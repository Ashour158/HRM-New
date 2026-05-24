import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Worker DTOs                                                        */
/* ------------------------------------------------------------------ */

export const CreateWorkerDtoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  phoneNumber: z.string().optional(),
  hireDate: z.coerce.date().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'TEMPORARY']).optional(),
  legalEntityId: z.string().uuid().optional(),
});

export class CreateWorkerDto {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional() phoneNumber?: string;
  @ApiPropertyOptional() hireDate?: Date;
  @ApiPropertyOptional() employmentType?: string;
  @ApiPropertyOptional() legalEntityId?: string;
}

export const UpdateWorkerDtoSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  phoneNumber: z.string().optional(),
});

export class UpdateWorkerDto {
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiPropertyOptional() phoneNumber?: string;
}

export const TerminateWorkerDtoSchema = z.object({
  terminationDate: z.coerce.date(),
  reason: z.string().min(1),
});

export class TerminateWorkerDto {
  @ApiProperty() terminationDate!: Date;
  @ApiProperty() reason!: string;
}

/* ------------------------------------------------------------------ */
/*  Job Assignment DTOs                                                */
/* ------------------------------------------------------------------ */

export const CreateJobAssignmentDtoSchema = z.object({
  workerId: z.string().uuid(),
  positionId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export class CreateJobAssignmentDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() positionId!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() endDate?: Date;
}

/* ------------------------------------------------------------------ */
/*  Employment Relationship DTOs                                       */
/* ------------------------------------------------------------------ */

export const CreateEmploymentRelationshipDtoSchema = z.object({
  workerId: z.string().uuid(),
  relationshipType: z.string().min(1),
  startDate: z.coerce.date(),
  legalEntityId: z.string().uuid().optional(),
  contractType: z.string().optional(),
  probationEndDate: z.coerce.date().optional(),
});

export class CreateEmploymentRelationshipDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() relationshipType!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() legalEntityId?: string;
  @ApiPropertyOptional() contractType?: string;
  @ApiPropertyOptional() probationEndDate?: Date;
}

/* ------------------------------------------------------------------ */
/*  Employment Contract DTOs                                           */
/* ------------------------------------------------------------------ */

export const CreateEmploymentContractDtoSchema = z.object({
  contractId: z.string().uuid(),
  workerId: z.string().uuid(),
  contractType: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  terms: z.record(z.unknown()).optional(),
});

export class CreateEmploymentContractDto {
  @ApiProperty() contractId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() contractType!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() endDate?: Date;
  @ApiPropertyOptional() terms?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Zod Validation Pipe                                                */
/* ------------------------------------------------------------------ */

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.format());
    }
    return result.data;
  }
}
