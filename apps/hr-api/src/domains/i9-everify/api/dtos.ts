import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { I9Case } from '../aggregates/i9-case.aggregate.js';
import type { EverifyCase } from '../aggregates/everify-case.aggregate.js';

/** Read-model view of an {@link I9Case}, safe to return from an API/report surface. */
export interface I9CaseDto {
  i9CaseId: string;
  workerId: string;
  status: string;
  startDate: string;
  citizenshipStatus?: string;
  section1CompletedAt?: string;
  section1LateFlag: boolean;
  documentType?: string;
  documentDescriptions: string[];
  documentExpirationDate?: string;
  reviewerId?: string;
  section2DueDate: string;
  section2CompletedAt?: string;
  section2LateFlag: boolean;
  everifyCaseId?: string;
  rejectionReason?: string;
}

/** Read-model view of an {@link EverifyCase}, safe to return from an API/report surface. */
export interface EverifyCaseDto {
  everifyCaseId: string;
  workerId: string;
  i9CaseId: string;
  status: string;
  caseNumber?: string;
  submittedAt?: string;
  simulatedDetermination?: string;
  result?: string;
  resultRecordedAt?: string;
  resultRecordedBy?: string;
  contestedAt?: string;
}

export function toI9CaseDto(i9Case: I9Case): I9CaseDto {
  return {
    i9CaseId: i9Case.id.value,
    workerId: i9Case.workerId.value,
    status: i9Case.status,
    startDate: i9Case.startDate.toISOString(),
    citizenshipStatus: i9Case.citizenshipStatus,
    section1CompletedAt: i9Case.section1CompletedAt?.toISOString(),
    section1LateFlag: i9Case.section1LateFlag,
    documentType: i9Case.documentType,
    documentDescriptions: i9Case.documentDescriptions,
    documentExpirationDate: i9Case.documentExpirationDate?.toISOString(),
    reviewerId: i9Case.reviewerId?.value,
    section2DueDate: i9Case.section2DueDate.toISOString(),
    section2CompletedAt: i9Case.section2CompletedAt?.toISOString(),
    section2LateFlag: i9Case.section2LateFlag,
    everifyCaseId: i9Case.everifyCaseId?.value,
    rejectionReason: i9Case.rejectionReason,
  };
}

export function toEverifyCaseDto(everifyCase: EverifyCase): EverifyCaseDto {
  return {
    everifyCaseId: everifyCase.id.value,
    workerId: everifyCase.workerId.value,
    i9CaseId: everifyCase.i9CaseId.value,
    status: everifyCase.status,
    caseNumber: everifyCase.caseNumber,
    submittedAt: everifyCase.submittedAt?.toISOString(),
    simulatedDetermination: everifyCase.simulatedDetermination,
    result: everifyCase.result,
    resultRecordedAt: everifyCase.resultRecordedAt?.toISOString(),
    resultRecordedBy: everifyCase.resultRecordedBy?.value,
    contestedAt: everifyCase.contestedAt?.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Request DTOs (I9Case)                                              */
/* ------------------------------------------------------------------ */

const I9_CITIZENSHIP_STATUS_ENUM = z.enum([
  'US_CITIZEN',
  'NONCITIZEN_NATIONAL',
  'LAWFUL_PERMANENT_RESIDENT',
  'AUTHORIZED_ALIEN',
]);

const I9_DOCUMENT_TYPE_ENUM = z.enum(['LIST_A', 'LIST_B_AND_C']);

const EVERIFY_RESULT_ENUM = z.enum(['CONFIRMED', 'TENTATIVE_NONCONFIRMATION', 'FINAL_NONCONFIRMATION']);

export const CompleteI9CaseSection1DtoSchema = z.object({
  citizenshipStatus: I9_CITIZENSHIP_STATUS_ENUM,
  section1CompletedAt: z.coerce.date().optional(),
});

export class CompleteI9CaseSection1Dto {
  @ApiProperty({ enum: I9_CITIZENSHIP_STATUS_ENUM.options }) citizenshipStatus!: string;
  @ApiPropertyOptional() section1CompletedAt?: Date;
}

export const CompleteI9CaseSection2DtoSchema = z.object({
  documentType: I9_DOCUMENT_TYPE_ENUM,
  documentDescriptions: z.array(z.string().min(1)).optional(),
  documentExpirationDate: z.coerce.date().optional(),
  reviewerId: z.string().uuid(),
  section2CompletedAt: z.coerce.date().optional(),
});

export class CompleteI9CaseSection2Dto {
  @ApiProperty({ enum: I9_DOCUMENT_TYPE_ENUM.options }) documentType!: string;
  @ApiPropertyOptional({ type: [String] }) documentDescriptions?: string[];
  @ApiPropertyOptional() documentExpirationDate?: Date;
  @ApiProperty() reviewerId!: string;
  @ApiPropertyOptional() section2CompletedAt?: Date;
}

export const RejectI9CaseDtoSchema = z.object({
  reason: z.string().min(1),
});

export class RejectI9CaseDto {
  @ApiProperty() reason!: string;
}

/* ------------------------------------------------------------------ */
/*  Request DTOs (EverifyCase)                                         */
/* ------------------------------------------------------------------ */

export const SubmitEverifyCaseDtoSchema = z.object({
  i9CaseId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date().optional(),
});

export class SubmitEverifyCaseDto {
  @ApiProperty() i9CaseId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional() dateOfBirth?: Date;
}

export const RecordEverifyResultDtoSchema = z.object({
  result: EVERIFY_RESULT_ENUM.optional(),
  recordedBy: z.string().uuid().optional(),
});

export class RecordEverifyResultDto {
  @ApiPropertyOptional({ enum: EVERIFY_RESULT_ENUM.options }) result?: string;
  @ApiPropertyOptional() recordedBy?: string;
}

/* ------------------------------------------------------------------ */
/*  Validation pipe                                                    */
/* ------------------------------------------------------------------ */

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
