/**
 * scripts/seed.ts
 *
 * Seed the database with GCI standard sample data.
 *
 * Usage (from monorepo root):
 *   pnpm db:seed
 *   pnpm db:seed --dry        # validate only, no DB writes
 *   pnpm db:seed --file path/to/custom.csv
 *
 * Default seed file: data/seed.csv (relative to monorepo root)
 *
 * The script uses the same importCsv pipeline as the /admin/import UI,
 * so fingerprint dedup, trust score calculation, and source upserts all apply.
 */

import { readFileSync }  from "node:fs";
import { resolve }       from "node:path";
import { prisma }        from "@gci/db";
import { importCsv }     from "../apps/data/src/lib/collectors/csv";

// ── Args ──────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const isDry   = args.includes("--dry");
const fileArg = args.find((a) => a.startsWith("--file="))?.slice(7)
             ?? args[args.indexOf("--file") + 1];

const SEED_FILE = resolve(
  process.cwd(),
  fileArg ?? "data/seed.csv",
);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("GCI Seed");
  console.log("  file   :", SEED_FILE);
  console.log("  dry-run:", isDry);
  console.log();

  let buffer: Buffer;
  try {
    buffer = readFileSync(SEED_FILE);
  } catch {
    console.error(`✗ Could not read seed file: ${SEED_FILE}`);
    process.exit(1);
  }

  const summary = await importCsv(buffer, { dryRun: isDry });

  const ok = summary.errors.length === 0;

  console.log("Results:");
  console.log("  totalRows :", summary.totalRows);
  console.log("  imported  :", summary.imported, isDry ? "(dry-run — not written)" : "");
  console.log("  duplicate :", summary.duplicate);
  console.log("  skipped   :", summary.skipped);

  if (summary.errors.length > 0) {
    console.log();
    console.log("Errors:");
    for (const e of summary.errors) {
      console.log(`  row ${e.row}: ${e.reason}`);
    }
  }

  console.log();
  if (isDry) {
    console.log(ok ? "✓ Dry-run passed — run without --dry to write to DB." : "✗ Validation failed.");
  } else {
    console.log(ok ? "✓ Seed complete." : "✗ Seed completed with errors (see above).");
  }

  if (!ok) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
