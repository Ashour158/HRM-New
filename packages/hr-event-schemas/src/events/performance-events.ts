/**
 * Performance management domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// PerformanceReviewCycleCreated
// ------------------------------------------------------------------

export interface PerformanceReviewCycleCreatedPayload {
  reviewCycleId: Uuid;
  reviewTemplateId: Uuid;
  createdBy: Uuid;
}

export const PerformanceReviewCycleCreatedPayloadSchema = z.object({
  reviewCycleId: z.string().uuid(),
  reviewTemplateId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const PERFORMANCE_REVIEW_CYCLE_CREATED = 'PerformanceReviewCycleCreated';

export type PerformanceReviewCycleCreatedEvent = HrEventEnvelope<PerformanceReviewCycleCreatedPayload>;

export function isPerformanceReviewCycleCreatedEvent(event: unknown): event is PerformanceReviewCycleCreatedEvent {
  const parsed = HrEventEnvelopeSchema(PerformanceReviewCycleCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PERFORMANCE_REVIEW_CYCLE_CREATED;
}

// ------------------------------------------------------------------
// PerformanceReviewCycleOpened
// ------------------------------------------------------------------

export interface PerformanceReviewCycleOpenedPayload {
  reviewCycleId: Uuid;
  openedBy: Uuid;
}

export const PerformanceReviewCycleOpenedPayloadSchema = z.object({
  reviewCycleId: z.string().uuid(),
  openedBy: z.string().uuid(),
});

export const PERFORMANCE_REVIEW_CYCLE_OPENED = 'PerformanceReviewCycleOpened';

export type PerformanceReviewCycleOpenedEvent = HrEventEnvelope<PerformanceReviewCycleOpenedPayload>;

export function isPerformanceReviewCycleOpenedEvent(event: unknown): event is PerformanceReviewCycleOpenedEvent {
  const parsed = HrEventEnvelopeSchema(PerformanceReviewCycleOpenedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PERFORMANCE_REVIEW_CYCLE_OPENED;
}

// ------------------------------------------------------------------
// PerformanceReviewCycleClosed
// ------------------------------------------------------------------

export interface PerformanceReviewCycleClosedPayload {
  reviewCycleId: Uuid;
  closedBy: Uuid;
}

export const PerformanceReviewCycleClosedPayloadSchema = z.object({
  reviewCycleId: z.string().uuid(),
  closedBy: z.string().uuid(),
});

export const PERFORMANCE_REVIEW_CYCLE_CLOSED = 'PerformanceReviewCycleClosed';

export type PerformanceReviewCycleClosedEvent = HrEventEnvelope<PerformanceReviewCycleClosedPayload>;

export function isPerformanceReviewCycleClosedEvent(event: unknown): event is PerformanceReviewCycleClosedEvent {
  const parsed = HrEventEnvelopeSchema(PerformanceReviewCycleClosedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PERFORMANCE_REVIEW_CYCLE_CLOSED;
}

// ------------------------------------------------------------------
// PerformanceReviewSubmitted
// ------------------------------------------------------------------

export interface PerformanceReviewSubmittedPayload {
  reviewId: Uuid;
  reviewCycleId: Uuid;
  workerId: Uuid;
  submittedBy: Uuid;
}

export const PerformanceReviewSubmittedPayloadSchema = z.object({
  reviewId: z.string().uuid(),
  reviewCycleId: z.string().uuid(),
  workerId: z.string().uuid(),
  submittedBy: z.string().uuid(),
});

export const PERFORMANCE_REVIEW_SUBMITTED = 'PerformanceReviewSubmitted';

export type PerformanceReviewSubmittedEvent = HrEventEnvelope<PerformanceReviewSubmittedPayload>;

export function isPerformanceReviewSubmittedEvent(event: unknown): event is PerformanceReviewSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(PerformanceReviewSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PERFORMANCE_REVIEW_SUBMITTED;
}

// ------------------------------------------------------------------
// PerformanceReviewAcknowledged
// ------------------------------------------------------------------

export interface PerformanceReviewAcknowledgedPayload {
  reviewId: Uuid;
  reviewCycleId: Uuid;
  workerId: Uuid;
}

export const PerformanceReviewAcknowledgedPayloadSchema = z.object({
  reviewId: z.string().uuid(),
  reviewCycleId: z.string().uuid(),
  workerId: z.string().uuid(),
});

export const PERFORMANCE_REVIEW_ACKNOWLEDGED = 'PerformanceReviewAcknowledged';

export type PerformanceReviewAcknowledgedEvent = HrEventEnvelope<PerformanceReviewAcknowledgedPayload>;

export function isPerformanceReviewAcknowledgedEvent(event: unknown): event is PerformanceReviewAcknowledgedEvent {
  const parsed = HrEventEnvelopeSchema(PerformanceReviewAcknowledgedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PERFORMANCE_REVIEW_ACKNOWLEDGED;
}

// ------------------------------------------------------------------
// GoalCreated
// ------------------------------------------------------------------

export interface GoalCreatedPayload {
  goalId: Uuid;
  workerId: Uuid;
  reviewCycleId?: Uuid;
  createdBy: Uuid;
}

export const GoalCreatedPayloadSchema = z.object({
  goalId: z.string().uuid(),
  workerId: z.string().uuid(),
  reviewCycleId: z.string().uuid().optional(),
  createdBy: z.string().uuid(),
});

export const GOAL_CREATED = 'GoalCreated';

export type GoalCreatedEvent = HrEventEnvelope<GoalCreatedPayload>;

export function isGoalCreatedEvent(event: unknown): event is GoalCreatedEvent {
  const parsed = HrEventEnvelopeSchema(GoalCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === GOAL_CREATED;
}

// ------------------------------------------------------------------
// GoalUpdated
// ------------------------------------------------------------------

export interface GoalUpdatedPayload {
  goalId: Uuid;
  workerId: Uuid;
  updatedBy: Uuid;
}

export const GoalUpdatedPayloadSchema = z.object({
  goalId: z.string().uuid(),
  workerId: z.string().uuid(),
  updatedBy: z.string().uuid(),
});

export const GOAL_UPDATED = 'GoalUpdated';

export type GoalUpdatedEvent = HrEventEnvelope<GoalUpdatedPayload>;

export function isGoalUpdatedEvent(event: unknown): event is GoalUpdatedEvent {
  const parsed = HrEventEnvelopeSchema(GoalUpdatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === GOAL_UPDATED;
}

// ------------------------------------------------------------------
// GoalAchieved
// ------------------------------------------------------------------

export interface GoalAchievedPayload {
  goalId: Uuid;
  workerId: Uuid;
  acknowledgedBy: Uuid;
}

export const GoalAchievedPayloadSchema = z.object({
  goalId: z.string().uuid(),
  workerId: z.string().uuid(),
  acknowledgedBy: z.string().uuid(),
});

export const GOAL_ACHIEVED = 'GoalAchieved';

export type GoalAchievedEvent = HrEventEnvelope<GoalAchievedPayload>;

export function isGoalAchievedEvent(event: unknown): event is GoalAchievedEvent {
  const parsed = HrEventEnvelopeSchema(GoalAchievedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === GOAL_ACHIEVED;
}

// ------------------------------------------------------------------
// CalibrationSessionCreated
// ------------------------------------------------------------------

export interface CalibrationSessionCreatedPayload {
  calibrationSessionId: Uuid;
  reviewCycleId: Uuid;
  orgUnitId: Uuid;
  createdBy: Uuid;
}

export const CalibrationSessionCreatedPayloadSchema = z.object({
  calibrationSessionId: z.string().uuid(),
  reviewCycleId: z.string().uuid(),
  orgUnitId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

export const CALIBRATION_SESSION_CREATED = 'CalibrationSessionCreated';

export type CalibrationSessionCreatedEvent = HrEventEnvelope<CalibrationSessionCreatedPayload>;

export function isCalibrationSessionCreatedEvent(event: unknown): event is CalibrationSessionCreatedEvent {
  const parsed = HrEventEnvelopeSchema(CalibrationSessionCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === CALIBRATION_SESSION_CREATED;
}

// ------------------------------------------------------------------
// CalibrationSessionFinalized
// ------------------------------------------------------------------

export interface CalibrationSessionFinalizedPayload {
  calibrationSessionId: Uuid;
  reviewCycleId: Uuid;
  finalizedBy: Uuid;
}

export const CalibrationSessionFinalizedPayloadSchema = z.object({
  calibrationSessionId: z.string().uuid(),
  reviewCycleId: z.string().uuid(),
  finalizedBy: z.string().uuid(),
});

export const CALIBRATION_SESSION_FINALIZED = 'CalibrationSessionFinalized';

export type CalibrationSessionFinalizedEvent = HrEventEnvelope<CalibrationSessionFinalizedPayload>;

export function isCalibrationSessionFinalizedEvent(event: unknown): event is CalibrationSessionFinalizedEvent {
  const parsed = HrEventEnvelopeSchema(CalibrationSessionFinalizedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === CALIBRATION_SESSION_FINALIZED;
}
