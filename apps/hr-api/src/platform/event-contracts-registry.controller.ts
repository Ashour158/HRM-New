import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../guards/auth.guard.js';
import { EventContractsRegistryService } from './event-contracts-registry.service.js';

const EVENT_CONTRACT_REGISTRY_READ_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'INTERNAL_AUDITOR',
  'AUDITOR',
]);

@ApiTags('Event Contract Registry')
@UseGuards(AuthGuard)
@Controller('admin/event-contracts')
export class EventContractsRegistryController {
  constructor(private readonly service: EventContractsRegistryService) {}

  @Get('registry')
  getRegistry(@Req() req: Request) {
    this.assertReadScope(req);
    return this.service.getRegistry();
  }

  private assertReadScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => EVENT_CONTRACT_REGISTRY_READ_ROLES.has(role))) return;
    throw new ForbiddenException('Only platform, audit, or HR administrators can inspect event contract registry metadata');
  }
}
