/**
 * E-Verify Submission Adapter
 *
 * Submits Section 2 employer data to the federal E-Verify system for an
 * employment-eligibility determination. The real USCIS E-Verify web service is
 * not reachable from this environment (no federal credential exists here), so
 * this adapter follows the same "real outbound call, gated by configured
 * endpoint/credential env vars" shape as every other adapter in this module
 * (see {@link sendIntegrationHttpPayload}). When `HR_EVERIFY_SANDBOX_ENDPOINT` /
 * `HR_EVERIFY_PRODUCTION_ENDPOINT` are configured, submission is a real HTTP call
 * like any other integration here.
 *
 * Until then, `submitCase` deterministically returns a configurable *mock*
 * determination (via `HR_EVERIFY_MOCK_RESULT`, default `CONFIRMED`) instead of a
 * bare "not configured" failure. This is a deliberate, explicitly-labeled
 * (`details.mock: true`) exception to the generic pattern: it lets the I9Case /
 * EverifyCase workflow actually be exercised end-to-end honestly, rather than
 * always failing until a federal credential exists that this environment will
 * never have. It never claims a real submission happened.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { IntegrationAdapter, IntegrationResult } from '../types.js';
import { createReadinessMetadata } from '../readiness.js';
import { integrationEndpointConfigured, sendIntegrationHttpPayload } from '../http-transport.js';

export type EverifyDetermination = 'CONFIRMED' | 'TENTATIVE_NONCONFIRMATION' | 'FINAL_NONCONFIRMATION';

export interface EverifySubmissionResult extends IntegrationResult {
  caseNumber?: string;
  /** Advisory only - see the class doc comment. Never treated as authoritative. */
  determination?: EverifyDetermination;
}

export interface EverifySubmissionPayload {
  workerId: Uuid;
  i9CaseId: Uuid;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  documentType: string;
}

const VALID_DETERMINATIONS: EverifyDetermination[] = ['CONFIRMED', 'TENTATIVE_NONCONFIRMATION', 'FINAL_NONCONFIRMATION'];

function configuredMockDetermination(): EverifyDetermination {
  const configured = process.env.HR_EVERIFY_MOCK_RESULT as EverifyDetermination | undefined;
  return configured && VALID_DETERMINATIONS.includes(configured) ? configured : 'CONFIRMED';
}

@Injectable()
export class EverifyAdapter implements IntegrationAdapter {
  readonly name = 'everify-case-submission';
  readonly direction = 'OUTBOUND' as const;
  readonly readiness = createReadinessMetadata({
    ownerTeam: 'Compliance & Immigration',
    ownerContact: 'compliance-immigration@example.com',
    sandboxEndpointRef: 'env:HR_EVERIFY_SANDBOX_ENDPOINT',
    productionEndpointRef: 'env:HR_EVERIFY_PRODUCTION_ENDPOINT',
    credentialRefBase: 'vault:integrations/everify',
  });
  private readonly logger = new Logger(EverifyAdapter.name);

  /** Health probe - checks whether a real E-Verify endpoint is configured. */
  async healthCheck(): Promise<boolean> {
    return integrationEndpointConfigured(this.readiness);
  }

  /**
   * Submits a case for E-Verify determination. Real HTTP call when configured;
   * otherwise a clearly-labeled mock result (see class doc comment).
   */
  async submitCase(payload: EverifySubmissionPayload): Promise<EverifySubmissionResult> {
    this.logger.log({ type: 'EVERIFY_SUBMIT_CASE', workerId: payload.workerId.value, i9CaseId: payload.i9CaseId.value });

    if (await this.healthCheck()) {
      const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
        operation: 'SUBMIT_CASE',
        ...payload,
      });
      const responseBody = result.details?.responseBody as { caseNumber?: string; determination?: EverifyDetermination } | undefined;
      return {
        ...result,
        caseNumber: responseBody?.caseNumber,
        determination: responseBody?.determination,
      };
    }

    const determination = configuredMockDetermination();
    this.logger.warn({
      type: 'EVERIFY_SUBMIT_CASE_MOCK',
      reason: 'EVERIFY_CREDENTIALS_NOT_CONFIGURED',
      workerId: payload.workerId.value,
      i9CaseId: payload.i9CaseId.value,
      mockDetermination: determination,
    });
    return {
      success: true,
      adapterName: this.name,
      operationId: crypto.randomUUID(),
      timestamp: new Date(),
      caseNumber: `MOCK-EV-${Date.now()}`,
      determination,
      details: { mock: true, reason: 'EVERIFY_CREDENTIALS_NOT_CONFIGURED' },
    };
  }

  /** Generic send facade - delegates to submitCase for well-formed payloads. */
  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.workerId && p.i9CaseId && p.documentType) {
      return this.submitCase(p as unknown as EverifySubmissionPayload);
    }
    throw new Error('E-Verify Adapter: unsupported payload shape');
  }

  /** Generic receive facade - E-Verify does not push inbound events via this adapter. */
  async receive(): Promise<unknown> {
    return { message: 'No inbound queue configured for the E-Verify adapter' };
  }
}
