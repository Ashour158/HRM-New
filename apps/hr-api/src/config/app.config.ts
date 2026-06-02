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
    apiKeyHeader: process.env.API_KEY_HEADER ?? 'X-API-Key',
    systemApiKey,
    integrationApiKey,
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
