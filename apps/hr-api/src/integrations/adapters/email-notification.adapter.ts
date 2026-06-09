/**
 * Email Notification Adapter
 *
 * Placeholder contract for outbound HR email delivery. It intentionally does
 * not hold SMTP credentials or send mail until provider credentials are wired
 * through the integration readiness/vault flow.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

type EmailDeliveryMode = 'DISABLED' | 'LOG' | 'WEBHOOK';

export function emailDeliveryMode(): EmailDeliveryMode {
  const configured = (process.env.HR_EMAIL_DELIVERY_MODE ?? '').trim().toUpperCase();
  if (configured === 'LOG' || configured === 'WEBHOOK') return configured;
  return 'DISABLED';
}

export function isEmailNotificationConfigured(): boolean {
  const mode = emailDeliveryMode();
  if (mode === 'LOG') return true;
  if (mode === 'WEBHOOK') {
    return Boolean(process.env.HR_EMAIL_WEBHOOK_URL && process.env.HR_EMAIL_WEBHOOK_TOKEN);
  }
  return false;
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
    credentialState: isEmailNotificationConfigured() ? 'CONFIGURED' : 'NOT_CONFIGURED',
  });
  private readonly logger = new Logger(EmailNotificationAdapter.name);

  async healthCheck(): Promise<boolean> {
    return isEmailNotificationConfigured();
  }

  async send(payload: unknown): Promise<EmailNotificationResult> {
    const message = this.assertPayload(payload);
    const operationId = randomUUID();
    const timestamp = new Date();
    const mode = emailDeliveryMode();

    if (mode === 'LOG') {
      this.logger.log({
        type: 'EMAIL_SEND_LOGGED',
        to: message.to,
        subject: message.subject,
        correlationId: message.correlationId,
        operationId,
      });
      return {
        success: true,
        adapterName: this.name,
        operationId,
        timestamp,
        providerMessageId: `log:${operationId}`,
        details: { mode },
      };
    }

    if (mode === 'WEBHOOK') {
      const endpoint = process.env.HR_EMAIL_WEBHOOK_URL;
      const token = process.env.HR_EMAIL_WEBHOOK_TOKEN;
      if (!endpoint || !token) {
        throw new Error('Email Notification Adapter: webhook endpoint or token is not configured.');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...message,
          from: message.from ?? process.env.HR_EMAIL_FROM ?? 'no-reply@hrm-nexus.local',
          operationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Email Notification Adapter: provider returned ${response.status}.`);
      }

      const providerResponse = await response.json().catch(() => ({})) as { id?: unknown; messageId?: unknown };
      return {
        success: true,
        adapterName: this.name,
        operationId,
        timestamp,
        providerMessageId: typeof providerResponse.messageId === 'string'
          ? providerResponse.messageId
          : typeof providerResponse.id === 'string'
            ? providerResponse.id
            : operationId,
        details: { mode },
      };
    }

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

  private assertPayload(payload: unknown): EmailNotificationPayload {
    const message = payload as Partial<EmailNotificationPayload>;
    if (!message || typeof message !== 'object') {
      throw new Error('Email Notification Adapter: message payload is required.');
    }
    if (!message.to || typeof message.to !== 'string') {
      throw new Error('Email Notification Adapter: recipient email is required.');
    }
    if (!message.subject || typeof message.subject !== 'string') {
      throw new Error('Email Notification Adapter: subject is required.');
    }
    if (!message.bodyText || typeof message.bodyText !== 'string') {
      throw new Error('Email Notification Adapter: body text is required.');
    }
    return {
      to: message.to,
      subject: message.subject,
      bodyText: message.bodyText,
      from: message.from,
      correlationId: message.correlationId,
    };
  }
}
