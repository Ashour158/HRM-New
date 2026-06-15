import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { SavedViewsController } from './saved-views.controller.js';
import { SavedView } from '../aggregates/saved-view.aggregate.js';
import type { SavedViewsRepository } from '../repositories/saved-views.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000999';
const actorId = '00000000-0000-0000-0000-000000000010';
const viewId = '00000000-0000-0000-0000-000000000260';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['SAVED_VIEW_READ', 'SAVED_VIEW_CREATE', 'SAVED_VIEW_UPDATE', 'SAVED_VIEW_DELETE'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(overrides: Partial<Request> = {}): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function savedView(overrides: Record<string, unknown> = {}) {
  return SavedView.rehydrate({
    id: new Uuid(viewId),
    tenantId: new Uuid(tenantId),
    userId: new Uuid(actorId),
    listKey: 'admin.workers',
    name: 'Active workers',
    filters: { status: 'ACTIVE' },
    columns: ['name', 'email', 'jobTitle'],
    isDefault: true,
    aggregateVersion: 0,
    createdAt: new Date('2026-06-15T08:00:00.000Z'),
    updatedAt: new Date('2026-06-15T08:00:00.000Z'),
    ...overrides,
  });
}

function makeController() {
  const repo = {
    findByUserAndList: vi.fn(),
    findByIdForUser: vi.fn(),
    save: vi.fn(async (view) => view),
    delete: vi.fn(),
    unsetDefaultForList: vi.fn(),
  } as unknown as SavedViewsRepository;

  return {
    controller: new SavedViewsController(repo),
    repo,
  };
}

describe('SavedViewsController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a user-scoped default saved view and clears the previous default', async () => {
    const { controller, repo } = makeController();
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (view) => view);

    const result = await controller.createView({
      listKey: 'admin.workers',
      name: 'Active workers',
      filters: { status: 'ACTIVE' },
      columns: ['name', 'email', 'jobTitle'],
      isDefault: true,
    }, request());

    expect(repo.unsetDefaultForList).toHaveBeenCalledWith(new Uuid(tenantId), new Uuid(actorId), 'admin.workers');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: new Uuid(tenantId),
      userId: new Uuid(actorId),
      listKey: 'admin.workers',
      name: 'Active workers',
      filters: { status: 'ACTIVE' },
      columns: ['name', 'email', 'jobTitle'],
      isDefault: true,
    }));
    expect(result).toMatchObject({
      tenantId,
      userId: actorId,
      listKey: 'admin.workers',
      name: 'Active workers',
      isDefault: true,
    });
  });

  it('lists only views owned by the authenticated actor and list key', async () => {
    const { controller, repo } = makeController();
    (repo.findByUserAndList as ReturnType<typeof vi.fn>).mockResolvedValue([savedView()]);

    const result = await controller.listViews('admin.workers', request());

    expect(repo.findByUserAndList).toHaveBeenCalledWith(new Uuid(tenantId), new Uuid(actorId), 'admin.workers');
    expect(result).toEqual([
      expect.objectContaining({
        id: viewId,
        tenantId,
        userId: actorId,
        listKey: 'admin.workers',
      }),
    ]);
  });

  it('updates a saved view without crossing tenant or user boundaries', async () => {
    const { controller, repo } = makeController();
    (repo.findByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(savedView());
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (view) => view);

    const result = await controller.updateView(viewId, {
      name: 'Workers by job',
      filters: { jobTitle: 'Engineer' },
      columns: ['name', 'jobTitle'],
      isDefault: true,
    }, request());

    expect(repo.findByIdForUser).toHaveBeenCalledWith(new Uuid(tenantId), new Uuid(actorId), new Uuid(viewId));
    expect(repo.unsetDefaultForList).toHaveBeenCalledWith(new Uuid(tenantId), new Uuid(actorId), 'admin.workers', new Uuid(viewId));
    expect(result).toMatchObject({
      id: viewId,
      name: 'Workers by job',
      filters: { jobTitle: 'Engineer' },
      columns: ['name', 'jobTitle'],
      isDefault: true,
    });
  });

  it('rejects requests without a validated actor or tenant context', async () => {
    const { controller, repo } = makeController();
    (repo.findByUserAndList as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(controller.listViews('admin.workers', request({ tenantId: otherTenantId }))).resolves.toBeDefined();
    await expect(controller.listViews('', request())).rejects.toThrow(BadRequestException);
    await expect(controller.createView({
      listKey: 'admin.workers',
      name: '',
      filters: {},
      columns: [],
    }, request())).rejects.toThrow(BadRequestException);
  });
});
