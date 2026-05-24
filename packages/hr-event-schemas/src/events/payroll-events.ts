/**
 * Payroll domain events.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// PayrollCycleOpened
// ------------------------------------------------------------------

export interface PayrollCycleOpenedPayload {
  payrollCycleId: Uuid;
  legalEntityId: Uuid;
  periodStartDate: string;
  periodEndDate: string;
  openedBy: Uuid;
}

export const PayrollCycleOpenedPayloadSchema = z.object({
  payrollCycleId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  periodStartDate: z.string().datetime(),
  periodEndDate: z.string().datetime(),
  openedBy: z.string().uuid(),
});

export const PAYROLL_CYCLE_OPENED = 'PayrollCycleOpened';

export type PayrollCycleOpenedEvent = HrEventEnvelope<PayrollCycleOpenedPayload>;

export function isPayrollCycleOpenedEvent(event: unknown): event is PayrollCycleOpenedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollCycleOpenedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_CYCLE_OPENED;
}

// ------------------------------------------------------------------
// PayrollCycleClosed
// ------------------------------------------------------------------

export interface PayrollCycleClosedPayload {
  payrollCycleId: Uuid;
  closedBy: Uuid;
}

export const PayrollCycleClosedPayloadSchema = z.object({
  payrollCycleId: z.string().uuid(),
  closedBy: z.string().uuid(),
});

export const PAYROLL_CYCLE_CLOSED = 'PayrollCycleClosed';

export type PayrollCycleClosedEvent = HrEventEnvelope<PayrollCycleClosedPayload>;

export function isPayrollCycleClosedEvent(event: unknown): event is PayrollCycleClosedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollCycleClosedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_CYCLE_CLOSED;
}

// ------------------------------------------------------------------
// PayrollCycleApproved
// ------------------------------------------------------------------

export interface PayrollCycleApprovedPayload {
  payrollCycleId: Uuid;
  approvedBy: Uuid;
}

export const PayrollCycleApprovedPayloadSchema = z.object({
  payrollCycleId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const PAYROLL_CYCLE_APPROVED = 'PayrollCycleApproved';

export type PayrollCycleApprovedEvent = HrEventEnvelope<PayrollCycleApprovedPayload>;

export function isPayrollCycleApprovedEvent(event: unknown): event is PayrollCycleApprovedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollCycleApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_CYCLE_APPROVED;
}

// ------------------------------------------------------------------
// PayrollInputSubmitted
// ------------------------------------------------------------------

export interface PayrollInputSubmittedPayload {
  payrollInputId: Uuid;
  payrollCycleId: Uuid;
  workerId: Uuid;
  submittedBy: Uuid;
}

export const PayrollInputSubmittedPayloadSchema = z.object({
  payrollInputId: z.string().uuid(),
  payrollCycleId: z.string().uuid(),
  workerId: z.string().uuid(),
  submittedBy: z.string().uuid(),
});

export const PAYROLL_INPUT_SUBMITTED = 'PayrollInputSubmitted';

export type PayrollInputSubmittedEvent = HrEventEnvelope<PayrollInputSubmittedPayload>;

export function isPayrollInputSubmittedEvent(event: unknown): event is PayrollInputSubmittedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollInputSubmittedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_INPUT_SUBMITTED;
}

// ------------------------------------------------------------------
// PayrollInputApproved
// ------------------------------------------------------------------

export interface PayrollInputApprovedPayload {
  payrollInputId: Uuid;
  approvedBy: Uuid;
}

export const PayrollInputApprovedPayloadSchema = z.object({
  payrollInputId: z.string().uuid(),
  approvedBy: z.string().uuid(),
});

export const PAYROLL_INPUT_APPROVED = 'PayrollInputApproved';

export type PayrollInputApprovedEvent = HrEventEnvelope<PayrollInputApprovedPayload>;

export function isPayrollInputApprovedEvent(event: unknown): event is PayrollInputApprovedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollInputApprovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_INPUT_APPROVED;
}

// ------------------------------------------------------------------
// PayrollCalculationStarted
// ------------------------------------------------------------------

export interface PayrollCalculationStartedPayload {
  payrollCycleId: Uuid;
  calculationRunId: Uuid;
  startedBy: Uuid;
}

export const PayrollCalculationStartedPayloadSchema = z.object({
  payrollCycleId: z.string().uuid(),
  calculationRunId: z.string().uuid(),
  startedBy: z.string().uuid(),
});

export const PAYROLL_CALCULATION_STARTED = 'PayrollCalculationStarted';

export type PayrollCalculationStartedEvent = HrEventEnvelope<PayrollCalculationStartedPayload>;

export function isPayrollCalculationStartedEvent(event: unknown): event is PayrollCalculationStartedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollCalculationStartedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_CALCULATION_STARTED;
}

// ------------------------------------------------------------------
// PayrollCalculationFinalized
// ------------------------------------------------------------------

export interface PayrollCalculationFinalizedPayload {
  payrollCycleId: Uuid;
  calculationRunId: Uuid;
  finalizedBy: Uuid;
}

export const PayrollCalculationFinalizedPayloadSchema = z.object({
  payrollCycleId: z.string().uuid(),
  calculationRunId: z.string().uuid(),
  finalizedBy: z.string().uuid(),
});

export const PAYROLL_CALCULATION_FINALIZED = 'PayrollCalculationFinalized';

export type PayrollCalculationFinalizedEvent = HrEventEnvelope<PayrollCalculationFinalizedPayload>;

export function isPayrollCalculationFinalizedEvent(event: unknown): event is PayrollCalculationFinalizedEvent {
  const parsed = HrEventEnvelopeSchema(PayrollCalculationFinalizedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYROLL_CALCULATION_FINALIZED;
}

// ------------------------------------------------------------------
// PayslipGenerated
// ------------------------------------------------------------------

export interface PayslipGeneratedPayload {
  payslipId: Uuid;
  payrollCycleId: Uuid;
  workerId: Uuid;
  generatedBy: Uuid;
}

export const PayslipGeneratedPayloadSchema = z.object({
  payslipId: z.string().uuid(),
  payrollCycleId: z.string().uuid(),
  workerId: z.string().uuid(),
  generatedBy: z.string().uuid(),
});

export const PAYSLIP_GENERATED = 'PayslipGenerated';

export type PayslipGeneratedEvent = HrEventEnvelope<PayslipGeneratedPayload>;

export function isPayslipGeneratedEvent(event: unknown): event is PayslipGeneratedEvent {
  const parsed = HrEventEnvelopeSchema(PayslipGeneratedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYSLIP_GENERATED;
}

// ------------------------------------------------------------------
// PayslipDelivered
// ------------------------------------------------------------------

export interface PayslipDeliveredPayload {
  payslipId: Uuid;
  workerId: Uuid;
  deliveryMethodId: Uuid;
}

export const PayslipDeliveredPayloadSchema = z.object({
  payslipId: z.string().uuid(),
  workerId: z.string().uuid(),
  deliveryMethodId: z.string().uuid(),
});

export const PAYSLIP_DELIVERED = 'PayslipDelivered';

export type PayslipDeliveredEvent = HrEventEnvelope<PayslipDeliveredPayload>;

export function isPayslipDeliveredEvent(event: unknown): event is PayslipDeliveredEvent {
  const parsed = HrEventEnvelopeSchema(PayslipDeliveredPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === PAYSLIP_DELIVERED;
}
