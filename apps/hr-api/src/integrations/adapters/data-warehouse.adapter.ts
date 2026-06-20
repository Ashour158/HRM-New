/**
 * Data Warehouse Export Adapter
 *
 * Analytics exports anonymised / aggregated data to the downstream data
 * warehouse.  Supports periodic batch exports as well as event-stream export.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Uuid } from '@hcm/shared-kernel';
import type { ExportResult, IntegrationAdapter, IntegrationResult } from '../types.js';
import { createReadinessMetadata } from '../readiness.js';
import { integrationEndpointConfigured, sendIntegrationHttpPayload } from '../http-transport.js';

export interface ScheduleResult extends IntegrationResult {
  scheduleId?: string;
  nextRunAt?: Date;
}

export interface ExportScheduleConfig {
  tenantId: Uuid;
  exportType: 'WORKERS' | 'PAYROLL' | 'TIME_ATTENDANCE' | 'BENEFITS' | 'EVENTS';
  cronExpression: string;
  destinationPath: string;
}

@Injectable()
export class DataWarehouseAdapter implements IntegrationAdapter {
  readonly name = 'data-warehouse';
  readonly direction = 'OUTBOUND' as const;
  readonly readiness = createReadinessMetadata({
    ownerTeam: 'People Analytics',
    ownerContact: 'people-analytics@example.com',
    sandboxEndpointRef: 'env:HR_WAREHOUSE_SANDBOX_ENDPOINT',
    productionEndpointRef: 'env:HR_WAREHOUSE_PRODUCTION_ENDPOINT',
    credentialRefBase: 'vault:integrations/data-warehouse',
  });
  private readonly logger = new Logger(DataWarehouseAdapter.name);

  async healthCheck(): Promise<boolean> {
    return integrationEndpointConfigured(this.readiness);
  }

  /**
   * Export worker dimension data (anonymised).
   * @param tenantId Tenant scope
   */
  async exportWorkers(tenantId: Uuid): Promise<ExportResult> {
    this.logger.log({ type: 'WAREHOUSE_EXPORT_WORKERS', tenantId: tenantId.value });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_WORKERS',
      tenantId,
    });
    return { ...result, format: 'PARQUET' };
  }

  /**
   * Export payroll facts for a given period.
   * @param tenantId Tenant scope
   * @param period   Period identifier (e.g. '2024-01')
   */
  async exportPayroll(tenantId: Uuid, period: string): Promise<ExportResult> {
    this.logger.log({ type: 'WAREHOUSE_EXPORT_PAYROLL', tenantId: tenantId.value, period });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_PAYROLL',
      tenantId,
      period,
    });
    return { ...result, format: 'PARQUET' };
  }

  /**
   * Export time & attendance facts for a given period.
   * @param tenantId Tenant scope
   * @param period   Period identifier
   */
  async exportTimeAndAttendance(tenantId: Uuid, period: string): Promise<ExportResult> {
    this.logger.log({ type: 'WAREHOUSE_EXPORT_TIME', tenantId: tenantId.value, period });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_TIME_ATTENDANCE',
      tenantId,
      period,
    });
    return { ...result, format: 'PARQUET' };
  }

  /**
   * Export benefits enrollment facts for a given period.
   * @param tenantId Tenant scope
   * @param period   Period identifier
   */
  async exportBenefits(tenantId: Uuid, period: string): Promise<ExportResult> {
    this.logger.log({ type: 'WAREHOUSE_EXPORT_BENEFITS', tenantId: tenantId.value, period });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_BENEFITS',
      tenantId,
      period,
    });
    return { ...result, format: 'PARQUET' };
  }

  /**
   * Export raw events to the warehouse event stream.
   * @param tenantId Tenant scope
   * @param from     Start of export window
   * @param to       End of export window
   */
  async exportEvents(tenantId: Uuid, from: Date, to: Date): Promise<ExportResult> {
    this.logger.log({
      type: 'WAREHOUSE_EXPORT_EVENTS',
      tenantId: tenantId.value,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const result = await sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'EXPORT_EVENTS',
      tenantId,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return { ...result, format: 'JSONL' };
  }

  /**
   * Schedule a recurring export job.
   * @param config Schedule configuration
   */
  async scheduleExport(config: ExportScheduleConfig): Promise<ScheduleResult> {
    this.logger.log({
      type: 'WAREHOUSE_SCHEDULE_EXPORT',
      tenantId: config.tenantId.value,
      exportType: config.exportType,
    });

    return sendIntegrationHttpPayload(this.name, this.readiness, {
      operation: 'SCHEDULE_EXPORT',
      config,
    }) as Promise<ScheduleResult>;
  }

  async send(payload: unknown): Promise<IntegrationResult> {
    const p = payload as Record<string, unknown>;
    if (p.tenantId && p.action === 'EXPORT_WORKERS') {
      return this.exportWorkers(p.tenantId as Uuid);
    }
    if (p.tenantId && p.period && p.action === 'EXPORT_PAYROLL') {
      return this.exportPayroll(p.tenantId as Uuid, p.period as string);
    }
    if (p.tenantId && p.period && p.action === 'EXPORT_TIME') {
      return this.exportTimeAndAttendance(p.tenantId as Uuid, p.period as string);
    }
    if (p.tenantId && p.period && p.action === 'EXPORT_BENEFITS') {
      return this.exportBenefits(p.tenantId as Uuid, p.period as string);
    }
    if (p.tenantId && p.from && p.to && p.action === 'EXPORT_EVENTS') {
      return this.exportEvents(p.tenantId as Uuid, new Date(p.from as string), new Date(p.to as string));
    }
    if (p.config && p.action === 'SCHEDULE') {
      return this.scheduleExport(p.config as unknown as ExportScheduleConfig);
    }
    throw new Error('Data Warehouse Adapter: unsupported payload shape');
  }

  async receive(): Promise<unknown> {
    return { message: 'No inbound queue configured for data warehouse adapter' };
  }
}
