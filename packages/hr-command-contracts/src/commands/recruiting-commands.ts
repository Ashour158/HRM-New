import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Job requisition commands                                           */
/* ------------------------------------------------------------------ */

export const CreateJobRequisitionCommandName = 'CreateJobRequisition' as const;

export interface CreateJobRequisitionPayload {
  requisitionId: Uuid;
  positionId: Uuid;
  title: string;
  description?: string;
}

export const CreateJobRequisitionPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  positionId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const ApproveJobRequisitionCommandName = 'ApproveJobRequisition' as const;

export interface ApproveJobRequisitionPayload {
  requisitionId: Uuid;
}

export const ApproveJobRequisitionPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
});

export const PublishJobRequisitionCommandName = 'PublishJobRequisition' as const;

export interface PublishJobRequisitionPayload {
  requisitionId: Uuid;
}

export const PublishJobRequisitionPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
});

export const CloseJobRequisitionCommandName = 'CloseJobRequisition' as const;

export interface CloseJobRequisitionPayload {
  requisitionId: Uuid;
  reason: string;
}

export const CloseJobRequisitionPayloadSchema = z.object({
  requisitionId: z.string().uuid(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Candidate commands                                                 */
/* ------------------------------------------------------------------ */

export const SubmitCandidateApplicationCommandName = 'SubmitCandidateApplication' as const;

export interface SubmitCandidateApplicationPayload {
  applicationId: Uuid;
  requisitionId: Uuid;
  candidateEmail: string;
  candidateName: string;
}

export const SubmitCandidateApplicationPayloadSchema = z.object({
  applicationId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(1),
});

export const ScreenCandidateCommandName = 'ScreenCandidate' as const;

export interface ScreenCandidatePayload {
  applicationId: Uuid;
  screenedByWorkerId: Uuid;
  outcome: string;
}

export const ScreenCandidatePayloadSchema = z.object({
  applicationId: z.string().uuid(),
  screenedByWorkerId: z.string().uuid(),
  outcome: z.string().min(1),
});

export const ScheduleInterviewCommandName = 'ScheduleInterview' as const;

export interface ScheduleInterviewPayload {
  interviewId: Uuid;
  applicationId: Uuid;
  scheduledAt: Date;
  interviewerWorkerIds: Uuid[];
}

export const ScheduleInterviewPayloadSchema = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  interviewerWorkerIds: z.array(z.string().uuid()).min(1),
});

/* ------------------------------------------------------------------ */
/*  Offer commands                                                     */
/* ------------------------------------------------------------------ */

export const CreateOfferCommandName = 'CreateOffer' as const;

export interface CreateOfferPayload {
  offerId: Uuid;
  applicationId: Uuid;
  proposedSalary: number;
  currency: string;
  startDate: Date;
}

export const CreateOfferPayloadSchema = z.object({
  offerId: z.string().uuid(),
  applicationId: z.string().uuid(),
  proposedSalary: z.number().positive(),
  currency: z.string().length(3),
  startDate: z.coerce.date(),
});

export const ApproveOfferCommandName = 'ApproveOffer' as const;

export interface ApproveOfferPayload {
  offerId: Uuid;
}

export const ApproveOfferPayloadSchema = z.object({
  offerId: z.string().uuid(),
});

export const AcceptOfferCommandName = 'AcceptOffer' as const;

export interface AcceptOfferPayload {
  offerId: Uuid;
  acceptedAt: Date;
}

export const AcceptOfferPayloadSchema = z.object({
  offerId: z.string().uuid(),
  acceptedAt: z.coerce.date(),
});

export const DeclineOfferCommandName = 'DeclineOffer' as const;

export interface DeclineOfferPayload {
  offerId: Uuid;
  reason: string;
}

export const DeclineOfferPayloadSchema = z.object({
  offerId: z.string().uuid(),
  reason: z.string().min(1),
});
