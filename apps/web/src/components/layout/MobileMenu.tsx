"use client";

import { useState, useEffect } from "react";
import Link                     from "next/link";
import { usePathname }          from "next/navigation";

type NavLink = { href: string; label: string; desktop?: string };

type Props = {
  links:  NavLink[];
  userId: string | null;
};

export function MobileMenu({ links, userId }: Props) {
  const [open,    setOpen]    = useState(false);
  const pathname              = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
      >
        <span className={`block w-5 h-px bg-navy transition-all ${open ? "rotate-45 translate-y-[4px]" : ""}`} />
        <span className={`block w-5 h-px bg-navy transition-all ${open ? "opacity-0" : ""}`} />
        <span className={`block w-5 h-px bg-navy transition-all ${open ? "-rotate-45 -translate-y-[4px]" : ""}`} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <div className={`fixed top-0 right-0 bottom-0 z-50 w-64 bg-white border-l border-navy/10 shadow-xl transition-[transform,visibility] duration-200 ${open ? "translate-x-0 visible" : "translate-x-full invisible"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy/5">
          <span className="text-xs uppercase tracking-widest text-navy/50">Menu</span>
          <button onClick={() => setOpen(false)} className="text-navy/30 hover:text-navy transition text-xl leading-none">✕</button>
        </div>

        <nav className="flex flex-col py-2 overflow-y-auto">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
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

          <div className="px-5 pt-4 mt-2 border-t border-navy/5 space-y-2">
            {userId ? (
              <Link href="/account" className="block w-full text-center border border-navy/15 px-3 py-2 text-xs text-navy/60 hover:text-navy hover:border-navy/40 transition">
                マイページ
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="flex-1 text-center border border-navy/15 px-3 py-2 text-xs text-navy/60 hover:text-navy transition">
                  ログイン
                </Link>
                <Link href="/login" className="flex-1 text-center border border-navy bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy/80 transition">
                  登録
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
