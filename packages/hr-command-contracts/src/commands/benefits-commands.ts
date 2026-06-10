import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Benefits enrollment commands                                       */
/* ------------------------------------------------------------------ */

export const CreateBenefitsEnrollmentCommandName = 'CreateBenefitsEnrollment' as const;

export interface BenefitsEnrollmentDependentPayload {
  dependentId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: Date;
}

export interface CreateBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  programId: Uuid;
  coverageLevel: string;
  dependents: BenefitsEnrollmentDependentPayload[];
  effectiveDate: Date;
}

export const BenefitsEnrollmentDependentPayloadSchema = z.object({
  dependentId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  relationship: z.string().min(1),
  dateOfBirth: z.coerce.date(),
});

export const CreateBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  programId: z.string().uuid(),
  coverageLevel: z.string().min(1),
  dependents: z.array(BenefitsEnrollmentDependentPayloadSchema),
  effectiveDate: z.coerce.date(),
});

export const ApproveBenefitsEnrollmentCommandName = 'ApproveBenefitsEnrollment' as const;

export interface ApproveBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  approvedBy?: Uuid;
}

export const ApproveBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  approvedBy: z.string().uuid().optional(),
});

export const RejectBenefitsEnrollmentCommandName = 'RejectBenefitsEnrollment' as const;

export interface RejectBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  rejectedBy?: Uuid;
  reason?: string;
}

export const RejectBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  rejectedBy: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export const MakeEffectiveBenefitsEnrollmentCommandName = 'MakeEffectiveBenefitsEnrollment' as const;

export interface MakeEffectiveBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
}

export const MakeEffectiveBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const TerminateBenefitsEnrollmentCommandName = 'TerminateBenefitsEnrollment' as const;

export interface TerminateBenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  reason?: string;
}

export const TerminateBenefitsEnrollmentPayloadSchema = z.object({
  enrollmentId: z.string().uuid(),
  reason: z.string().optional(),
});

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

export const CreateBenefitsLifeEventCommandName = 'CreateBenefitsLifeEvent' as const;

export interface CreateBenefitsLifeEventPayload {
  lifeEventId: Uuid;
  workerId: Uuid;
  eventType: string;
  eventDate: Date;
  description?: string;
}

export const CreateBenefitsLifeEventPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  workerId: z.string().uuid(),
  eventType: z.string().min(1),
  eventDate: z.coerce.date(),
  description: z.string().optional(),
});

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

export const ProcessBenefitsLifeEventCommandName = 'ProcessBenefitsLifeEvent' as const;

export interface ProcessBenefitsLifeEventPayload {
  lifeEventId: Uuid;
  processedBy?: Uuid;
}

export const ProcessBenefitsLifeEventPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  processedBy: z.string().uuid().optional(),
});

export const RejectBenefitsLifeEventCommandName = 'RejectBenefitsLifeEvent' as const;

export interface RejectBenefitsLifeEventPayload {
  lifeEventId: Uuid;
  rejectedBy?: Uuid;
  reason?: string;
}

export const RejectBenefitsLifeEventPayloadSchema = z.object({
  lifeEventId: z.string().uuid(),
  rejectedBy: z.string().uuid().optional(),
  reason: z.string().optional(),
});
