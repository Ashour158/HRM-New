import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { ValidationError, Ok, Err, type Result, Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '../core/actor.js';
import type { HrCommandEnvelope } from '../core/command-envelope.js';

/**
 * Options used when constructing a command envelope via {@link createCommand}.
 */
export interface CreateCommandOptions {
  subjectWorkerId?: Uuid;
  aggregateType: string;
  aggregateId?: Uuid;
  expectedState?: string;
  expectedVersion?: number;
  effectiveDate?: Date;
  idempotencyKey: string;
  correlationId: Uuid;
  causationId?: Uuid;
  sourceEventId?: Uuid;
  processInstanceId?: string;
  reason: string;
  metadata?: Partial<{
    clientType: 'EMPLOYEE_PORTAL' | 'MANAGER_PORTAL' | 'HR_ADMIN' | 'MOBILE' | 'BFF' | 'SYSTEM' | 'INTEGRATION';
    dataResidencyRegion?: string;
    hrDataSensitivity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'RESTRICTED' | 'SPECIAL_CATEGORY';
  }>;
}

/**
 * Creates a fully-populated {@link HrCommandEnvelope}.
 *
 * @param commandName - Canonical command name (e.g. "CreateWorker").
 * @param tenantId - Target tenant UUID.
 * @param actor - The actor initiating the command.
 * @param payload - Domain-specific payload.
 * @param options - Envelope options (idempotency, correlation, locking, etc.).
 * @returns A typed command envelope ready for dispatch.
 */
export function createCommand<TPayload>(
  commandName: string,
  tenantId: Uuid,
  actor: HrActor,
  payload: TPayload,
  options: CreateCommandOptions
): HrCommandEnvelope<TPayload> {
  const commandId = new Uuid(randomUUID());
  const requestHash = computeRequestHash(payload);

  return {
    commandId,
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor,
    subjectWorkerId: options.subjectWorkerId,
    aggregateType: options.aggregateType,
    aggregateId: options.aggregateId,
    expectedState: options.expectedState,
    expectedVersion: options.expectedVersion,
    effectiveDate: options.effectiveDate,
    idempotencyKey: options.idempotencyKey,
    correlationId: options.correlationId,
    causationId: options.causationId,
    sourceEventId: options.sourceEventId,
    processInstanceId: options.processInstanceId,
    reason: options.reason,
    payload,
    metadata: {
      requestHash,
      clientType: options.metadata?.clientType ?? 'SYSTEM',
      dataResidencyRegion: options.metadata?.dataResidencyRegion,
      hrDataSensitivity: options.metadata?.hrDataSensitivity,
    },
  };
}

/**
 * Recursively sorts object keys so that JSON serialization is deterministic.
 */
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

/**
 * Computes a SHA-256 hash of the normalized JSON representation of a payload.
 *
 * @param payload - The payload to hash.
 * @returns Hex-encoded SHA-256 digest.
 */
export function computeRequestHash(payload: unknown): string {
  const normalized = JSON.stringify(sortKeys(payload));
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validates an unknown input against a command envelope schema.
 *
 * @param schema - Zod schema for the full command envelope.
 * @param input - Raw input to validate.
 * @returns A {@link Result} containing the parsed envelope or a {@link ValidationError}.
 */
export function validateCommand<TPayload>(
  schema: z.ZodType<HrCommandEnvelope<TPayload>>,
  input: unknown
): Result<HrCommandEnvelope<TPayload>, ValidationError> {
  const parseResult = schema.safeParse(input);
  if (parseResult.success) {
    return new Ok(parseResult.data);
  }

  const details: Record<string, string[]> = {};
  for (const issue of parseResult.error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return new Err(new ValidationError('Command validation failed', details));
}
