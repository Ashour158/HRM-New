import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { loadAppConfig } from '../config/app.config.js';
import { ObservabilityController } from './observability.controller.js';
import { ObservabilityMetricsService } from './observability-metrics.service.js';
import { ObservabilityMiddleware } from './observability.middleware.js';
import { StructuredLoggerService } from './structured-logger.service.js';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [
    ObservabilityMetricsService,
    ObservabilityMiddleware,
    {
      provide: StructuredLoggerService,
      useFactory: () => {
        const config = loadAppConfig();
        return new StructuredLoggerService(config.otelServiceName, config.logLevel);
      },
    },
  ],
  exports: [ObservabilityMetricsService, StructuredLoggerService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ObservabilityMiddleware).forRoutes('*');
  }
}
