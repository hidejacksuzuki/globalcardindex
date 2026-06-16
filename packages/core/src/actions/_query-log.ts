// Lightweight query timing helper — logs to stderr so Vercel captures it.
export async function timedQuery<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;

  const rows =
    Array.isArray(result) ? result.length
    : result !== null && typeof result === "object" && "cards" in result &&
      Array.isArray((result as Record<string, unknown>)["cards"])
      ? ((result as Record<string, unknown[]>)["cards"].length)
      : 1;

  const sizeKb = Math.round(JSON.stringify(result).length / 1024);

  console.log(
    `[query] ${label} rows=${rows} size=${sizeKb}kb time=${ms}ms`,
  );

  return result;
}
