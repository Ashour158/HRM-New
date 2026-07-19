import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const OpenHrServiceCaseDtoSchema = z.object({
  caseNumber: z.string().min(1).optional(),
  requesterWorkerId: z.string().uuid().optional(),
  caseType: z.string().min(1),
  priority: z.string().min(1),
  description: z.string().min(1),
  assignedTo: z.string().uuid().optional(),
  slaDeadline: z.coerce.date().optional(),
  catalogItemId: z.string().uuid().optional(),
  ownerGroup: z.string().min(1).optional(),
});

export class OpenHrServiceCaseDto {
  @ApiPropertyOptional() caseNumber?: string;
  @ApiPropertyOptional() requesterWorkerId?: string;
  @ApiProperty() caseType!: string;
  @ApiProperty() priority!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() assignedTo?: string;
  @ApiPropertyOptional() slaDeadline?: Date;
  @ApiPropertyOptional() catalogItemId?: string;
  @ApiPropertyOptional() ownerGroup?: string;
}

export const EscalateHrServiceCaseDtoSchema = z.object({
  escalationReason: z.string().min(1),
});

export class EscalateHrServiceCaseDto {
  @ApiProperty() escalationReason!: string;
}

export const ReassignHrServiceCaseDtoSchema = z.object({
  assignedTo: z.string().uuid(),
  ownerGroup: z.string().min(1).optional(),
});

export class ReassignHrServiceCaseDto {
  @ApiProperty() assignedTo!: string;
  @ApiPropertyOptional() ownerGroup?: string;
}

export const CreateHrCaseTaskDtoSchema = z.object({
  caseId: z.string().uuid(),
  title: z.string().min(1),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional(),
});

export class CreateHrCaseTaskDto {
  @ApiProperty() caseId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() assignedTo?: string;
  @ApiPropertyOptional() dueDate?: Date;
}

export const CreateHrKnowledgeArticleDtoSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export class CreateHrKnowledgeArticleDto {
  @ApiProperty() title!: string;
  @ApiProperty() content!: string;
  @ApiProperty() category!: string;
  @ApiPropertyOptional() tags?: string[];
}

export const CreateHrServiceCatalogItemDtoSchema = z.object({
  serviceCode: z.string().min(1),
  serviceName: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  slaHours: z.number().positive(),
  fulfillmentProcess: z.string().min(1),
  defaultOwnerGroup: z.string().min(1).optional(),
});

export class CreateHrServiceCatalogItemDto {
  @ApiProperty() serviceCode!: string;
  @ApiProperty() serviceName!: string;
  @ApiProperty() description!: string;
  @ApiProperty() category!: string;
  @ApiProperty() slaHours!: number;
  @ApiProperty() fulfillmentProcess!: string;
  @ApiPropertyOptional() defaultOwnerGroup?: string;
}

export const CreateHrCaseSlaInstanceDtoSchema = z.object({
  caseId: z.string().uuid(),
  slaDefinitionId: z.string().uuid(),
  deadlineAt: z.coerce.date(),
});

export class CreateHrCaseSlaInstanceDto {
  @ApiProperty() caseId!: string;
  @ApiProperty() slaDefinitionId!: string;
  @ApiProperty() deadlineAt!: Date;
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
