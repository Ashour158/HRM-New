/**
 * Platform-wide configuration for the HR/HCM system.
 */

export interface PlatformConfig {
  /** PostgreSQL connection URL. */
  databaseUrl: string;
  /** Redis connection URL. */
  redisUrl: string;
  /** Kafka broker list. */
  kafkaBrokers: string[];
  /** Secret used to verify JWT tokens. */
  jwtSecret: string;
  /** TTL for idempotency keys in hours. */
  idempotencyKeyTtlHours: number;
  /** Number of days to retain audit records. */
  auditRetentionDays: number;
  /** Maximum time to wait for a command handler in milliseconds. */
  commandTimeoutMs: number;
  /** Interval between event publish attempts in milliseconds. */
  eventPublishIntervalMs: number;
  /** Maximum number of event publish retry attempts. */
  maxEventPublishAttempts: number;
  /** Default data residency region (e.g., 'eu-west-1', 'us-east-1'). */
  defaultDataResidencyRegion: string;
  /** KMS key ID or alias for encryption at rest. */
  encryptionKeyId: string;
}

/**
 * Loads platform configuration from environment variables.
 * Falls back to sensible defaults where appropriate.
 * @returns The populated {@link PlatformConfig}.
 * @throws Error if a required environment variable is missing.
 */
export function loadFromEnv(): PlatformConfig {
  const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };

  const parseList = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  };

  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),
    kafkaBrokers: parseList(process.env.KAFKA_BROKERS) || ['localhost:9092'],
    jwtSecret: requireEnv('JWT_SECRET'),
    idempotencyKeyTtlHours: Number(process.env.IDEMPOTENCY_KEY_TTL_HOURS ?? 24),
    auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS ?? 2555),
    commandTimeoutMs: Number(process.env.COMMAND_TIMEOUT_MS ?? 30000),
    eventPublishIntervalMs: Number(process.env.EVENT_PUBLISH_INTERVAL_MS ?? 1000),
    maxEventPublishAttempts: Number(process.env.MAX_EVENT_PUBLISH_ATTEMPTS ?? 5),
    defaultDataResidencyRegion: process.env.DEFAULT_DATA_RESIDENCY_REGION ?? 'eu-west-1',
    encryptionKeyId: requireEnv('ENCRYPTION_KEY_ID'),
  };
}
