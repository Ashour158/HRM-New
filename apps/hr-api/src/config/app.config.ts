/**
 * Application configuration loader.
 */
import { resolveKeyFromEnv } from '@hcm/platform-core';

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
  /** Bcrypt cost factor for password hashes. */
  bcryptCost: number;
  /** Number of failed login attempts before account lockout. */
  loginMaxAttempts: number;
  /** Login lockout duration in minutes. */
  lockoutMinutes: number;
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
  /** Canonical frontend origin SSO callbacks redirect to (server-configured, never client-supplied). */
  webAppUrl: string;
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
function parsePositiveIntEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

/** Substrings that mark a secret as a placeholder / dev value, rejected in production. */
const WEAK_SECRET_MARKERS = ['change-me', 'changeme', 'dev-', 'dev_', 'demo', 'example', 'placeholder', 'password', 'localhost', '123456', 'system-api-key', 'integration-api-key'];

/**
 * In production, reject not just the exact placeholder but any low-entropy or
 * known-dev secret: missing, too short, all-one-character, or containing a
 * well-known weak marker. Fail-closed so a deployment can't ship a guessable secret.
 */
export function assertStrongProductionSecret(name: string, value: string | undefined, minLength: number): void {
  if (!value) throw new Error(`${name} must be configured in production`);
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters in production`);
  }
  const lower = value.toLowerCase();
  const marker = WEAK_SECRET_MARKERS.find((m) => lower.includes(m));
  if (marker) {
    throw new Error(`${name} looks like a placeholder/dev secret (contains "${marker}"); use a strong random value in production`);
  }
  if (new Set(value).size < 8) {
    throw new Error(`${name} has too little entropy (fewer than 8 distinct characters) for production`);
  }
}

export function loadAppConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';
  const systemApiKey = process.env.SYSTEM_API_KEY ?? (isProduction ? undefined : 'system-api-key');
  const integrationApiKey =
    process.env.INTEGRATION_API_KEY ?? (isProduction ? undefined : 'integration-api-key');

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const webAppUrl = (process.env.WEB_APP_URL ?? corsOrigins[0] ?? 'http://localhost:4173').trim();

  if (isProduction) {
    // Reject placeholders AND low-entropy/known-dev secrets, not just exact literals.
    assertStrongProductionSecret('JWT_SECRET', jwtSecret, 32);
    assertStrongProductionSecret('SYSTEM_API_KEY', systemApiKey, 16);
    assertStrongProductionSecret('INTEGRATION_API_KEY', integrationApiKey, 16);
    // Fails fast at boot rather than lazily on the first BANKING/TAX/COMPENSATION
    // or SPECIAL_CATEGORY personal-data write/read; resolveKeyFromEnv already
    // validates presence and exact 32-byte length.
    resolveKeyFromEnv('PII_DATA_ENCRYPTION_KEY', 'development-pii-data-key-32bytes!');
    // A "*" origin forces credentials off (see main.ts) — in production that is a
    // misconfiguration, not a silent degrade. Require an explicit allow-list.
    if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
      throw new Error(
        'CORS_ORIGINS must be an explicit allow-list in production (no "*" wildcard and at least one origin).',
      );
    }
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
    bcryptCost: parsePositiveIntEnv('BCRYPT_COST', 12, 8, 16),
    loginMaxAttempts: parsePositiveIntEnv('LOGIN_MAX_ATTEMPTS', 5, 1, 20),
    lockoutMinutes: parsePositiveIntEnv('LOCKOUT_MINUTES', 15, 1, 1440),
    oidcIssuerUrl: process.env.OIDC_ISSUER_URL,
    oidcClientId: process.env.OIDC_CLIENT_ID,
    oidcRedirectUri: process.env.OIDC_REDIRECT_URI,
    samlMetadataUrl: process.env.SAML_METADATA_URL,
    samlEntityId: process.env.SAML_ENTITY_ID,
    apiKeyHeader: process.env.API_KEY_HEADER ?? 'X-API-Key',
    systemApiKey,
    integrationApiKey,
    corsOrigins,
    webAppUrl,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    otelEnabled: (process.env.OTEL_ENABLED ?? 'false').toLowerCase() === 'true',
    otelServiceName: process.env.OTEL_SERVICE_NAME ?? 'hr-api',
    otelExporterOtlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  };
}
