/**
 * Worker misclassification risk scoring engine.
 *
 * Implements the IRS common-law test — the modern 3-category consolidation
 * of the original "20-factor test" the IRS itself now uses (Behavioral
 * Control, Financial Control, Type of Relationship; see IRS Publication
 * 15-A / Form SS-8 guidance). Each factor is a structured, evidence-based
 * boolean input (not a raw score), and contributes a documented weight
 * toward a 0-100 riskScore. A higher score means stronger
 * employee-like signal — i.e. greater risk that a worker currently
 * classified as a contractor should legally be classified as an employee.
 *
 * Weights are allocated across the three IRS categories in proportion to
 * their traditional emphasis in enforcement guidance (Behavioral Control is
 * weighted heaviest, since the degree of instruction/control the company
 * exercises is the single strongest common-law indicator), and sum to 100
 * so riskScore is always in [0, 100].
 */

export type MisclassificationFactorCategory = 'BEHAVIORAL_CONTROL' | 'FINANCIAL_CONTROL' | 'RELATIONSHIP_TYPE';

export interface MisclassificationFactorInputs {
  // -- Behavioral Control: does the company control how/when/where the work is done? --
  /** Company gives detailed instructions on how, when, and where the work is performed. */
  instructionsControl: boolean;
  /** Company provides training on required procedures or methods. */
  trainingProvided: boolean;
  /** Company sets the worker's schedule/hours. */
  workScheduleSetByCompany: boolean;
  /** Worker provides services exclusively to this company (no other clients). */
  worksExclusivelyForCompany: boolean;

  // -- Financial Control: does the worker have a genuine financial stake in the engagement? --
  /** Company supplies tools, equipment, or workspace. */
  toolsProvidedByCompany: boolean;
  /** Company reimburses business/travel expenses. */
  expensesReimbursed: boolean;
  /** Worker is paid a fixed wage/salary on a regular schedule rather than a flat project/deliverable fee. */
  paidFixedRegularWage: boolean;
  /** Worker can realize a profit or incur a loss from the engagement (contractor-like when true). */
  opportunityForProfitOrLoss: boolean;
  /** Worker has made a significant investment in their own equipment/facilities (contractor-like when true). */
  significantInvestment: boolean;

  // -- Type of Relationship: how do the parties themselves characterize and structure the relationship? --
  /** Written agreement characterizes the relationship as employment. */
  writtenContractIndicatesEmployee: boolean;
  /** Company provides employee-type benefits (insurance, pension, paid leave). */
  employeeBenefitsProvided: boolean;
  /** Relationship is ongoing/indefinite rather than tied to a specific project or term. */
  relationshipIsIndefinite: boolean;
  /** Services performed are a key/regular aspect of the company's core, ongoing business. */
  servicesKeyToBusiness: boolean;
}

interface FactorDefinition {
  weight: number;
  label: string;
  category: MisclassificationFactorCategory;
  /** When true, the raw `true` value is a *contractor*-like signal, so it is inverted before scoring. */
  contractorLikeWhenTrue?: boolean;
}

/** Weights sum to 100: Behavioral Control 40, Financial Control 35, Relationship Type 25. */
export const MISCLASSIFICATION_FACTOR_DEFINITIONS: Record<keyof MisclassificationFactorInputs, FactorDefinition> = {
  instructionsControl: {
    weight: 12,
    label: 'Company gives detailed instructions on how, when, and where work is performed',
    category: 'BEHAVIORAL_CONTROL',
  },
  trainingProvided: {
    weight: 8,
    label: 'Company provides training on required procedures or methods',
    category: 'BEHAVIORAL_CONTROL',
  },
  workScheduleSetByCompany: {
    weight: 12,
    label: "Company sets the worker's schedule or hours",
    category: 'BEHAVIORAL_CONTROL',
  },
  worksExclusivelyForCompany: {
    weight: 8,
    label: 'Worker provides services exclusively to this company',
    category: 'BEHAVIORAL_CONTROL',
  },
  toolsProvidedByCompany: {
    weight: 8,
    label: 'Company supplies tools, equipment, or workspace',
    category: 'FINANCIAL_CONTROL',
  },
  expensesReimbursed: {
    weight: 7,
    label: 'Company reimburses business or travel expenses',
    category: 'FINANCIAL_CONTROL',
  },
  paidFixedRegularWage: {
    weight: 8,
    label: 'Worker is paid a fixed wage/salary on a regular schedule rather than a flat project fee',
    category: 'FINANCIAL_CONTROL',
  },
  opportunityForProfitOrLoss: {
    weight: 6,
    label: 'Worker cannot realize a profit or incur a loss from the engagement',
    category: 'FINANCIAL_CONTROL',
    contractorLikeWhenTrue: true,
  },
  significantInvestment: {
    weight: 6,
    label: 'Worker has not made a significant investment in their own equipment or facilities',
    category: 'FINANCIAL_CONTROL',
    contractorLikeWhenTrue: true,
  },
  writtenContractIndicatesEmployee: {
    weight: 6,
    label: 'Written agreement characterizes the relationship as employment',
    category: 'RELATIONSHIP_TYPE',
  },
  employeeBenefitsProvided: {
    weight: 7,
    label: 'Company provides employee-type benefits (insurance, pension, paid leave)',
    category: 'RELATIONSHIP_TYPE',
  },
  relationshipIsIndefinite: {
    weight: 6,
    label: 'Relationship is ongoing/indefinite rather than tied to a specific project or term',
    category: 'RELATIONSHIP_TYPE',
  },
  servicesKeyToBusiness: {
    weight: 6,
    label: "Services performed are a key, regular aspect of the company's core business",
    category: 'RELATIONSHIP_TYPE',
  },
};

export const MISCLASSIFICATION_MAX_SCORE = Object.values(MISCLASSIFICATION_FACTOR_DEFINITIONS).reduce(
  (sum, def) => sum + def.weight,
  0,
);

export interface MisclassificationScoringResult {
  /** 0-100. Higher = stronger employee-like signal = greater misclassification risk. */
  riskScore: number;
  /** Human-readable labels of the factors that contributed an employee-like signal. */
  riskFactors: string[];
  categoryScores: {
    behavioralControl: number;
    financialControl: number;
    relationshipType: number;
  };
}

/**
 * Scores a structured set of IRS common-law factor inputs into a weighted
 * 0-100 riskScore plus the human-readable riskFactors that drove it.
 */
export function calculateMisclassificationRiskScore(factors: MisclassificationFactorInputs): MisclassificationScoringResult {
  let riskScore = 0;
  const riskFactors: string[] = [];
  const categoryTotals: Record<MisclassificationFactorCategory, number> = {
    BEHAVIORAL_CONTROL: 0,
    FINANCIAL_CONTROL: 0,
    RELATIONSHIP_TYPE: 0,
  };

  for (const key of Object.keys(MISCLASSIFICATION_FACTOR_DEFINITIONS) as Array<keyof MisclassificationFactorInputs>) {
    const definition = MISCLASSIFICATION_FACTOR_DEFINITIONS[key];
    const rawValue = Boolean(factors[key]);
    const employeeLikeSignal = definition.contractorLikeWhenTrue ? !rawValue : rawValue;
    if (employeeLikeSignal) {
      riskScore += definition.weight;
      riskFactors.push(definition.label);
      categoryTotals[definition.category] += definition.weight;
    }
  }

  return {
    riskScore: Math.round(riskScore * 100) / 100,
    riskFactors,
    categoryScores: {
      behavioralControl: categoryTotals.BEHAVIORAL_CONTROL,
      financialControl: categoryTotals.FINANCIAL_CONTROL,
      relationshipType: categoryTotals.RELATIONSHIP_TYPE,
    },
  };
}
