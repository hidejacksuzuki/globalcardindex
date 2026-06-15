"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/daily",        label: "Daily ✦"     },
  { href: "/admin/prices",       label: "Prices"       },
  { href: "/admin/sources",      label: "Sources"      },
  { href: "/admin/index",        label: "Index"        },
  { href: "/admin/logs",         label: "Logs"         },
  { href: "/admin/distribution", label: "Distribution" },
  { href: "/admin/newsletter",   label: "Newsletter"   },
  { href: "/admin/import",       label: "Import"       },
  { href: "/admin/cards",        label: "Cards"        },
  { href: "/admin/cards/add",    label: "＋ Add Cards"  },
  { href: "/admin/collector",    label: "Collector"    },
  { href: "/admin/card-requests", label: "Requests"    },
  { href: "/admin/bookmarklet",    label: "Bookmarklet" },
  { href: "/admin/cards/auto-add", label: "Auto Add"   },
  { href: "/admin/prices/inbox",   label: "Inbox"      },
  { href: "/admin/extension",      label: "Extension"  },
  { href: "/admin/ebay-aliases",   label: "eBay Alias" },
  { href: "/admin/collector/ebay", label: "eBay Collect" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      {/* Admin サブナビゲーション */}
      <nav className="mb-8 flex gap-1 border-b border-navy/10">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "px-4 py-2.5 text-xs uppercase tracking-widest transition -mb-px border-b-2",
                active
                  ? "border-navy text-navy font-medium"
                  : "border-transparent text-navy/40 hover:text-navy/70 hover:border-navy/20",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
