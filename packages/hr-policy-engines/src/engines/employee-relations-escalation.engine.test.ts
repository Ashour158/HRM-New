import { describe, expect, it } from 'vitest';
import { evaluateDisciplinaryEscalation, type DisciplinaryEscalationInput } from './employee-relations-escalation.engine.js';

function input(overrides: Partial<DisciplinaryEscalationInput> = {}): DisciplinaryEscalationInput {
  return { severity: 'LOW', legalReviewCompleted: false, ...overrides };
}

describe('evaluateDisciplinaryEscalation', () => {
  it('LOW severity never requires legal review and always finalizes', () => {
    const r = evaluateDisciplinaryEscalation(input({ severity: 'LOW' }));
    expect(r.requiresLegalReview).toBe(false);
    expect(r.canFinalize).toBe(true);
    expect(r.decisionCode).toBe('APPROVED');
  });

  it('MEDIUM severity does not require legal review by default (threshold = HIGH)', () => {
    const r = evaluateDisciplinaryEscalation(input({ severity: 'MEDIUM' }));
    expect(r.requiresLegalReview).toBe(false);
    expect(r.canFinalize).toBe(true);
  });

  it('HIGH severity requires legal review and blocks finalization when not completed', () => {
    const r = evaluateDisciplinaryEscalation(input({ severity: 'HIGH', legalReviewCompleted: false }));
    expect(r.requiresLegalReview).toBe(true);
    expect(r.canFinalize).toBe(false);
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
  });

  it('HIGH severity finalizes once legal review is recorded', () => {
    const r = evaluateDisciplinaryEscalation(input({ severity: 'HIGH', legalReviewCompleted: true }));
    expect(r.requiresLegalReview).toBe(true);
    expect(r.canFinalize).toBe(true);
    expect(r.decisionCode).toBe('APPROVED');
  });

  it('honours a configurable, lower severity threshold', () => {
    const r = evaluateDisciplinaryEscalation(
      input({ severity: 'MEDIUM', legalReviewCompleted: false, legalReviewSeverityThreshold: 'MEDIUM' }),
    );
    expect(r.requiresLegalReview).toBe(true);
    expect(r.canFinalize).toBe(false);
  });
});
