/**
 * Benefits Carrier Adapter
 *
 * Benefits integrates with external insurance carriers.
 * On BenefitsEnrollmentFinalized the enrollment is pushed to the carrier.
 * On LifeEventProcessed the carrier record is updated.
 * This adapter also receives carrier reconciliation files.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { IntegrationAdapter, IntegrationResult } from '../types.js';
import { createReadinessMetadata } from '../readiness.js';

export interface CarrierResult extends IntegrationResult {
  carrierReference?: string;
}

export interface ReconciliationResult extends IntegrationResult {
  matchedCount?: number;
  discrepancyCount?: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  effectiveDate?: string;
}

export interface BenefitsEnrollmentPayload {
  enrollmentId: Uuid;
  workerId: Uuid;
  programId: Uuid;
  coverageStartDate: string;
  dependents?: Uuid[];
}

export interface LifeEventPayload {
  lifeEventId: Uuid;
  workerId: Uuid;
  eventType: string;
  effectiveDate: string;
}

@Injectable()
export class BenefitsCarrierAdapter implements IntegrationAdapter {
  readonly name = 'benefits-carrier';
  readonly direction = 'BIDIRECTIONAL' as const;
  readonly readiness = createReadinessMetadata({
    ownerTeam: 'Benefits Operations',
    ownerContact: 'benefits-ops@example.com',
    sandboxEndpointRef: 'env:HR_BENEFITS_CARRIER_SANDBOX_ENDPOINT',
    productionEndpointRef: 'env:HR_BENEFITS_CARRIER_PRODUCTION_ENDPOINT',
    credentialRefBase: 'vault:integrations/benefits-carrier',
  });
  private readonly logger = new Logger(BenefitsCarrierAdapter.name);

  async healthCheck(): Promise<boolean> {
    // Mock: ping carrier API gateway
    return true;
  }

  /**
   * Send a finalized enrollment to the carrier.
   * @param enrollment Enrollment payload
   */
  async sendEnrollment(enrollment: BenefitsEnrollmentPayload): Promise<CarrierResult> {
    this.logger.log({
      type: 'CARRIER_SEND_ENROLLMENT',
      enrollmentId: enrollment.enrollmentId.value,
      workerId: enrollment.workerId.value,
    });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      carrierReference: `CAR-${enrollment.enrollmentId.value}`,
      details: { programId: enrollment.programId.value },
    };
  }

  /**
   * Notify the carrier of an enrollment termination.
   * @param enrollmentId Enrollment aggregate id
   */
  async sendTermination(enrollmentId: Uuid): Promise<CarrierResult> {
    this.logger.log({ type: 'CARRIER_SEND_TERMINATION', enrollmentId: enrollmentId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      details: { enrollmentId: enrollmentId.value, action: 'TERMINATED' },
    };
  }

  /**
   * Send a life-event update to the carrier.
   * @param event Life event payload
   */
  async sendLifeEventUpdate(event: LifeEventPayload): Promise<CarrierResult> {
    this.logger.log({ type: 'CARRIER_SEND_LIFE_EVENT', lifeEventId: event.lifeEventId.value });

    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      details: { eventType: event.eventType, workerId: event.workerId.value },
    };
  }

  /**
   * Process a carrier reconciliation file (INBOUND).
   * @param file Reconciliation file contents / metadata
   */
  async receiveReconciliation(file: unknown): Promise<ReconciliationResult> {
    this.logger.log({ type: 'CARRIER_RECEIVE_RECONCILIATION' });

    // Mock implementation
    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      matchedCount: 0,
      discrepancyCount: 0,
      details: { file },
    };
  }

  /**
   * Validate worker eligibility for a benefits program.
   * @param workerId  Worker aggregate id
   * @param programId Benefits program id
   */
  async validateEligibility(workerId: Uuid, programId: Uuid): Promise<EligibilityResult> {
    this.logger.log({ type: 'CARRIER_VALIDATE_ELIGIBILITY', workerId: workerId.value, programId: programId.value });

    return { eligible: true, effectiveDate: new Date().toISOString() };
  }

  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.enrollmentId && p.workerId && p.programId) {
      return this.sendEnrollment(p as unknown as BenefitsEnrollmentPayload);
    }
    if (p.enrollmentId && p.action === 'TERMINATE') {
      return this.sendTermination(p.enrollmentId as Uuid);
    }
    if (p.lifeEventId && p.workerId && p.eventType) {
      return this.sendLifeEventUpdate(p as unknown as LifeEventPayload);
    }
    throw new Error('Benefits Carrier Adapter: unsupported payload shape');
  }

  async receive(): Promise<unknown> {
    return this.receiveReconciliation({});
  }
}
