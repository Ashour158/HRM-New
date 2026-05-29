import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { AuditLedgerService, type AuditRecord } from './audit-ledger.js';

describe('AuditLedgerService audit-on-access', () => {
  it('uses the explicit tenant id, not the actor id, for sensitive access records', async () => {
    const service = new AuditLedgerService({} as never);
    const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
    const actor: HrActor = {
      actorType: 'USER',
      actorId: new Uuid('550e8400-e29b-41d4-a716-446655440001'),
      roles: ['PAYROLL_ADMIN'],
      permissions: ['PAYROLL_READ'],
      mfaAuthenticated: true,
    };
    let written: AuditRecord | undefined;
    vi.spyOn(service, 'write').mockImplementation(async (record) => {
      written = record;
    });

    await (service as unknown as {
      writeAuditOnAccess(
        actor: HrActor,
        tenantId: Uuid,
        resourceType: string,
        resourceId: Uuid,
        fieldsAccessed: string[],
        reason: string,
      ): Promise<void>;
    }).writeAuditOnAccess(
      actor,
      tenantId,
      'Payslip',
      new Uuid('550e8400-e29b-41d4-a716-446655440002'),
      ['netSalary'],
      'Employee payslip view',
    );

    expect(written?.tenantId.value).toBe(tenantId.value);
    expect(written?.actorId.value).toBe(actor.actorId.value);
  });
});
