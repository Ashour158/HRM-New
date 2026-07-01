import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AdminDashboardController } from './admin-dashboard.controller.js';

// The controller's newHiresThisMonth/terminationsThisMonth/turnover metrics are computed
// against the real wall-clock month (isSameUtcMonth(date, new Date())), so fixture dates must
// be relative to "now" rather than a fixed calendar string — a hardcoded month rolls stale (and
// silently breaks this test) the moment the real month changes.
function firstOfCurrentUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function yearsBeforeNowUtc(years: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), 1));
}

describe('AdminDashboardController', () => {
  it('builds dashboard metrics from worker records', async () => {
    const controller = new AdminDashboardController({
      searchForTenant: vi.fn().mockResolvedValue([
        {
          id: new Uuid('00000000-0000-0000-0000-000000000101'),
          firstName: 'A',
          lastName: 'Worker',
          status: 'ACTIVE',
          hireDate: firstOfCurrentUtcMonth(),
        },
        {
          id: new Uuid('00000000-0000-0000-0000-000000000102'),
          firstName: 'B',
          lastName: 'Worker',
          status: 'TERMINATED',
          hireDate: yearsBeforeNowUtc(1),
          terminationDate: firstOfCurrentUtcMonth(),
        },
      ]),
      search: vi.fn().mockResolvedValue({
        items: [
          {
            id: new Uuid('00000000-0000-0000-0000-000000000101'),
            firstName: 'A',
            lastName: 'Worker',
            status: 'ACTIVE',
            hireDate: firstOfCurrentUtcMonth(),
          },
          {
            id: new Uuid('00000000-0000-0000-0000-000000000102'),
            firstName: 'B',
            lastName: 'Worker',
            status: 'TERMINATED',
            hireDate: yearsBeforeNowUtc(1),
            terminationDate: firstOfCurrentUtcMonth(),
          },
        ],
      }),
    } as never, {
      findAll: vi.fn().mockResolvedValue([
        { status: 'VACANT' },
        { status: 'ACTIVE' },
        { status: 'FILLED' },
      ]),
    } as never);

    const dashboard = await controller.getDashboard({
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: { value: '00000000-0000-0000-0000-000000000010' },
        roles: ['HR_ADMIN'],
        permissions: [],
        mfaAuthenticated: true,
      },
    } as unknown as Request);

    expect(dashboard).toMatchObject({
      headcount: 1,
      turnover: 50,
      newHiresThisMonth: 1,
      terminationsThisMonth: 1,
      openPositions: 2,
    });
    expect(dashboard.recentActivity.length).toBeGreaterThan(0);
    expect(dashboard.alerts.length).toBeGreaterThan(0);
  });

  it('rejects employee users from the admin dashboard summary', async () => {
    const workerRepo = {
      searchForTenant: vi.fn(),
      search: vi.fn(),
    };
    const positionRepo = { findAll: vi.fn() };
    const controller = new AdminDashboardController(workerRepo as never, positionRepo as never);

    await expect(controller.getDashboard({
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: { value: '00000000-0000-0000-0000-000000000012' },
        roles: ['EMPLOYEE'],
        permissions: [],
        mfaAuthenticated: true,
      },
    } as unknown as Request)).rejects.toBeInstanceOf(ForbiddenException);
    expect(workerRepo.searchForTenant).not.toHaveBeenCalled();
    expect(positionRepo.findAll).not.toHaveBeenCalled();
  });
});
