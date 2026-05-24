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
});

export class CreateOnboardingPlanDto {
  @ApiProperty() planId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() assignedBuddyId?: string;
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
  dueDate: z.coerce.date().optional(),
});

export class CreateOnboardingTaskDto {
  @ApiProperty() taskId!: string;
  @ApiProperty() planId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() assignedTo?: string;
  @ApiPropertyOptional() dueDate?: Date;
}
