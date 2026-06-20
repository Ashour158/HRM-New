import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { DeiAnalyticsController } from './dei-analytics.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { DeiReportRepository } from '../repositories/dei-report.repository.js';
import type { PayGapReportRepository } from '../repositories/pay-gap-report.repository.js';
import type { PayEquityReviewRepository } from '../repositories/pay-equity-review.repository.js';
import type { AttritionSegmentReportRepository } from '../repositories/attrition-segment-report.repository.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const otherTenantId = '00000000-0000-4000-8000-000000000999';
const actorId = '00000000-0000-4000-8000-000000000010';
const deiReportId = '00000000-0000-4000-8000-000000000101';
const legalEntityId = '00000000-0000-4000-8000-000000000201';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN', 'DEI_ANALYST'],
    permissions: ['DEI_ANALYTICS_READ', 'DEI_ANALYTICS_WRITE'],
    email: 'dei.lead@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const deiReportRepo = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as DeiReportRepository;
  const payGapReportRepo = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as PayGapReportRepository;
  const payEquityReviewRepo = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as PayEquityReviewRepository;
  const attritionSegmentReportRepo = {
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as AttritionSegmentReportRepository;

  const controller = new DeiAnalyticsController(
    commandBus,
    deiReportRepo,
    payGapReportRepo,
    payEquityReviewRepo,
    attritionSegmentReportRepo,
  );

  return { controller, commandBus, deiReportRepo, payGapReportRepo, payEquityReviewRepo, attritionSegmentReportRepo };
}

describe('DeiAnalyticsController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates and generates a DEI report through command envelopes', async () => {
    const { controller, commandBus, deiReportRepo } = makeController();
    (deiReportRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(deiReportId),
      tenantId: new Uuid(tenantId),
      status: 'DRAFT',
      aggregateVersion: 1,
    });

    await controller.createDeiReport({
      deiReportId,
      reportType: 'WORKFORCE_DIVERSITY',
      reportingPeriod: '2026-Q2',
      countryCode: 'AE',
      legalEntityId,
    }, request());
    await controller.generateDeiReport({
      deiReportId,
      metrics: {
        genderDistribution: { female: 54, male: 46 },
        leadershipRepresentation: { female: 42, male: 58 },
      },
    }, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateDeiReport',
      aggregateType: 'DeiReport',
      payload: expect.objectContaining({ deiReportId, reportType: 'WORKFORCE_DIVERSITY' }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'GenerateDeiReport',
      aggregateType: 'DeiReport',
      aggregateId: new Uuid(deiReportId),
      expectedState: 'DRAFT',
      expectedVersion: 1,
      payload: expect.objectContaining({
        deiReportId,
        metrics: expect.objectContaining({ genderDistribution: expect.any(Object) }),
      }),
    }));
  });

  it('reads one DEI report and rejects missing reports during generation', async () => {
    const { controller, deiReportRepo } = makeController();
    (deiReportRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: new Uuid(deiReportId), status: 'GENERATED' });

    await expect(controller.getDeiReport(deiReportId, request())).resolves.toMatchObject({ status: 'GENERATED' });
    (deiReportRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await expect(controller.generateDeiReport({ deiReportId, metrics: {} }, request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects callers without a DEI/people-analytics or HR admin role', async () => {
    const { controller, deiReportRepo } = makeController();
    (deiReportRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(deiReportId), status: 'GENERATED' });
    const unprivileged = { tenantId, actor: { ...actor(), roles: ['EMPLOYEE'] }, headers: {} } as unknown as Request;

    await expect(controller.getDeiReport(deiReportId, unprivileged)).rejects.toBeInstanceOf(ForbiddenException);
    expect(deiReportRepo.findById).not.toHaveBeenCalled();
  });

  it('lists DEI analytics records by the authenticated tenant only', async () => {
    const { controller, deiReportRepo, payGapReportRepo, payEquityReviewRepo, attritionSegmentReportRepo } = makeController();
    (deiReportRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(deiReportId) }]);
    (payGapReportRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (payEquityReviewRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (attritionSegmentReportRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(controller.listDeiReportsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.listPayGapReportsByTenant(tenantId, request())).resolves.toHaveLength(0);
    await expect(controller.listPayEquityReviewsByTenant(tenantId, request())).resolves.toHaveLength(0);
    await expect(controller.listAttritionSegmentReportsByTenant(tenantId, request())).resolves.toHaveLength(0);
    await expect(controller.listDeiReportsByTenant(otherTenantId, request())).rejects.toThrow('Tenant mismatch');

    expect(deiReportRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
    expect(payGapReportRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
    expect(payEquityReviewRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
    expect(attritionSegmentReportRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });
});
