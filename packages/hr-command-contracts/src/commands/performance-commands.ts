import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Performance review cycle commands                                  */
/* ------------------------------------------------------------------ */

export const CreatePerformanceReviewCycleCommandName = 'CreatePerformanceReviewCycle' as const;

export interface CreatePerformanceReviewCyclePayload {
  cycleId?: Uuid;
  name: string;
  cycleYear: number;
  startDate: Date;
  endDate: Date;
  reviewType: string;
  templateId?: Uuid;
  weightings?: Record<string, number>;
  periods?: Array<{ name: string; startDate: Date; endDate: Date }>;
}

export const CreatePerformanceReviewCyclePayloadSchema = z.object({
  cycleId: z.string().uuid().optional(),
  name: z.string().min(1),
  cycleYear: z.number().int(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reviewType: z.string().min(1),
  templateId: z.string().uuid().optional(),
  weightings: z.record(z.number().min(0).max(100)).optional(),
  periods: z.array(z.object({
    name: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })).optional(),
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
/*  Performance improvement plan commands                              */
/* ------------------------------------------------------------------ */

export const RecordPerformanceImprovementPlanCheckpointCommandName = 'RecordPerformanceImprovementPlanCheckpoint' as const;

export interface RecordPerformanceImprovementPlanCheckpointPayload {
  performanceImprovementPlanId: Uuid;
  milestoneTitle?: string;
  milestoneDay?: number;
  milestoneStatus?: string;
  metricUpdates?: Array<{ metric: string; current: number }>;
  note?: string;
}

export const RecordPerformanceImprovementPlanCheckpointPayloadSchema = z.object({
  performanceImprovementPlanId: z.string().uuid(),
  milestoneTitle: z.string().min(1).optional(),
  milestoneDay: z.number().int().min(1).optional(),
  milestoneStatus: z.string().min(1).optional(),
  metricUpdates: z.array(z.object({
    metric: z.string().min(1),
    current: z.number(),
  })).optional(),
  note: z.string().optional(),
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

/* ------------------------------------------------------------------ */
/*  Live performance command registry                                  */
/* ------------------------------------------------------------------ */

const UuidStringSchema = z.string().uuid();

export const PerformanceCommandNames = [
  'CreatePerformanceReviewCycle',
  'SetupPerformanceReviewCycle',
  'ActivatePerformanceReviewCycle',
  'StartPerformanceReviewCycle',
  'EnterCalibrationPerformanceReviewCycle',
  'EnterReviewPerformanceReviewCycle',
  'ClosePerformanceReviewCycle',
  'CreatePerformanceReview',
  'SubmitSelfReview',
  'SubmitManagerReview',
  'CalibratePerformanceReview',
  'FinalizePerformanceReview',
  'AcknowledgePerformanceReview',
  'DisputePerformanceReview',
  'CreateGoal',
  'ActivateGoal',
  'UpdateGoalProgress',
  'MarkGoalAchieved',
  'MarkGoalMissed',
  'CancelGoal',
  'CreateCalibrationSession',
  'ScheduleCalibrationSession',
  'StartCalibrationSession',
  'CompleteCalibrationSession',
  'FinalizeCalibrationSession',
  'CreatePerformanceImprovementPlan',
  'ActivatePerformanceImprovementPlan',
  'EnterReviewPerformanceImprovementPlan',
  'CompletePerformanceImprovementPlan',
  'ClosePerformanceImprovementPlan',
  'ExtendPerformanceImprovementPlan',
  'RecordPerformanceImprovementPlanCheckpoint',
  'TerminatePerformanceImprovementPlan',
  'CreatePerformanceFeedback360Cycle',
  'ActivatePerformanceFeedback360Cycle',
  'LaunchPerformanceFeedback360Cycle',
  'ClosePerformanceFeedback360Cycle',
  'ArchivePerformanceFeedback360Cycle',
  'CreatePerformanceFeedback360Response',
  'SubmitPerformanceFeedback360Response',
  'CreateObjective',
  'ActivateObjective',
  'UpdateObjectiveProgress',
  'MarkObjectiveAchieved',
  'CancelObjective',
  'CreateKeyResult',
  'ActivateKeyResult',
  'UpdateKeyResultProgress',
  'CompleteKeyResult',
  'CancelKeyResult',
  'CreateKpi',
  'ActivateKpi',
  'UpdateKpiActual',
  'AssignKpiOwner',
  'ArchiveKpi',
  'RecordKpiMeasurement',
  'ValidateKpiMeasurement',
  'CreateReviewTemplate',
  'PublishReviewTemplate',
  'ArchiveReviewTemplate',
  'CreateCompetency',
  'ActivateCompetency',
  'DeactivateCompetency',
  'CreateDevelopmentPlan',
  'ActivateDevelopmentPlan',
  'RecordDevelopmentMilestone',
  'CompleteDevelopmentPlan',
  'CloseDevelopmentPlan',
] as const;

export type PerformanceCommandName = typeof PerformanceCommandNames[number];

export const PerformanceCommandNameSchema = z.enum(PerformanceCommandNames);

export const LivePerformanceCommandPayloadSchemas = {
  CreatePerformanceReviewCycle: CreatePerformanceReviewCyclePayloadSchema,
  SetupPerformanceReviewCycle: z.object({ performanceReviewCycleId: UuidStringSchema }),
  ActivatePerformanceReviewCycle: z.object({ performanceReviewCycleId: UuidStringSchema }),
  StartPerformanceReviewCycle: z.object({ performanceReviewCycleId: UuidStringSchema }),
  EnterCalibrationPerformanceReviewCycle: z.object({ performanceReviewCycleId: UuidStringSchema }),
  EnterReviewPerformanceReviewCycle: z.object({ performanceReviewCycleId: UuidStringSchema }),
  ClosePerformanceReviewCycle: z.object({ performanceReviewCycleId: UuidStringSchema }),
  CreatePerformanceReview: z.object({ workerId: UuidStringSchema, reviewCycleId: UuidStringSchema, managerId: UuidStringSchema }),
  SubmitSelfReview: z.object({ performanceReviewId: UuidStringSchema, content: z.string().min(1) }),
  SubmitManagerReview: z.object({ performanceReviewId: UuidStringSchema, content: z.string().min(1) }),
  CalibratePerformanceReview: z.object({ performanceReviewId: UuidStringSchema, rating: z.number().min(0).max(5) }),
  FinalizePerformanceReview: z.object({ performanceReviewId: UuidStringSchema, rating: z.number().min(0).max(5) }),
  AcknowledgePerformanceReview: z.object({ performanceReviewId: UuidStringSchema }),
  DisputePerformanceReview: z.object({ performanceReviewId: UuidStringSchema }),
  CreateGoal: CreateGoalPayloadSchema.omit({ goalId: true }).extend({ goalId: UuidStringSchema.optional() }),
  ActivateGoal: z.object({ goalId: UuidStringSchema }),
  UpdateGoalProgress: z.object({ goalId: UuidStringSchema, currentValue: z.number() }),
  MarkGoalAchieved: z.object({ goalId: UuidStringSchema }),
  MarkGoalMissed: z.object({ goalId: UuidStringSchema }),
  CancelGoal: z.object({ goalId: UuidStringSchema }),
  CreateCalibrationSession: z.object({ reviewCycleId: UuidStringSchema, facilitatorId: UuidStringSchema, participants: z.array(UuidStringSchema).optional() }),
  ScheduleCalibrationSession: z.object({ calibrationSessionId: UuidStringSchema }),
  StartCalibrationSession: z.object({ calibrationSessionId: UuidStringSchema }),
  CompleteCalibrationSession: z.object({ calibrationSessionId: UuidStringSchema }),
  FinalizeCalibrationSession: z.object({ calibrationSessionId: UuidStringSchema }),
  CreatePerformanceImprovementPlan: z.object({
    workerId: UuidStringSchema,
    managerId: UuidStringSchema,
    objectives: z.array(z.string()).optional(),
    currentPerformance: z.record(z.unknown()).optional(),
    planDurationDays: z.number().int().positive().optional(),
    milestones: z.array(z.record(z.unknown())).optional(),
    trackingMetrics: z.array(z.record(z.unknown())).optional(),
  }),
  ActivatePerformanceImprovementPlan: z.object({ performanceImprovementPlanId: UuidStringSchema }),
  EnterReviewPerformanceImprovementPlan: z.object({ performanceImprovementPlanId: UuidStringSchema }),
  CompletePerformanceImprovementPlan: z.object({ performanceImprovementPlanId: UuidStringSchema, outcome: z.string().min(1) }),
  ClosePerformanceImprovementPlan: z.object({ performanceImprovementPlanId: UuidStringSchema }),
  ExtendPerformanceImprovementPlan: z.object({ performanceImprovementPlanId: UuidStringSchema, newEndDate: z.coerce.date() }),
  RecordPerformanceImprovementPlanCheckpoint: RecordPerformanceImprovementPlanCheckpointPayloadSchema,
  TerminatePerformanceImprovementPlan: z.object({ performanceImprovementPlanId: UuidStringSchema }),
  CreatePerformanceFeedback360Cycle: z.object({
    name: z.string().min(1),
    cycleYear: z.number().int(),
    reviewCycleId: UuidStringSchema.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    anonymityEnabled: z.boolean().optional(),
    minPeerReviews: z.number().int().positive().optional(),
    maxPeerReviews: z.number().int().positive().optional(),
  }),
  ActivatePerformanceFeedback360Cycle: z.object({ feedback360CycleId: UuidStringSchema }),
  LaunchPerformanceFeedback360Cycle: z.object({ feedback360CycleId: UuidStringSchema }),
  ClosePerformanceFeedback360Cycle: z.object({ feedback360CycleId: UuidStringSchema }),
  ArchivePerformanceFeedback360Cycle: z.object({ feedback360CycleId: UuidStringSchema }),
  CreatePerformanceFeedback360Response: z.object({
    cycleId: UuidStringSchema,
    revieweeId: UuidStringSchema,
    reviewerId: UuidStringSchema,
    relationshipType: z.string().min(1),
    isAnonymous: z.boolean().optional(),
  }),
  SubmitPerformanceFeedback360Response: z.object({
    feedback360ResponseId: UuidStringSchema,
    competencyScores: z.record(z.number()).optional(),
    dimensionScores: z.record(z.number()).optional(),
    areaComments: z.record(z.string()).optional(),
    overallRating: z.number().min(0).max(5).optional(),
    strengths: z.string().optional(),
    improvements: z.string().optional(),
    comments: z.string().optional(),
    isAnonymous: z.boolean().optional(),
  }),
  CreateObjective: z.record(z.unknown()).and(z.object({ ownerId: UuidStringSchema, title: z.string().min(1) })),
  ActivateObjective: z.object({ objectiveId: UuidStringSchema }),
  UpdateObjectiveProgress: z.object({ objectiveId: UuidStringSchema, progress: z.number().min(0).max(100), confidenceScore: z.number().min(0).max(1).optional() }),
  MarkObjectiveAchieved: z.object({ objectiveId: UuidStringSchema }),
  CancelObjective: z.object({ objectiveId: UuidStringSchema, reason: z.string().optional() }),
  CreateKeyResult: z.record(z.unknown()).and(z.object({ objectiveId: UuidStringSchema, title: z.string().min(1) })),
  ActivateKeyResult: z.object({ keyResultId: UuidStringSchema }),
  UpdateKeyResultProgress: z.object({ keyResultId: UuidStringSchema, progress: z.number().min(0).max(100) }),
  CompleteKeyResult: z.object({ keyResultId: UuidStringSchema }),
  CancelKeyResult: z.object({ keyResultId: UuidStringSchema }),
  CreateKpi: z.record(z.unknown()).and(z.object({ name: z.string().min(1) })),
  ActivateKpi: z.object({ kpiId: UuidStringSchema }),
  UpdateKpiActual: z.object({ kpiId: UuidStringSchema, actualValue: z.number() }),
  AssignKpiOwner: z.object({ kpiId: UuidStringSchema, ownerId: UuidStringSchema }),
  ArchiveKpi: z.object({ kpiId: UuidStringSchema }),
  RecordKpiMeasurement: z.record(z.unknown()).and(z.object({ kpiId: UuidStringSchema, measuredValue: z.number() })),
  ValidateKpiMeasurement: z.object({ kpiMeasurementId: UuidStringSchema }),
  CreateReviewTemplate: z.record(z.unknown()).and(z.object({ name: z.string().min(1) })),
  PublishReviewTemplate: z.object({ reviewTemplateId: UuidStringSchema }),
  ArchiveReviewTemplate: z.object({ reviewTemplateId: UuidStringSchema }),
  CreateCompetency: z.record(z.unknown()).and(z.object({ name: z.string().min(1), category: z.string().min(1) })),
  ActivateCompetency: z.object({ competencyId: UuidStringSchema }),
  DeactivateCompetency: z.object({ competencyId: UuidStringSchema }),
  CreateDevelopmentPlan: z.record(z.unknown()).and(z.object({ workerId: UuidStringSchema, title: z.string().min(1) })),
  ActivateDevelopmentPlan: z.object({ developmentPlanId: UuidStringSchema }),
  RecordDevelopmentMilestone: z.record(z.unknown()).and(z.object({ developmentPlanId: UuidStringSchema })),
  CompleteDevelopmentPlan: z.object({ developmentPlanId: UuidStringSchema }),
  CloseDevelopmentPlan: z.object({ developmentPlanId: UuidStringSchema }),
} satisfies Record<PerformanceCommandName, z.ZodTypeAny>;
