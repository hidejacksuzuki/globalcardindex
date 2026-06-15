// Shared constants and types for admin/cards.
// No "use client" here so server components can import freely.

export type GameCounts = {
  all:     number;
  visible: number;
  hidden:  number;
  orphan:  number;
  merged:  number;
  deleted: number;
};

export type GlobalCounts = {
  duplicates: number;
  orphans:    number;
  requests:   number;
  recent:     number;
};

export type SidebarCounts = {
  games:  Record<string, GameCounts>;
  global: GlobalCounts;
};

export const SIDEBAR_GAMES = [
  { key: "mtg",         label: "MTG"        },
  { key: "duelmasters", label: "デュエマ"   },
  { key: "pokemon",     label: "ポケモン"   },
  { key: "onepiece",    label: "ワンピース"  },
  { key: "yugioh",      label: "遊戯王"     },
] as const;

export type SidebarGameKey = typeof SIDEBAR_GAMES[number]["key"];
