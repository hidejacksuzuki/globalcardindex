/**
 * Future: collapse vendor-supplied title variants into a canonical form
 * so the same card from different marketplaces lines up.
 *
 * MVP: trim, lowercase, collapse whitespace.
 */

export function normalizeTitle(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}
