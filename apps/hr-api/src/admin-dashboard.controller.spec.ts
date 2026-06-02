import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AdminDashboardController } from './admin-dashboard.controller.js';

describe('AdminDashboardController', () => {
  it('builds dashboard metrics from worker records', async () => {
    const controller = new AdminDashboardController({
      searchForTenant: vi.fn().mockResolvedValue([
        {
          id: new Uuid('00000000-0000-0000-0000-000000000101'),
          firstName: 'A',
          lastName: 'Worker',
          status: 'ACTIVE',
          hireDate: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          id: new Uuid('00000000-0000-0000-0000-000000000102'),
          firstName: 'B',
          lastName: 'Worker',
          status: 'TERMINATED',
          hireDate: new Date('2025-01-01T00:00:00.000Z'),
          terminationDate: new Date('2026-06-01T00:00:00.000Z'),
        },
      ]),
      search: vi.fn().mockResolvedValue({
        items: [
          {
            id: new Uuid('00000000-0000-0000-0000-000000000101'),
            firstName: 'A',
            lastName: 'Worker',
            status: 'ACTIVE',
            hireDate: new Date('2026-06-01T00:00:00.000Z'),
          },
          {
            id: new Uuid('00000000-0000-0000-0000-000000000102'),
            firstName: 'B',
            lastName: 'Worker',
            status: 'TERMINATED',
            hireDate: new Date('2025-01-01T00:00:00.000Z'),
            terminationDate: new Date('2026-06-01T00:00:00.000Z'),
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
