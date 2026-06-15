export type InsightBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface InsightFactor {
  factor: string;
  weight: number;
  detail: string;
}

export interface ScoredInsight {
  score: number;
  band: InsightBand;
  factors: InsightFactor[];
  modelKey: string;
  modelVersion: string;
}

export interface IntelligenceModel<TFeatures, TResult extends ScoredInsight> {
  readonly key: string;
  readonly version: string;
  score(features: TFeatures): TResult;
}

export interface AttritionRiskFeatures {
  tenureMonths: number;
  compPositionToBandMidpoint: number;
  monthsSincePromotion: number;
  engagementScoreTrend: number;
  absenceDaysLast90: number;
  managerChangesLast12Months: number;
}

export interface AttendancePayrollAnomalyFeatures {
  hoursWorked: number;
  scheduledHours: number;
  overtimeHours: number;
  priorPeriodNetPay: number;
  currentNetPay: number;
  missingPunches: number;
}

export const ATTRITION_RISK_MODEL_KEY = 'heuristic.attrition-risk';
export const ATTENDANCE_PAYROLL_ANOMALY_MODEL_KEY = 'heuristic.attendance-payroll-anomaly';
export const HEURISTIC_MODEL_VERSION = '2026.06.01';

export class AttritionRiskModel implements IntelligenceModel<AttritionRiskFeatures, ScoredInsight> {
  readonly key = ATTRITION_RISK_MODEL_KEY;
  readonly version = HEURISTIC_MODEL_VERSION;

  score(features: AttritionRiskFeatures): ScoredInsight {
    const factors: InsightFactor[] = [
      factor('Tenure risk', tenureRisk(features.tenureMonths), `Tenure is ${features.tenureMonths} months.`),
      factor('Compensation position', compRisk(features.compPositionToBandMidpoint), `Compensation is ${(features.compPositionToBandMidpoint * 100).toFixed(0)}% of band midpoint.`),
      factor('Promotion recency', promotionRisk(features.monthsSincePromotion), `${features.monthsSincePromotion} months since last promotion or movement.`),
      factor('Engagement trend', engagementRisk(features.engagementScoreTrend), `Engagement trend is ${features.engagementScoreTrend.toFixed(2)}.`),
      factor('Absence trend', absenceRisk(features.absenceDaysLast90), `${features.absenceDaysLast90} absence days in the last 90 days.`),
      factor('Manager changes', managerChangeRisk(features.managerChangesLast12Months), `${features.managerChangesLast12Months} manager changes in the last 12 months.`),
    ];
    const score = weightedAverage(factors);
    return {
      score,
      band: bandForScore(score),
      factors: factors.filter((entry) => entry.weight > 0),
      modelKey: this.key,
      modelVersion: this.version,
    };
  }
}

export class AttendancePayrollAnomalyModel implements IntelligenceModel<AttendancePayrollAnomalyFeatures, ScoredInsight> {
  readonly key = ATTENDANCE_PAYROLL_ANOMALY_MODEL_KEY;
  readonly version = HEURISTIC_MODEL_VERSION;

  score(features: AttendancePayrollAnomalyFeatures): ScoredInsight {
    const scheduled = Math.max(1, features.scheduledHours);
    const payDelta = features.priorPeriodNetPay <= 0
      ? 0
      : Math.abs(features.currentNetPay - features.priorPeriodNetPay) / features.priorPeriodNetPay;
    const factors: InsightFactor[] = [
      factor('Hours variance', clamp(Math.abs(features.hoursWorked - features.scheduledHours) / scheduled), `${features.hoursWorked} actual hours against ${features.scheduledHours} scheduled.`),
      factor('Overtime outlier', clamp(features.overtimeHours / Math.max(1, scheduled * 0.15)), `${features.overtimeHours} overtime hours recorded.`),
      factor('Pay delta', clamp(payDelta / 0.2), `Net pay changed by ${(payDelta * 100).toFixed(1)}%.`),
      factor('Missing punches', clamp(features.missingPunches / 3), `${features.missingPunches} missing punches detected.`),
    ];
    const score = weightedAverage(factors);
    return {
      score,
      band: bandForScore(score),
      factors: factors.filter((entry) => entry.weight > 0),
      modelKey: this.key,
      modelVersion: this.version,
    };
  }
}

export function scoreAttritionRisk(features: AttritionRiskFeatures): ScoredInsight {
  return new AttritionRiskModel().score(features);
}

export function detectAttendancePayrollAnomaly(features: AttendancePayrollAnomalyFeatures): ScoredInsight {
  return new AttendancePayrollAnomalyModel().score(features);
}

function factor(factorName: string, weight: number, detail: string): InsightFactor {
  return { factor: factorName, weight: clamp(weight), detail };
}

function tenureRisk(months: number): number {
  if (months < 6) return 0.65;
  if (months < 18) return 0.35;
  return 0.1;
}

function compRisk(positionToMidpoint: number): number {
  if (positionToMidpoint <= 0) return 0.35;
  return clamp((1 - positionToMidpoint) / 0.35);
}

function promotionRisk(months: number): number {
  return clamp((months - 24) / 36);
}

function engagementRisk(trend: number): number {
  return trend >= 0 ? 0 : clamp(Math.abs(trend) / 0.4);
}

function absenceRisk(days: number): number {
  return clamp(days / 12);
}

function managerChangeRisk(changes: number): number {
  return clamp(changes / 3);
}

function weightedAverage(factors: InsightFactor[]): number {
  if (factors.length === 0) return 0;
  return round(factors.reduce((sum, entry) => sum + entry.weight, 0) / factors.length);
}

function bandForScore(score: number): InsightBand {
  if (score >= 0.66) return 'HIGH';
  if (score >= 0.33) return 'MEDIUM';
  return 'LOW';
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
