import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from './guards/auth.guard.js';
import { requireTenantId } from './platform/http/request-context.js';
import { AdminReadinessService } from './admin-readiness.service.js';

const SYSTEM_CONSOLE_ROLES = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN']);

@ApiTags('Admin System Console')
@UseGuards(AuthGuard)
@Controller('admin/system-console')
export class AdminReadinessController {
  constructor(private readonly readiness: AdminReadinessService) {}

  @Get('readiness')
  async getReadiness(@Req() req: Request) {
    this.assertSystemConsoleScope(req);
    return this.readiness.getReadiness(this.getTenantId(req));
  }

  private assertSystemConsoleScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => SYSTEM_CONSOLE_ROLES.has(role))) return;
    throw new ForbiddenException('Only system console administrators can view production readiness');
  }

  private getTenantId(req: Request) {
    return requireTenantId(req, 'Production readiness');
  }
}
