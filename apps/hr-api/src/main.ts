import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { loadAppConfig } from './config/app.config.js';

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();

  const app = await NestFactory.create(AppModule, {
    logger:
      config.logLevel === 'debug'
        ? ['debug', 'log', 'warn', 'error', 'verbose']
        : config.logLevel === 'warn'
          ? ['warn', 'error']
          : config.logLevel === 'error'
            ? ['error']
            : ['log', 'warn', 'error'],
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  if (config.corsOrigins.includes('*')) {
    app.enableCors({ origin: true, credentials: true });
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

  console.log(`HR/HCM Platform API running on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
