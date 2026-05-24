import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Worker commands                                                    */
/* ------------------------------------------------------------------ */

export const CreateWorkerCommandName = 'CreateWorker' as const;

export interface CreateWorkerPayload {
  workerId: Uuid;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  email?: string;
}

export const CreateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email().optional(),
});

export const ActivateWorkerCommandName = 'ActivateWorker' as const;

export interface ActivateWorkerPayload {
  workerId: Uuid;
  activationDate?: Date;
}

export const ActivateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  activationDate: z.coerce.date().optional(),
});

export const UpdateWorkerPersonalDataCommandName = 'UpdateWorkerPersonalData' as const;

export interface UpdateWorkerPersonalDataPayload {
  workerId: Uuid;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  email?: string;
  phoneNumber?: string;
}

export const UpdateWorkerPersonalDataPayloadSchema = z.object({
  workerId: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
});

export const TerminateWorkerCommandName = 'TerminateWorker' as const;

export interface TerminateWorkerPayload {
  workerId: Uuid;
  terminationDate: Date;
  reason: string;
}

export const TerminateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  terminationDate: z.coerce.date(),
  reason: z.string().min(1),
});

export const ReactivateWorkerCommandName = 'ReactivateWorker' as const;

export interface ReactivateWorkerPayload {
  workerId: Uuid;
  reason: string;
  reactivationDate?: Date;
}

export const ReactivateWorkerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  reason: z.string().min(1),
  reactivationDate: z.coerce.date().optional(),
});

/* ------------------------------------------------------------------ */
/*  Job assignment commands                                            */
/* ------------------------------------------------------------------ */

export const CreateJobAssignmentCommandName = 'CreateJobAssignment' as const;

export interface CreateJobAssignmentPayload {
  assignmentId: Uuid;
  workerId: Uuid;
  positionId: Uuid;
  startDate: Date;
  endDate?: Date;
}

export const CreateJobAssignmentPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  positionId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const ActivateJobAssignmentCommandName = 'ActivateJobAssignment' as const;

export interface ActivateJobAssignmentPayload {
  assignmentId: Uuid;
}

export const ActivateJobAssignmentPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
});

export const EndJobAssignmentCommandName = 'EndJobAssignment' as const;

export interface EndJobAssignmentPayload {
  assignmentId: Uuid;
  endDate: Date;
  reason: string;
}

export const EndJobAssignmentPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
  endDate: z.coerce.date(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Employment contract commands                                       */
/* ------------------------------------------------------------------ */

export const CreateEmploymentContractCommandName = 'CreateEmploymentContract' as const;

export interface CreateEmploymentContractPayload {
  contractId: Uuid;
  workerId: Uuid;
  contractType: string;
  startDate: Date;
  endDate?: Date;
}

export const CreateEmploymentContractPayloadSchema = z.object({
  contractId: z.string().uuid(),
  workerId: z.string().uuid(),
  contractType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const SignEmploymentContractCommandName = 'SignEmploymentContract' as const;

export interface SignEmploymentContractPayload {
  contractId: Uuid;
  signedAt: Date;
}

export const SignEmploymentContractPayloadSchema = z.object({
  contractId: z.string().uuid(),
  signedAt: z.coerce.date(),
});

export const TerminateEmploymentContractCommandName = 'TerminateEmploymentContract' as const;

export interface TerminateEmploymentContractPayload {
  contractId: Uuid;
  terminationDate: Date;
  reason: string;
}

export const TerminateEmploymentContractPayloadSchema = z.object({
  contractId: z.string().uuid(),
  terminationDate: z.coerce.date(),
  reason: z.string().min(1),
});
