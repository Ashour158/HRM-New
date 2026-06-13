import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BenefitsCarrierAdapter,
  EmailNotificationAdapter,
  IamProvisioningAdapter,
  PayrollExportAdapter,
  TaxAuthorityAdapter,
} from './adapters/index.js';
import { IntegrationsController } from './api/integrations.controller.js';
import { IntegrationHealthService } from './integration-health.service.js';
import { IntegrationOrchestrator } from './integration-orchestrator.service.js';
import type { IntegrationAdapter } from './types.js';

function registerAdapters(adapters: IntegrationAdapter[]) {
  const healthService = new IntegrationHealthService();
  const orchestrator = new IntegrationOrchestrator(healthService);

  for (const adapter of adapters) {
    orchestrator.registerAdapter(adapter);
  }

  return { healthService, orchestrator };
}

function operatorRequest(roles = ['PLATFORM_ADMIN'], mfaAuthenticated = true) {
  return {
    actor: {
      roles,
      mfaAuthenticated,
    },
  } as never;
}

describe('integration provider readiness', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('publishes governed readiness metadata for SSO, statutory filing, bank files, carriers, and email', () => {
    const adapters = [
      new IamProvisioningAdapter(),
      new TaxAuthorityAdapter(),
      new PayrollExportAdapter(),
      new BenefitsCarrierAdapter(),
      new EmailNotificationAdapter(),
    ];
    const { orchestrator } = registerAdapters(adapters);

    const readiness = orchestrator.getProviderReadiness();

    expect(readiness.map((entry) => entry.adapterName).sort()).toEqual([
      'benefits-carrier',
      'email-notification',
      'iam-provisioning',
      'payroll-export',
      'tax-authority',
    ]);

    for (const entry of readiness) {
      expect(entry.owner.team).toBeTruthy();
      expect(entry.owner.contact).toMatch('@');
      expect(entry.retryPolicy.maxAttempts).toBeGreaterThanOrEqual(3);
      expect(entry.retryPolicy.deadLetterAfterAttempts).toBeGreaterThanOrEqual(entry.retryPolicy.maxAttempts);
      expect(entry.auditLogHooks).toEqual(expect.arrayContaining(['SEND_ATTEMPT', 'SEND_SUCCESS', 'SEND_FAILURE']));
      expect(entry.environments.map((environment) => environment.name).sort()).toEqual(['PRODUCTION', 'SANDBOX']);

      const sandbox = entry.environments.find((environment) => environment.name === 'SANDBOX');
      const production = entry.environments.find((environment) => environment.name === 'PRODUCTION');
      expect(sandbox?.endpointRef).toBeTruthy();
      expect(production?.endpointRef).toBeTruthy();
      expect(sandbox?.endpointRef).not.toBe(production?.endpointRef);
    }
  });

  it('marks adapters with missing provider credentials as not ready without leaking secret values', async () => {
    const email = new EmailNotificationAdapter();
    const { healthService } = registerAdapters([email]);

    const readiness = healthService.getReadiness(email.name);
    expect(readiness?.credentialState).toBe('NOT_CONFIGURED');
    expect(readiness?.ready).toBe(false);
    expect(readiness?.blockers).toContain('CREDENTIALS_NOT_CONFIGURED');
    expect(JSON.stringify(readiness)).not.toContain('smtp-password');

    const probe = await healthService.check(email);
    expect(probe.healthy).toBe(false);
    expect(probe.errorMessage).toContain('credentials are not configured');
    expect(healthService.getStatus(email.name)?.state).toBe('CREDENTIALS_NOT_CONFIGURED');
  });

  it('blocks outbound sends before invoking adapters that are not credential-ready', async () => {
    const email = new EmailNotificationAdapter();
    const { orchestrator } = registerAdapters([email]);
    const sendSpy = vi.spyOn(email, 'send');

    await expect(orchestrator.send(email.name, {
      to: 'employee@example.com',
      subject: 'Welcome',
      bodyText: 'Welcome to the team',
    })).rejects.toThrow("Adapter 'email-notification' credentials are not configured.");

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('delivers email notifications through the configured adapter path', async () => {
    process.env.HR_EMAIL_DELIVERY_MODE = 'LOG';
    const email = new EmailNotificationAdapter();
    const { healthService, orchestrator } = registerAdapters([email]);

    expect(healthService.getReadiness(email.name)).toEqual(expect.objectContaining({
      credentialState: 'CONFIGURED',
      ready: true,
    }));

    const result = await orchestrator.send(email.name, {
      to: 'employee@example.com',
      subject: 'Leave approved',
      bodyText: 'Your leave request was approved.',
      correlationId: 'corr-1',
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      adapterName: 'email-notification',
      providerMessageId: expect.stringMatching(/^log:/),
    }));
    expect(healthService.getMetrics(email.name)).toEqual(expect.objectContaining({
      totalCalls: 1,
      successfulCalls: 1,
      failedCalls: 0,
    }));
  });

  it('tracks incident state and outbound health in readiness snapshots', async () => {
    const iam = new IamProvisioningAdapter();
    const { healthService } = registerAdapters([iam]);

    healthService.markCredentialsConfigured(iam.name);
    await healthService.check(iam);

    expect(healthService.getReadiness(iam.name)?.outboundHealth).toEqual(expect.objectContaining({
      state: 'HEALTHY',
      consecutiveFailures: 0,
      lastCheckedAt: expect.any(Date),
    }));

    healthService.recordIncident(iam.name, {
      state: 'ACTIVE',
      severity: 'SEV2',
      summary: 'SSO provisioning API unavailable',
    });

    const readiness = healthService.getReadiness(iam.name);
    expect(readiness?.incident.state).toBe('ACTIVE');
    expect(readiness?.ready).toBe(false);
    expect(readiness?.blockers).toContain('ACTIVE_INCIDENT');
    expect(healthService.getStatus(iam.name)?.state).toBe('INCIDENT_ACTIVE');
  });

  it('records governed connection-test evidence and exposes integration logs', async () => {
    const email = new EmailNotificationAdapter();
    const { healthService, orchestrator } = registerAdapters([email]);
    const controller = new IntegrationsController(orchestrator, healthService);

    const result = await controller.testAdapter(email.name, operatorRequest());

    expect(result).toEqual(expect.objectContaining({
      adapterName: 'email-notification',
      operatorAction: 'TEST_CONNECTION',
      health: expect.objectContaining({
        healthy: false,
        errorMessage: expect.stringContaining('credentials are not configured'),
      }),
      readiness: expect.objectContaining({
        ready: false,
        blockers: expect.arrayContaining(['CREDENTIALS_NOT_CONFIGURED']),
      }),
      log: expect.objectContaining({
        adapterName: 'email-notification',
        operation: 'TEST_CONNECTION',
        status: 'FAILED',
      }),
    }));

    expect(controller.getLogs(email.name, '10').logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: 'HEALTH_CHECK', status: 'FAILED' }),
      expect.objectContaining({ operation: 'TEST_CONNECTION', status: 'FAILED' }),
    ]));
  });

  it('requires admin role and MFA for integration operator commands', async () => {
    const email = new EmailNotificationAdapter();
    const { healthService, orchestrator } = registerAdapters([email]);
    const controller = new IntegrationsController(orchestrator, healthService);

    await expect(controller.testAdapter(email.name, operatorRequest(['EMPLOYEE'], true))).rejects.toThrow('Only system administrators');
    await expect(controller.testAdapter(email.name, operatorRequest(['PLATFORM_ADMIN'], false))).rejects.toThrow('Integration operations require MFA');
  });
});
