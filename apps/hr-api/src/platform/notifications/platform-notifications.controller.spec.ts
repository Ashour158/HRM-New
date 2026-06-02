import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { PlatformNotificationsController } from './platform-notifications.controller.js';
import type { PlatformNotificationRepository } from './platform-notification.repository.js';

function request(role: string, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000011'),
      roles: [role],
      email: 'employee@example.com',
      ...overrides,
    },
  } as never;
}

describe('PlatformNotificationsController', () => {
  it('returns employee-scoped notifications for the authenticated worker', async () => {
    const repository = {
      findWorkerIdForActor: vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000011'),
      findByWorker: vi.fn().mockResolvedValue([{ id: 'notification-1' }]),
    } as unknown as PlatformNotificationRepository;
    const controller = new PlatformNotificationsController(repository);

    await expect(controller.getMyNotifications(request('EMPLOYEE'))).resolves.toEqual([{ id: 'notification-1' }]);
    expect(repository.findByWorker).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000011',
      50,
    );
  });

  it('rejects employee notification access when no tenant worker is linked', async () => {
    const repository = {
      findWorkerIdForActor: vi.fn().mockResolvedValue(undefined),
      findByWorker: vi.fn(),
    } as unknown as PlatformNotificationRepository;
    const controller = new PlatformNotificationsController(repository);

    await expect(controller.getMyNotifications(request('EMPLOYEE'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findByWorker).not.toHaveBeenCalled();
  });

  it('returns HR operations notifications only to HR administrators', async () => {
    const repository = {
      findByRole: vi.fn().mockResolvedValue([{ id: 'hr-feed-1' }]),
    } as unknown as PlatformNotificationRepository;
    const controller = new PlatformNotificationsController(repository);

    await expect(controller.getHrOperationsNotifications(request('HR_ADMIN'))).resolves.toEqual([{ id: 'hr-feed-1' }]);
    await expect(controller.getHrOperationsNotifications(request('EMPLOYEE'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
