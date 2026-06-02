import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuditController } from './audit.controller.js';

describe('AuditController', () => {
  it('maps audit ledger records to the frontend audit trail contract', async () => {
    const auditLedger = {
      getAuditTrailForTenant: vi.fn().mockResolvedValue([
        {
          id: new Uuid('00000000-0000-0000-0000-000000000601'),
          actorType: 'USER',
          actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
          action: 'CreateWorkerProfile',
          resourceType: 'WorkerProfile',
          resourceId: new Uuid('00000000-0000-0000-0000-000000000011'),
          payload: { firstName: 'Sarah' },
          occurredAt: new Date('2026-06-01T09:00:00.000Z'),
        },
      ]),
      getAuditTrail: vi.fn(),
    };
    const controller = new AuditController(auditLedger as never);

    const entries = await controller.listAuditTrail(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        tenantId: '00000000-0000-0000-0000-000000000001',
        actor: {
          actorType: 'USER',
          actorId: { value: '00000000-0000-0000-0000-000000000010' },
          roles: ['HR_ADMIN'],
          permissions: [],
          mfaAuthenticated: true,
        },
      } as unknown as Request,
    );

    expect(entries).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000601',
        actorId: '00000000-0000-0000-0000-000000000010',
        actorName: 'USER',
        action: 'CreateWorkerProfile',
        resourceType: 'WorkerProfile',
        resourceId: '00000000-0000-0000-0000-000000000011',
        timestamp: '2026-06-01T09:00:00.000Z',
        details: { firstName: 'Sarah' },
      },
    ]);
  });

  it('rejects employee users from tenant-wide audit history', async () => {
    const auditLedger = {
      getAuditTrailForTenant: vi.fn(),
      getAuditTrail: vi.fn(),
    };
    const controller = new AuditController(auditLedger as never);

    await expect(controller.listAuditTrail(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        tenantId: '00000000-0000-0000-0000-000000000001',
        actor: {
          actorType: 'USER',
          actorId: { value: '00000000-0000-0000-0000-000000000012' },
          roles: ['EMPLOYEE'],
          permissions: [],
          mfaAuthenticated: true,
        },
      } as unknown as Request,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditLedger.getAuditTrailForTenant).not.toHaveBeenCalled();
    expect(auditLedger.getAuditTrail).not.toHaveBeenCalled();
  });
});
