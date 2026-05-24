import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export const CreateLearningCourseDtoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  contentType: z.string().min(1),
  durationMinutes: z.number().optional(),
  credits: z.number().optional(),
  certificationEligible: z.boolean().optional(),
});

export class CreateLearningCourseDto {
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() contentType!: string;
  @ApiPropertyOptional() durationMinutes?: number;
  @ApiPropertyOptional() credits?: number;
  @ApiPropertyOptional() certificationEligible?: boolean;
}

export const CreateLearningAssignmentDtoSchema = z.object({
  workerId: z.string().uuid(),
  courseId: z.string().uuid(),
  assignedBy: z.string().uuid(),
  dueDate: z.coerce.date().optional(),
});

export class CreateLearningAssignmentDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() assignedBy!: string;
  @ApiPropertyOptional() dueDate?: Date;
}

export const CompleteLearningAssignmentDtoSchema = z.object({
  score: z.number(),
});

export class CompleteLearningAssignmentDto {
  @ApiProperty() score!: number;
}

export const CreateCertificationDtoSchema = z.object({
  workerId: z.string().uuid(),
  certificationName: z.string().min(1),
  issuingBody: z.string().optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  credentialId: z.string().optional(),
});

export class CreateCertificationDto {
  @ApiProperty() workerId!: string;
  @ApiProperty() certificationName!: string;
  @ApiPropertyOptional() issuingBody?: string;
  @ApiPropertyOptional() issueDate?: Date;
  @ApiPropertyOptional() expiryDate?: Date;
  @ApiPropertyOptional() credentialId?: string;
}

export const RenewCertificationDtoSchema = z.object({
  newExpiryDate: z.coerce.date(),
});

export class RenewCertificationDto {
  @ApiProperty() newExpiryDate!: Date;
}

export const CreateLearningContentPackageDtoSchema = z.object({
  packageType: z.enum(['SCORM_1_2', 'SCORM_2004', 'XAPI']),
  title: z.string().min(1),
  version: z.string().optional(),
  fileUrl: z.string().optional(),
  manifest: z.record(z.unknown()).optional(),
});

export class CreateLearningContentPackageDto {
  @ApiProperty() packageType!: 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';
  @ApiProperty() title!: string;
  @ApiPropertyOptional() version?: string;
  @ApiPropertyOptional() fileUrl?: string;
  @ApiPropertyOptional() manifest?: Record<string, unknown>;
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
