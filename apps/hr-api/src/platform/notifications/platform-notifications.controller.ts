import { Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import { HR_OPERATIONS_NOTIFICATION_ROLE, PlatformNotificationRepository } from './platform-notification.repository.js';
import type { Request } from 'express';

const HR_NOTIFICATION_ROLES = new Set([
  'HR_ADMIN',
  'SUPER_ADMIN',
  'HRBP',
  'COMPLIANCE_ADMIN',
  'WORKFORCE_PLANNING_ADMIN',
  'HR_OPERATIONS_ANALYST',
]);

@UseGuards(AuthGuard)
@Controller('notifications')
export class PlatformNotificationsController {
  constructor(private readonly repository: PlatformNotificationRepository) {}

  @Get('me')
  async getMyNotifications(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const workerId = await this.resolveActorWorkerId(req, tenantId);
    return this.repository.findByWorker(tenantId, workerId, 50);
  }

  @Post(':id/commands/read')
  async markMyNotificationRead(@Param('id') id: string, @Req() req: Request) {
    const tenantId = this.getTenantId(req);
    const workerId = await this.resolveActorWorkerId(req, tenantId);
    return this.repository.markWorkerRead(tenantId, id, workerId);
  }

  @Get('hr-operations')
  async getHrOperationsNotifications(@Req() req: Request) {
    this.assertHrNotificationRole(req);
    return this.repository.findByRole(this.getTenantId(req), HR_OPERATIONS_NOTIFICATION_ROLE, 100);
  }

  private async resolveActorWorkerId(req: Request, tenantId: string): Promise<string> {
    const actorId = this.getActorId(req);
    const email = (req.actor as { email?: string } | undefined)?.email;
    const workerId = await this.repository.findWorkerIdForActor(tenantId, actorId, email);
    if (!workerId) {
      throw new ForbiddenException('No worker is linked to the authenticated notification recipient');
    }
    return workerId;
  }

  private assertHrNotificationRole(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => HR_NOTIFICATION_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR operations roles can view HR operations notifications');
  }

  private getTenantId(req: Request): string {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return req.tenantId;
    }
    throw new ForbiddenException('Authenticated tenant is required');
  }

  private getActorId(req: Request): string {
    const actorId = req.actor?.actorId;
    if (actorId instanceof Uuid) return actorId.value;
    const actorIdLike = actorId as { value?: unknown } | undefined;
    if (typeof actorIdLike?.value === 'string') return actorIdLike.value;
    throw new ForbiddenException('Authenticated actor is required');
  }
}
