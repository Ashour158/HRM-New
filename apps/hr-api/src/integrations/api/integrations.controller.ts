/**
 * Integration Management API
 *
 * Provides REST endpoints for health, status, manual triggering, and metrics
 * inspection of all registered external adapters.
 *
 * @controller hr/integrations
 */

import { Controller, ForbiddenException, Get, Logger, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IntegrationOrchestrator } from '../integration-orchestrator.service.js';
import { IntegrationHealthService } from '../integration-health.service.js';
import { AuthGuard } from '../../guards/auth.guard.js';

const INTEGRATION_OPERATOR_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN']);

@UseGuards(AuthGuard)
@Controller('hr/integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly orchestrator: IntegrationOrchestrator,
    private readonly healthService: IntegrationHealthService,
  ) {}

  /** GET /hr/integrations/health – live health check for every adapter. */
  @Get('health')
  async getHealth() {
    const results = await this.orchestrator.healthCheck();
    return { adapters: results };
  }

  /** GET /hr/integrations/status – cached operational status for every adapter. */
  @Get('status')
  getStatus() {
    return { adapters: this.orchestrator.getIntegrationStatus() };
  }

  /** GET /hr/integrations/readiness - governed production-readiness view. */
  @Get('readiness')
  getReadiness() {
    return { adapters: this.orchestrator.getProviderReadiness() };
  }

  /** GET /hr/integrations/:adapterName/readiness - readiness for one adapter. */
  @Get(':adapterName/readiness')
  getAdapterReadiness(@Param('adapterName') adapterName: string) {
    return this.orchestrator.getAdapterReadiness(adapterName);
  }

  /**
   * POST /hr/integrations/:adapterName/trigger – manually trigger an adapter.
   * The payload is passed straight through to the adapter's `send()` method.
   */
  @Post(':adapterName/trigger')
  async triggerAdapter(@Param('adapterName') adapterName: string, @Req() req: Request) {
    this.assertOperatorScope(req);
    this.logger.log({ type: 'MANUAL_TRIGGER', adapterName });
    const result = await this.orchestrator.send(adapterName, { action: 'MANUAL_TRIGGER' });
    return { adapterName, result };
  }

  /** POST /hr/integrations/:adapterName/commands/test - governed operator connection test. */
  @Post(':adapterName/commands/test')
  async testAdapter(@Param('adapterName') adapterName: string, @Req() req: Request) {
    this.assertOperatorScope(req);
    const adapter = this.orchestrator.getAdapter(adapterName);
    if (!adapter) {
      throw new NotFoundException(`Integration adapter '${adapterName}' is not registered.`);
    }

    this.logger.log({ type: 'INTEGRATION_OPERATOR_TEST', adapterName });
    const health = await this.healthService.check(adapter);
    const log = this.healthService.recordTestResult(adapterName, {
      success: health.healthy,
      latencyMs: health.latencyMs,
      message: health.errorMessage,
      readinessReady: health.readiness?.ready,
      blockers: health.readiness?.blockers,
    });

    return {
      adapterName,
      operatorAction: 'TEST_CONNECTION',
      testedAt: log.createdAt,
      health,
      readiness: this.healthService.getReadiness(adapterName),
      metrics: this.healthService.getMetrics(adapterName),
      log,
    };
  }

  /** GET /hr/integrations/:adapterName/metrics – computed metrics for an adapter. */
  @Get(':adapterName/metrics')
  getMetrics(@Param('adapterName') adapterName: string) {
    return this.healthService.getMetrics(adapterName);
  }

  /** GET /hr/integrations/:adapterName/logs - recent governed integration operation logs. */
  @Get(':adapterName/logs')
  getLogs(@Param('adapterName') adapterName: string, @Query('limit') limit?: string) {
    if (!this.orchestrator.getAdapter(adapterName)) {
      throw new NotFoundException(`Integration adapter '${adapterName}' is not registered.`);
    }
    const parsedLimit = Number.parseInt(limit ?? '50', 10);
    return {
      adapterName,
      logs: this.healthService.getOperationLogs(
        adapterName,
        Number.isFinite(parsedLimit) ? parsedLimit : 50,
      ),
    };
  }

  private assertOperatorScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => INTEGRATION_OPERATOR_ROLES.has(role))) {
      throw new ForbiddenException('Only system administrators can operate integration commands');
    }
    if (req.actor?.mfaAuthenticated !== true) {
      throw new ForbiddenException('Integration operations require MFA');
    }
  }
}
