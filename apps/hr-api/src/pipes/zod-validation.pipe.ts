import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Interface for DTO classes that expose a static Zod schema.
 */
export interface ZodDto {
  zodSchema: ZodSchema<unknown>;
}

/**
 * NestJS pipe that validates incoming data using a Zod schema attached
 * to the DTO class via a static `zodSchema` property.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: { metatype?: unknown }): unknown {
    const metatype = metadata.metatype as (new () => unknown) & Partial<ZodDto> | undefined;
    const schema = metatype?.zodSchema;

    if (!schema) {
      // No schema defined — pass through untouched.
      return value;
    }

    const result = schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: this.flattenErrors(result.error),
      });
    }

    return result.data;
  }

  private flattenErrors(error: ZodError): Array<{ path: string; message: string }> {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
}
