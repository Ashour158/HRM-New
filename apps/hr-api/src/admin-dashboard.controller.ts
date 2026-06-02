import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from './guards/auth.guard.js';
import { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';
import type { WorkerProfile } from './domains/hr-core/aggregates/worker-profile.aggregate.js';
import { PositionRepository } from './domains/position-control/repositories/position.repository.js';
import { Uuid } from '@hcm/shared-kernel';

function isSameUtcMonth(date: Date | undefined, now: Date): boolean {
  return Boolean(
    date &&
      date.getUTCFullYear() === now.getUTCFullYear() &&
      date.getUTCMonth() === now.getUTCMonth(),
  );
}

function normalizeWorkers(result: WorkerProfile[] | { items?: WorkerProfile[] }): WorkerProfile[] {
  return Array.isArray(result) ? result : result.items ?? [];
}

const ADMIN_DASHBOARD_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'WORKFORCE_PLANNING_ADMIN',
  'PAYROLL_ADMIN',
  'BENEFITS_ADMIN',
  'COMPENSATION_ADMIN',
]);

@ApiTags('Admin Dashboard')
@UseGuards(AuthGuard)
@Controller('admin')
export class AdminDashboardController {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly positionRepo: PositionRepository,
  ) {}

  @Get('dashboard')
  async getDashboard(@Req() req: Request) {
    this.assertAdminDashboardScope(req);
    const now = new Date();
    const tenantId = req.tenantId ? new Uuid(req.tenantId) : undefined;
    const workers = normalizeWorkers(tenantId
      ? await this.workerRepo.searchForTenant('', tenantId, { limit: 10000 })
      : await this.workerRepo.search('', { limit: 10000 }));
    const positions = tenantId ? await this.positionRepo.findAll(tenantId) : [];
    const activeWorkers = workers.filter((worker) => worker.status === 'ACTIVE' || worker.status === 'REHIRED');
    const terminatedThisMonth = workers.filter((worker) => worker.status === 'TERMINATED' && isSameUtcMonth(worker.terminationDate, now));
    const newHiresThisMonth = workers.filter((worker) => isSameUtcMonth(worker.hireDate, now)).length;
    const headcount = activeWorkers.length;
    const openPositions = positions.filter((position) => position.status === 'ACTIVE' || position.status === 'VACANT').length;
    const turnover = headcount + terminatedThisMonth.length > 0
      ? Number(((terminatedThisMonth.length / (headcount + terminatedThisMonth.length)) * 100).toFixed(1))
      : 0;

    return {
      headcount,
      turnover,
      openPositions,
      newHiresThisMonth,
      terminationsThisMonth: terminatedThisMonth.length,
      recentActivity: [
        ...workers
          .filter((worker) => isSameUtcMonth(worker.hireDate, now))
          .slice(0, 3)
          .map((worker) => ({
            id: `worker-hired-${worker.id.value}`,
            description: `${worker.firstName} ${worker.lastName} joined as ${worker.jobTitle ?? 'a worker'}`,
            timestamp: worker.hireDate.toISOString(),
            type: 'WORKER',
          })),
        ...terminatedThisMonth.slice(0, 2).map((worker) => ({
          id: `worker-terminated-${worker.id.value}`,
          description: `${worker.firstName} ${worker.lastName} was terminated`,
          timestamp: worker.terminationDate?.toISOString() ?? now.toISOString(),
          type: 'WORKER',
        })),
      ],
      alerts: [
        ...(headcount === 0
          ? [{ id: 'no-active-workers', severity: 'high' as const, message: 'No active workers are available in the tenant.' }]
          : []),
        ...(terminatedThisMonth.length > 0
          ? [{ id: 'terminations-this-month', severity: 'medium' as const, message: `${terminatedThisMonth.length} termination(s) occurred this month.` }]
          : []),
      ],
    };
  }

  private assertAdminDashboardScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => ADMIN_DASHBOARD_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR or platform administrators can view the admin dashboard');
  }
}
