import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { WorkforceManagementController } from './workforce-management.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000500';
const scheduleId = '00000000-0000-0000-0000-000000000501';
const departmentId = '00000000-0000-0000-0000-000000000502';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['WORKFORCE_MANAGEMENT_WRITE', 'WORKFORCE_MANAGEMENT_READ'],
    email: 'wfm.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function buildController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) };
  const shiftScheduleRepo = { findById: vi.fn(), findByWorker: vi.fn(), findByTenant: vi.fn() };
  const openShiftRepo = { findById: vi.fn(), findByDepartment: vi.fn(), findByTenant: vi.fn() };
  const shiftBidRepo = { findById: vi.fn(), findByWorker: vi.fn(), findByTenant: vi.fn() };
  const shiftSwapRequestRepo = { findById: vi.fn(), findByRequester: vi.fn(), findByTenant: vi.fn() };
  const overtimeApprovalRepo = { findById: vi.fn(), findByWorker: vi.fn(), findByTenant: vi.fn() };
  const coverageGapRepo = { findById: vi.fn(), findByDepartment: vi.fn(), findByTenant: vi.fn() };
  const controller = new WorkforceManagementController(
    commandBus as unknown as CommandBus,
    shiftScheduleRepo as never,
    openShiftRepo as never,
    shiftBidRepo as never,
    shiftSwapRequestRepo as never,
    overtimeApprovalRepo as never,
    coverageGapRepo as never,
  );

  return { controller, commandBus, shiftScheduleRepo, openShiftRepo, shiftBidRepo, shiftSwapRequestRepo, overtimeApprovalRepo, coverageGapRepo };
}

describe('WorkforceManagementController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates, publishes, and reads shift schedules with aggregate guards', async () => {
    const { controller, commandBus, shiftScheduleRepo } = buildController();
    const persistedSchedule = {
      id: new Uuid(scheduleId),
      tenantId: new Uuid(tenantId),
      workerId: new Uuid(workerId),
      status: 'DRAFT',
      aggregateVersion: 2,
    };
    shiftScheduleRepo.findById.mockResolvedValue(persistedSchedule);

    await controller.createShiftSchedule({
      workerId,
      departmentId,
      shiftDate: new Date('2026-02-01'),
      startTime: new Date('2026-02-01T09:00:00Z'),
      endTime: new Date('2026-02-01T17:00:00Z'),
      breakDuration: 60,
      workplaceCode: 'CAIRO_HQ',
    }, request());
    await controller.publishShiftSchedule(scheduleId, request());
    await expect(controller.getShiftSchedule(scheduleId)).resolves.toBe(persistedSchedule);

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateShiftSchedule',
      aggregateType: 'ShiftSchedule',
      payload: expect.objectContaining({ workerId, departmentId, workplaceCode: 'CAIRO_HQ' }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'PublishShiftSchedule',
      aggregateType: 'ShiftSchedule',
      aggregateId: new Uuid(scheduleId),
      expectedState: 'DRAFT',
      expectedVersion: 2,
      payload: { shiftScheduleId: new Uuid(scheduleId) },
    }));
    expect(shiftScheduleRepo.findById).toHaveBeenCalledWith(new Uuid(scheduleId));
  });

  it('lists workforce records by the authenticated tenant only', async () => {
    const {
      controller,
      shiftScheduleRepo,
      openShiftRepo,
      shiftBidRepo,
      shiftSwapRequestRepo,
      overtimeApprovalRepo,
      coverageGapRepo,
    } = buildController();
    shiftScheduleRepo.findByTenant.mockResolvedValue([{ id: new Uuid(scheduleId), status: 'PUBLISHED' }]);
    openShiftRepo.findByTenant.mockResolvedValue([{ id: new Uuid('00000000-0000-0000-0000-000000000601'), status: 'OPEN' }]);
    shiftBidRepo.findByTenant.mockResolvedValue([]);
    shiftSwapRequestRepo.findByTenant.mockResolvedValue([]);
    overtimeApprovalRepo.findByTenant.mockResolvedValue([]);
    coverageGapRepo.findByTenant.mockResolvedValue([{ id: new Uuid('00000000-0000-0000-0000-000000000602'), status: 'DETECTED' }]);

    await expect(controller.getShiftSchedulesByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getOpenShiftsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getShiftBidsByTenant(tenantId, request())).resolves.toEqual([]);
    await expect(controller.getShiftSwapRequestsByTenant(tenantId, request())).resolves.toEqual([]);
    await expect(controller.getOvertimeApprovalsByTenant(tenantId, request())).resolves.toEqual([]);
    await expect(controller.getCoverageGapsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getShiftSchedulesByTenant('00000000-0000-0000-0000-000000000999', request())).rejects.toThrow('Tenant mismatch');

    expect(shiftScheduleRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
    expect(coverageGapRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });
});
