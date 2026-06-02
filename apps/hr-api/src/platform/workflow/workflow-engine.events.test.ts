import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { EventBus } from '../event-bus/event-bus.js';
import { WorkflowEngine } from './workflow-engine.js';

describe('WorkflowEngine event wiring', () => {
  it('publishes workflow lifecycle events for notification and audit consumers', async () => {
    const eventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventBus;
    const engine = new WorkflowEngine(eventBus);

    const instance = await engine.startWorkflow('leave-approval', {
      tenantId: Uuid.generate(),
      initiatorId: Uuid.generate(),
      payload: { aggregateType: 'AbsenceRequest' },
    });
    await engine.addStep(instance.id, { name: 'Manager approval', type: 'APPROVAL', status: 'PENDING' });
    await engine.completeStep(instance.id, instance.currentStepId!, { status: 'COMPLETED' });

    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'WorkflowStarted',
      aggregateType: 'WorkflowInstance',
      aggregateId: instance.id,
    }));
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'WorkflowStepCompleted',
      aggregateType: 'WorkflowInstance',
      aggregateId: instance.id,
      payload: expect.objectContaining({ stepName: 'Manager approval' }),
    }));
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'WorkflowCompleted',
      aggregateType: 'WorkflowInstance',
      aggregateId: instance.id,
    }));
  });
});
