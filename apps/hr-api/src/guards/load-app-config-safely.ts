import { Logger } from '@nestjs/common';
import { loadAppConfig } from '../config/app.config.js';

/**
 * Shared by AuthGuard and OptionalAuthGuard: loadAppConfig() throws in production when a
 * required secret (JWT_SECRET, SYSTEM_API_KEY, ...) is missing or fails the strong-secret
 * guard. That failure must never surface as an unhandled 500 - callers decide what "config
 * unavailable" means for their route (AuthGuard denies; OptionalAuthGuard proceeds
 * anonymously) - but either way it's a production misconfiguration worth a loud log, since
 * silently degrading to "no actor attached" with zero signal could hide a broken deploy.
 */
export function loadAppConfigOrUndefined(
  logger: Logger,
  route: string,
  method: string,
): ReturnType<typeof loadAppConfig> | undefined {
  try {
    return loadAppConfig();
  } catch {
    logger.error({ eventType: 'AUTH_CONFIG_ERROR', route, method });
    return undefined;
  }
}
