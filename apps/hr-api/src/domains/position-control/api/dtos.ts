import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/* ── Position DTOs ─────────────────────────────────────────────── */

export const CreatePositionDtoSchema = z.object({
  positionCode: z.string().min(1),
  title: z.string().min(1),
  departmentId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  jobFamily: z.string().optional(),
  jobLevel: z.string().optional(),
  employmentType: z.string().min(1),
  headcountRequestId: z.string().uuid().optional(),
});

export class CreatePositionDto {
  static zodSchema = CreatePositionDtoSchema;

  @ApiProperty({ description: 'Unique position code per tenant' })
  positionCode!: string;

  @ApiProperty({ description: 'Position title' })
  title!: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Legal entity UUID' })
  legalEntityId?: string;

  @ApiPropertyOptional({ description: 'Job family classification' })
  jobFamily?: string;

  @ApiPropertyOptional({ description: 'Job level' })
  jobLevel?: string;

  @ApiProperty({ description: 'Employment type (e.g. FULL_TIME, PART_TIME)' })
  employmentType!: string;

  @ApiPropertyOptional({ description: 'Linked approved headcount request UUID' })
  headcountRequestId?: string;
}

export const UpdatePositionDtoSchema = z.object({
  title: z.string().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  jobFamily: z.string().optional(),
  jobLevel: z.string().optional(),
  employmentType: z.string().min(1).optional(),
});

export class UpdatePositionDto {
  static zodSchema = UpdatePositionDtoSchema;

  @ApiPropertyOptional({ description: 'Position title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Legal entity UUID' })
  legalEntityId?: string;

  @ApiPropertyOptional({ description: 'Job family classification' })
  jobFamily?: string;

  @ApiPropertyOptional({ description: 'Job level' })
  jobLevel?: string;

  @ApiPropertyOptional({ description: 'Employment type' })
  employmentType?: string;
}

export const FillPositionDtoSchema = z.object({
  workerId: z.string().uuid(),
});

export class FillPositionDto {
  static zodSchema = FillPositionDtoSchema;

  @ApiProperty({ description: 'Worker UUID to fill the position' })
  workerId!: string;
}

export const VacatePositionDtoSchema = z.object({
  reason: z.string().min(1).optional(),
});

export class VacatePositionDto {
  static zodSchema = VacatePositionDtoSchema;

  @ApiPropertyOptional({ description: 'Reason for vacating' })
  reason?: string;
}

/* ── Headcount Request DTOs ────────────────────────────────────── */

export const SubmitHeadcountRequestDtoSchema = z.object({
  departmentId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  justification: z.string().min(1),
  requestedPositions: z.number().int().positive(),
});

export class SubmitHeadcountRequestDto {
  static zodSchema = SubmitHeadcountRequestDtoSchema;

  @ApiPropertyOptional({ description: 'Department UUID' })
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Legal entity UUID' })
  legalEntityId?: string;

  @ApiProperty({ description: 'Business justification for the request' })
  justification!: string;

  @ApiProperty({ description: 'Number of positions requested' })
  requestedPositions!: number;
}

export const ApproveHeadcountRequestDtoSchema = z.object({
  positionsApproved: z.number().int().positive(),
});

export class ApproveHeadcountRequestDto {
  static zodSchema = ApproveHeadcountRequestDtoSchema;

  @ApiProperty({ description: 'Number of positions approved' })
  positionsApproved!: number;
}

export const RejectHeadcountRequestDtoSchema = z.object({
  reason: z.string().min(1),
});

export class RejectHeadcountRequestDto {
  static zodSchema = RejectHeadcountRequestDtoSchema;

  @ApiProperty({ description: 'Rejection reason' })
  reason!: string;
}
