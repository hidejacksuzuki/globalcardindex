"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SIDEBAR_GAMES } from "./_shared";
import type { SidebarCounts, GameCounts, GlobalCounts } from "./_shared";

// Re-export for consumers that used to import from this file
export type { GameCounts, GlobalCounts, SidebarCounts };
export { SIDEBAR_GAMES };

const GAME_VIEWS = [
  { key: "all",     label: "全カード"   },
  { key: "visible", label: "公開中"     },
  { key: "hidden",  label: "非公開"     },
  { key: "orphan",  label: "未確認"     },
  { key: "merged",  label: "統合候補"   },
  { key: "deleted", label: "削除候補"   },
] as const;

const GLOBAL_VIEWS = [
  { key: "duplicates", label: "重複候補"      },
  { key: "orphans",    label: "価格未登録"    },
  { key: "requests",   label: "人気リクエスト" },
  { key: "recent",     label: "最近追加"      },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function navLink(game: string | null, view: string | null): string {
  const p = new URLSearchParams();
  if (game) p.set("game", game);
  if (view) p.set("view", view);
  const qs = p.toString();
  return `/admin/cards${qs ? "?" + qs : ""}`;
}

function Badge({ n, alert = false }: { n: number; alert?: boolean }) {
  if (n === 0) return null;
  return (
    <span
      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none ${
        alert ? "bg-red-100 text-red-600" : "bg-navy/10 text-navy/50"
      }`}
    >
      {n.toLocaleString()}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CardSidebar({ counts }: { counts: SidebarCounts }) {
  const sp          = useSearchParams();
  const currentGame = sp.get("game");
  const currentView = sp.get("view");
  const isDashboard = !currentGame && !currentView;

  return (
    <nav className="space-y-0.5">
      {/* ダッシュボード */}
      <Link
        href="/admin/cards"
        className={`flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
          isDashboard
            ? "bg-navy text-white"
            : "text-navy/60 hover:bg-navy/5 hover:text-navy"
        }`}
      >
        ダッシュボード
      </Link>

      {/* ゲーム別 */}
      <div className="pt-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-navy/30">
          ゲーム別
        </p>
        <div className="space-y-0.5">
          {SIDEBAR_GAMES.map((g) => {
            const gc         = counts.games[g.key];
            const isExpanded = currentGame === g.key;

            return (
              <div key={g.key}>
                <Link
                  href={navLink(g.key, "all")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                    isExpanded
                      ? "font-semibold text-navy"
                      : "text-navy/60 hover:bg-navy/5 hover:text-navy"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isExpanded ? "bg-navy" : "bg-navy/20"
                    }`}
                  />
                  {g.label}
                  {gc && <Badge n={gc.all} />}
                </Link>

                {isExpanded && (
                  <div className="ml-5 space-y-0.5 border-l border-navy/10 pl-2.5 pb-1">
                    {GAME_VIEWS.map((v) => {
                      const count    = gc ? (gc[v.key as keyof GameCounts] as number) : 0;
                      const isActive = currentGame === g.key && currentView === v.key;
                      const isAlert  = (v.key === "merged" || v.key === "deleted") && count > 0;
                      return (
                        <Link
                          key={v.key}
                          href={navLink(g.key, v.key)}
                          className={`flex items-center rounded px-2 py-1.5 text-[11px] transition-colors ${
                            isActive
                              ? "bg-navy/10 font-medium text-navy"
                              : "text-navy/50 hover:bg-navy/5 hover:text-navy"
                          }`}
                        >
                          {v.label}
                          <Badge n={count} alert={isAlert} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 全ゲーム横断 */}
      <div className="pt-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-navy/30">
          全ゲーム横断
        </p>
        <div className="space-y-0.5">
          {GLOBAL_VIEWS.map((v) => {
            const count    = counts.global[v.key as keyof GlobalCounts] as number;
            const isActive = !currentGame && currentView === v.key;
            const isAlert  = v.key === "duplicates" && count > 0;
            return (
              <Link
                key={v.key}
                href={navLink(null, v.key)}
                className={`flex items-center rounded-md px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "bg-navy/10 font-medium text-navy"
                    : "text-navy/60 hover:bg-navy/5 hover:text-navy"
                }`}
              >
                {v.label}
                <Badge n={count} alert={isAlert} />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
