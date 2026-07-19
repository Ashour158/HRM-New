import { describe, expect, it } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { MisclassificationAssessment } from './misclassification-assessment.aggregate.js';
import type { MisclassificationFactorInputs } from '../services/misclassification-scoring.js';

const EMPLOYEE_LIKE_FACTORS: MisclassificationFactorInputs = {
  instructionsControl: true,
  trainingProvided: true,
  workScheduleSetByCompany: true,
  worksExclusivelyForCompany: true,
  toolsProvidedByCompany: true,
  expensesReimbursed: true,
  paidFixedRegularWage: true,
  opportunityForProfitOrLoss: false,
  significantInvestment: false,
  writtenContractIndicatesEmployee: true,
  employeeBenefitsProvided: true,
  relationshipIsIndefinite: true,
  servicesKeyToBusiness: true,
};

const CONTRACTOR_LIKE_FACTORS: MisclassificationFactorInputs = {
  instructionsControl: false,
  trainingProvided: false,
  workScheduleSetByCompany: false,
  worksExclusivelyForCompany: false,
  toolsProvidedByCompany: false,
  expensesReimbursed: false,
  paidFixedRegularWage: false,
  opportunityForProfitOrLoss: true,
  significantInvestment: true,
  writtenContractIndicatesEmployee: false,
  employeeBenefitsProvided: false,
  relationshipIsIndefinite: false,
  servicesKeyToBusiness: false,
};

function createAssessment(factorInputs: MisclassificationFactorInputs): MisclassificationAssessment {
  return MisclassificationAssessment.create(
    {
      id: Uuid.generate(),
      tenantId: Uuid.generate(),
      workerId: Uuid.generate(),
      assessmentDate: new Date('2026-07-01'),
      factorInputs,
    },
    Uuid.generate(),
  );
}

describe('MisclassificationAssessment aggregate', () => {
  it('computes riskScore/riskFactors from structured factorInputs on creation rather than accepting a raw number', () => {
    const assessment = createAssessment(EMPLOYEE_LIKE_FACTORS);
    expect(assessment.riskScore).toBe(100);
    expect(assessment.riskFactors?.length).toBeGreaterThan(0);
    expect(assessment.status).toBe('PENDING');
  });

  it('requires factorInputs to create an assessment', () => {
    expect(() =>
      MisclassificationAssessment.create(
        {
          id: Uuid.generate(),
          tenantId: Uuid.generate(),
          workerId: Uuid.generate(),
          assessmentDate: new Date('2026-07-01'),
        },
        Uuid.generate(),
      ),
    ).toThrow();
  });

  it('recalculates the score only while IN_PROGRESS, and reflects new factor inputs', () => {
    const assessment = createAssessment(CONTRACTOR_LIKE_FACTORS);
    expect(assessment.riskScore).toBe(0);

    // Not started yet -> recalculation is rejected.
    expect(() => assessment.recalculateScore(EMPLOYEE_LIKE_FACTORS, Uuid.generate())).toThrow(ValidationError);

    assessment.start(Uuid.generate());
    expect(assessment.status).toBe('IN_PROGRESS');

    const versionBeforeRecalc = assessment.aggregateVersion;
    assessment.recalculateScore(EMPLOYEE_LIKE_FACTORS, Uuid.generate());

    expect(assessment.riskScore).toBe(100);
    expect(assessment.factorInputs).toEqual(EMPLOYEE_LIKE_FACTORS);
    expect(assessment.aggregateVersion).toBe(versionBeforeRecalc + 1);
    expect(assessment.domainEvents.some((e) => e.eventName === 'MisclassificationScoreRecalculated')).toBe(true);
  });

  it('rejects recalculation once the assessment has been cleared or flagged', () => {
    const assessment = createAssessment(CONTRACTOR_LIKE_FACTORS);
    assessment.start(Uuid.generate());
    assessment.clear(Uuid.generate());

    expect(() => assessment.recalculateScore(EMPLOYEE_LIKE_FACTORS, Uuid.generate())).toThrow(ValidationError);
  });
});
