import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Benefits enrollment commands                                       */
/* ------------------------------------------------------------------ */

export const OpenBenefitsEnrollmentCommandName = 'OpenBenefitsEnrollment' as const;

export interface OpenBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  enrollmentWindowStart: Date;
  enrollmentWindowEnd: Date;
}

export const OpenBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  enrollmentWindowStart: z.coerce.date(),
  enrollmentWindowEnd: z.coerce.date(),
});

export const FinalizeBenefitsEnrollmentCommandName = 'FinalizeBenefitsEnrollment' as const;

export interface FinalizeBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
}

export const FinalizeBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const CancelBenefitsEnrollmentCommandName = 'CancelBenefitsEnrollment' as const;

export interface CancelBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  reason: string;
}

export const CancelBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Dependent commands                                                 */
/* ------------------------------------------------------------------ */

export const AddDependentCommandName = 'AddDependent' as const;

export interface AddDependentPayload {
  dependentId: Uuid;
  workerId: Uuid;
  firstName: string;
  lastName: string;
  relationship: string;
}

export const AddDependentPayloadSchema = z.object({
  dependentId: z.string().uuid(),
  workerId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  relationship: z.string().min(1),
});

export const VerifyDependentCommandName = 'VerifyDependent' as const;

export interface VerifyDependentPayload {
  dependentId: Uuid;
  verifiedByWorkerId: Uuid;
}

export const VerifyDependentPayloadSchema = z.object({
  dependentId: z.string().uuid(),
  verifiedByWorkerId: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/*  Life event commands                                                */
/* ------------------------------------------------------------------ */

export const RecordLifeEventCommandName = 'RecordLifeEvent' as const;

export interface RecordLifeEventPayload {
  lifeEventId: Uuid;
  workerId: Uuid;
  eventType: string;
  occurredOn: Date;
}

export const RecordLifeEventPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  workerId: z.string().uuid(),
  eventType: z.string().min(1),
  occurredOn: z.coerce.date(),
});

export const ProcessLifeEventCommandName = 'ProcessLifeEvent' as const;

export interface ProcessLifeEventPayload {
  lifeEventId: Uuid;
}

export const ProcessLifeEventPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
});
