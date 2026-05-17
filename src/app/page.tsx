import Link from "next/link";
import { getLatestIndex } from "@/actions";
import { IndexHero } from "@/components/index/IndexHero";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await getLatestIndex();

  return (
    <div className="space-y-10">
      <IndexHero snapshot={snapshot} />

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/indices"
          className="border border-navy/10 bg-white p-6 transition hover:border-gold"
        >
          <p className="text-xs uppercase tracking-widest text-navy/50">
            Explore
          </p>
          <p className="mt-2 text-lg font-medium text-navy">Indices</p>
          <p className="mt-1 text-sm text-navy/60">
            Historical GCI values and changes over time.
          </p>
        </Link>
        <Link
          href="/marketboard"
          className="border border-navy/10 bg-white p-6 transition hover:border-gold"
        >
          <p className="text-xs uppercase tracking-widest text-navy/50">
            Explore
          </p>
          <p className="mt-2 text-lg font-medium text-navy">Marketboard</p>
          <p className="mt-1 text-sm text-navy/60">
            Latest prices and movement across tracked cards.
          </p>
        </Link>
      </section>
    </div>
  );
}
