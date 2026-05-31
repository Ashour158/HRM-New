import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Performance review cycle commands                                  */
/* ------------------------------------------------------------------ */

export const CreatePerformanceReviewCycleCommandName = 'CreatePerformanceReviewCycle' as const;

export interface CreatePerformanceReviewCyclePayload {
  cycleId: Uuid;
  name: string;
  startDate: Date;
  endDate: Date;
}

export const CreatePerformanceReviewCyclePayloadSchema = z.object({
  cycleId: z.string().uuid(),
  name: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const OpenPerformanceReviewCycleCommandName = 'OpenPerformanceReviewCycle' as const;

export interface OpenPerformanceReviewCyclePayload {
  cycleId: Uuid;
}

export const OpenPerformanceReviewCyclePayloadSchema = z.object({
  cycleId: z.string().uuid(),
});

export const ClosePerformanceReviewCycleCommandName = 'ClosePerformanceReviewCycle' as const;

export interface ClosePerformanceReviewCyclePayload {
  cycleId: Uuid;
}

export const ClosePerformanceReviewCyclePayloadSchema = z.object({
  cycleId: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/*  Performance review commands                                        */
/* ------------------------------------------------------------------ */

export const SubmitPerformanceReviewCommandName = 'SubmitPerformanceReview' as const;

export interface SubmitPerformanceReviewPayload {
  reviewId: Uuid;
  cycleId: Uuid;
  workerId: Uuid;
  reviewerWorkerId: Uuid;
  rating?: number;
  comments?: string;
}

export const SubmitPerformanceReviewPayloadSchema = z.object({
  reviewId: z.string().uuid(),
  cycleId: z.string().uuid(),
  workerId: z.string().uuid(),
  reviewerWorkerId: z.string().uuid(),
  rating: z.number().min(0).max(5).optional(),
  comments: z.string().optional(),
});

export const AcknowledgePerformanceReviewCommandName = 'AcknowledgePerformanceReview' as const;

export interface AcknowledgePerformanceReviewPayload {
  reviewId: Uuid;
  acknowledgedAt: Date;
}

export const AcknowledgePerformanceReviewPayloadSchema = z.object({
  reviewId: z.string().uuid(),
  acknowledgedAt: z.coerce.date(),
});

/* ------------------------------------------------------------------ */
/*  Goal commands                                                      */
/* ------------------------------------------------------------------ */

export const CreateGoalCommandName = 'CreateGoal' as const;

export interface CreateGoalPayload {
  goalId: Uuid;
  workerId: Uuid;
  title: string;
  description?: string;
  metricName?: string;
  smartCriteria?: {
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
  baselineValue?: number;
  targetValue?: number;
  unit?: string;
  startDate?: Date;
  dueDate?: Date;
  weight?: number;
  reviewCadence?: string;
  evidenceRequired?: boolean;
}

export const CreateGoalPayloadSchema = z.object({
  goalId: z.string().uuid(),
  workerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  metricName: z.string().optional(),
  smartCriteria: z.object({
    specific: z.string().optional(),
    measurable: z.string().optional(),
    achievable: z.string().optional(),
    relevant: z.string().optional(),
    timeBound: z.string().optional(),
  }).optional(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  weight: z.number().optional(),
  reviewCadence: z.string().optional(),
  evidenceRequired: z.boolean().optional(),
});

export const UpdateGoalCommandName = 'UpdateGoal' as const;

export interface UpdateGoalPayload {
  goalId: Uuid;
  title?: string;
  description?: string;
  dueDate?: Date;
  status?: string;
}

export const UpdateGoalPayloadSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  status: z.string().optional(),
});

export const AchieveGoalCommandName = 'AchieveGoal' as const;

export interface AchieveGoalPayload {
  goalId: Uuid;
  achievedAt: Date;
}

export const AchieveGoalPayloadSchema = z.object({
  goalId: z.string().uuid(),
  achievedAt: z.coerce.date(),
});

/* ------------------------------------------------------------------ */
/*  Calibration session commands                                       */
/* ------------------------------------------------------------------ */

export const CreateCalibrationSessionCommandName = 'CreateCalibrationSession' as const;

export interface CreateCalibrationSessionPayload {
  sessionId: Uuid;
  cycleId: Uuid;
  name: string;
  facilitatorWorkerId: Uuid;
}

export const CreateCalibrationSessionPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  cycleId: z.string().uuid(),
  name: z.string().min(1),
  facilitatorWorkerId: z.string().uuid(),
});

export const FinalizeCalibrationSessionCommandName = 'FinalizeCalibrationSession' as const;

export interface FinalizeCalibrationSessionPayload {
  sessionId: Uuid;
}

export const FinalizeCalibrationSessionPayloadSchema = z.object({
  sessionId: z.string().uuid(),
});
