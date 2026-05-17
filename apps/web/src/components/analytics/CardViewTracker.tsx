"use client";

/**
 * CardViewTracker
 *
 * Tiny client component that fires a Plausible "Card View" event once,
 * on initial mount. Drop it anywhere inside a Server Component tree.
 *
 * Usage:
 *   <CardViewTracker slug={card.slug ?? card.id} />
 */

import { useEffect } from "react";
import { trackCardView } from "./PlausibleAnalytics";

export function CardViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackCardView(slug);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);          // run once on mount only
  return null;     // renders nothing
}
