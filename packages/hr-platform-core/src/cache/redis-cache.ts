/**
 * Redis-backed cache service for the HR/HCM platform.
 */

import type { Redis } from 'ioredis';
import { Uuid } from '@hcm/shared-kernel';

/**
 * Generic cache operations backed by Redis.
 */
export class RedisCacheService {
  /**
   * @param redis - An ioredis client instance.
   */
  constructor(private readonly redis: Redis) {}

  /**
   * Retrieves a cached value by key.
   * @param key - The cache key.
   * @returns The deserialized value or undefined if missing.
   */
  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) {
      return undefined;
    }
    return JSON.parse(raw) as T;
  }

  /**
   * Stores a value in the cache with an optional TTL.
   * @param key - The cache key.
   * @param value - The value to cache (must be JSON-serializable).
   * @param ttlSeconds - Optional time-to-live in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  /**
   * Removes a single key from the cache.
   * @param key - The cache key to delete.
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Returns the cached value or invokes the factory, caches the result, and returns it.
   * @param key - The cache key.
   * @param factory - Async factory to produce the value on cache miss.
   * @param ttlSeconds - Optional TTL for the newly cached value.
   * @returns The cached or freshly produced value.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Deletes all keys prefixed with the tenant identifier.
   * @param tenantId - The tenant whose cache entries should be evicted.
   */
  async flushTenant(tenantId: Uuid): Promise<void> {
    const pattern = `hcm:${tenantId.value}:*`;
    let cursor = '0';
    do {
      const reply = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
