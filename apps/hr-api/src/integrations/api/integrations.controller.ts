/**
 * Integration Management API
 *
 * Provides REST endpoints for health, status, manual triggering, and metrics
 * inspection of all registered external adapters.
 *
 * @controller hr/integrations
 */

import { Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { IntegrationOrchestrator } from '../integration-orchestrator.service.js';
import { IntegrationHealthService } from '../integration-health.service.js';

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

  /**
   * POST /hr/integrations/:adapterName/trigger – manually trigger an adapter.
   * The payload is passed straight through to the adapter's `send()` method.
   */
  @Post(':adapterName/trigger')
  async triggerAdapter(@Param('adapterName') adapterName: string) {
    this.logger.log({ type: 'MANUAL_TRIGGER', adapterName });
    const result = await this.orchestrator.send(adapterName, { action: 'MANUAL_TRIGGER' });
    return { adapterName, result };
  }

  /** GET /hr/integrations/:adapterName/metrics – computed metrics for an adapter. */
  @Get(':adapterName/metrics')
  getMetrics(@Param('adapterName') adapterName: string) {
    return this.healthService.getMetrics(adapterName);
  }

  /** GET /hr/integrations/:adapterName/logs – stub for recent integration logs. */
  @Get(':adapterName/logs')
  getLogs(@Param('adapterName') adapterName: string) {
    // In production this would query a log table or time-series store
    return { adapterName, logs: [] };
  }
}
