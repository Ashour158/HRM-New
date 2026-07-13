import { describe, expect, it } from 'vitest';
import {
  calculateMisclassificationRiskScore,
  MISCLASSIFICATION_MAX_SCORE,
  MISCLASSIFICATION_FACTOR_DEFINITIONS,
  type MisclassificationFactorInputs,
} from './misclassification-scoring.js';

const ALL_EMPLOYEE_LIKE: MisclassificationFactorInputs = {
  instructionsControl: true,
  trainingProvided: true,
  workScheduleSetByCompany: true,
  worksExclusivelyForCompany: true,
  toolsProvidedByCompany: true,
  expensesReimbursed: true,
  paidFixedRegularWage: true,
  opportunityForProfitOrLoss: false, // contractor-like when true, so false = employee-like
  significantInvestment: false, // contractor-like when true, so false = employee-like
  writtenContractIndicatesEmployee: true,
  employeeBenefitsProvided: true,
  relationshipIsIndefinite: true,
  servicesKeyToBusiness: true,
};

const ALL_CONTRACTOR_LIKE: MisclassificationFactorInputs = {
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

describe('MISCLASSIFICATION_FACTOR_DEFINITIONS', () => {
  it('weights sum to exactly 100 across the three IRS common-law categories', () => {
    expect(MISCLASSIFICATION_MAX_SCORE).toBe(100);
  });
});

describe('calculateMisclassificationRiskScore', () => {
  it('scores 100 (maximum risk) when every factor indicates an employee', () => {
    const result = calculateMisclassificationRiskScore(ALL_EMPLOYEE_LIKE);
    expect(result.riskScore).toBe(100);
    expect(result.riskFactors).toHaveLength(Object.keys(MISCLASSIFICATION_FACTOR_DEFINITIONS).length);
    expect(result.categoryScores).toEqual({ behavioralControl: 40, financialControl: 35, relationshipType: 25 });
  });

  it('scores 0 (minimum risk) when every factor indicates a genuine contractor', () => {
    const result = calculateMisclassificationRiskScore(ALL_CONTRACTOR_LIKE);
    expect(result.riskScore).toBe(0);
    expect(result.riskFactors).toEqual([]);
    expect(result.categoryScores).toEqual({ behavioralControl: 0, financialControl: 0, relationshipType: 0 });
  });

  it('computes a correct weighted score for a mixed set of factor inputs', () => {
    const mixed: MisclassificationFactorInputs = {
      ...ALL_CONTRACTOR_LIKE,
      instructionsControl: true, // +12, BEHAVIORAL_CONTROL
      workScheduleSetByCompany: true, // +12, BEHAVIORAL_CONTROL
      paidFixedRegularWage: true, // +8, FINANCIAL_CONTROL
      employeeBenefitsProvided: true, // +7, RELATIONSHIP_TYPE
    };

    const result = calculateMisclassificationRiskScore(mixed);

    expect(result.riskScore).toBe(12 + 12 + 8 + 7);
    expect(result.categoryScores).toEqual({ behavioralControl: 24, financialControl: 8, relationshipType: 7 });
    expect(result.riskFactors).toEqual(
      expect.arrayContaining([
        MISCLASSIFICATION_FACTOR_DEFINITIONS.instructionsControl.label,
        MISCLASSIFICATION_FACTOR_DEFINITIONS.workScheduleSetByCompany.label,
        MISCLASSIFICATION_FACTOR_DEFINITIONS.paidFixedRegularWage.label,
        MISCLASSIFICATION_FACTOR_DEFINITIONS.employeeBenefitsProvided.label,
      ]),
    );
    expect(result.riskFactors).toHaveLength(4);
  });

  it('treats opportunityForProfitOrLoss/significantInvestment as contractor-like signals that lower risk when true', () => {
    const onlyInvestmentFactorsFlipped: MisclassificationFactorInputs = {
      ...ALL_EMPLOYEE_LIKE,
      opportunityForProfitOrLoss: true,
      significantInvestment: true,
    };
    const result = calculateMisclassificationRiskScore(onlyInvestmentFactorsFlipped);
    // 100 minus the two contractor-signal weights (6 + 6)
    expect(result.riskScore).toBe(88);
    expect(result.riskFactors).not.toContain(MISCLASSIFICATION_FACTOR_DEFINITIONS.opportunityForProfitOrLoss.label);
    expect(result.riskFactors).not.toContain(MISCLASSIFICATION_FACTOR_DEFINITIONS.significantInvestment.label);
  });
});
