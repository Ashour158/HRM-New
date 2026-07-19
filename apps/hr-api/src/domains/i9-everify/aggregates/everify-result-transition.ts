import { ValidationError } from '@hcm/shared-kernel';
import type { EverifyResult } from './i9-case.aggregate.js';

/**
 * The three phases the E-Verify determination rule cares about, factored out
 * of {@link I9Case.resolveEverifyResultTransition} and
 * {@link EverifyCase.resolveResultTransition} - which enforce the exact same
 * "which `EverifyResult` values are legal from which point in the
 * determination lifecycle" rule against two differently-named status enums -
 * so the rule itself only has to be got right, and changed, in one place.
 */
export type EverifyResultPhase = 'AWAITING_FIRST_DETERMINATION' | 'UNCONTESTED_TNC' | 'CONTESTED_TNC';

/**
 * Throws a {@link ValidationError} if `result` is not a legal determination
 * from `phase`. Callers are responsible for mapping their own status enum to
 * an {@link EverifyResultPhase} and for mapping a validated `result` back to
 * their own target status (see the two call sites for the exact mapping).
 */
export function assertValidEverifyResult(phase: EverifyResultPhase, result: EverifyResult): void {
  if (phase === 'AWAITING_FIRST_DETERMINATION') {
    if (result !== 'CONFIRMED' && result !== 'TENTATIVE_NONCONFIRMATION') {
      throw new ValidationError('A first E-Verify determination must be CONFIRMED or TENTATIVE_NONCONFIRMATION');
    }
    return;
  }
  if (phase === 'UNCONTESTED_TNC') {
    if (result !== 'FINAL_NONCONFIRMATION') {
      throw new ValidationError('An uncontested tentative nonconfirmation can only resolve to FINAL_NONCONFIRMATION');
    }
    return;
  }
  if (result !== 'CONFIRMED' && result !== 'FINAL_NONCONFIRMATION') {
    throw new ValidationError('A contested tentative nonconfirmation must resolve to CONFIRMED or FINAL_NONCONFIRMATION');
  }
}
