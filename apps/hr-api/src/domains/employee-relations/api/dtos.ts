import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateEmployeeRelationsCaseDtoSchema = z.object({
  caseNumber: z.string().min(1),
  subjectWorkerId: z.string().uuid(),
  caseType: z.string().min(1),
  severity: z.string().min(1),
  description: z.string().min(1),
  openedBy: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
});

export class CreateEmployeeRelationsCaseDto {
  @ApiProperty() caseNumber!: string;
  @ApiProperty() subjectWorkerId!: string;
  @ApiProperty() caseType!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() description!: string;
  @ApiProperty() openedBy!: string;
  @ApiPropertyOptional() assignedTo?: string;
}

export const CreateErInvestigationDtoSchema = z.object({
  erCaseId: z.string().uuid(),
  leadInvestigatorId: z.string().uuid(),
});

export class CreateErInvestigationDto {
  @ApiProperty() erCaseId!: string;
  @ApiProperty() leadInvestigatorId!: string;
}

export const DraftDisciplinaryActionDtoSchema = z.object({
  workerId: z.string().uuid(),
  erCaseId: z.string().uuid(),
  actionType: z.string().min(1),
  severity: z.string().min(1),
  description: z.string().min(1),
  effectiveDate: z.coerce.date(),
});

export class DraftDisciplinaryActionDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() erCaseId!: string;
  @ApiProperty() actionType!: string;
  @ApiProperty() severity!: string;
  @ApiProperty() description!: string;
  @ApiProperty() effectiveDate!: Date;
}

export const CreateAccommodationCaseDtoSchema = z.object({
  workerId: z.string().uuid(),
  requestType: z.string().min(1),
  description: z.string().min(1),
  medicalDocumentation: z.string().optional(),
  accommodationDetails: z.string().optional(),
});

export class CreateAccommodationCaseDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() requestType!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() medicalDocumentation?: string;
  @ApiPropertyOptional() accommodationDetails?: string;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
