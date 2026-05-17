/**
 * packages/core/src/auth/timingSafeEqual.ts
 *
 * Constant-time string comparison — safe against timing attacks.
 *
 * Works in both Node.js and Edge Runtime (no Node-specific APIs).
 * The comparison always iterates the full length of `a` regardless of
 * whether a mismatch is found early, preventing timing-based secret extraction.
 *
 * Algorithm:
 *   1. If lengths differ, continue comparing against `b` with wrap-around
 *      indexing to avoid short-circuit but always return false.
 *   2. XOR each char code pair and OR into an accumulator.
 *   3. Return true only if accumulator is 0 AND lengths matched.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  const lengthsMatch = lenA === lenB;

  // Always iterate lenA characters to keep timing constant
  let result = 0;
  for (let i = 0; i < lenA; i++) {
    // If b is shorter, wrap index to avoid out-of-bounds (still returns false due to lengthsMatch)
    result |= a.charCodeAt(i) ^ b.charCodeAt(i % lenB);
  }

  return lengthsMatch && result === 0;
}
