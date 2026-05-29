/**
 * Immutable audit ledger service for the HR/HCM platform.
 */

import type { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { CommandResult } from '@hcm/command-contracts';
import type { HrActor } from '@hcm/command-contracts';

/**
 * A single immutable audit record.
 */
export interface AuditRecord {
  id: Uuid;
  tenantId: Uuid;
  actorType: string;
  actorId: Uuid;
  action: string;
  resourceType: string;
  resourceId: Uuid;
  payload: Record<string, unknown>;
  occurredAt: Date;
  correlationId: Uuid;
  causationId?: Uuid;
  processInstanceId?: string;
  ipAddress?: string;
  userAgent?: string;
  decisionRecordId?: Uuid;
  fieldAccessDecisions?: Record<string, string>;
  dataClassification: string;
  legalHoldStatus: string;
  retentionClass: string;
}

/**
 * Options controlling how an audit record is derived from a command.
 */
export interface AuditOptions {
  ipAddress?: string;
  userAgent?: string;
  decisionRecordId?: Uuid;
  dataClassification?: string;
  legalHoldStatus?: string;
  retentionClass?: string;
}

/**
 * Service responsible for writing and querying the audit ledger.
 */
export class AuditLedgerService {
  /**
   * @param db - Kysely instance for the platform database.
   */
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Persists a single audit record.
   * @param record - The record to write.
   */
  async write(record: AuditRecord): Promise<void> {
    await this.db
      .insertInto('audit_log')
      .values({
        id: record.id.value,
        tenant_id: record.tenantId.value,
        actor_type: record.actorType,
        actor_id: record.actorId.value,
        action: record.action,
        resource_type: record.resourceType,
        resource_id: record.resourceId.value,
        payload: record.payload,
        occurred_at: record.occurredAt,
        correlation_id: record.correlationId.value,
      })
      .execute();
  }

  /**
   * Derives and writes an audit record from a completed command.
   * @param command - The command envelope.
   * @param result - The command result.
   * @param options - Additional audit metadata.
   */
  async writeFromCommand(
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
    options: AuditOptions = {}
  ): Promise<void> {
    const record: AuditRecord = {
      id: result.auditRecordId,
      tenantId: command.tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: command.commandName,
      resourceType: command.aggregateType,
      resourceId: result.aggregateId,
      payload: this.sanitizePayload(command.payload as Record<string, unknown>),
      occurredAt: new Date(),
      correlationId: command.correlationId,
      causationId: command.causationId,
      processInstanceId: command.processInstanceId,
      ipAddress: options.ipAddress ?? command.actor.ipAddress,
      userAgent: options.userAgent ?? command.actor.userAgent,
      decisionRecordId: options.decisionRecordId,
      fieldAccessDecisions: result.fieldAccessDecisions as Record<string, string>,
      dataClassification: options.dataClassification ?? 'CONFIDENTIAL',
      legalHoldStatus: options.legalHoldStatus ?? 'NONE',
      retentionClass: options.retentionClass ?? 'STANDARD',
    };

    await this.write(record);
  }

  /**
   * Retrieves the audit trail for a specific resource.
   * @param resourceType - The aggregate type.
   * @param resourceId - The aggregate UUID.
   * @returns Ordered list of audit records (newest first).
   */
  async getAuditTrail(
    resourceType: string,
    resourceId: Uuid
  ): Promise<AuditRecord[]> {
    const rows = await this.db
      .selectFrom('audit_log')
      .selectAll()
      .where('resource_type', '=', resourceType)
      .where('resource_id', '=', resourceId.value)
      .orderBy('occurred_at', 'desc')
      .execute();

    return rows.map((r) => this.toRecord(r));
  }

  /**
   * Retrieves the audit trail for a tenant with optional filtering.
   * @param tenantId - The tenant to query.
   * @param options - Pagination and date-range filters.
   * @returns Ordered list of audit records (newest first).
   */
  async getAuditTrailForTenant(
    tenantId: Uuid,
    options: {
      limit?: number;
      offset?: number;
      from?: Date;
      to?: Date;
    } = {}
  ): Promise<AuditRecord[]> {
    let query = this.db
      .selectFrom('audit_log')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('occurred_at', 'desc');

    if (options.from) {
      query = query.where('occurred_at', '>=', options.from);
    }
    if (options.to) {
      query = query.where('occurred_at', '<=', options.to);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    const rows = await query.execute();
    return rows.map((r) => this.toRecord(r));
  }

  /**
   * Writes an audit-on-access record for sensitive data views.
   *
   * Called when queries touch payslip, compensation, ER, benefits,
   * immigration, union, or demographic data.
   *
   * @param actor - The actor performing the access.
   * @param resourceType - The type of resource accessed.
   * @param resourceId - The resource UUID.
   * @param fieldsAccessed - Fields that were read.
   * @param reason - Business reason for the access.
   */
  async writeAuditOnAccess(
    actor: HrActor,
    tenantId: Uuid,
    resourceType: string,
    resourceId: Uuid,
    fieldsAccessed: string[],
    reason: string
  ): Promise<void> {
    const record: AuditRecord = {
      id: Uuid.generate(),
      tenantId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: 'ACCESS',
      resourceType,
      resourceId,
      payload: { fieldsAccessed, reason },
      occurredAt: new Date(),
      correlationId: Uuid.generate(),
      dataClassification: 'SPECIAL_CATEGORY',
      legalHoldStatus: 'NONE',
      retentionClass: 'EXTENDED',
    };

    await this.write(record);
  }

  private sanitizePayload(
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    // Deep-clone and strip known special-category keys.
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    const sensitiveKeys = ['ssn', 'nationalId', 'sin', 'passportNumber', 'biometric'];
    for (const key of sensitiveKeys) {
      delete clone[key];
    }
    return clone;
  }

  private toRecord(row: {
    id: string;
    tenant_id: string;
    actor_type: string;
    actor_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    payload: unknown;
    occurred_at: Date;
    correlation_id: string | null;
  }): AuditRecord {
    return {
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      actorType: row.actor_type,
      actorId: new Uuid(row.actor_id),
      action: row.action,
      resourceType: row.resource_type,
      resourceId: new Uuid(row.resource_id),
      payload: (row.payload as Record<string, unknown>) ?? {},
      occurredAt: row.occurred_at,
      correlationId: new Uuid(row.correlation_id ?? Uuid.generate().value),
      dataClassification: 'CONFIDENTIAL',
      legalHoldStatus: 'NONE',
      retentionClass: 'STANDARD',
    };
  }
}
