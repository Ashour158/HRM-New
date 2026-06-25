import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { loadAppConfig } from './config/app.config.js';
import { shutdownOpenTelemetry, startOpenTelemetry } from './observability/opentelemetry.js';
import { StructuredLoggerService } from './observability/structured-logger.service.js';

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();

  const logger = new StructuredLoggerService('hr-api', config.logLevel);
  startOpenTelemetry(config, logger);
  const app = await NestFactory.create(AppModule, { logger });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // CORS. Reflecting an arbitrary origin together with credentials is unsafe
  // (any site could make credentialed calls), so a wildcard origin disables
  // credentials; an explicit allow-list keeps them.
  if (config.corsOrigins.includes('*')) {
    logger.warn?.({
      eventType: 'CORS_WILDCARD',
      message: 'CORS_ORIGINS includes "*"; credentials disabled. Set explicit origins in production.',
    });
    app.enableCors({ origin: true, credentials: false });
  } else {
    app.enableCors({
      origin: config.corsOrigins,
      credentials: true,
    });
  }

  // Security headers
  app.use(helmet());

  // Compression
  app.use(compression());

  // Graceful shutdown hooks
  app.enableShutdownHooks();
  process.once('SIGTERM', () => {
    void shutdownOpenTelemetry(logger);
  });
  process.once('SIGINT', () => {
    void shutdownOpenTelemetry(logger);
  });

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HR/HCM Platform API')
    .setDescription('Enterprise HR/HCM Platform REST API')
    .setVersion('1.4.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: config.apiKeyHeader, in: 'header' }, 'apiKey')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.port;
  await app.listen(port);

  logger.info({ eventType: 'API_BOOTSTRAPPED', port, url: `http://localhost:${port}` });
}

bootstrap().catch((err: unknown) => {
  const logger = new StructuredLoggerService('hr-api', 'error');
  logger.error(err instanceof Error ? err : new Error(String(err)), 'Bootstrap');
  process.exit(1);
});
