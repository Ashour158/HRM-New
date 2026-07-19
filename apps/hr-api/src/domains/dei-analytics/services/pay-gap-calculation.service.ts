import { Injectable } from '@nestjs/common';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { parseNumeric, runWithTenant } from '@hcm/database';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import type { PersonalDataRecord, DataCategory } from '../../hr-core/aggregates/personal-data-record.aggregate.js';
import type { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { CompensationChangeRepository } from '../../compensation/repositories/compensation-change.repository.js';
import { LegalEntityRepository } from '../../organization/repositories/legal-entity.repository.js';
import { PositionRepository } from '../../position-control/repositories/position.repository.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import type { PayGapReportProps } from '../aggregates/pay-gap-report.aggregate.js';

/**
 * Standard annual hours used to convert an annual base salary into an
 * hourly-equivalent rate. Neither the worker nor job-assignment schema
 * currently tracks a per-worker `hoursWorked`/FTE figure, so this is a
 * documented, transparent approximation keyed by employment type rather
 * than a silently invented per-worker value. If/when a real hours-worked or
 * FTE column is added, replace this lookup with the real figure — the rest
 * of the pipeline (grouping, mean/median, quartiles, suppression) is
 * unaffected by where the hourly rate comes from.
 */
const STANDARD_ANNUAL_HOURS: Record<string, number> = {
  FULL_TIME: 2080, // 40 h/week * 52 weeks
  PART_TIME: 1040, // 20 h/week * 52 weeks
  CONTRACTOR: 2080,
  TEMPORARY: 2080,
  INTERN: 2080,
};
const DEFAULT_ANNUAL_HOURS = 2080;

/** Sentinel used when a worker has not disclosed / has no data recorded for the
 * protected-class group relevant to this report type. Kept as an explicit,
 * visible bucket (rather than dropping the worker) so non-disclosure rates are
 * themselves auditable in the published report. */
export const NOT_DISCLOSED = 'NOT_DISCLOSED';

export interface WorkerPayEquityTuple {
  readonly workerId: string;
  readonly annualBaseSalary: number;
  readonly currency: string;
  readonly hourlyRate: number;
  readonly protectedClassGroup: string;
  readonly jobFamily: string;
  readonly jobLevel: string;
}

export interface PayGapCalculationResult {
  readonly meanHourlyGap: number;
  readonly medianHourlyGap: number;
  readonly quartileDistribution: Record<string, unknown>;
}

export type PayGapReportSourceInput = Pick<PayGapReportProps, 'tenantId' | 'countryCode' | 'reportType'>;

/**
 * Computes real pay-gap statistics (mean/median hourly-pay gap, quartile
 * representation by protected-class group) from actual worker compensation
 * and self-identification records, instead of trusting caller-asserted
 * numbers.
 *
 * Data sources:
 *  - Population: ACTIVE workers for the tenant (`WorkerRepository`), scoped
 *    to the report's `countryCode` via the worker's legal entity
 *    (`LegalEntityRepository`). Workers with no legal entity assigned are
 *    excluded because their jurisdiction cannot be determined.
 *  - Pay: the worker's most recent `EFFECTIVE` `CompensationChange.newAmount`
 *    (`CompensationChangeRepository`); if a worker has never had a tracked
 *    compensation change, falls back to the `salaryAmount`/`grossSalaryAmount`
 *    recorded on their `COMPENSATION` `PersonalDataRecord` at hire. Every
 *    NUMERIC-column read goes through `parseNumeric` from `@hcm/database` to
 *    guard against Postgres returning NUMERIC/DECIMAL columns as strings on
 *    the wire (see `packages/hr-database/src/util/numeric.ts`).
 *  - Protected-class group: for GENDER_PAY_GAP, the `gender` field already
 *    collected on the worker's `BASIC` `PersonalDataRecord`
 *    (`CreateWorkerHandler` writes this today). For ETHNICITY_PAY_GAP, the
 *    `ethnicity` field on the worker's `SPECIAL_CATEGORY` record, decrypted
 *    via the existing `PersonalDataRecord.readSensitivePayload()` helper — no
 *    UI currently collects this field, so ethnicity reports will show 100%
 *    `NOT_DISCLOSED` until self-ID intake exists; that is a data-collection
 *    gap surfaced honestly in the output, not a computation gap.
 *  - Job family/level: the `Position` filled by the worker
 *    (`PositionRepository`), used for audit-trail completeness in the report
 *    metadata (job-family/level-adjusted "like-for-like" comparisons are the
 *    remit of `PayEquityReview`, a separate aggregate in this domain).
 *
 * K-anonymity suppression is NOT applied here — it is applied by
 * `PayGapReport.calculate()` itself (`applyKAnonymitySuppression`), which
 * already suppresses any `count`/`headcount` cell below the domain's shared
 * aggregation threshold. This service only needs to shape its output using
 * those key names.
 */
@Injectable()
export class PayGapCalculationService {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly compensationChangeRepo: CompensationChangeRepository,
    private readonly legalEntityRepo: LegalEntityRepository,
    private readonly positionRepo: PositionRepository,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  /**
   * Computes real mean/median hourly-pay gap and quartile representation for
   * the given report's tenant/country/report-type scope.
   *
   * @throws ValidationError if no worker qualifies (no active worker in the
   *   report's jurisdiction has both a resolvable pay figure and a legal
   *   entity match) — a report cannot be silently calculated as "0% gap"
   *   from zero underlying records.
   */
  async computeForReport(report: PayGapReportSourceInput): Promise<PayGapCalculationResult> {
    const tuples = await this.buildWorkerTuples(report.tenantId, report.countryCode, report.reportType);
    return computePayGapStatistics(tuples);
  }

  private async buildWorkerTuples(
    tenantId: Uuid,
    countryCode: string,
    reportType: 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP',
  ): Promise<WorkerPayEquityTuple[]> {
    const [workers, legalEntities, compensationChanges, positions] = await Promise.all([
      this.workerRepo.findByStatusForTenant('ACTIVE', tenantId),
      this.legalEntityRepo.findByTenant(tenantId),
      this.compensationChangeRepo.findByTenant(tenantId),
      this.positionRepo.findAll(tenantId, 'ACTIVE'),
    ]);

    const countryByLegalEntity = new Map(legalEntities.map((entity) => [entity.id.value, entity.countryCode.toUpperCase()]));
    const scopedWorkers = workers.filter(
      (worker) => worker.legalEntityId && countryByLegalEntity.get(worker.legalEntityId.value) === countryCode.toUpperCase(),
    );
    if (scopedWorkers.length === 0) return [];

    // Resolved once per report calculation (mirrors PayrollCloseWorkflowService.resolvePayrollCurrency)
    // and used only as the fallback when a worker's compensation record predates
    // per-record currency tracking; the tenant's actual configured currency is
    // always preferred over any invented default.
    const tenantCurrency = resolveTenantCurrency(await this.hcmSetupService.getSetup(tenantId));

    const latestEffectiveByWorker = new Map<string, { amount: number; currency: string; effectiveDate: Date }>();
    for (const change of compensationChanges) {
      if (change.status !== 'EFFECTIVE') continue;
      const workerId = change.workerId.value;
      const existing = latestEffectiveByWorker.get(workerId);
      if (!existing || change.effectiveDate.getTime() > existing.effectiveDate.getTime()) {
        latestEffectiveByWorker.set(workerId, {
          amount: parseNumeric(change.newAmount),
          currency: change.currency,
          effectiveDate: change.effectiveDate,
        });
      }
    }

    const positionByWorker = new Map(
      positions.filter((position) => position.filledByWorkerId).map((position) => [position.filledByWorkerId!.value, position]),
    );

    // findByWorkers uses ambient tenant context (AsyncLocalStorage) rather
    // than an explicit parameter; runWithTenant establishes it for this
    // batch call regardless of whether the caller is already inside a
    // request-scoped tenant context.
    const personalDataRecords = await runWithTenant(tenantId, () =>
      this.personalDataRepo.findByWorkers(scopedWorkers.map((worker) => worker.id)),
    );
    const recordsByWorker = new Map<string, PersonalDataRecord[]>();
    for (const record of personalDataRecords) {
      if (record.state === 'DELETED' || record.state === 'SUPPRESSED') continue;
      const list = recordsByWorker.get(record.workerId.value) ?? [];
      list.push(record);
      recordsByWorker.set(record.workerId.value, list);
    }

    const tuples: WorkerPayEquityTuple[] = [];
    for (const worker of scopedWorkers) {
      const records = recordsByWorker.get(worker.id.value) ?? [];
      const salary = this.resolveAnnualSalary(worker, records, latestEffectiveByWorker, tenantCurrency);
      if (!salary || salary.amount <= 0) continue;

      const protectedClassGroup = this.resolveProtectedClassGroup(reportType, records);
      const position = positionByWorker.get(worker.id.value);
      const annualHours = STANDARD_ANNUAL_HOURS[worker.employmentType] ?? DEFAULT_ANNUAL_HOURS;

      tuples.push({
        workerId: worker.id.value,
        annualBaseSalary: salary.amount,
        currency: salary.currency,
        hourlyRate: roundTo(salary.amount / annualHours, 6),
        protectedClassGroup,
        jobFamily: position?.jobFamily ?? 'UNSPECIFIED',
        jobLevel: position?.jobLevel ?? 'UNSPECIFIED',
      });
    }
    return tuples;
  }

  private resolveAnnualSalary(
    worker: WorkerProfile,
    records: PersonalDataRecord[],
    latestEffectiveByWorker: Map<string, { amount: number; currency: string; effectiveDate: Date }>,
    tenantCurrency: string,
  ): { amount: number; currency: string } | undefined {
    const effective = latestEffectiveByWorker.get(worker.id.value);
    if (effective) return { amount: effective.amount, currency: effective.currency };

    const compensationRecord = latestRecordOfCategory(records, 'COMPENSATION');
    const payload = compensationRecord?.payload as Record<string, unknown> | undefined;
    const raw = payload?.salaryAmount ?? payload?.grossSalaryAmount;
    if (raw === undefined || raw === null || raw === '') return undefined;
    return {
      amount: parseNumeric(raw as string | number),
      currency: typeof payload?.salaryCurrency === 'string' ? payload.salaryCurrency : tenantCurrency,
    };
  }

  private resolveProtectedClassGroup(
    reportType: 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP',
    records: PersonalDataRecord[],
  ): string {
    if (reportType === 'GENDER_PAY_GAP') {
      const basic = latestRecordOfCategory(records, 'BASIC');
      const gender = (basic?.payload as Record<string, unknown> | undefined)?.gender;
      return normalizeGroup(gender);
    }
    const special = latestRecordOfCategory(records, 'SPECIAL_CATEGORY');
    const ethnicity = special?.readSensitivePayload()?.ethnicity;
    return normalizeGroup(ethnicity);
  }
}

function latestRecordOfCategory(records: PersonalDataRecord[], category: DataCategory): PersonalDataRecord | undefined {
  return records
    .filter((record) => record.dataCategory === category)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

function normalizeGroup(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return NOT_DISCLOSED;
  return value.trim().toUpperCase();
}

function roundTo(value: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

/**
 * Pure statistics core, exported separately so it can be unit-tested against
 * hand-calculated fixtures without a database.
 *
 * Methodology (mirrors the UK/EU statutory gender-pay-gap convention,
 * generalized to any number of self-identified groups):
 *  - The "reference" group is whichever disclosed group has the largest
 *    headcount (ties broken alphabetically for determinism).
 *  - `meanHourlyGap` / `medianHourlyGap` are the reference group's mean/median
 *    hourly-equivalent pay compared to the pooled mean/median of every other
 *    disclosed worker, expressed as a percentage of the reference group's
 *    figure: `((reference - comparison) / reference) * 100`. Positive means
 *    the reference group is paid more on average.
 *  - `quartileDistribution` ranks every qualifying worker by hourly rate,
 *    splits them into four equal-as-possible quartiles (Q1 = lowest-paid,
 *    Q4 = highest-paid; any remainder goes to the lowest quartiles first),
 *    and reports each group's headcount (`count`) within each quartile.
 *    `PayGapReport.calculate()` runs this object through
 *    `applyKAnonymitySuppression`, which replaces any `count` below the
 *    domain's shared aggregation threshold with `'SUPPRESSED'`.
 */
export function computePayGapStatistics(tuples: WorkerPayEquityTuple[]): PayGapCalculationResult {
  if (tuples.length === 0) {
    throw new ValidationError(
      'No active worker with a resolvable pay figure, matching jurisdiction, and protected-class data was found; cannot calculate this pay gap report.',
    );
  }

  const byGroup = new Map<string, WorkerPayEquityTuple[]>();
  for (const tuple of tuples) {
    const list = byGroup.get(tuple.protectedClassGroup) ?? [];
    list.push(tuple);
    byGroup.set(tuple.protectedClassGroup, list);
  }

  const groupsByHeadcountDesc = [...byGroup.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const [referenceGroupName, referenceTuples] = groupsByHeadcountDesc[0];
  const referenceRates = referenceTuples.map((tuple) => tuple.hourlyRate);
  const comparisonRates = tuples
    .filter((tuple) => tuple.protectedClassGroup !== referenceGroupName)
    .map((tuple) => tuple.hourlyRate);

  const referenceMean = mean(referenceRates);
  const referenceMedian = median(referenceRates);
  const comparisonMean = comparisonRates.length > 0 ? mean(comparisonRates) : referenceMean;
  const comparisonMedian = comparisonRates.length > 0 ? median(comparisonRates) : referenceMedian;

  const meanHourlyGap = referenceMean > 0 ? roundTo(((referenceMean - comparisonMean) / referenceMean) * 100, 2) : 0;
  const medianHourlyGap =
    referenceMedian > 0 ? roundTo(((referenceMedian - comparisonMedian) / referenceMedian) * 100, 2) : 0;

  return {
    meanHourlyGap,
    medianHourlyGap,
    quartileDistribution: buildQuartileDistribution(tuples, referenceGroupName),
  };
}

function buildQuartileDistribution(tuples: WorkerPayEquityTuple[], referenceGroupName: string): Record<string, unknown> {
  const sorted = [...tuples].sort((a, b) => a.hourlyRate - b.hourlyRate);
  const quartileMembers = splitIntoQuartiles(sorted);
  const jobFamiliesRepresented = [...new Set(tuples.map((tuple) => tuple.jobFamily))].sort();

  const quartiles: Record<string, unknown> = {};
  (['Q1', 'Q2', 'Q3', 'Q4'] as const).forEach((label, index) => {
    const members = quartileMembers[index];
    const byGroup: Record<string, { count: number }> = {};
    for (const member of members) {
      const cell = byGroup[member.protectedClassGroup] ?? { count: 0 };
      cell.count += 1;
      byGroup[member.protectedClassGroup] = cell;
    }
    quartiles[label] = { count: members.length, byGroup };
  });

  return {
    methodology:
      'Active workers with a resolvable hourly-equivalent pay figure and matching jurisdiction are ranked by pay and split into four equal-sized quartiles (Q1 = lowest-paid, Q4 = highest-paid). Each quartile reports headcount by protected-class self-identification group; cells below the aggregation threshold are suppressed.',
    referenceGroup: referenceGroupName,
    totalWorkersIncluded: tuples.length,
    jobFamiliesRepresented,
    quartiles,
  };
}

function splitIntoQuartiles<T>(sorted: T[]): [T[], T[], T[], T[]] {
  const total = sorted.length;
  const base = Math.floor(total / 4);
  const remainder = total % 4;
  const sizes = [0, 1, 2, 3].map((index) => base + (index < remainder ? 1 : 0));
  const groups: T[][] = [];
  let offset = 0;
  for (const size of sizes) {
    groups.push(sorted.slice(offset, offset + size));
    offset += size;
  }
  return groups as [T[], T[], T[], T[]];
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
