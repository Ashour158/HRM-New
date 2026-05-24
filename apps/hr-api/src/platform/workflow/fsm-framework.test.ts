import { describe, it, expect, beforeEach } from 'vitest';
import { FsmFramework } from './fsm-framework.js';
import { Uuid } from '@hcm/shared-kernel';

describe('FsmFramework', () => {
  let fsm: FsmFramework;

  beforeEach(() => {
    fsm = new FsmFramework();
    fsm.register({
      aggregateType: 'WorkerProfile',
      states: ['DRAFT', 'PENDING_ACTIVATION', 'ACTIVE', 'TERMINATED'],
      actions: ['ActivateWorker', 'TerminateWorker'],
      transitions: [
        { action: 'ActivateWorker', from: 'DRAFT', to: 'PENDING_ACTIVATION', eventName: 'WorkerActivated' },
        { action: 'ActivateWorker', from: 'PENDING_ACTIVATION', to: 'ACTIVE', eventName: 'WorkerActivated' },
        { action: 'TerminateWorker', from: 'ACTIVE', to: 'TERMINATED', eventName: 'WorkerTerminated' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['TERMINATED'],
    });
  });

  it('returns allowed actions from a given state', () => {
    const actions = fsm.getAllowedActionsFromState('DRAFT', 'WorkerProfile');
    expect(actions).toContain('ActivateWorker');
    expect(actions).not.toContain('TerminateWorker');
  });

  it('allows DRAFT -> PENDING_ACTIVATION via ActivateWorker', () => {
    const instance = {
      aggregateId: Uuid.generate(),
      aggregateType: 'WorkerProfile',
      currentState: 'DRAFT',
      version: 1,
      history: [],
    };
    const result = fsm.transition(instance, 'ActivateWorker', {
      triggeredBy: 'test',
      correlationId: Uuid.generate(),
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.newState).toBe('PENDING_ACTIVATION');
      expect(result.value.eventName).toBe('WorkerActivated');
    }
  });

  it('rejects invalid action from a state', () => {
    const instance = {
      aggregateId: Uuid.generate(),
      aggregateType: 'WorkerProfile',
      currentState: 'DRAFT',
      version: 1,
      history: [],
    };
    const result = fsm.transition(instance, 'TerminateWorker', {
      triggeredBy: 'test',
      correlationId: Uuid.generate(),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_ACTION');
    }
  });

  it('rejects transition from terminal state', () => {
    const instance = {
      aggregateId: Uuid.generate(),
      aggregateType: 'WorkerProfile',
      currentState: 'TERMINATED',
      version: 1,
      history: [],
    };
    const result = fsm.transition(instance, 'ActivateWorker', {
      triggeredBy: 'test',
      correlationId: Uuid.generate(),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('ALREADY_TERMINAL');
    }
  });

  it('validates known states', () => {
    expect(fsm.validateState('WorkerProfile', 'DRAFT')).toBe(true);
    expect(fsm.validateState('WorkerProfile', 'UNKNOWN')).toBe(false);
  });
});
