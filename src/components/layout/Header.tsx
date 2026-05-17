import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-navy/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-navy">
            GCI
          </span>
          <span className="text-xs uppercase tracking-widest text-navy/50">
            Global Card Index
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-navy/70">
          <Link href="/games" className="transition hover:text-navy">
            Games
          </Link>
          <Link href="/daily" className="transition hover:text-navy font-medium">
            Daily
          </Link>
          <Link href="/trending" className="transition hover:text-navy">
            🔥 Trending
          </Link>
          <Link href="/indices" className="transition hover:text-navy">
            Indices
          </Link>
          <Link href="/marketboard" className="transition hover:text-navy">
            Marketboard
          </Link>
          <Link href="/cards" className="transition hover:text-navy">
            Cards
          </Link>
          <Link
            href="/watchlist"
            className="transition hover:text-navy"
          >
            ☆ Watchlist
          </Link>
          <Link
            href="/admin/prices"
            className="rounded border border-navy/20 px-2.5 py-1 text-xs uppercase tracking-widest text-navy/40 transition hover:border-navy/40 hover:text-navy/70"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
