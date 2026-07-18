import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import {
  PayGapCalculationService,
  computePayGapStatistics,
  type WorkerPayEquityTuple,
} from './pay-gap-calculation.service.js';
import { PayGapReport } from '../aggregates/pay-gap-report.aggregate.js';
import { SUPPRESSED, DEFAULT_AGGREGATION_THRESHOLD } from '../aggregates/k-anonymity.js';
import type { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import type { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import type { CompensationChangeRepository } from '../../compensation/repositories/compensation-change.repository.js';
import type { LegalEntityRepository } from '../../organization/repositories/legal-entity.repository.js';
import type { PositionRepository } from '../../position-control/repositories/position.repository.js';

const FULL_TIME_ANNUAL_HOURS = 2080;
const PART_TIME_ANNUAL_HOURS = 1040;

function tuple(overrides: Partial<WorkerPayEquityTuple> & { hourlyRate: number }): WorkerPayEquityTuple {
  return {
    workerId: Uuid.generate().value,
    annualBaseSalary: overrides.hourlyRate * FULL_TIME_ANNUAL_HOURS,
    currency: 'USD',
    protectedClassGroup: 'UNSPECIFIED',
    jobFamily: 'ENGINEERING',
    jobLevel: 'L3',
    ...overrides,
  };
}

describe('computePayGapStatistics (pure, hand-calculated)', () => {
  it('computes mean/median hourly gap and per-quartile group counts against hand-calculated values', () => {
    // Reference group (largest headcount): MALE, 5 workers, hourly rates 50/60/70/80/100.
    //   mean = (50+60+70+80+100)/5 = 360/5 = 72
    //   median (sorted 50,60,70,80,100) = 70
    // Comparison group: FEMALE, 3 workers, hourly rates 40/45/48.
    //   mean = (40+45+48)/3 = 133/3 = 44.333...
    //   median (sorted 40,45,48) = 45
    // meanHourlyGap   = ((72 - 44.333...) / 72) * 100 = 38.4259...% -> 38.43
    // medianHourlyGap = ((70 - 45) / 70) * 100 = 35.714285...%    -> 35.71
    const male = [50, 60, 70, 80, 100].map((hourlyRate) =>
      tuple({ hourlyRate, protectedClassGroup: 'MALE', jobFamily: 'ENGINEERING' }),
    );
    const female = [40, 45, 48].map((hourlyRate) =>
      tuple({ hourlyRate, protectedClassGroup: 'FEMALE', jobFamily: 'SALES' }),
    );

    const result = computePayGapStatistics([...male, ...female]);

    expect(result.meanHourlyGap).toBeCloseTo(38.43, 2);
    expect(result.medianHourlyGap).toBeCloseTo(35.71, 2);

    // Combined ascending order: F40, F45, F48, M50, M60, M70, M80, M100 (n=8, 2 per quartile).
    const dist = result.quartileDistribution as {
      referenceGroup: string;
      totalWorkersIncluded: number;
      jobFamiliesRepresented: string[];
      quartiles: Record<string, { count: number; byGroup: Record<string, { count: number }> }>;
    };
    expect(dist.referenceGroup).toBe('MALE');
    expect(dist.totalWorkersIncluded).toBe(8);
    expect(dist.jobFamiliesRepresented).toEqual(['ENGINEERING', 'SALES']);

    expect(dist.quartiles.Q1).toEqual({ count: 2, byGroup: { FEMALE: { count: 2 } } });
    expect(dist.quartiles.Q2).toEqual({ count: 2, byGroup: { FEMALE: { count: 1 }, MALE: { count: 1 } } });
    expect(dist.quartiles.Q3).toEqual({ count: 2, byGroup: { MALE: { count: 2 } } });
    expect(dist.quartiles.Q4).toEqual({ count: 2, byGroup: { MALE: { count: 2 } } });
  });

  it('breaks reference-group ties alphabetically and returns a zero gap for a single disclosed group', () => {
    const result = computePayGapStatistics([
      tuple({ hourlyRate: 50, protectedClassGroup: 'NOT_DISCLOSED' }),
      tuple({ hourlyRate: 60, protectedClassGroup: 'NOT_DISCLOSED' }),
    ]);
    expect(result.meanHourlyGap).toBe(0);
    expect(result.medianHourlyGap).toBe(0);
  });

  it('throws when there are no workers to calculate from', () => {
    expect(() => computePayGapStatistics([])).toThrow(/no active worker/i);
  });
});

describe('quartile suppression via PayGapReport.calculate (reuses applyKAnonymitySuppression)', () => {
  it('suppresses small quartile/group cells below the threshold while keeping large cells real', () => {
    // 20 MALE workers (reference) at hourly rates 20..39, 4 FEMALE workers at 10..13
    // (lower than every MALE rate). n=24 -> 6 members per quartile.
    // Q1 = F10,F11,F12,F13,M20,M21 -> FEMALE count=4 (<5, suppressed), MALE count=2 (<5, suppressed),
    //      quartile total count=6 (>=5, NOT suppressed).
    // Q2/Q3/Q4 = MALE only, 6 members each -> both quartile count and MALE group count stay real (6).
    const female = [10, 11, 12, 13].map((hourlyRate) => tuple({ hourlyRate, protectedClassGroup: 'FEMALE' }));
    const male = Array.from({ length: 20 }, (_, i) => 20 + i).map((hourlyRate) =>
      tuple({ hourlyRate, protectedClassGroup: 'MALE' }),
    );

    const { meanHourlyGap, medianHourlyGap, quartileDistribution } = computePayGapStatistics([...female, ...male]);

    const report = PayGapReport.create(
      {
        id: Uuid.generate(),
        tenantId: Uuid.generate(),
        reportType: 'GENDER_PAY_GAP',
        reportingYear: 2026,
        countryCode: 'US',
      },
      Uuid.generate(),
    );
    report.calculate(Uuid.generate(), meanHourlyGap, medianHourlyGap, quartileDistribution);

    expect(report.status).toBe('CALCULATED');
    const quartiles = (report.quartileDistribution as { quartiles: Record<string, any> }).quartiles;

    expect(quartiles.Q1.count).toBe(6); // 6 >= threshold, real value preserved
    expect(quartiles.Q1.byGroup.FEMALE.count).toBe(SUPPRESSED);
    expect(quartiles.Q1.byGroup.MALE.count).toBe(SUPPRESSED);

    for (const label of ['Q2', 'Q3', 'Q4']) {
      expect(quartiles[label].count).toBe(6);
      expect(quartiles[label].byGroup.MALE.count).toBe(6);
      expect(quartiles[label].byGroup.MALE.count).toBeGreaterThanOrEqual(DEFAULT_AGGREGATION_THRESHOLD);
    }
  });
});

describe('PayGapCalculationService.computeForReport (data sourcing)', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const usLegalEntityId = new Uuid('00000000-0000-0000-0000-0000000000a1');
  const egLegalEntityId = new Uuid('00000000-0000-0000-0000-0000000000a2');
  const worker1Id = new Uuid('00000000-0000-0000-0000-0000000000b1'); // in-scope: US, EFFECTIVE comp change (string NUMERIC)
  const worker2Id = new Uuid('00000000-0000-0000-0000-0000000000b2'); // in-scope: US, falls back to hire-time COMPENSATION record
  const worker3Id = new Uuid('00000000-0000-0000-0000-0000000000b3'); // out-of-scope: different country

  function baseWorker(id: Uuid, legalEntityId: Uuid, employmentType: string) {
    return {
      id,
      legalEntityId,
      employmentType,
    } as unknown as import('../../hr-core/aggregates/worker-profile.aggregate.js').WorkerProfile;
  }

  function makeRepos() {
    const workerRepo = { findByStatusForTenant: vi.fn() } as unknown as WorkerRepository;
    const personalDataRepo = { findByWorkers: vi.fn() } as unknown as PersonalDataRecordRepository;
    const compensationChangeRepo = { findByTenant: vi.fn() } as unknown as CompensationChangeRepository;
    const legalEntityRepo = { findByTenant: vi.fn() } as unknown as LegalEntityRepository;
    const positionRepo = { findAll: vi.fn() } as unknown as PositionRepository;
    return { workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo };
  }

  it('scopes to the report country via legal entity, prefers the latest EFFECTIVE comp change (parsing NUMERIC-as-string), and falls back to the hire-time COMPENSATION record', async () => {
    const { workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo } = makeRepos();

    vi.mocked(workerRepo.findByStatusForTenant).mockResolvedValue([
      baseWorker(worker1Id, usLegalEntityId, 'FULL_TIME'),
      baseWorker(worker2Id, usLegalEntityId, 'PART_TIME'),
      baseWorker(worker3Id, egLegalEntityId, 'FULL_TIME'),
    ]);

    vi.mocked(legalEntityRepo.findByTenant).mockResolvedValue([
      { id: usLegalEntityId, countryCode: 'US' },
      { id: egLegalEntityId, countryCode: 'EG' },
    ] as any);

    vi.mocked(compensationChangeRepo.findByTenant).mockResolvedValue([
      // Older EFFECTIVE change for worker1 -- must be superseded by the newer one below.
      { workerId: worker1Id, status: 'EFFECTIVE', newAmount: '90000.00', currency: 'USD', effectiveDate: new Date('2024-01-01') },
      // Latest EFFECTIVE change for worker1, value arrives as a string (Postgres NUMERIC wire behavior).
      { workerId: worker1Id, status: 'EFFECTIVE', newAmount: '104000.00', currency: 'USD', effectiveDate: new Date('2025-06-01') },
      // Worker2 has only a non-EFFECTIVE (DRAFT) change -- must be ignored, forcing the hire-time fallback.
      { workerId: worker2Id, status: 'DRAFT', newAmount: '999999', currency: 'USD', effectiveDate: new Date('2026-01-01') },
    ] as any);

    vi.mocked(positionRepo.findAll).mockResolvedValue([
      { jobFamily: 'ENGINEERING', jobLevel: 'L4', filledByWorkerId: worker1Id },
    ] as any);

    vi.mocked(personalDataRepo.findByWorkers).mockResolvedValue([
      { workerId: worker1Id, dataCategory: 'BASIC', state: 'ACTIVE', updatedAt: new Date('2025-01-01'), payload: { gender: 'Female' } },
      { workerId: worker2Id, dataCategory: 'BASIC', state: 'ACTIVE', updatedAt: new Date('2025-01-01'), payload: { gender: 'male' } },
      {
        workerId: worker2Id,
        dataCategory: 'COMPENSATION',
        state: 'ACTIVE',
        updatedAt: new Date('2024-01-01'),
        payload: { salaryAmount: 52000 },
      },
    ] as any);

    const service = new PayGapCalculationService(workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo);
    const result = await service.computeForReport({ tenantId, countryCode: 'US', reportType: 'GENDER_PAY_GAP' });

    // Only the two US-scoped workers are read for PII, never the EG worker.
    expect(personalDataRepo.findByWorkers).toHaveBeenCalledWith([worker1Id, worker2Id]);

    // worker1: 104000 / 2080 (FULL_TIME) = 50 ; worker2: 52000 / 1040 (PART_TIME) = 50 -> identical hourly rate.
    expect(result.meanHourlyGap).toBe(0);
    expect(result.medianHourlyGap).toBe(0);

    const dist = result.quartileDistribution as {
      totalWorkersIncluded: number;
      referenceGroup: string;
      jobFamiliesRepresented: string[];
      quartiles: Record<string, { byGroup: Record<string, { count: number }> }>;
    };
    expect(dist.totalWorkersIncluded).toBe(2);
    expect(dist.referenceGroup).toBe('FEMALE'); // 1 vs 1 headcount tie -> alphabetical
    expect(dist.jobFamiliesRepresented).toEqual(['ENGINEERING', 'UNSPECIFIED']);
    expect(dist.quartiles.Q1.byGroup.FEMALE.count).toBe(1);
    expect(dist.quartiles.Q2.byGroup.MALE.count).toBe(1);
  });

  it('resolves ETHNICITY_PAY_GAP groups from the decrypted SPECIAL_CATEGORY record, not gender', async () => {
    const { workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo } = makeRepos();

    vi.mocked(workerRepo.findByStatusForTenant).mockResolvedValue([
      baseWorker(worker1Id, usLegalEntityId, 'FULL_TIME'),
    ]);
    vi.mocked(legalEntityRepo.findByTenant).mockResolvedValue([{ id: usLegalEntityId, countryCode: 'US' }] as any);
    vi.mocked(compensationChangeRepo.findByTenant).mockResolvedValue([
      { workerId: worker1Id, status: 'EFFECTIVE', newAmount: 104000, currency: 'USD', effectiveDate: new Date('2025-01-01') },
    ] as any);
    vi.mocked(positionRepo.findAll).mockResolvedValue([]);
    vi.mocked(personalDataRepo.findByWorkers).mockResolvedValue([
      {
        workerId: worker1Id,
        dataCategory: 'SPECIAL_CATEGORY',
        state: 'ACTIVE',
        updatedAt: new Date('2025-01-01'),
        payload: null,
        readSensitivePayload: () => ({ ethnicity: 'Asian' }),
      },
      // A BASIC gender record is present too, but must be ignored for an ETHNICITY_PAY_GAP report.
      { workerId: worker1Id, dataCategory: 'BASIC', state: 'ACTIVE', updatedAt: new Date('2025-01-01'), payload: { gender: 'Female' } },
    ] as any);

    const service = new PayGapCalculationService(workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo);
    const result = await service.computeForReport({ tenantId, countryCode: 'US', reportType: 'ETHNICITY_PAY_GAP' });

    const dist = result.quartileDistribution as { referenceGroup: string };
    expect(dist.referenceGroup).toBe('ASIAN');
  });

  it('throws when no worker in the tenant matches the report country', async () => {
    const { workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo } = makeRepos();
    vi.mocked(workerRepo.findByStatusForTenant).mockResolvedValue([baseWorker(worker3Id, egLegalEntityId, 'FULL_TIME')]);
    vi.mocked(legalEntityRepo.findByTenant).mockResolvedValue([{ id: egLegalEntityId, countryCode: 'EG' }] as any);
    vi.mocked(compensationChangeRepo.findByTenant).mockResolvedValue([]);
    vi.mocked(positionRepo.findAll).mockResolvedValue([]);
    vi.mocked(personalDataRepo.findByWorkers).mockResolvedValue([]);

    const service = new PayGapCalculationService(workerRepo, personalDataRepo, compensationChangeRepo, legalEntityRepo, positionRepo);
    await expect(service.computeForReport({ tenantId, countryCode: 'US', reportType: 'GENDER_PAY_GAP' })).rejects.toThrow(
      /no active worker/i,
    );
  });
});
