import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from './actor.js';
import { HrActorSchema } from './actor.js';

/**
 * Universal command envelope used for every command in the HR/HCM platform.
 *
 * @template TPayload - The domain-specific payload type for the command.
 */
export interface HrCommandEnvelope<TPayload> {
  commandId: Uuid;
  commandName: string;
  commandSchemaVersion: number;
  tenantId: Uuid;
  actor: HrActor;
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
  payload: TPayload;
  metadata: {
    requestHash: string;
    clientType: 'EMPLOYEE_PORTAL' | 'MANAGER_PORTAL' | 'HR_ADMIN' | 'MOBILE' | 'BFF' | 'SYSTEM' | 'SYSTEM_SCHEDULER' | 'INTEGRATION';
    dataResidencyRegion?: string;
    hrDataSensitivity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'RESTRICTED' | 'SPECIAL_CATEGORY';
  };
}

/**
 * Builds a Zod schema for a command envelope wrapping the given payload schema.
 *
 * @param payloadSchema - Zod schema for the command-specific payload.
 * @returns Zod schema for the full {@link HrCommandEnvelope}.
 */
export function HrCommandEnvelopeSchema<TPayload>(
  payloadSchema: z.ZodType<TPayload>
): z.ZodType<HrCommandEnvelope<TPayload>> {
  return z.object({
    commandId: z.string().uuid(),
    commandName: z.string().min(1),
    commandSchemaVersion: z.number().int().positive(),
    tenantId: z.string().uuid(),
    actor: HrActorSchema,
    subjectWorkerId: z.string().uuid().optional(),
    aggregateType: z.string().min(1),
    aggregateId: z.string().uuid().optional(),
    expectedState: z.string().optional(),
    expectedVersion: z.number().int().optional(),
    effectiveDate: z.coerce.date().optional(),
    idempotencyKey: z.string().min(1),
    correlationId: z.string().uuid(),
    causationId: z.string().uuid().optional(),
    sourceEventId: z.string().uuid().optional(),
    processInstanceId: z.string().optional(),
    reason: z.string().min(1),
    payload: payloadSchema,
    metadata: z.object({
      requestHash: z.string().min(1),
      clientType: z.enum([
        'EMPLOYEE_PORTAL',
        'MANAGER_PORTAL',
        'HR_ADMIN',
        'MOBILE',
        'BFF',
        'SYSTEM',
        'SYSTEM_SCHEDULER',
        'INTEGRATION',
      ]),
      dataResidencyRegion: z.string().optional(),
      hrDataSensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'RESTRICTED', 'SPECIAL_CATEGORY']).optional(),
    }),
  }) as unknown as z.ZodType<HrCommandEnvelope<TPayload>>;
}
