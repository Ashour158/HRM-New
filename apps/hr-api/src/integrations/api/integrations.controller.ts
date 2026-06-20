/**
 * Integration Management API
 *
 * Provides REST endpoints for health, status, manual triggering, and metrics
 * inspection of all registered external adapters.
 *
 * @controller hr/integrations
 */

import { Controller, ForbiddenException, Get, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IntegrationOrchestrator } from '../integration-orchestrator.service.js';
import { IntegrationHealthService } from '../integration-health.service.js';
import { AuthGuard } from '../../guards/auth.guard.js';

// Manually triggering an external integration is a privileged operation restricted
// to integration/platform administrators and trusted SYSTEM/INTEGRATION actors.
const INTEGRATION_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'INTEGRATION_ADMIN',
  'SYSTEM_ACTOR',
  'INTEGRATION_ACTOR',
]);

@Controller('hr/integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly orchestrator: IntegrationOrchestrator,
    private readonly healthService: IntegrationHealthService,
  ) {}

  private assertIntegrationAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => INTEGRATION_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only integration or platform administrators can access integration management');
  }

  /** GET /hr/integrations/health – live health check for every adapter. */
  @Get('health')
  async getHealth(@Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    const results = await this.orchestrator.healthCheck();
    return { adapters: results };
  }

  /** GET /hr/integrations/status – cached operational status for every adapter. */
  @Get('status')
  getStatus(@Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    return { adapters: this.orchestrator.getIntegrationStatus() };
  }

  /** GET /hr/integrations/readiness - governed production-readiness view. */
  @Get('readiness')
  getReadiness(@Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    return { adapters: this.orchestrator.getProviderReadiness() };
  }

  /** GET /hr/integrations/:adapterName/readiness - readiness for one adapter. */
  @Get(':adapterName/readiness')
  getAdapterReadiness(@Param('adapterName') adapterName: string, @Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    return this.orchestrator.getAdapterReadiness(adapterName);
  }

  /**
   * POST /hr/integrations/:adapterName/trigger – manually trigger an adapter.
   * The payload is passed straight through to the adapter's `send()` method.
   */
  @Post(':adapterName/trigger')
  async triggerAdapter(@Param('adapterName') adapterName: string, @Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    this.logger.log({ type: 'MANUAL_TRIGGER', adapterName });
    const result = await this.orchestrator.send(adapterName, { action: 'MANUAL_TRIGGER' });
    return { adapterName, result };
  }

  /** GET /hr/integrations/:adapterName/metrics – computed metrics for an adapter. */
  @Get(':adapterName/metrics')
  getMetrics(@Param('adapterName') adapterName: string, @Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    return this.healthService.getMetrics(adapterName);
  }

  /** GET /hr/integrations/:adapterName/logs – stub for recent integration logs. */
  @Get(':adapterName/logs')
  getLogs(@Param('adapterName') adapterName: string, @Req() req: Request) {
    this.assertIntegrationAdminScope(req);
    // In production this would query a log table or time-series store
    return { adapterName, logs: [] };
  }
}
