/**
 * Date formatting utilities — locale-aware.
 *
 * All functions accept an optional `locale` (BCP 47) parameter.
 * Defaults to "ja-JP" for backward compatibility.
 */

function normalizeLocale(locale: string): string {
  const map: Record<string, string> = {
    ja: "ja-JP",
    en: "en-US",
    ko: "ko-KR",
    zh: "zh-CN",
  };
  return map[locale] ?? locale;
}

export function formatDate(value: string | Date, locale = "ja-JP"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(normalizeLocale(locale), {
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  });
}

export function formatDateTime(value: string | Date, locale = "ja-JP"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(normalizeLocale(locale), {
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

/** Short relative label: "Today", "Yesterday", or a formatted date. */
export function formatRelativeDate(value: string | Date, locale = "ja-JP"): string {
  const d   = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

  if (diffDays === 0) return locale.startsWith("ja") ? "今日"      : "Today";
  if (diffDays === 1) return locale.startsWith("ja") ? "昨日"      : "Yesterday";
  if (diffDays === 2) return locale.startsWith("ja") ? "一昨日"    : "2 days ago";

  return formatDate(d, locale);
}
