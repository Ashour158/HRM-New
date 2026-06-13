import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { loadAppConfig } from '../config/app.config.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly config = loadAppConfig();
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const email = typeof request.body?.email === 'string' ? request.body.email.toLowerCase() : 'unknown';
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const key = `${ip}:${email}`;
    const now = Date.now();
    // Purge expired buckets so the map cannot grow unbounded across unique ip/email keys.
    for (const [bucketKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(bucketKey);
    }
    const bucket = buckets.get(key);
    const maxAttempts = Math.max(1, this.config.loginMaxAttempts);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > maxAttempts) {
      throw new HttpException('Too many login attempts. Please wait before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
