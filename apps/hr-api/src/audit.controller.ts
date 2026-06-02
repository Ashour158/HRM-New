import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditLedgerService } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from './guards/auth.guard.js';

function toUuidValue(value: Uuid | string | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Uuid ? value.value : value;
}

const AUDIT_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'COMPLIANCE_OFFICER',
  'INTERNAL_AUDITOR',
  'AUDITOR',
  'PAYROLL_ADMIN',
]);

@ApiTags('Audit')
@UseGuards(AuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditLedger: AuditLedgerService) {}

  @Get()
  async listAuditTrail(
    @Query('resourceType') resourceType: string | undefined,
    @Query('resourceId') resourceId: string | undefined,
    @Query('action') action: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Req() req: Request,
  ) {
    this.assertAuditScope(req);
    const records = resourceType && resourceId
      ? await this.auditLedger.getAuditTrail(resourceType, new Uuid(resourceId))
      : await this.auditLedger.getAuditTrailForTenant(
        new Uuid((req.tenantId as string | undefined) ?? '00000000-0000-0000-0000-000000000001'),
        {
          limit: 200,
          from: dateFrom ? new Date(dateFrom) : undefined,
          to: dateTo ? new Date(dateTo) : undefined,
        },
      );

    return records
      .filter((record) => !action || record.action === action)
      .map((record) => ({
        id: record.id.value,
        actorId: toUuidValue(record.actorId) ?? '',
        actorName: record.actorType,
        action: record.action,
        resourceType: record.resourceType,
        resourceId: toUuidValue(record.resourceId) ?? '',
        timestamp: record.occurredAt.toISOString(),
        details: record.payload,
      }));
  }

  private assertAuditScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => AUDIT_ROLES.has(role))) return;
    throw new ForbiddenException('Only audit, compliance, or HR administrators can view audit history');
  }
}
