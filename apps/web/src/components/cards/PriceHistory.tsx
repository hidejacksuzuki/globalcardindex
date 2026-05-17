import { formatDateTime } from "@gci/core";
import { formatPrice } from "@gci/core";
import type { PriceRecord } from "@gci/core";

type Props = {
  prices: PriceRecord[];
};

export function PriceHistory({ prices }: Props) {
  if (prices.length === 0) {
    return (
      <p className="border border-navy/10 bg-white p-6 text-sm text-navy/50">
        No price observations recorded.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <table className="min-w-full divide-y divide-navy/10 text-sm">
        <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/60">
          <tr>
            <th className="px-4 py-3">Observed</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Trust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {prices.map((p) => (
            <tr key={p.id} className="text-navy/80">
              <td className="px-4 py-3 tabular-nums">
                {formatDateTime(p.observedAt)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {formatPrice(p.price, p.currency)}
              </td>
              <td className="px-4 py-3">
                {p.sourceName}{" "}
                <span className="text-navy/40">({p.sourceType})</span>
              </td>
              <td className="px-4 py-3 tabular-nums">{p.trustScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
