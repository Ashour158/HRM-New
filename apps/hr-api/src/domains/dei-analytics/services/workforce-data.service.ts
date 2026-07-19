import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import type { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { CompensationChangeRepository } from '../../compensation/repositories/compensation-change.repository.js';
import type { CompensationChange } from '../../compensation/aggregates/compensation-change.aggregate.js';
import { LegalEntityRepository } from '../../organization/repositories/legal-entity.repository.js';
import { amountToHourlyRate, UNSPECIFIED_DIMENSION, type PayGapWorkerRecord } from './pay-gap-calculator.js';
import { UNSPECIFIED_GENDER, type WorkforceSnapshotWorker } from './workforce-metrics-calculator.js';
import { resolveAttritionSegmentValue, type AttritionWorkerInput } from './attrition-calculator.js';

/**
 * Loads real worker, compensation, and legal-entity data for the DEI
 * analytics domain's computation services. This is the sole place in the
 * domain that talks to hr-core / compensation / organization repositories so
 * the pure calculators (pay-gap-calculator, workforce-metrics-calculator,
 * attrition-calculator) can stay framework-free and easily testable.
 */
@Injectable()
export class WorkforceDataService {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly compensationChangeRepo: CompensationChangeRepository,
    private readonly legalEntityRepo: LegalEntityRepository,
  ) {}

  /** Maps legalEntityId -> countryCode for every legal entity in the tenant. */
  async loadCountryCodesByLegalEntity(tenantId: Uuid): Promise<Map<string, string>> {
    const entities = await this.legalEntityRepo.findByTenant(tenantId);
    return new Map(entities.map((e) => [e.id.value, e.countryCode]));
  }

  /** Reads a single BASIC personal-data field (e.g. "gender") for a batch of workers. Excludes suppressed/deleted records. */
  private async loadBasicFieldByWorker(workerIds: Uuid[], field: string): Promise<Map<string, string>> {
    if (workerIds.length === 0) return new Map();
    const records = await this.personalDataRepo.findByWorkers(workerIds);
    const result = new Map<string, string>();
    for (const record of records) {
      if (record.dataCategory !== 'BASIC') continue;
      if (record.state === 'DELETED' || record.state === 'SUPPRESSED') continue;
      const value = (record.payload as Record<string, unknown> | undefined)?.[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        result.set(record.workerId.value, value.trim().toUpperCase());
      }
    }
    return result;
  }

  /**
   * Loads per-worker hourly-pay records for pay-gap computation: workers
   * employed under a legal entity in the given country, still employed (or
   * not yet terminated) as of the reporting-year snapshot date (Dec 31 of
   * reportingYear), with a known latest EFFECTIVE compensation change as of
   * that date. Workers without a resolvable pay rate are excluded rather
   * than fabricated.
   */
  async loadPayGapWorkerRecords(
    tenantId: Uuid,
    options: { countryCode: string; reportingYear: number; dimensionField: string },
  ): Promise<PayGapWorkerRecord[]> {
    const snapshotDate = new Date(Date.UTC(options.reportingYear, 11, 31, 23, 59, 59, 999));
    const countryByLegalEntity = await this.loadCountryCodesByLegalEntity(tenantId);
    const allWorkers = await this.workerRepo.searchForTenant('', tenantId);

    const eligible = allWorkers.filter((w) => {
      if (!w.legalEntityId) return false;
      if (countryByLegalEntity.get(w.legalEntityId.value) !== options.countryCode) return false;
      if (w.hireDate > snapshotDate) return false;
      if (w.terminationDate && w.terminationDate <= snapshotDate) return false;
      return true;
    });
    if (eligible.length === 0) return [];

    const [dimensionByWorker, compChanges] = await Promise.all([
      this.loadBasicFieldByWorker(eligible.map((w) => w.id), options.dimensionField),
      this.compensationChangeRepo.findByTenant(tenantId),
    ]);

    const latestChangeByWorker = new Map<string, CompensationChange>();
    for (const change of compChanges) {
      if (change.status !== 'EFFECTIVE') continue;
      if (change.effectiveDate > snapshotDate) continue;
      const current = latestChangeByWorker.get(change.workerId.value);
      if (!current || change.effectiveDate > current.effectiveDate) {
        latestChangeByWorker.set(change.workerId.value, change);
      }
    }

    const records: PayGapWorkerRecord[] = [];
    for (const worker of eligible) {
      const change = latestChangeByWorker.get(worker.id.value);
      if (!change) continue; // no known pay rate -> excluded, not fabricated
      records.push({
        workerId: worker.id.value,
        dimensionValue: dimensionByWorker.get(worker.id.value) ?? UNSPECIFIED_DIMENSION,
        hourlyRate: amountToHourlyRate(change.newAmount),
        departmentId: worker.departmentId?.value,
        role: worker.jobTitle,
      });
    }
    return records;
  }

  /**
   * Loads a snapshot of a legal entity's current (ACTIVE or SUSPENDED)
   * workforce for DEI/workforce-composition report metrics.
   */
  async loadWorkforceSnapshot(tenantId: Uuid, legalEntityId: Uuid): Promise<WorkforceSnapshotWorker[]> {
    const workers = await this.workerRepo.searchForTenant('', tenantId, { legalEntityId });
    const currentWorkers = workers.filter((w) => w.status === 'ACTIVE' || w.status === 'SUSPENDED');
    if (currentWorkers.length === 0) return [];

    const genderByWorker = await this.loadBasicFieldByWorker(currentWorkers.map((w) => w.id), 'gender');
    const managerIds = new Set(
      currentWorkers.filter((w) => w.managerId).map((w) => (w.managerId as Uuid).value),
    );

    return currentWorkers.map((w) => ({
      workerId: w.id.value,
      gender: genderByWorker.get(w.id.value) ?? UNSPECIFIED_GENDER,
      departmentId: w.departmentId?.value,
      employmentType: w.employmentType,
      isManager: managerIds.has(w.id.value),
    }));
  }

  /**
   * Loads all workers for the tenant (any status, so terminated workers are
   * included) with the segment cohort resolved for the given segmentType,
   * for attrition-segment computation.
   */
  async loadAttritionWorkerRecords(tenantId: Uuid, segmentType: string): Promise<AttritionWorkerInput[]> {
    const workers = await this.workerRepo.searchForTenant('', tenantId);
    if (workers.length === 0) return [];

    const needsGender = segmentType.toUpperCase() === 'GENDER';
    const genderByWorker = needsGender
      ? await this.loadBasicFieldByWorker(workers.map((w: WorkerProfile) => w.id), 'gender')
      : new Map<string, string>();

    return workers.map((w: WorkerProfile) => ({
      workerId: w.id.value,
      hireDate: w.hireDate,
      terminationDate: w.terminationDate,
      segmentValue: resolveAttritionSegmentValue(segmentType, {
        departmentId: w.departmentId?.value,
        employmentType: w.employmentType,
        jobTitle: w.jobTitle,
        gender: genderByWorker.get(w.id.value),
      }),
    }));
  }
}
