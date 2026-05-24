/**
 * HR Core domain events.
 *
 * Covers worker lifecycle, job assignments, employment contracts,
 * and personal-data change notifications.
 *
 * Payloads contain UUID references only – never raw PII.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// WorkerProfileCreated
// ------------------------------------------------------------------

export interface WorkerProfileCreatedPayload {
  workerId: Uuid;
  personId: Uuid;
  createdBy: Uuid;
}

export const WorkerProfileCreatedPayloadSchema = z.object({
  workerId: z.string().uuid(),
  personId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const WORKER_PROFILE_CREATED = 'WorkerProfileCreated';

export type WorkerProfileCreatedEvent = HrEventEnvelope<WorkerProfileCreatedPayload>;

export function isWorkerProfileCreatedEvent(event: unknown): event is WorkerProfileCreatedEvent {
  const parsed = HrEventEnvelopeSchema(WorkerProfileCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === WORKER_PROFILE_CREATED;
}

// ------------------------------------------------------------------
// WorkerActivated
// ------------------------------------------------------------------

export interface WorkerActivatedPayload {
  workerId: Uuid;
  activatedBy: Uuid;
  effectiveDate: string;
}

export const WorkerActivatedPayloadSchema = z.object({
  workerId: z.string().uuid(),
  activatedBy: z.string().uuid(),
  effectiveDate: z.string().datetime(),
});

export const WORKER_ACTIVATED = 'WorkerActivated';

export type WorkerActivatedEvent = HrEventEnvelope<WorkerActivatedPayload>;

export function isWorkerActivatedEvent(event: unknown): event is WorkerActivatedEvent {
  const parsed = HrEventEnvelopeSchema(WorkerActivatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === WORKER_ACTIVATED;
}

// ------------------------------------------------------------------
// WorkerTerminated
// ------------------------------------------------------------------

export interface WorkerTerminatedPayload {
  workerId: Uuid;
  terminationReasonId?: Uuid;
  terminatedBy: Uuid;
  effectiveDate: string;
}

export const WorkerTerminatedPayloadSchema = z.object({
  workerId: z.string().uuid(),
  terminationReasonId: z.string().uuid().optional(),
  terminatedBy: z.string().uuid(),
  effectiveDate: z.string().datetime(),
});

export const WORKER_TERMINATED = 'WorkerTerminated';

export type WorkerTerminatedEvent = HrEventEnvelope<WorkerTerminatedPayload>;

export function isWorkerTerminatedEvent(event: unknown): event is WorkerTerminatedEvent {
  const parsed = HrEventEnvelopeSchema(WorkerTerminatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === WORKER_TERMINATED;
}

// ------------------------------------------------------------------
// WorkerReactivated
// ------------------------------------------------------------------

export interface WorkerReactivatedPayload {
  workerId: Uuid;
  reactivatedBy: Uuid;
  priorTerminationId: Uuid;
  effectiveDate: string;
}

export const WorkerReactivatedPayloadSchema = z.object({
  workerId: z.string().uuid(),
  reactivatedBy: z.string().uuid(),
  priorTerminationId: z.string().uuid(),
  effectiveDate: z.string().datetime(),
});

export const WORKER_REACTIVATED = 'WorkerReactivated';

export type WorkerReactivatedEvent = HrEventEnvelope<WorkerReactivatedPayload>;

export function isWorkerReactivatedEvent(event: unknown): event is WorkerReactivatedEvent {
  const parsed = HrEventEnvelopeSchema(WorkerReactivatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === WORKER_REACTIVATED;
}

// ------------------------------------------------------------------
// JobAssignmentCreated
// ------------------------------------------------------------------

export interface JobAssignmentCreatedPayload {
  jobAssignmentId: Uuid;
  workerId: Uuid;
  positionId: Uuid;
  legalEntityId: Uuid;
  orgUnitId: Uuid;
  effectiveDate: string;
}

export const JobAssignmentCreatedPayloadSchema = z.object({
  jobAssignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  positionId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  effectiveDate: z.string().datetime(),
});

export const JOB_ASSIGNMENT_CREATED = 'JobAssignmentCreated';

export type JobAssignmentCreatedEvent = HrEventEnvelope<JobAssignmentCreatedPayload>;

export function isJobAssignmentCreatedEvent(event: unknown): event is JobAssignmentCreatedEvent {
  const parsed = HrEventEnvelopeSchema(JobAssignmentCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_ASSIGNMENT_CREATED;
}

// ------------------------------------------------------------------
// JobAssignmentActivated
// ------------------------------------------------------------------

export interface JobAssignmentActivatedPayload {
  jobAssignmentId: Uuid;
  workerId: Uuid;
  activatedBy: Uuid;
  effectiveDate: string;
}

export const JobAssignmentActivatedPayloadSchema = z.object({
  jobAssignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  activatedBy: z.string().uuid(),
  effectiveDate: z.string().datetime(),
});

export const JOB_ASSIGNMENT_ACTIVATED = 'JobAssignmentActivated';

export type JobAssignmentActivatedEvent = HrEventEnvelope<JobAssignmentActivatedPayload>;

export function isJobAssignmentActivatedEvent(event: unknown): event is JobAssignmentActivatedEvent {
  const parsed = HrEventEnvelopeSchema(JobAssignmentActivatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_ASSIGNMENT_ACTIVATED;
}

// ------------------------------------------------------------------
// JobAssignmentEnded
// ------------------------------------------------------------------

export interface JobAssignmentEndedPayload {
  jobAssignmentId: Uuid;
  workerId: Uuid;
  endedBy: Uuid;
  endReasonId?: Uuid;
  effectiveDate: string;
}

export const JobAssignmentEndedPayloadSchema = z.object({
  jobAssignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  endedBy: z.string().uuid(),
  endReasonId: z.string().uuid().optional(),
  effectiveDate: z.string().datetime(),
});

export const JOB_ASSIGNMENT_ENDED = 'JobAssignmentEnded';

export type JobAssignmentEndedEvent = HrEventEnvelope<JobAssignmentEndedPayload>;

export function isJobAssignmentEndedEvent(event: unknown): event is JobAssignmentEndedEvent {
  const parsed = HrEventEnvelopeSchema(JobAssignmentEndedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === JOB_ASSIGNMENT_ENDED;
}

// ------------------------------------------------------------------
// EmploymentContractCreated
// ------------------------------------------------------------------

export interface EmploymentContractCreatedPayload {
  contractId: Uuid;
  workerId: Uuid;
  contractTypeId: Uuid;
  legalEntityId: Uuid;
  effectiveDate: string;
}

export const EmploymentContractCreatedPayloadSchema = z.object({
  contractId: z.string().uuid(),
  workerId: z.string().uuid(),
  contractTypeId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  effectiveDate: z.string().datetime(),
});

export const EMPLOYMENT_CONTRACT_CREATED = 'EmploymentContractCreated';

export type EmploymentContractCreatedEvent = HrEventEnvelope<EmploymentContractCreatedPayload>;

export function isEmploymentContractCreatedEvent(event: unknown): event is EmploymentContractCreatedEvent {
  const parsed = HrEventEnvelopeSchema(EmploymentContractCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === EMPLOYMENT_CONTRACT_CREATED;
}

// ------------------------------------------------------------------
// EmploymentContractSigned
// ------------------------------------------------------------------

export interface EmploymentContractSignedPayload {
  contractId: Uuid;
  signedBy: Uuid;
  signedAt: string;
}

export const EmploymentContractSignedPayloadSchema = z.object({
  contractId: z.string().uuid(),
  signedBy: z.string().uuid(),
  signedAt: z.string().datetime(),
});

export const EMPLOYMENT_CONTRACT_SIGNED = 'EmploymentContractSigned';

export type EmploymentContractSignedEvent = HrEventEnvelope<EmploymentContractSignedPayload>;

export function isEmploymentContractSignedEvent(event: unknown): event is EmploymentContractSignedEvent {
  const parsed = HrEventEnvelopeSchema(EmploymentContractSignedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === EMPLOYMENT_CONTRACT_SIGNED;
}

// ------------------------------------------------------------------
// EmploymentContractTerminated
// ------------------------------------------------------------------

export interface EmploymentContractTerminatedPayload {
  contractId: Uuid;
  terminatedBy: Uuid;
  terminationReasonId?: Uuid;
  effectiveDate: string;
}

export const EmploymentContractTerminatedPayloadSchema = z.object({
  contractId: z.string().uuid(),
  terminatedBy: z.string().uuid(),
  terminationReasonId: z.string().uuid().optional(),
  effectiveDate: z.string().datetime(),
});

export const EMPLOYMENT_CONTRACT_TERMINATED = 'EmploymentContractTerminated';

export type EmploymentContractTerminatedEvent = HrEventEnvelope<EmploymentContractTerminatedPayload>;

export function isEmploymentContractTerminatedEvent(event: unknown): event is EmploymentContractTerminatedEvent {
  const parsed = HrEventEnvelopeSchema(EmploymentContractTerminatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === EMPLOYMENT_CONTRACT_TERMINATED;
}

// ------------------------------------------------------------------
// PersonalDataUpdated
// ------------------------------------------------------------------

export interface PersonalDataUpdatedPayload {
  workerId: Uuid;
  changeRequestId: Uuid;
  fieldCategory: string;
}

export const PersonalDataUpdatedPayloadSchema = z.object({
  workerId: z.string().uuid(),
  changeRequestId: z.string().uuid(),
  fieldCategory: z.string().min(1),
});

export const PERSONAL_DATA_UPDATED = 'PersonalDataUpdated';

export type PersonalDataUpdatedEvent = HrEventEnvelope<PersonalDataUpdatedPayload>;

export function isPersonalDataUpdatedEvent(event: unknown): event is PersonalDataUpdatedEvent {
  const parsed = HrEventEnvelopeSchema(PersonalDataUpdatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PERSONAL_DATA_UPDATED;
}
