import { describe, expect, it } from 'vitest';
import { buildOpenTelemetryOptions, shouldStartOpenTelemetry } from './opentelemetry.js';
import type { AppConfig } from '../config/app.config.js';

const baseConfig: AppConfig = {
  port: 3001,
  nodeEnv: 'test',
  databaseUrl: 'postgresql://localhost/test',
  redisUrl: 'redis://localhost:6379',
  kafkaBrokers: [],
  jwtSecret: 'test-secret',
  jwtExpiresIn: '1h',
  refreshTokenExpiresIn: '7d',
  mfaRequired: false,
  apiKeyHeader: 'X-API-Key',
  corsOrigins: [],
  logLevel: 'info',
  otelEnabled: false,
  otelServiceName: 'hr-api',
};

describe('OpenTelemetry bootstrap', () => {
  it('does not start tracing when neither enabled nor an OTLP endpoint is configured', () => {
    expect(shouldStartOpenTelemetry(baseConfig)).toBe(false);
  });

  it('starts automatically when an OTLP endpoint is configured (smart default)', () => {
    expect(shouldStartOpenTelemetry({
      ...baseConfig,
      otelEnabled: false,
      otelExporterOtlpEndpoint: 'http://otel-collector:4318/v1/traces',
    })).toBe(true);
  });

  it('starts when explicitly enabled even without an endpoint', () => {
    expect(shouldStartOpenTelemetry({ ...baseConfig, otelEnabled: true })).toBe(true);
  });

  it('builds OTLP tracing options from app config', () => {
    const options = buildOpenTelemetryOptions({
      ...baseConfig,
      otelEnabled: true,
      otelServiceName: 'hrm-nexus-api',
      otelExporterOtlpEndpoint: 'http://otel-collector:4318/v1/traces',
    });

    expect(options).toMatchObject({
      serviceName: 'hrm-nexus-api',
    });
    expect(options.traceExporter).toBeTruthy();
    expect(options.instrumentations).toBeTruthy();
  });
});
