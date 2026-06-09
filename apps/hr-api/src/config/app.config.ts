/**
 * Application configuration loader.
 */

export interface AppConfig {
  /** HTTP port to listen on. */
  port: number;
  /** Node environment. */
  nodeEnv: string;
  /** Primary database connection URL. */
  databaseUrl: string;
  /** Redis connection URL. */
  redisUrl: string;
  /** Kafka broker list. */
  kafkaBrokers: string[];
  /** JWT signing secret. */
  jwtSecret: string;
  /** JWT expiration expression. */
  jwtExpiresIn: string;
  /** Refresh token expiration expression. */
  refreshTokenExpiresIn: string;
  /** Whether MFA step-up is required for sensitive sessions. */
  mfaRequired: boolean;
  /** Non-production demo MFA code. Undefined in production unless explicitly configured. */
  mfaDemoCode?: string;
  /** Optional OIDC identity provider issuer URL. */
  oidcIssuerUrl?: string;
  /** Optional OIDC client ID. */
  oidcClientId?: string;
  /** Optional OIDC redirect URI. */
  oidcRedirectUri?: string;
  /** Optional SAML metadata URL or path. */
  samlMetadataUrl?: string;
  /** Optional SAML entity ID. */
  samlEntityId?: string;
  /** Header name for API key authentication. */
  apiKeyHeader: string;
  /** API key accepted for system actors. Defaults only in non-production. */
  systemApiKey?: string;
  /** API key accepted for integration actors. Defaults only in non-production. */
  integrationApiKey?: string;
  /** Allowed CORS origins. */
  corsOrigins: string[];
  /** Log level. */
  logLevel: string;
  /** Whether OpenTelemetry tracing is enabled. */
  otelEnabled: boolean;
  /** OpenTelemetry service name. */
  otelServiceName: string;
  /** Optional OTLP HTTP trace exporter endpoint. */
  otelExporterOtlpEndpoint?: string;
}

/**
 * Load configuration from environment variables with sensible defaults.
 */
export function loadAppConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';
  const systemApiKey = process.env.SYSTEM_API_KEY ?? (isProduction ? undefined : 'system-api-key');
  const integrationApiKey =
    process.env.INTEGRATION_API_KEY ?? (isProduction ? undefined : 'integration-api-key');
  const mfaDemoCode = process.env.MFA_DEMO_CODE ?? (isProduction ? undefined : '123456');

  if (isProduction && jwtSecret === 'change-me-in-production') {
    throw new Error('JWT_SECRET must be configured to a non-placeholder value in production');
  }
  if (isProduction && systemApiKey === 'system-api-key') {
    throw new Error('SYSTEM_API_KEY must not use the demo value in production');
  }
  if (isProduction && integrationApiKey === 'integration-api-key') {
    throw new Error('INTEGRATION_API_KEY must not use the demo value in production');
  }

  return {
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv,
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/hr_platform',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    mfaRequired: (process.env.MFA_REQUIRED ?? 'false').toLowerCase() === 'true',
    mfaDemoCode,
    oidcIssuerUrl: process.env.OIDC_ISSUER_URL,
    oidcClientId: process.env.OIDC_CLIENT_ID,
    oidcRedirectUri: process.env.OIDC_REDIRECT_URI,
    samlMetadataUrl: process.env.SAML_METADATA_URL,
    samlEntityId: process.env.SAML_ENTITY_ID,
    apiKeyHeader: process.env.API_KEY_HEADER ?? 'X-API-Key',
    systemApiKey,
    integrationApiKey,
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    otelEnabled: (process.env.OTEL_ENABLED ?? 'false').toLowerCase() === 'true',
    otelServiceName: process.env.OTEL_SERVICE_NAME ?? 'hr-api',
    otelExporterOtlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  };
}
