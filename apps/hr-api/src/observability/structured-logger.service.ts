import { Injectable, LoggerService } from '@nestjs/common';
import { getRequestContext } from './request-context.js';

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'verbose';

export type StructuredLogEntry = Record<string, unknown> & {
  eventType?: string;
  correlationId?: string;
  traceId?: string;
};

const LEVEL_WEIGHT: Record<StructuredLogLevel, number> = {
  debug: 0,
  verbose: 1,
  info: 2,
  warn: 3,
  error: 4,
};

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(
    private readonly serviceName = 'hr-api',
    minimumLevel: string = 'info',
  ) {
    this.minimumLevel = isLogLevel(minimumLevel) ? minimumLevel : 'info';
  }

  private readonly minimumLevel: StructuredLogLevel;

  info(entry: StructuredLogEntry): void {
    this.write('info', entry);
  }

  log(message: unknown, context?: string): void {
    this.write('info', this.toEntry(message, context));
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', this.toEntry(message, context));
  }

  error(message: unknown, traceOrContext?: string, context?: string): void {
    const entry = this.toEntry(message, context ?? traceOrContext);
    if (traceOrContext && context) entry.stack = traceOrContext;
    this.write('error', entry);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', this.toEntry(message, context));
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', this.toEntry(message, context));
  }

  format(level: StructuredLogLevel, entry: StructuredLogEntry): StructuredLogEntry {
    const eventType =
      typeof entry.eventType === 'string'
        ? entry.eventType
        : typeof entry.type === 'string'
          ? entry.type
          : 'LOG';
    // Enrich with the ambient request correlation/trace when the caller didn't
    // set them explicitly, so service-layer logs are attributable to a request.
    const ctx = getRequestContext();
    const ambient: Partial<StructuredLogEntry> = {};
    if (ctx?.correlationId && entry.correlationId === undefined) ambient.correlationId = ctx.correlationId;
    if (ctx?.traceId && entry.traceId === undefined) ambient.traceId = ctx.traceId;
    return {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      ...ambient,
      ...entry,
      eventType,
    };
  }

  private write(level: StructuredLogLevel, entry: StructuredLogEntry): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minimumLevel]) return;
    const payload = JSON.stringify(this.format(level, entry));
    if (level === 'error') {
      console.error(payload);
      return;
    }
    if (level === 'warn') {
      console.warn(payload);
      return;
    }
    console.log(payload);
  }

  private toEntry(message: unknown, context?: string): StructuredLogEntry {
    if (message instanceof Error) {
      return {
        eventType: 'ERROR',
        message: message.message,
        stack: message.stack,
        context,
      };
    }
    if (typeof message === 'object' && message !== null) {
      return {
        ...(message as Record<string, unknown>),
        ...(context ? { context } : {}),
      };
    }
    return {
      eventType: 'LOG',
      message: String(message),
      context,
    };
  }
}

function isLogLevel(value: string): value is StructuredLogLevel {
  return value in LEVEL_WEIGHT;
}
