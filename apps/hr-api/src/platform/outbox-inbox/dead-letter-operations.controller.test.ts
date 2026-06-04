import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { DeadLetterOperationsController } from './dead-letter-operations.controller.js';
import type { DeadLetterOperationsService } from './dead-letter-operations.service.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const adminId = '00000000-0000-0000-0000-000000000101';

function request(roles: string[] | undefined, mfaAuthenticated = true): Request {
  return {
    tenantId,
    actor: roles ? {
      actorType: roles.includes('EMPLOYEE') ? 'EMPLOYEE' : 'USER',
      actorId: new Uuid(adminId),
      roles,
      permissions: [],
      mfaAuthenticated,
      email: roles.includes('EMPLOYEE') ? 'employee@example.com' : 'admin@example.com',
    } : undefined,
  } as unknown as Request;
}

function response() {
  return {
    setHeader: vi.fn(),
    send: vi.fn((payload) => payload),
  } as unknown as Response & { setHeader: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
}

function service() {
  return {
    getSummary: vi.fn(async () => ({ inbox: {}, outbox: {}, generatedAt: new Date().toISOString() })),
    listInboxEvents: vi.fn(async () => []),
    listOutboxEvents: vi.fn(async () => []),
    retryInboxEvent: vi.fn(async () => ({ action: 'RETRY_INBOX_EVENT' })),
    skipInboxEvent: vi.fn(async () => ({ action: 'SKIP_INBOX_EVENT' })),
    retryOutboxEvent: vi.fn(async () => ({ action: 'RETRY_OUTBOX_EVENT' })),
    skipOutboxEvent: vi.fn(async () => ({ action: 'SKIP_OUTBOX_EVENT' })),
    bulkCommand: vi.fn(async () => ({ action: 'BULK_RETRY_INBOX_EVENTS', requested: 1, succeeded: 1, failed: [], results: [] })),
    exportCsv: vi.fn(async () => 'queue,id\n'),
  } as unknown as DeadLetterOperationsService;
}

describe('DeadLetterOperationsController', () => {
  it('blocks employees from operator dead-letter reads', async () => {
    const controller = new DeadLetterOperationsController(service());

    await expect(controller.summary(request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.listInbox(request(['MANAGER']), {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows platform admins to inspect tenant-scoped queues', async () => {
    const svc = service();
    const controller = new DeadLetterOperationsController(svc);

    await controller.summary(request(['PLATFORM_ADMIN']));
    await controller.listOutbox(request(['SUPER_ADMIN']), { status: 'EXHAUSTED', limit: '25' });

    expect(svc.getSummary).toHaveBeenCalledWith(new Uuid(tenantId));
    expect(svc.listOutboxEvents).toHaveBeenCalledWith(new Uuid(tenantId), expect.objectContaining({
      status: 'EXHAUSTED',
      limit: 25,
    }));
  });

  it('requires MFA for retry and skip commands', async () => {
    const svc = service();
    const controller = new DeadLetterOperationsController(svc);

    await expect(controller.retryInbox('inbox-1', { reason: 'fixed' }, request(['PLATFORM_ADMIN'], false)))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.skipOutbox('outbox-1', { reason: 'poison' }, request(['PLATFORM_ADMIN'], false)))
      .rejects.toBeInstanceOf(ForbiddenException);

    await controller.retryInbox('inbox-1', { reason: 'fixed' }, request(['PLATFORM_ADMIN']));
    await controller.skipOutbox('outbox-1', { reason: 'poison' }, request(['SUPER_ADMIN']));

    expect(svc.retryInboxEvent).toHaveBeenCalledWith(new Uuid(tenantId), 'inbox-1', expect.objectContaining({
      actorId: adminId,
      actorName: 'admin@example.com',
    }), 'fixed');
    expect(svc.skipOutboxEvent).toHaveBeenCalledWith(new Uuid(tenantId), 'outbox-1', expect.objectContaining({
      actorId: adminId,
      actorName: 'admin@example.com',
    }), 'poison');
  });

  it('runs bulk operator commands with MFA and actor evidence', async () => {
    const svc = service();
    const controller = new DeadLetterOperationsController(svc);

    await controller.bulkInbox(
      { command: 'retry', ids: ['inbox-1', 'inbox-2'], reason: 'consumer fixed' },
      request(['APP_ADMIN']),
    );
    await controller.bulkOutbox(
      { command: 'skip', ids: ['outbox-1'], reason: 'legacy poison event' },
      request(['SUPER_ADMIN']),
    );

    expect(svc.bulkCommand).toHaveBeenCalledWith(
      new Uuid(tenantId),
      'inbox',
      'retry',
      ['inbox-1', 'inbox-2'],
      expect.objectContaining({ actorId: adminId, actorName: 'admin@example.com' }),
      'consumer fixed',
    );
    expect(svc.bulkCommand).toHaveBeenCalledWith(
      new Uuid(tenantId),
      'outbox',
      'skip',
      ['outbox-1'],
      expect.objectContaining({ actorId: adminId, actorName: 'admin@example.com' }),
      'legacy poison event',
    );
  });

  it('exports CSV with admin headers and MFA protection', async () => {
    const svc = service();
    const controller = new DeadLetterOperationsController(svc);
    const res = response();

    await controller.exportCsv(request(['APP_ADMIN']), { queue: 'outbox', status: 'EXHAUSTED', search: 'payroll' }, res);

    expect(svc.exportCsv).toHaveBeenCalledWith(
      new Uuid(tenantId),
      expect.objectContaining({ queue: 'outbox', status: 'EXHAUSTED', search: 'payroll' }),
      expect.objectContaining({
        actorId: adminId,
        actorName: 'admin@example.com',
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('X-Data-Classification', 'CONFIDENTIAL');
    expect(res.send).toHaveBeenCalledWith('\uFEFFqueue,id\n');
  });
});
