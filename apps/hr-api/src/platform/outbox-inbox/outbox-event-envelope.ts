import { Uuid } from '@hcm/shared-kernel';
import type { ClientType, EventMetadata, HrEventEnvelope, HrEventPrivacy } from '@hcm/event-schemas';
import { createPrivacyForEvent, getTopicForEvent } from '@hcm/event-schemas';

export interface OutboxEventRow {
  id: string;
  tenant_id: string;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  metadata: unknown;
  event_schema_version?: number | string | bigint | null;
  event_topic?: string | null;
  envelope_version?: number | string | bigint | null;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: Date;
  published_at: Date | null;
  publish_attempt_count: number;
}

export function outboxRowToEnvelope(row: OutboxEventRow): HrEventEnvelope<unknown> {
  const metadata = normalizeMetadata(row);
  const stored = isRecord(row.metadata) ? row.metadata : {};
  const eventSchemaVersion = positiveNumberFrom(row.event_schema_version)
    ?? positiveNumberFrom(stored.eventSchemaVersion)
    ?? 1;
  const envelopeVersion = positiveNumberFrom(row.envelope_version)
    ?? positiveNumberFrom(stored.envelopeVersion)
    ?? 1;
  return {
    eventId: new Uuid(row.id),
    eventName: row.event_name,
    eventSchemaVersion,
    tenantId: new Uuid(row.tenant_id),
    aggregateType: row.aggregate_type,
    aggregateId: new Uuid(row.aggregate_id),
    payload: row.payload,
    metadata,
    privacy: normalizePrivacy(row, metadata),
    occurredAt: row.created_at,
    version: envelopeVersion,
  };
}

export function outboxMetadataForEvent(event: HrEventEnvelope<unknown>): EventMetadata & {
  privacy: HrEventPrivacy;
  eventSchemaVersion: number;
  envelopeVersion: number;
  topic: string;
} {
  return {
    ...event.metadata,
    privacy: event.privacy,
    eventSchemaVersion: event.eventSchemaVersion,
    envelopeVersion: event.version,
    topic: getTopicForEvent(event),
  };
}

function normalizeMetadata(row: OutboxEventRow): EventMetadata {
  const stored = isRecord(row.metadata) ? row.metadata : {};
  const correlationId = uuidFrom(stored.correlationId) ?? uuidFrom(row.correlation_id) ?? new Uuid(row.id);
  const causationId = uuidFrom(stored.causationId) ?? uuidFrom(row.causation_id);
  const clientType = isClientType(stored.clientType) ? stored.clientType : 'SYSTEM';
  const requestHash = typeof stored.requestHash === 'string' && stored.requestHash.length > 0
    ? stored.requestHash
    : row.id;

  const metadata: EventMetadata = {
    correlationId,
    causationId,
    sourceEventId: uuidFrom(stored.sourceEventId),
    processInstanceId: typeof stored.processInstanceId === 'string' ? stored.processInstanceId : undefined,
    requestHash,
    clientType,
    dataResidencyRegion: typeof stored.dataResidencyRegion === 'string' ? stored.dataResidencyRegion : undefined,
    hrDataSensitivity: isHrDataSensitivity(stored.hrDataSensitivity) ? stored.hrDataSensitivity : undefined,
    topic: stringFrom(row.event_topic) ?? stringFrom(stored.topic) ?? getTopicForEvent({
      aggregateType: row.aggregate_type,
      eventName: row.event_name,
    }),
    eventSchemaVersion: positiveNumberFrom(row.event_schema_version) ?? positiveNumberFrom(stored.eventSchemaVersion) ?? 1,
    envelopeVersion: positiveNumberFrom(row.envelope_version) ?? positiveNumberFrom(stored.envelopeVersion) ?? 1,
  };
  return {
    ...metadata,
    sourceOutboxEventId: row.id,
    publicationSource: 'OUTBOX',
  } as EventMetadata;
}

function positiveNumberFrom(value: unknown): number | undefined {
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function uuidFrom(value: unknown): Uuid | undefined {
  if (value instanceof Uuid) {
    return value;
  }
  if (typeof value === 'string' && Uuid.isValid(value)) {
    return new Uuid(value);
  }
  if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) {
    return new Uuid(value.value);
  }
  return undefined;
}

function normalizePrivacy(row: OutboxEventRow, metadata: EventMetadata): HrEventPrivacy {
  const stored = isRecord(row.metadata) ? row.metadata : {};
  if (isHrEventPrivacy(stored.privacy)) {
    return stored.privacy;
  }

  const classification = metadata.hrDataSensitivity ?? 'NONE';
  return createPrivacyForEvent(
    classification,
    extractWorkerId(row.payload),
    inferEmployeeDataCategory(row.aggregate_type),
  );
}

function extractWorkerId(value: unknown): string | undefined {
  if (!isRecord(value) && !Array.isArray(value)) return undefined;
  const preferredKeys = ['subjectWorkerId', 'workerId', 'employeeId', 'recipientWorkerId'];
  const queue = Array.isArray(value) ? [...value] : [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (!isRecord(current)) continue;
    for (const key of preferredKeys) {
      const candidate = readUuidLike(current[key]);
      if (candidate) return candidate;
    }
    queue.push(...Object.values(current));
  }
  return undefined;
}

function readUuidLike(value: unknown): string | undefined {
  if (value instanceof Uuid) return value.value;
  if (typeof value === 'string' && Uuid.isValid(value)) return value;
  if (isRecord(value) && typeof value.value === 'string' && Uuid.isValid(value.value)) return value.value;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isClientType(value: unknown): value is ClientType {
  return typeof value === 'string' && [
    'EMPLOYEE_PORTAL',
    'MANAGER_PORTAL',
    'HR_ADMIN',
    'MOBILE',
    'BFF',
    'SYSTEM',
    'INTEGRATION',
  ].includes(value);
}

function isHrDataSensitivity(
  value: unknown,
): value is NonNullable<EventMetadata['hrDataSensitivity']> {
  return typeof value === 'string' && [
    'LOW',
    'MEDIUM',
    'HIGH',
    'RESTRICTED',
    'SPECIAL_CATEGORY',
  ].includes(value);
}

function isHrEventPrivacy(value: unknown): value is HrEventPrivacy {
  if (!isRecord(value)) return false;
  return (
    isPrivacyClassification(value.piiClassification) &&
    (value.subjectWorkerId === undefined || (typeof value.subjectWorkerId === 'string' && Uuid.isValid(value.subjectWorkerId))) &&
    typeof value.managerVisible === 'boolean' &&
    typeof value.employeeVisible === 'boolean' &&
    typeof value.hrRestricted === 'boolean' &&
    typeof value.redactionApplied === 'boolean'
  );
}

function isPrivacyClassification(value: unknown): value is HrEventPrivacy['piiClassification'] {
  return typeof value === 'string' && [
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'RESTRICTED',
    'SPECIAL_CATEGORY',
  ].includes(value);
}

function inferEmployeeDataCategory(aggregateType: string): HrEventPrivacy['employeeDataCategory'] {
  const value = aggregateType.toLowerCase();
  if (value.includes('payroll') || value.includes('payslip')) return 'PAYROLL';
  if (value.includes('compensation') || value.includes('bonus') || value.includes('equity')) return 'COMPENSATION';
  if (value.includes('benefits')) return 'BENEFITS';
  if (value.includes('performance') || value.includes('objective') || value.includes('goal')) return 'PERFORMANCE';
  if (value.includes('relations') || value.includes('disciplinary') || value.includes('grievance')) return 'ER_CASE';
  if (value.includes('medical') || value.includes('wellness') || value.includes('eap')) return 'MEDICAL';
  if (value.includes('authorization') || value.includes('visa') || value.includes('immigration')) return 'IMMIGRATION';
  if (value.includes('survey')) return 'SURVEY';
  return 'PROFILE';
}
