import { NodeSDK, type NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { AppConfig } from '../config/app.config.js';
import type { StructuredLoggerService } from './structured-logger.service.js';

let activeSdk: NodeSDK | undefined;

export function shouldStartOpenTelemetry(config: AppConfig): boolean {
  // Start when explicitly enabled, OR automatically when an OTLP endpoint is
  // configured (there is somewhere to export to). Stays off when no endpoint and
  // not explicitly enabled, so we never spam a non-existent local collector.
  return config.otelEnabled === true || Boolean(config.otelExporterOtlpEndpoint);
}

export function buildOpenTelemetryOptions(config: AppConfig): Partial<NodeSDKConfiguration> {
  return {
    serviceName: config.otelServiceName,
    traceExporter: new OTLPTraceExporter(
      config.otelExporterOtlpEndpoint
        ? { url: config.otelExporterOtlpEndpoint }
        : {},
    ),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  };
}

export function startOpenTelemetry(
  config: AppConfig,
  logger?: Pick<StructuredLoggerService, 'info' | 'warn'>,
): NodeSDK | undefined {
  if (!shouldStartOpenTelemetry(config)) return undefined;
  if (activeSdk) return activeSdk;

  activeSdk = new NodeSDK(buildOpenTelemetryOptions(config));
  activeSdk.start();
  logger?.info({
    eventType: 'OPENTELEMETRY_STARTED',
    serviceName: config.otelServiceName,
    exporterEndpoint: config.otelExporterOtlpEndpoint ?? 'env/default',
  });

  return activeSdk;
}

export async function shutdownOpenTelemetry(
  logger?: Pick<StructuredLoggerService, 'info' | 'warn'>,
): Promise<void> {
  if (!activeSdk) return;
  try {
    await activeSdk.shutdown();
    logger?.info({ eventType: 'OPENTELEMETRY_STOPPED' });
  } catch (error) {
    logger?.warn({
      eventType: 'OPENTELEMETRY_SHUTDOWN_FAILED',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeSdk = undefined;
  }
}
