import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Absence request commands                                           */
/* ------------------------------------------------------------------ */

export const SubmitAbsenceRequestCommandName = 'SubmitAbsenceRequest' as const;

export interface SubmitAbsenceRequestPayload {
  requestId: Uuid;
  workerId: Uuid;
  absenceType: string;
  startDate: Date;
  endDate: Date;
}

export const SubmitAbsenceRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
  workerId: z.string().uuid(),
  absenceType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const ApproveAbsenceRequestCommandName = 'ApproveAbsenceRequest' as const;

export interface ApproveAbsenceRequestPayload {
  requestId: Uuid;
}

export const ApproveAbsenceRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
});

export const RejectAbsenceRequestCommandName = 'RejectAbsenceRequest' as const;

export interface RejectAbsenceRequestPayload {
  requestId: Uuid;
  reason: string;
}

export const RejectAbsenceRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(1),
});

export const CancelAbsenceRequestCommandName = 'CancelAbsenceRequest' as const;

export interface CancelAbsenceRequestPayload {
  requestId: Uuid;
  reason: string;
}

export const CancelAbsenceRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Leave case commands                                                */
/* ------------------------------------------------------------------ */

export const OpenLeaveCaseCommandName = 'OpenLeaveCase' as const;

export interface OpenLeaveCasePayload {
  caseId: Uuid;
  workerId: Uuid;
  leaveType: string;
  startDate: Date;
}

export const OpenLeaveCasePayloadSchema = z.object({
  caseId: z.string().uuid(),
  workerId: z.string().uuid(),
  leaveType: z.string().min(1),
  startDate: z.coerce.date(),
});

export const CloseLeaveCaseCommandName = 'CloseLeaveCase' as const;

export interface CloseLeaveCasePayload {
  caseId: Uuid;
  closedOn: Date;
}

export const CloseLeaveCasePayloadSchema = z.object({
  caseId: z.string().uuid(),
  closedOn: z.coerce.date(),
});
