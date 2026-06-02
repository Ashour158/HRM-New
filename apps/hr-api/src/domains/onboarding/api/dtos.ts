import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* ------------------------------------------------------------------ */
/*  Onboarding Plan DTOs                                               */
/* ------------------------------------------------------------------ */

export const CreateOnboardingPlanDtoSchema = z.object({
  planId: z.string().uuid(),
  workerId: z.string().uuid(),
  startDate: z.coerce.date(),
  assignedBuddyId: z.string().uuid().optional(),
  mentorId: z.string().uuid().optional(),
  roleTrack: z.string().min(1).optional(),
  preboardingPortalStatus: z.enum(['NOT_INVITED', 'INVITED', 'ACTIVE', 'COMPLETED']).optional(),
  firstDayInstructions: z.record(z.unknown()).optional(),
  welcomeMessage: z.string().optional(),
  probationReviewDate: z.coerce.date().optional(),
  probationStatus: z.enum(['NOT_REQUIRED', 'PENDING_REVIEW', 'CONFIRMED', 'EXTENDED', 'TERMINATION_RECOMMENDED']).optional(),
});

export class CreateOnboardingPlanDto {
  static zodSchema = CreateOnboardingPlanDtoSchema;

  @ApiProperty() planId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() assignedBuddyId?: string;
  @ApiPropertyOptional() mentorId?: string;
  @ApiPropertyOptional() roleTrack?: string;
  @ApiPropertyOptional() preboardingPortalStatus?: string;
  @ApiPropertyOptional() firstDayInstructions?: Record<string, unknown>;
  @ApiPropertyOptional() welcomeMessage?: string;
  @ApiPropertyOptional() probationReviewDate?: Date;
  @ApiPropertyOptional() probationStatus?: string;
}

/* ------------------------------------------------------------------ */
/*  Onboarding Task DTOs                                               */
/* ------------------------------------------------------------------ */

export const CreateOnboardingTaskDtoSchema = z.object({
  taskId: z.string().uuid(),
  planId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  ownerGroup: z.string().optional(),
  category: z.enum([
    'PREBOARDING',
    'DOCUMENT',
    'SIGNATURE',
    'IT_PROVISIONING',
    'FACILITY_ACCESS',
    'FINANCE_SETUP',
    'MANAGER_CHECKIN',
    'TRAINING',
    'COMPLIANCE',
    'MILESTONE_30',
    'MILESTONE_60',
    'MILESTONE_90',
    'PROBATION',
  ]).optional(),
  required: z.boolean().optional(),
  evidenceType: z.string().optional(),
  evidencePayload: z.record(z.unknown()).optional(),
  provisioningTarget: z.string().optional(),
  signingProviderEnvelopeId: z.string().optional(),
  milestoneDay: z.number().int().positive().optional(),
  dueDate: z.coerce.date().optional(),
});

export class CreateOnboardingTaskDto {
  static zodSchema = CreateOnboardingTaskDtoSchema;

  @ApiProperty() taskId!: string;
  @ApiProperty() planId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() assignedTo?: string;
  @ApiPropertyOptional() ownerGroup?: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() required?: boolean;
  @ApiPropertyOptional() evidenceType?: string;
  @ApiPropertyOptional() evidencePayload?: Record<string, unknown>;
  @ApiPropertyOptional() provisioningTarget?: string;
  @ApiPropertyOptional() signingProviderEnvelopeId?: string;
  @ApiPropertyOptional() milestoneDay?: number;
  @ApiPropertyOptional() dueDate?: Date;
}

export const ApplyOnboardingTemplateDtoSchema = z.object({
  trackCode: z.string().min(1),
  assignedBuddyId: z.string().uuid().optional(),
  mentorId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
});

export class ApplyOnboardingTemplateDto {
  static zodSchema = ApplyOnboardingTemplateDtoSchema;

  @ApiProperty() trackCode!: string;
  @ApiPropertyOptional() assignedBuddyId?: string;
  @ApiPropertyOptional() mentorId?: string;
  @ApiPropertyOptional() managerId?: string;
}

export const RecordOnboardingTaskEvidenceDtoSchema = z.object({
  evidenceType: z.string().optional(),
  evidencePayload: z.record(z.unknown()).optional(),
  signingProviderEnvelopeId: z.string().optional(),
  provisioningTarget: z.string().optional(),
  completionNotes: z.string().optional(),
  completeTask: z.boolean().optional(),
});

export class RecordOnboardingTaskEvidenceDto {
  static zodSchema = RecordOnboardingTaskEvidenceDtoSchema;

  @ApiPropertyOptional() evidenceType?: string;
  @ApiPropertyOptional() evidencePayload?: Record<string, unknown>;
  @ApiPropertyOptional() signingProviderEnvelopeId?: string;
  @ApiPropertyOptional() provisioningTarget?: string;
  @ApiPropertyOptional() completionNotes?: string;
  @ApiPropertyOptional() completeTask?: boolean;
}
