"use client";

import { useState, useEffect } from "react";
import Link                     from "next/link";
import { usePathname }          from "next/navigation";

type NavLink = { href: string; label: string; desktop?: string };

type Props = {
  links:           NavLink[];
  newsletterLabel: string;
};

export function MobileMenu({ links, newsletterLabel }: Props) {
  const [open,    setOpen]    = useState(false);
  const pathname              = usePathname();

  // パス変更時に閉じる
  useEffect(() => { setOpen(false); }, [pathname]);
  // 開いている間 body スクロール無効
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="sm:hidden">
      {/* ハンバーガー */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
      >
        <span className={`block w-5 h-px bg-navy transition-all ${open ? "rotate-45 translate-y-[4px]" : ""}`} />
        <span className={`block w-5 h-px bg-navy transition-all ${open ? "opacity-0" : ""}`} />
        <span className={`block w-5 h-px bg-navy transition-all ${open ? "-rotate-45 -translate-y-[4px]" : ""}`} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 z-50 w-64 bg-white border-l border-navy/10 shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy/5">
          <span className="text-xs uppercase tracking-widest text-navy/50">Menu</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="閉じる"
            className="text-navy/30 hover:text-navy transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-col py-2">
          {links.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-5 py-3 text-sm transition border-l-2 ${
                  active
                    ? "border-navy text-navy font-medium bg-navy/[0.03]"
                    : "border-transparent text-navy/60 hover:text-navy hover:bg-navy/[0.02]"
                }`}
              >
                {label}
              </Link>
            );
          })}

          <div className="px-5 pt-3 mt-1 border-t border-navy/5">
            <Link
              href="/newsletter"
              className="block w-full text-center border border-gold/60 bg-gold/5 px-3 py-2 text-xs font-medium text-navy/70 hover:bg-gold/10 transition"
            >
              {newsletterLabel}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
