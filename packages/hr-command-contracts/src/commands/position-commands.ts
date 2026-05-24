import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Position lifecycle commands                                        */
/* ------------------------------------------------------------------ */

export const CreatePositionCommandName = 'CreatePosition' as const;

export interface CreatePositionPayload {
  positionId: Uuid;
  orgUnitId: Uuid;
  jobCode: string;
  title: string;
}

export const CreatePositionPayloadSchema = z.object({
  positionId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  jobCode: z.string().min(1),
  title: z.string().min(1),
});

export const ActivatePositionCommandName = 'ActivatePosition' as const;

export interface ActivatePositionPayload {
  positionId: Uuid;
}

export const ActivatePositionPayloadSchema = z.object({
  positionId: z.string().uuid(),
});

export const FreezePositionCommandName = 'FreezePosition' as const;

export interface FreezePositionPayload {
  positionId: Uuid;
  reason: string;
}

export const FreezePositionPayloadSchema = z.object({
  positionId: z.string().uuid(),
  reason: z.string().min(1),
});

export const VacatePositionCommandName = 'VacatePosition' as const;

export interface VacatePositionPayload {
  positionId: Uuid;
  reason: string;
}

export const VacatePositionPayloadSchema = z.object({
  positionId: z.string().uuid(),
  reason: z.string().min(1),
});

export const ClosePositionCommandName = 'ClosePosition' as const;

export interface ClosePositionPayload {
  positionId: Uuid;
  reason: string;
}

export const ClosePositionPayloadSchema = z.object({
  positionId: z.string().uuid(),
  reason: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/*  Headcount request commands                                         */
/* ------------------------------------------------------------------ */

export const SubmitHeadcountRequestCommandName = 'SubmitHeadcountRequest' as const;

export interface SubmitHeadcountRequestPayload {
  requestId: Uuid;
  orgUnitId: Uuid;
  requestedPositions: number;
  justification: string;
}

export const SubmitHeadcountRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  requestedPositions: z.number().int().positive(),
  justification: z.string().min(1),
});

export const ApproveHeadcountRequestCommandName = 'ApproveHeadcountRequest' as const;

export interface ApproveHeadcountRequestPayload {
  requestId: Uuid;
}

export const ApproveHeadcountRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
});

export const RejectHeadcountRequestCommandName = 'RejectHeadcountRequest' as const;

export interface RejectHeadcountRequestPayload {
  requestId: Uuid;
  reason: string;
}

export const RejectHeadcountRequestPayloadSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(1),
});
