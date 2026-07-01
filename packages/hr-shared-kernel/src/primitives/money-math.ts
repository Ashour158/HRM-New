/**
 * Rounds a floating-point amount to 2 decimal places (cents), correcting for
 * binary floating-point representation error (e.g. 1.005 * 100 === 100.49999999999999
 * without the Number.EPSILON nudge) before the final rounding step.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
