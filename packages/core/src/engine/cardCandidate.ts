/**
 * parseCardCandidates
 *
 * 複数行テキストから CardCandidate を自動推定する。
 * 1行 = 1候補。
 *
 * 入力例:
 *   ナンジャモ SAR sv2D クレイバースト raw
 *   Black Lotus Alpha PSA10
 *   モンキー・D・ルフィ SEC OP01 ROMANCE DAWN NM
 */

export type CardCandidateInput = {
  inputText:     string;
  game:          string | null;
  name:          string;
  rarity:        string | null;
  version:       string | null;
  condition:     string;
  searchKeyword: string;
  confidence:    number;
};

// ゲーム推定
const GAME_HINTS: { pattern: RegExp; game: string }[] = [
  {
    pattern: /\b(sv\d|SV\d|ポケモン|ピカチュウ|リザードン|ミュウ|ルギア|ゲンガー|イーブイ|マスカーニャ|ナンジャモ|ミモザ|キハダ|カイリュー|アルセウス)\b/i,
    game: "pokemon",
  },
  {
    pattern: /\b(OP\d{2}|ルフィ|ゾロ|エース|ナミ|ロー|ワンピース|ROMANCE DAWN|PARAMOUNT WAR)\b/i,
    game: "onepiece",
  },
  {
    pattern: /\b(CHIM|ETCO|DAMA|遊戯王|増殖する|マスカレーナ|シークレット|JP\d{3})\b/i,
    game: "yugioh",
  },
  {
    pattern: /\b(Alpha|Beta|Revised|Magic|Lotus|Mox|Ancestral|Timetwister|LTR|MTG)\b/i,
    game: "mtg",
  },
];

// レアリティパターン（優先度順）
const RARITY_PATTERNS: RegExp[] = [
  /\b(25thシークレット|20thシークレット|10000シークレット)\b/,
  /\b(Borderless Foil)\b/,
  /\b(SAR|CSR|SSR|PSA10|PSA9|PSA8|SEC)\b/i,
  /\b(SR|UR|HR|AR|CHR|TR|SP|SA)\b/,
  /\b(Alpha|Beta|Revised)\b/i,
  /\b(R|C)\b/,
];

// コンディション
const CONDITION_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /\bpsa\s?10\b/i, value: "PSA10" },
  { pattern: /\bpsa\s?9\b/i,  value: "PSA9"  },
  { pattern: /\bpsa\s?8\b/i,  value: "PSA8"  },
  { pattern: /\b(NM)\b/,      value: "NM"    },
  { pattern: /\b(LP)\b/,      value: "LP"    },
  { pattern: /\b(MP)\b/,      value: "MP"    },
  { pattern: /\braw\b/i,      value: "raw"   },
];

// セットコードパターン
const SET_CODE_PATTERN =
  /\b(sv\d[a-z]?|OP\d{2}|CHIM|ETCO|DAMA|FLOD|LTR|Alpha|Beta|Revised)\b/i;

export function parseCardCandidates(lines: string[]): CardCandidateInput[] {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((inputText) => {
      // ゲーム推定
      let game: string | null = null;
      for (const { pattern, game: g } of GAME_HINTS) {
        if (pattern.test(inputText)) { game = g; break; }
      }

      // レアリティ
      let rarity: string | null = null;
      for (const pat of RARITY_PATTERNS) {
        const m = inputText.match(pat);
        if (m) { rarity = m[1] ?? m[0]; break; }
      }

      // コンディション
      let condition = "raw";
      for (const { pattern, value } of CONDITION_PATTERNS) {
        if (pattern.test(inputText)) { condition = value; break; }
      }

      // バージョン（セットコード）
      const versionMatch = inputText.match(SET_CODE_PATTERN);
      const version = versionMatch ? versionMatch[0] : null;

      // name: 既知のトークンを除去して残りをカード名とみなす
      const removeTokens = [
        rarity, version, condition,
        "PSA10", "PSA9", "PSA8", "NM", "LP", "MP", "raw",
      ].filter(Boolean);

      let name = inputText;
      for (const token of removeTokens) {
        if (token) {
          name = name.replace(new RegExp(`\\b${token}\\b`, "gi"), "");
        }
      }
      name = name.replace(/\s+/g, " ").trim();
      if (!name) name = inputText.trim();

      // searchKeyword
      const searchKeyword = [name, rarity, version]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // confidence
      let confidence = 0;
      if (game)                    confidence += 20;
      if (name && name.length >= 2) confidence += 30;
      if (rarity)                  confidence += 25;
      if (version)                 confidence += 15;
      if (condition !== "raw")     confidence += 10;
      confidence = Math.min(100, confidence);

      return { inputText, game, name, rarity, version, condition, searchKeyword, confidence };
    });
}
