import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { NotFoundError, ValidationError, ConflictError } from '@hcm/shared-kernel';
import { DomainExceptionFilter } from './domain-exception.filter.js';

function hostFor(req: Record<string, unknown> = {}) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ headers: {}, url: '/x', method: 'POST', ...req }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('preserves the status of a framework HttpException (403, not 500)', () => {
    const { host, status, json } = hostFor();
    filter.catch(new ForbiddenException('nope'), host);
    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0]).toMatchObject({ success: false, errorMessage: 'nope' });
  });

  it('maps a BadRequestException to 400', () => {
    const { host, status } = hostFor();
    filter.catch(new BadRequestException('bad'), host);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps domain NotFoundError to 404', () => {
    const { host, status } = hostFor();
    filter.catch(new NotFoundError('missing'), host);
    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps domain ValidationError to 422', () => {
    const { host, status } = hostFor();
    filter.catch(new ValidationError('invalid'), host);
    expect(status).toHaveBeenCalledWith(422);
  });

  it('maps an unknown error to 500 with a generic envelope', () => {
    const { host, status, json } = hostFor();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({ success: false, errorCode: 'INTERNAL_ERROR' });
  });

  it('echoes the request correlation id and domain code into the envelope', () => {
    const { host, status, json } = hostFor({ correlationId: 'corr-123' });
    filter.catch(new ConflictError('dup'), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0]).toMatchObject({ correlationId: 'corr-123', errorCode: 'CONFLICT' });
  });
});
