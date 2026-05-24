import { z } from 'zod';
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

export const CreateEapReferralDto = z.object({
  workerId: z.string().uuid(),
  reason: z.string().min(1),
  scheduledDate: z.coerce.date().optional(),
  providerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type CreateEapReferralDto = z.infer<typeof CreateEapReferralDto>;

export const CreateWellnessProgramDto = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().optional(),
});

export type CreateWellnessProgramDto = z.infer<typeof CreateWellnessProgramDto>;

export const CreateMentalHealthCaseDto = z.object({
  workerId: z.string().uuid(),
  severity: z.string().min(1),
  providerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type CreateMentalHealthCaseDto = z.infer<typeof CreateMentalHealthCaseDto>;

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
