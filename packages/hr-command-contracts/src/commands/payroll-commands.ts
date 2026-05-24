import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Payroll cycle commands                                             */
/* ------------------------------------------------------------------ */

export const OpenPayrollCycleCommandName = 'OpenPayrollCycle' as const;

export interface OpenPayrollCyclePayload {
  cycleId: Uuid;
  legalEntityId: Uuid;
  periodStart: Date;
  periodEnd: Date;
}

export const OpenPayrollCyclePayloadSchema = z.object({
  cycleId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export const ClosePayrollCycleCommandName = 'ClosePayrollCycle' as const;

export interface ClosePayrollCyclePayload {
  cycleId: Uuid;
}

export const ClosePayrollCyclePayloadSchema = z.object({
  cycleId: z.string().uuid(),
});

export const ApprovePayrollCycleCommandName = 'ApprovePayrollCycle' as const;

export interface ApprovePayrollCyclePayload {
  cycleId: Uuid;
}

export const ApprovePayrollCyclePayloadSchema = z.object({
  cycleId: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/*  Payroll input commands                                             */
/* ------------------------------------------------------------------ */

export const SubmitPayrollInputCommandName = 'SubmitPayrollInput' as const;

export interface SubmitPayrollInputPayload {
  inputId: Uuid;
  cycleId: Uuid;
  workerId: Uuid;
  inputType: string;
  amount: number;
  currency: string;
}

export const SubmitPayrollInputPayloadSchema = z.object({
  inputId: z.string().uuid(),
  cycleId: z.string().uuid(),
  workerId: z.string().uuid(),
  inputType: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),
});

export const ApprovePayrollInputCommandName = 'ApprovePayrollInput' as const;

export interface ApprovePayrollInputPayload {
  inputId: Uuid;
}

export const ApprovePayrollInputPayloadSchema = z.object({
  inputId: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/*  Payroll calculation commands                                       */
/* ------------------------------------------------------------------ */

export const StartPayrollCalculationCommandName = 'StartPayrollCalculation' as const;

export interface StartPayrollCalculationPayload {
  cycleId: Uuid;
}

export const StartPayrollCalculationPayloadSchema = z.object({
  cycleId: z.string().uuid(),
});

export const FinalizePayrollCalculationCommandName = 'FinalizePayrollCalculation' as const;

export interface FinalizePayrollCalculationPayload {
  cycleId: Uuid;
}

export const FinalizePayrollCalculationPayloadSchema = z.object({
  cycleId: z.string().uuid(),
});
