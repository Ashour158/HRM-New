import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * NestJS pipe that validates a request body against an explicit Zod schema
 * supplied at construction time (e.g. `@Body(new ZodValidationPipe(SomeDtoSchema))`).
 * Unlike a metatype-based pipe, this can't silently no-op when a schema is
 * missing — the schema is a required constructor argument.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}

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
  @ApiProperty({ description: 'Worker UUID to fill the position' })
  workerId!: string;
}

export const VacatePositionDtoSchema = z.object({
  reason: z.string().min(1).optional(),
});

export class VacatePositionDto {
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
  fiscalYear: z.number().int().min(1900).optional(),
});

export class ApproveHeadcountRequestDto {
  @ApiProperty({ description: 'Number of positions approved' })
  positionsApproved!: number;

  @ApiPropertyOptional({ description: 'Fiscal year to check the org unit headcount budget against; defaults to the current calendar year' })
  fiscalYear?: number;
}

/* ── Headcount Budget DTOs ─────────────────────────────────────── */

export const ConfigureHeadcountBudgetDtoSchema = z.object({
  departmentId: z.string().uuid(),
  fiscalYear: z.number().int().min(1900),
  ceiling: z.number().int().min(0),
});

export class ConfigureHeadcountBudgetDto {
  static zodSchema = ConfigureHeadcountBudgetDtoSchema;

  @ApiProperty({ description: 'Org unit (department) UUID the budget applies to' })
  departmentId!: string;

  @ApiProperty({ description: 'Fiscal year the budget applies to (e.g. 2026)' })
  fiscalYear!: number;

  @ApiProperty({ description: 'Budgeted FTE/headcount ceiling for the org unit and fiscal year' })
  ceiling!: number;
}

export const RejectHeadcountRequestDtoSchema = z.object({
  reason: z.string().min(1),
});

export class RejectHeadcountRequestDto {
  @ApiProperty({ description: 'Rejection reason' })
  reason!: string;
}
