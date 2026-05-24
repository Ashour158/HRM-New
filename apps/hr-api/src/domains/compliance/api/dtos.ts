import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/* ------------------------------------------------------------------ */
/*  Policy Document DTOs                                               */
/* ------------------------------------------------------------------ */

export const CreatePolicyDocumentDtoSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(1),
  documentType: z.string().min(1),
  version: z.string().min(1),
  content: z.record(z.unknown()),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),
});

export class CreatePolicyDocumentDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() documentType!: string;
  @ApiProperty() version!: string;
  @ApiProperty() content!: Record<string, unknown>;
  @ApiPropertyOptional() effectiveFrom?: Date;
  @ApiPropertyOptional() effectiveUntil?: Date;
}

export const ApprovePolicyDocumentDtoSchema = z.object({
  documentId: z.string().uuid(),
});

export class ApprovePolicyDocumentDto {
  @ApiProperty() documentId!: string;
}

export const PublishPolicyDocumentDtoSchema = z.object({
  documentId: z.string().uuid(),
});

export class PublishPolicyDocumentDto {
  @ApiProperty() documentId!: string;
}

/* ------------------------------------------------------------------ */
/*  Policy Acknowledgement DTOs                                        */
/* ------------------------------------------------------------------ */

export const RequirePolicyAcknowledgementDtoSchema = z.object({
  requirementId: z.string().uuid(),
  workerId: z.string().uuid(),
  policyDocumentId: z.string().uuid(),
  dueDate: z.coerce.date(),
});

export class RequirePolicyAcknowledgementDto {
  @ApiProperty() requirementId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty() policyDocumentId!: string;
  @ApiProperty() dueDate!: Date;
}

export const RecordPolicyAcknowledgementDtoSchema = z.object({
  requirementId: z.string().uuid(),
});

export class RecordPolicyAcknowledgementDto {
  @ApiProperty() requirementId!: string;
}

/* ------------------------------------------------------------------ */
/*  Legal Hold DTOs                                                    */
/* ------------------------------------------------------------------ */

export const PlaceLegalHoldDtoSchema = z.object({
  holdId: z.string().uuid(),
  holdName: z.string().min(1),
  description: z.string().optional(),
  reason: z.string().min(1),
  affectedWorkerIds: z.array(z.string().uuid()),
  placedByWorkerId: z.string().uuid(),
});

export class PlaceLegalHoldDto {
  @ApiProperty() holdId!: string;
  @ApiProperty() holdName!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() reason!: string;
  @ApiProperty() affectedWorkerIds!: string[];
  @ApiProperty() placedByWorkerId!: string;
}

export const ReleaseLegalHoldDtoSchema = z.object({
  holdId: z.string().uuid(),
  releasedByWorkerId: z.string().uuid(),
});

export class ReleaseLegalHoldDto {
  @ApiProperty() holdId!: string;
  @ApiProperty() releasedByWorkerId!: string;
}

/* ------------------------------------------------------------------ */
/*  Statutory Report DTOs                                              */
/* ------------------------------------------------------------------ */

export const SubmitStatutoryReportDtoSchema = z.object({
  reportId: z.string().uuid(),
  reportType: z.string().min(1),
  reportingPeriod: z.string().min(1),
  countryCode: z.string().length(2),
  legalEntityId: z.string().uuid(),
  content: z.record(z.unknown()),
});

export class SubmitStatutoryReportDto {
  @ApiProperty() reportId!: string;
  @ApiProperty() reportType!: string;
  @ApiProperty() reportingPeriod!: string;
  @ApiProperty() countryCode!: string;
  @ApiProperty() legalEntityId!: string;
  @ApiProperty() content!: Record<string, unknown>;
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
