import { z } from 'zod';
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

export const CreateUnionRecognitionDto = z.object({
  unionName: z.string().min(1),
  bargainingUnitId: z.string().uuid(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  agreementDocument: z.string().optional(),
});

export type CreateUnionRecognitionDto = z.infer<typeof CreateUnionRecognitionDto>;

export const CreateGrievanceDto = z.object({
  workerId: z.string().uuid(),
  grievanceType: z.string().min(1),
  description: z.string().min(1),
  resolution: z.string().optional(),
  arbitratorDecision: z.string().optional(),
});

export type CreateGrievanceDto = z.infer<typeof CreateGrievanceDto>;

export const CreateCollectiveBargainingSessionDto = z.object({
  unionRecognitionId: z.string().uuid(),
  sessionDate: z.coerce.date(),
  location: z.string().optional(),
  agenda: z.string().optional(),
  minutes: z.string().optional(),
});

export type CreateCollectiveBargainingSessionDto = z.infer<typeof CreateCollectiveBargainingSessionDto>;

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodTypeAny) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.format());
    return result.data;
  }
}
