import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { HcmSetupService } from './hcm-setup.service.js';
import type { HcmSetupUpdate } from './hcm-setup.types.js';

const SETUP_ADMIN_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN']);

@ApiTags('HCM Setup')
@UseGuards(AuthGuard)
@Controller('admin/hcm-setup')
export class HcmSetupController {
  constructor(private readonly service: HcmSetupService) {}

  @Get()
  async getSetup(@Req() req: Request) {
    return this.service.getSetup(this.getTenantId(req));
  }

  @Patch()
  async updateSetup(@Body() body: HcmSetupUpdate, @Req() req: Request) {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => SETUP_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only HCM setup administrators can update employee profile setup');
    }

    return this.service.updateSetup(this.getTenantId(req), body);
  }

  private getTenantId(req: Request): Uuid {
    return new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
  }
}
