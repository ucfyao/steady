import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Validates and strips a request body with a schema from @steady/core.
 * (nestjs-zod does not support NestJS 12 yet; this is all we need from it.)
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    // A POST without a JSON body arrives as undefined; treat it as an empty object.
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid request',
        errors: result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`),
      });
    }
    return result.data;
  }
}
