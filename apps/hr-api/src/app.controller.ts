import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { CorrelationInterceptor } from './interceptors/correlation.interceptor.js';

@Controller()
@UseInterceptors(CorrelationInterceptor)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): ReturnType<AppService['getHealth']> {
    return this.appService.getHealth();
  }

  @Get('health/ready')
  async getReadiness(): Promise<ReturnType<AppService['getReadiness']>> {
    return this.appService.getReadiness();
  }

  @Get('health/live')
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
