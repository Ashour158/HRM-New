import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

/* ------------------------------------------------------------------ */
/*  Job Requisition DTOs                                               */
/* ------------------------------------------------------------------ */

export const CreateJobRequisitionDtoSchema = z.object({
  requisitionId: z.string().uuid(),
  positionId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
});

export class CreateJobRequisitionDto {
  @ApiProperty() requisitionId!: string;
  @ApiProperty() positionId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
}

export const CloseJobRequisitionDtoSchema = z.object({
  reason: z.string().min(1),
});

export class CloseJobRequisitionDto {
  @ApiProperty() reason!: string;
}

/* ------------------------------------------------------------------ */
/*  Candidate DTOs                                                     */
/* ------------------------------------------------------------------ */

export const SubmitCandidateDtoSchema = z.object({
  applicationId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  source: z.string().optional(),
});

export class SubmitCandidateDto {
  @ApiProperty() applicationId!: string;
  @ApiProperty() requisitionId!: string;
  @ApiProperty() candidateEmail!: string;
  @ApiProperty() candidateName!: string;
  @ApiPropertyOptional() firstName?: string;
  @ApiPropertyOptional() lastName?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() resumeUrl?: string;
  @ApiPropertyOptional() source?: string;
}

export const ScreenCandidateDtoSchema = z.object({
  screenedByWorkerId: z.string().uuid(),
  outcome: z.string().min(1),
});

export class ScreenCandidateDto {
  @ApiProperty() screenedByWorkerId!: string;
  @ApiProperty() outcome!: string;
}

export const ScheduleInterviewDtoSchema = z.object({
  interviewId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  interviewerWorkerIds: z.array(z.string().uuid()).min(1),
  format: z.enum(['PHONE', 'VIDEO', 'ONSITE', 'PANEL', 'TAKE_HOME']).optional(),
});

export class ScheduleInterviewDto {
  @ApiProperty() interviewId!: string;
  @ApiProperty() scheduledAt!: Date;
  @ApiProperty({ type: [String] }) interviewerWorkerIds!: string[];
  @ApiPropertyOptional() format?: string;
}

/* ------------------------------------------------------------------ */
/*  Offer DTOs                                                         */
/* ------------------------------------------------------------------ */

export const CreateOfferDtoSchema = z.object({
  offerId: z.string().uuid(),
  applicationId: z.string().uuid(),
  proposedSalary: z.number().positive(),
  currency: z.string().length(3),
  startDate: z.coerce.date(),
  benefitsPackage: z.record(z.unknown()).optional(),
});

export class CreateOfferDto {
  @ApiProperty() offerId!: string;
  // The candidate application this offer is for. CreateOfferHandler resolves the
  // candidate (and its requisition) from this id, so it must be declared + sent.
  @ApiProperty() applicationId!: string;
  @ApiProperty() proposedSalary!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() startDate!: Date;
  @ApiPropertyOptional() benefitsPackage?: Record<string, unknown>;
}

export const SendOfferDtoSchema = z.object({
  sentAt: z.coerce.date().optional(),
});

export class SendOfferDto {
  @ApiPropertyOptional() sentAt?: Date;
}

export const AcceptOfferDtoSchema = z.object({
  acceptedAt: z.coerce.date().optional(),
});

export class AcceptOfferDto {
  @ApiPropertyOptional() acceptedAt?: Date;
}
