import { Injectable } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';

export type WorkflowStepType = 'MANUAL' | 'AUTO' | 'APPROVAL' | 'ENGINE';
export type WorkflowStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  status: WorkflowStepStatus;
  assigneeRoles?: string[];
  dueDate?: Date;
  completedAt?: Date;
  result?: unknown;
}

export interface WorkflowInstance {
  id: Uuid;
  definitionId: string;
  tenantId: Uuid;
  status: WorkflowStatus;
  currentStepId?: string;
  steps: WorkflowStep[];
  context: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkflowContext {
  tenantId: Uuid;
  initiatorId: Uuid;
  payload?: unknown;
}

export interface StepResult {
  status: WorkflowStepStatus;
  data?: unknown;
  reason?: string;
}

@Injectable()
export class WorkflowEngine {
  private readonly instances = new Map<string, WorkflowInstance>();

  async startWorkflow(
    definitionId: string,
    context: WorkflowContext,
  ): Promise<WorkflowInstance> {
    const id = crypto.randomUUID() as unknown as Uuid;
    const instance: WorkflowInstance = {
      id,
      definitionId,
      tenantId: context.tenantId,
      status: 'RUNNING',
      steps: [],
      context: {
        initiatorId: context.initiatorId.value,
        payload: context.payload,
      },
      startedAt: new Date(),
    };
    this.instances.set(id.value, instance);
    return instance;
  }

  async completeStep(
    instanceId: Uuid,
    stepId: string,
    result: StepResult,
  ): Promise<void> {
    const instance = this.instances.get(instanceId.value);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId.value} not found`);
    }
    const step = instance.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in workflow ${instanceId.value}`);
    }
    step.status = result.status;
    step.completedAt = new Date();
    step.result = result.data;

    // Advance to next step if available
    const currentIndex = instance.steps.findIndex((s) => s.id === stepId);
    const nextStep = instance.steps[currentIndex + 1];
    if (nextStep) {
      instance.currentStepId = nextStep.id;
      nextStep.status = 'IN_PROGRESS';
    } else if (instance.steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED')) {
      instance.status = 'COMPLETED';
      instance.completedAt = new Date();
    }
  }

  async cancelWorkflow(instanceId: Uuid, reason: string): Promise<void> {
    const instance = this.instances.get(instanceId.value);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId.value} not found`);
    }
    instance.status = 'CANCELLED';
    instance.completedAt = new Date();
    instance.context.cancellationReason = reason;
  }

  async getInstance(instanceId: Uuid): Promise<WorkflowInstance | undefined> {
    return this.instances.get(instanceId.value);
  }

  async addStep(
    instanceId: Uuid,
    step: Omit<WorkflowStep, 'id'>,
  ): Promise<void> {
    const instance = this.instances.get(instanceId.value);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId.value} not found`);
    }
    const newStep: WorkflowStep = {
      ...step,
      id: crypto.randomUUID(),
    };
    instance.steps.push(newStep);
    if (!instance.currentStepId) {
      instance.currentStepId = newStep.id;
      newStep.status = 'IN_PROGRESS';
    }
  }
}
