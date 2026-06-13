import {
  Controller,
  Get,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { CorrelationInterceptor } from './interceptors/correlation.interceptor.js';
import { Public } from './decorators/public.decorator.js';

@Controller()
@UseInterceptors(CorrelationInterceptor)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Public()
  getHealth(): ReturnType<AppService['getHealth']> {
    return this.appService.getHealth();
  }

  @Get('health/ready')
  @Public()
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReturnType<AppService['getReadiness']>> {
    const readiness = await this.appService.getReadiness();
    if (readiness.status !== 'ready') {
      res.status(503);
    }
    return readiness;
  }

  @Get('health/live')
  @Public()
  getLiveness(): { status: 'alive'; timestamp: string } {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api/info')
  @UseGuards(AuthGuard, RolesGuard)
  getApiInfo(): {
    name: string;
    version: string;
    modules: string[];
  } {
    return {
      name: 'HR/HCM Platform',
      version: '1.4.0',
      modules: [
        'platform',
        'organization',
        'hr-core',
        'position-control',
      ],
    };
  }
}
