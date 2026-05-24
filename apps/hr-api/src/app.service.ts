import { Injectable } from '@nestjs/common';
import { loadAppConfig } from './config/app.config.js';
import { getPool } from '@hcm/database';
import { createKyselyInstance } from '@hcm/database';

export interface HealthStatus {
  status: 'ok' | 'error';
  version: string;
  timestamp: string;
}

export interface ReadinessCheck {
  name: string;
  status: 'up' | 'down';
  details?: string;
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  checks: ReadinessCheck[];
  timestamp: string;
}

/**
 * Root application service.
 */
@Injectable()
export class AppService {
  private readonly version = '1.4.0';

  getHello(): string {
    return 'HR/HCM Platform API';
  }

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const checks: ReadinessCheck[] = [];

    // Database check
    try {
      const pool = getPool();
      const db = createKyselyInstance(pool);
      await db.selectFrom('tenants').select('id').limit(1).execute();
      checks.push({ name: 'database', status: 'up' });
    } catch (err) {
      checks.push({
        name: 'database',
        status: 'down',
        details: err instanceof Error ? err.message : String(err),
      });
    }

    // Redis check
    try {
      const config = loadAppConfig();
      const { Redis } = await import('ioredis');
      const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
      await redis.ping();
      redis.disconnect();
      checks.push({ name: 'redis', status: 'up' });
    } catch (err) {
      checks.push({
        name: 'redis',
        status: 'down',
        details: err instanceof Error ? err.message : String(err),
      });
    }

    // Kafka check (optional — only if brokers are configured)
    const config = loadAppConfig();
    if (config.kafkaBrokers.length > 0 && config.kafkaBrokers[0]) {
      try {
        const { Kafka } = await import('kafkajs');
        const kafka = new Kafka({
          clientId: 'hr-api-health',
          brokers: config.kafkaBrokers,
        });
        const admin = kafka.admin();
        await admin.connect();
        await admin.disconnect();
        checks.push({ name: 'kafka', status: 'up' });
      } catch (err) {
        checks.push({
          name: 'kafka',
          status: 'down',
          details: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const allUp = checks.every((c) => c.status === 'up');

    return {
      status: allUp ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
