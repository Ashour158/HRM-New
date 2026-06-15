import { BadRequestException, Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../guards/auth.guard.js';
import { createCommand, type CommandOutcome } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandBus } from '../../platform/command-bus/command-bus.js';
import { actorClientType, requireActor, requireTenantId } from '../../platform/http/request-context.js';
import { HcmSetupService } from './hcm-setup.service.js';
import type { HcmSetupConfig, HcmSetupUpdate } from './hcm-setup.types.js';

const SETUP_ADMIN_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN']);

@ApiTags('HCM Setup')
@UseGuards(AuthGuard)
@Controller('admin/hcm-setup')
export class HcmSetupController {
  constructor(
    private readonly service: HcmSetupService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Get()
  async getSetup(@Req() req: Request) {
    this.assertSetupAdmin(req);
    return this.service.getSetup(this.getTenantId(req));
  }

  @Patch()
  async updateSetup(@Body() body: HcmSetupUpdate, @Req() req: Request) {
    this.assertSetupAdmin(req);
    const tenantId = this.getTenantId(req);
    const actor = requireActor(req, 'HCM setup');
    const commandBus = this.moduleRef.get(CommandBus, { strict: false });
    const result = await commandBus.execute(createCommand(
      'ConfigureHcmSetup',
      tenantId,
      actor,
      body,
      {
        aggregateType: 'HcmSetupConfig',
        aggregateId: tenantId,
        idempotencyKey: crypto.randomUUID(),
        correlationId: Uuid.generate(),
        reason: 'Configure HCM setup via System Console',
        metadata: {
          clientType: actorClientType(actor),
          hrDataSensitivity: 'HIGH',
        },
      },
    )) as CommandOutcome<HcmSetupConfig>;
    if (!result.success) {
      throw new BadRequestException(result.errorMessage);
    }
    return result.data;
  }

  private assertSetupAdmin(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => SETUP_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only HCM setup administrators can update employee profile setup');
    }
  }

  private getTenantId(req: Request) {
    return requireTenantId(req, 'HCM setup');
  }
}
