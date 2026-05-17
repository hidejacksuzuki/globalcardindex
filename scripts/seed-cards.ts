/**
 * scripts/seed-cards.ts
 *
 * Upserts the static card catalog (Pokémon TCG + One Piece Card Game)
 * into the database. Does NOT import price data — cards are created
 * so the collector can begin gathering prices against them.
 *
 * Usage (from monorepo root):
 *   pnpm db:seed-cards           # upsert all cards
 *   pnpm db:seed-cards --dry     # validate & count only
 *   pnpm db:seed-cards --game=pokemon    # one game only
 *   pnpm db:seed-cards --game=onepiece   # one game only
 */

import { prisma }    from "@gci/db";
import { slugify }   from "@gci/core";
import { ALL_CARDS, getCardsByGame, type CardSeed } from "../data/seed-cards";

// ── Args ──────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const isDry   = args.includes("--dry");
const gameArg = args.find((a) => a.startsWith("--game="))?.slice(7);

const cards: CardSeed[] = gameArg ? getCardsByGame(gameArg) : ALL_CARDS;

// ── Slug helpers ──────────────────────────────────────────────────────────────

/**
 * Extract a short set code from a set name.
 * "SV4a シャイニートレジャーex" → "sv4a"
 * "OP-04 Kingdoms of Intrigue" → "op-04"
 * "Base Set"                   → "base-set"
 */
function setCode(setName: string): string {
  // Leading code patterns: SV4a, OP-04, SWSH11, BW9, etc.
  const leading = setName.match(/^([A-Za-z]{1,6}[-]?\d{1,3}[A-Za-z]?)\b/);
  if (leading) return slugify(leading[1]);

  // Bracketed codes: (SV4a), (OP-04)
  const bracketed = setName.match(/\(([A-Za-z0-9\-]+)\)/);
  if (bracketed) return slugify(bracketed[1]);

  // Fallback: first 3 words slugified
  return slugify(setName.split(/\s+/).slice(0, 3).join(" "));
}

function buildSlug(card: CardSeed): string {
  return [
    slugify(card.name),
    setCode(card.setName),
    slugify(card.rarity),
    slugify(card.condition),
  ]
    .filter(Boolean)
    .join("-");
}

// ── Duplicate slug resolution ─────────────────────────────────────────────────

function resolveSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) { used.add(base); return base; }
  let n = 1;
  while (used.has(`${base}-${n}`)) n++;
  const s = `${base}-${n}`;
  used.add(s);
  return s;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("GCI Card Seed");
  console.log(`  dry-run : ${isDry}`);
  console.log(`  game    : ${gameArg ?? "all"}`);
  console.log(`  cards   : ${cards.length}`);
  console.log();

  // Load existing slugs to avoid collisions
  const existingSlugs = await prisma.card.findMany({
    select: { slug: true },
    where:  { slug: { not: null } },
  });
  const usedSlugs = new Set(existingSlugs.map((c) => c.slug!));

  let created  = 0;
  let skipped  = 0;
  let errored  = 0;

  for (const card of cards) {
    const baseSlug = buildSlug(card);
    if (!baseSlug) {
      console.warn(`  ⚠ slug empty — skipping: ${JSON.stringify(card)}`);
      skipped++;
      continue;
    }

    const slug = resolveSlug(baseSlug, usedSlugs);

    if (isDry) {
      console.log(`  → [${card.game}] "${card.name}" ${card.setName} (${card.rarity} / ${card.condition}) : ${slug}`);
      created++;
      continue;
    }

    try {
      await prisma.card.upsert({
        where: {
          name_setName_rarity_condition: {
            name:      card.name,
            setName:   card.setName,
            rarity:    card.rarity,
            condition: card.condition,
          },
        },
        update: {
          game: card.game,
          // Only update slug if currently null (don't overwrite manually set slugs)
          ...(slug ? { slug } : {}),
        },
        create: {
          name:      card.name,
          setName:   card.setName,
          rarity:    card.rarity,
          condition: card.condition,
          game:      card.game,
          slug,
        },
      });
      created++;
    } catch (err) {
      console.error(`  ✗ failed: "${card.name}" ${card.setName} — ${err instanceof Error ? err.message : err}`);
      errored++;
    }

    // Progress dot every 20 cards
    if (created % 20 === 0) process.stdout.write(".");
  }

  if (created >= 20) console.log(); // newline after dots

  console.log();
  console.log("Results:");
  console.log(`  created/updated : ${created}${isDry ? " (dry-run — not written)" : ""}`);
  console.log(`  skipped         : ${skipped}`);
  console.log(`  errored         : ${errored}`);

  if (errored > 0) {
    console.log();
    console.log("✗ Completed with errors.");
    process.exitCode = 1;
  } else {
    console.log();
    console.log(isDry ? "✓ Dry-run passed — run without --dry to write to DB." : "✓ Card seed complete.");
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
