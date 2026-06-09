import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { ObservabilityMetricsService } from './observability-metrics.service.js';

@Controller()
export class ObservabilityController {
  constructor(private readonly metrics: ObservabilityMetricsService) {}

  @Get('metrics')
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metricsText(@Res() response: Response): void {
    response.type('text/plain; version=0.0.4; charset=utf-8').send(this.metrics.renderPrometheus());
  }
}
