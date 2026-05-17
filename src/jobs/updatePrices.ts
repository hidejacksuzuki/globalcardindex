/**
 * Future: pull fresh prices from configured collectors on a schedule.
 * For MVP CSV is the only ingestion path — see scripts/import-csv.ts.
 */

export async function updatePrices(): Promise<never> {
  throw new Error("updatePrices job not implemented");
}
