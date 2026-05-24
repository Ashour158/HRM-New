import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Policy document commands                                           */
/* ------------------------------------------------------------------ */

export const PublishPolicyDocumentCommandName = 'PublishPolicyDocument' as const;

export interface PublishPolicyDocumentPayload {
  documentId: Uuid;
  title: string;
  version: string;
  contentUrl: string;
}

export const PublishPolicyDocumentPayloadSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(1),
  version: z.string().min(1),
  contentUrl: z.string().url(),
});

export const RequirePolicyAcknowledgementCommandName = 'RequirePolicyAcknowledgement' as const;

export interface RequirePolicyAcknowledgementPayload {
  requirementId: Uuid;
  documentId: Uuid;
  workerId: Uuid;
  dueDate: Date;
}

export const RequirePolicyAcknowledgementPayloadSchema = z.object({
  requirementId: z.string().uuid(),
  documentId: z.string().uuid(),
  workerId: z.string().uuid(),
  dueDate: z.coerce.date(),
});

export const RecordPolicyAcknowledgementCommandName = 'RecordPolicyAcknowledgement' as const;

export interface RecordPolicyAcknowledgementPayload {
  requirementId: Uuid;
  acknowledgedAt: Date;
}

export const RecordPolicyAcknowledgementPayloadSchema = z.object({
  requirementId: z.string().uuid(),
  acknowledgedAt: z.coerce.date(),
});

/* ------------------------------------------------------------------ */
/*  Legal hold commands                                                */
/* ------------------------------------------------------------------ */

export const PlaceLegalHoldCommandName = 'PlaceLegalHold' as const;

export interface PlaceLegalHoldPayload {
  holdId: Uuid;
  workerId: Uuid;
  reason: string;
  placedByWorkerId: Uuid;
}

export const PlaceLegalHoldPayloadSchema = z.object({
  holdId: z.string().uuid(),
  workerId: z.string().uuid(),
  reason: z.string().min(1),
  placedByWorkerId: z.string().uuid(),
});

export const ReleaseLegalHoldCommandName = 'ReleaseLegalHold' as const;

export interface ReleaseLegalHoldPayload {
  holdId: Uuid;
  releasedByWorkerId: Uuid;
}

export const ReleaseLegalHoldPayloadSchema = z.object({
  holdId: z.string().uuid(),
  releasedByWorkerId: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/*  Statutory reporting commands                                       */
/* ------------------------------------------------------------------ */

export const SubmitStatutoryReportCommandName = 'SubmitStatutoryReport' as const;

export interface SubmitStatutoryReportPayload {
  reportId: Uuid;
  reportType: string;
  countryCode: string;
  periodStart: Date;
  periodEnd: Date;
  dataUrl: string;
}

export const SubmitStatutoryReportPayloadSchema = z.object({
  reportId: z.string().uuid(),
  reportType: z.string().min(1),
  countryCode: z.string().length(2),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  dataUrl: z.string().url(),
});
