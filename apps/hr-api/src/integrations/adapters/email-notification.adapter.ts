/**
 * Email Notification Adapter
 *
 * Placeholder contract for outbound HR email delivery. It intentionally does
 * not hold SMTP credentials or send mail until provider credentials are wired
 * through the integration readiness/vault flow.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IntegrationAdapter, IntegrationResult } from '../types.js';
import { createReadinessMetadata } from '../readiness.js';

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  bodyText: string;
  from?: string;
  correlationId?: string;
}

export interface EmailNotificationResult extends IntegrationResult {
  providerMessageId?: string;
}

@Injectable()
export class EmailNotificationAdapter implements IntegrationAdapter {
  readonly name = 'email-notification';
  readonly direction = 'OUTBOUND' as const;
  readonly readiness = createReadinessMetadata({
    ownerTeam: 'HR Communications Platform',
    ownerContact: 'hr-communications-platform@example.com',
    sandboxEndpointRef: 'env:HR_EMAIL_SANDBOX_ENDPOINT',
    productionEndpointRef: 'env:HR_EMAIL_PRODUCTION_ENDPOINT',
    credentialRefBase: 'vault:integrations/email-notification',
  });
  private readonly logger = new Logger(EmailNotificationAdapter.name);

  async healthCheck(): Promise<boolean> {
    return false;
  }

  async send(payload: unknown): Promise<EmailNotificationResult> {
    const message = payload as Partial<EmailNotificationPayload>;
    this.logger.warn({
      type: 'EMAIL_SEND_BLOCKED',
      to: message.to,
      correlationId: message.correlationId,
      reason: 'CREDENTIALS_NOT_CONFIGURED',
    });
    throw new Error('Email Notification Adapter: provider credentials are not configured.');
  }

  async receive(): Promise<unknown> {
    return { message: 'No inbound queue configured for email notification adapter' };
  }
}
