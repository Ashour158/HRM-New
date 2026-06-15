import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../guards/auth.guard.js';
import { requireActor, requireTenantId } from '../http/request-context.js';
import { MeInboxService } from './me-inbox.service.js';

@ApiTags('Me')
@UseGuards(AuthGuard)
@Controller('me')
export class MeInboxController {
  constructor(private readonly inbox: MeInboxService) {}

  @Get('inbox')
  async getInbox(@Req() req: Request) {
    return this.inbox.getInbox({
      tenantId: requireTenantId(req, 'Me inbox'),
      actor: requireActor(req, 'Me inbox'),
    });
  }
}
