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
  /** Allowed CORS origins. */
  corsOrigins: string[];
  /** Log level. */
  logLevel: string;
}

/**
 * Load configuration from environment variables with sensible defaults.
 */
export function loadAppConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/hr_platform',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    apiKeyHeader: process.env.API_KEY_HEADER ?? 'X-API-Key',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
