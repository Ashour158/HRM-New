import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { MeInboxController } from './me-inbox.controller.js';
import type { MeInboxService } from './me-inbox.service.js';

describe('MeInboxController', () => {
  it('returns the authenticated tenant and actor inbox', async () => {
    const service = {
      getInbox: vi.fn().mockResolvedValue({
        generatedAt: '2026-06-15T10:00:00.000Z',
        sections: [],
      }),
    } as unknown as MeInboxService;
    const controller = new MeInboxController(service);
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const actorId = new Uuid('00000000-0000-0000-0000-000000000011');

    const response = await controller.getInbox({
      tenantId,
      actor: {
        actorId,
        actorType: 'USER',
        roles: ['MANAGER'],
        permissions: ['WORKFLOW_APPROVE'],
        mfaAuthenticated: true,
      },
    } as never);

    expect(response).toEqual({ generatedAt: '2026-06-15T10:00:00.000Z', sections: [] });
    expect(service.getInbox).toHaveBeenCalledWith({
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId }),
    });
  });
});
