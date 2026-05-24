/**
 * IAM Provisioning Adapter
 *
 * HR Core owns worker/employment truth; IAM owns login identity and credentials.
 * This adapter **only** calls the IAM command port – it never mutates HR Core
 * tables directly.
 *
 * Trigger events:
 * - WorkerActivated   → provision user account
 * - WorkerTerminated  → deactivate user account
 * - JobAssignmentChanged → update IAM roles/groups
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { IntegrationAdapter, IntegrationResult } from '../types.js';

export interface IamProvisioningResult extends IntegrationResult {
  iamUserId?: string;
}

export interface IamRole {
  roleId: string;
  roleName: string;
}

@Injectable()
export class IamProvisioningAdapter implements IntegrationAdapter {
  readonly name = 'iam-provisioning';
  readonly direction = 'OUTBOUND' as const;
  private readonly logger = new Logger(IamProvisioningAdapter.name);

  /** Health probe – checks IAM command port reachability. */
  async healthCheck(): Promise<boolean> {
    // Mock: in production this would ping the IAM /health endpoint
    return true;
  }

  /**
   * Provision a new user account in IAM when a worker is activated.
   * @param workerId HR Core worker identifier
   * @param email    Corporate email address
   * @param roles    Initial role assignments
   */
  async provisionUser(
    workerId: Uuid,
    email: string,
    roles: IamRole[],
  ): Promise<IamProvisioningResult> {
    this.logger.log({ type: 'IAM_PROVISION_USER', workerId: workerId.value, email, roleCount: roles.length });

    // Mock implementation – replace with real IAM API call
    const iamUserId = `IAM-${workerId.value}`;

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      iamUserId,
      details: { workerId: workerId.value, email, roles: roles.map((r) => r.roleName) },
    };
  }

  /**
   * Deactivate (soft-delete) the IAM user account when a worker is terminated.
   * @param workerId HR Core worker identifier
   */
  async deprovisionUser(workerId: Uuid): Promise<IamProvisioningResult> {
    this.logger.log({ type: 'IAM_DEPROVISION_USER', workerId: workerId.value });

    // Mock implementation
    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      details: { workerId: workerId.value, action: 'DEACTIVATED' },
    };
  }

  /**
   * Update IAM roles/groups when a worker's job assignment changes.
   * @param workerId HR Core worker identifier
   * @param roles    Updated role assignments
   */
  async updateUserRoles(workerId: Uuid, roles: IamRole[]): Promise<IamProvisioningResult> {
    this.logger.log({ type: 'IAM_UPDATE_ROLES', workerId: workerId.value, roleCount: roles.length });

    // Mock implementation
    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      details: { workerId: workerId.value, roles: roles.map((r) => r.roleName) },
    };
  }

  /** Generic send façade – delegates to provisionUser for well-formed payloads. */
  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.workerId && p.email && Array.isArray(p.roles)) {
      return this.provisionUser(
        p.workerId as Uuid,
        p.email as string,
        p.roles as IamRole[],
      );
    }
    if (p.workerId && p.action === 'DEPROVISION') {
      return this.deprovisionUser(p.workerId as Uuid);
    }
    if (p.workerId && p.action === 'UPDATE_ROLES' && Array.isArray(p.roles)) {
      return this.updateUserRoles(p.workerId as Uuid, p.roles as IamRole[]);
    }
    throw new Error('IAM Provisioning Adapter: unsupported payload shape');
  }

  /** Generic receive façade – IAM does not push inbound events via this adapter. */
  async receive(): Promise<unknown> {
    return { message: 'No inbound queue configured for IAM adapter' };
  }
}
