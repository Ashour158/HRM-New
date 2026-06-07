import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ReportingController } from './reporting.controller.js';
import type { ServiceUsageReportingService } from '../services/service-usage-reporting.service.js';

function request() {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000101'),
      roles: ['REPORTING_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'reporting.admin@example.com',
    },
  } as never;
}

describe('ReportingController service usage surface', () => {
  it('returns the service usage summary for the authenticated tenant', async () => {
    const serviceUsage = {
      getSummary: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        services: [],
      }),
    } as unknown as ServiceUsageReportingService;
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      serviceUsage,
    );

    await expect(controller.getServiceUsageSummary(
      request(),
      '2026-06-01T00:00:00.000Z',
      '2026-06-03T23:59:59.999Z',
    )).resolves.toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      services: [],
    });
    expect(serviceUsage.getSummary).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-03T23:59:59.999Z'),
    });
  });

  it('keeps the public service usage route wired to the same summary service', async () => {
    const serviceUsage = {
      getSummary: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        services: [{ module: 'leave', actionCount: 2 }],
      }),
    } as unknown as ServiceUsageReportingService;
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      serviceUsage,
    );

    await expect(controller.getServiceUsage(
      request(),
      '2026-06-01T00:00:00.000Z',
      undefined,
    )).resolves.toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      services: [{ module: 'leave', actionCount: 2 }],
    });
    expect(serviceUsage.getSummary).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: undefined,
    });
  });
});
