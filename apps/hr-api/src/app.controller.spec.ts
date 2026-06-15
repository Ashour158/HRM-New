import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { AppController } from './app.controller.js';
import type { AppService } from './app.service.js';

function responseMock(): Pick<Response, 'status'> {
  return {
    status: vi.fn().mockReturnThis(),
  } as unknown as Pick<Response, 'status'>;
}

describe('AppController readiness', () => {
  it('keeps HTTP 200 when readiness checks pass', async () => {
    const service = {
      getReadiness: vi.fn().mockResolvedValue({
        status: 'ready',
        checks: [{ name: 'database', status: 'up' }],
        timestamp: '2026-06-12T00:00:00.000Z',
      }),
    } as unknown as AppService;
    const response = responseMock();
    const controller = new AppController(service);

    const readiness = await controller.getReadiness(response as Response);

    expect(readiness.status).toBe('ready');
    expect(response.status).not.toHaveBeenCalled();
  });

  it('returns HTTP 503 when a readiness dependency is down', async () => {
    const service = {
      getReadiness: vi.fn().mockResolvedValue({
        status: 'not_ready',
        checks: [{ name: 'database', status: 'down', details: 'connection refused' }],
        timestamp: '2026-06-12T00:00:00.000Z',
      }),
    } as unknown as AppService;
    const response = responseMock();
    const controller = new AppController(service);

    const readiness = await controller.getReadiness(response as Response);

    expect(readiness.status).toBe('not_ready');
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
