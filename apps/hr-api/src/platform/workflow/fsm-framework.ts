import { Injectable } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import { Ok, Err, type Result } from '@hcm/shared-kernel';

export interface FsmTransition<TState, TAction> {
  action: TAction;
  from: TState;
  to: TState;
  guard?: string;
  eventName: string;
}

export interface FsmTransitionRecord {
  fromState: string;
  toState: string;
  action: string;
  occurredAt: Date;
}

export interface FsmDefinition<TState, TAction> {
  aggregateType: string;
  states: TState[];
  actions: TAction[];
  transitions: FsmTransition<TState, TAction>[];
  initialState: TState;
  terminalStates: TState[];
}

export interface FsmInstance<TState> {
  aggregateId: Uuid;
  aggregateType: string;
  currentState: TState;
  version: number;
  history: FsmTransitionRecord[];
}

export interface TransitionContext {
  triggeredBy: string;
  correlationId: Uuid;
  effectiveDate?: Date;
  payload?: unknown;
}

export interface FsmTransitionResult {
  newState: string;
  eventName: string;
  transitionRecord: FsmTransitionRecord;
}

export enum FsmErrorCode {
  DEFINITION_NOT_FOUND = 'DEFINITION_NOT_FOUND',
  INVALID_ACTION = 'INVALID_ACTION',
  GUARD_DENIED = 'GUARD_DENIED',
  ALREADY_TERMINAL = 'ALREADY_TERMINAL',
}

export interface FsmError {
  code: FsmErrorCode;
  message: string;
}

@Injectable()
export class FsmFramework {
  private readonly definitions = new Map<string, FsmDefinition<string, string>>();

  register(definition: FsmDefinition<string, string>): void {
    this.definitions.set(definition.aggregateType, definition);
  }

  getDefinition(aggregateType: string): FsmDefinition<string, string> | undefined {
    return this.definitions.get(aggregateType);
  }

  canTransition(instance: FsmInstance<string>, action: string): boolean {
    const def = this.definitions.get(instance.aggregateType);
    if (!def) return false;
    if (!def.states.includes(instance.currentState)) return false;
    if (def.terminalStates.includes(instance.currentState)) return false;
    const transition = def.transitions.find(
      (t) => t.from === instance.currentState && t.action === action,
    );
    return !!transition;
  }

  transition(
    instance: FsmInstance<string>,
    action: string,
    _context: TransitionContext,
  ): Result<FsmTransitionResult, FsmError> {
    const def = this.definitions.get(instance.aggregateType);
    if (!def) {
      return new Err({
        code: FsmErrorCode.DEFINITION_NOT_FOUND,
        message: `No FSM definition found for aggregate type ${instance.aggregateType}`,
      });
    }

    if (!def.states.includes(instance.currentState)) {
      return new Err({
        code: FsmErrorCode.DEFINITION_NOT_FOUND,
        message: `State ${instance.currentState} is not valid for aggregate type ${instance.aggregateType}`,
      });
    }

    if (def.terminalStates.includes(instance.currentState)) {
      return new Err({
        code: FsmErrorCode.ALREADY_TERMINAL,
        message: `Aggregate is in terminal state ${instance.currentState}`,
      });
    }

    const transition = def.transitions.find(
      (t) => t.from === instance.currentState && t.action === action,
    );
    if (!transition) {
      return new Err({
        code: FsmErrorCode.INVALID_ACTION,
        message: `Action ${action} not allowed from state ${instance.currentState}`,
      });
    }

    const record: FsmTransitionRecord = {
      fromState: instance.currentState,
      toState: transition.to,
      action,
      occurredAt: new Date(),
    };

    return new Ok({
      newState: transition.to,
      eventName: transition.eventName,
      transitionRecord: record,
    });
  }

  getAllowedActions(instance: FsmInstance<string>): string[] {
    const def = this.definitions.get(instance.aggregateType);
    if (!def) return [];
    if (!def.states.includes(instance.currentState)) return [];
    return def.transitions
      .filter((t) => t.from === instance.currentState)
      .map((t) => t.action);
  }

  getAllowedActionsFromState(state: string, aggregateType: string): string[] {
    const def = this.definitions.get(aggregateType);
    if (!def) return [];
    return def.transitions.filter((t) => t.from === state).map((t) => t.action);
  }

  validateState(aggregateType: string, state: string): boolean {
    const def = this.definitions.get(aggregateType);
    if (!def) return false;
    return def.states.includes(state);
  }
}
