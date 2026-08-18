/**
 * games.ts
 * サポートするカードゲームの静的設定。
 * slug → 表示名・説明・カラーのマッピングを管理する。
 */

export type GameConfig = {
  slug:        string;   // URL キー e.g. "pokemon"
  name:        string;   // 表示名 e.g. "Pokémon TCG"
  nameJa:      string;   // 日本語名
  description: string;   // SEO meta description 用（日本語）
  descriptionEn: string;  // SEO meta description 用（英語 /en）
  color:       string;   // Tailwind テキスト色クラス（ブランドカラー）
  bgColor:     string;   // Tailwind 背景色クラス
  emoji:       string;   // 代表絵文字
};

export const GAMES: GameConfig[] = [
  {
    slug:        "pokemon",
    name:        "Pokémon TCG",
    nameJa:      "ポケモンカード",
    description: "Pokémon TCG（ポケモンカードゲーム）の市場価格指数・相場データを提供。レアリティ・状態別の価格推移をリアルタイムで追跡。",
    descriptionEn: "Pokémon TCG market price index and price guide. Track price history of SAR, SR and other rare cards by rarity and condition, aggregated from real Japanese market sales.",
    color:       "text-yellow-600",
    bgColor:     "bg-yellow-50",
    emoji:       "⚡",
  },
  {
    slug:        "onepiece",
    name:        "One Piece Card Game",
    nameJa:      "ワンピースカード",
    description: "One Piece Card Game（ワンピースカードゲーム）の市場価格指数・相場データ。SR・SEC・リーダーなど希少カードの価格変動を追跡。",
    descriptionEn: "One Piece Card Game market price index and price guide. Track SEC, SR and Leader parallel card prices aggregated from real Japanese market sales.",
    color:       "text-red-600",
    bgColor:     "bg-red-50",
    emoji:       "⚓",
  },
  {
    slug:        "yugioh",
    name:        "Yu-Gi-Oh! OCG",
    nameJa:      "遊戯王OCG",
    description: "遊戯王OCGの市場価格指数・相場データ。スーパーレア・ウルトラレア・シークレットレアの価格推移を追跡。",
    descriptionEn: "Yu-Gi-Oh! OCG market price index and price guide. Track Secret Rare, Ultra Rare and 20th/25th anniversary card prices from the Japanese market.",
    color:       "text-purple-600",
    bgColor:     "bg-purple-50",
    emoji:       "🃏",
  },
  {
    slug:        "mtg",
    name:        "Magic: The Gathering",
    nameJa:      "マジック：ザ・ギャザリング",
    description: "Magic: The Gathering（マジック：ザ・ギャザリング）の市場価格指数・相場データ。日本語版・英語版の価格比較。",
    descriptionEn: "Magic: The Gathering market price index and price guide. Track Power 9, dual lands and reserved list card prices from the Japanese market.",
    color:       "text-blue-600",
    bgColor:     "bg-blue-50",
    emoji:       "✨",
  },
];

/** slug からゲーム設定を取得（見つからなければ undefined） */
export function getGame(slug: string): GameConfig | undefined {
  return GAMES.find((g) => g.slug === slug);
}

/** すべての slug を返す（generateStaticParams 用） */
export function getGameSlugs(): string[] {
  return GAMES.map((g) => g.slug);
}
