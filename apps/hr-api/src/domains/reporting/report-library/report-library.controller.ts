import { BadRequestException, Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../../guards/auth.guard.js';
import type { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { AbsenceAccrualBalanceRepository } from '../../absence-leave/repositories/absence-accrual-balance.repository.js';
import { AbsenceRequestRepository } from '../../absence-leave/repositories/absence-request.repository.js';
import { LeaveEntitlementCalculationRepository } from '../../absence-leave/repositories/leave-entitlement-calculation.repository.js';
import { LeavePolicyService } from '../../absence-leave/services/leave-policy.service.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import type { LeavePolicy } from '../../hcm-setup/hcm-setup.types.js';
import { AttendanceLedgerBuilderService } from '../../time-attendance/services/attendance-ledger-builder.service.js';
import { AttendanceReportingService } from '../../time-attendance/services/attendance-reporting.service.js';
import { LearningAssignmentRepository } from '../../learning/repositories/learning-assignment.repository.js';
import { LearningCourseRepository } from '../../learning/repositories/learning-course.repository.js';
import { CertificationRepository } from '../../learning/repositories/certification.repository.js';
import { PerformanceReviewRepository } from '../../performance/repositories/performance-review.repository.js';
import { GoalRepository } from '../../performance/repositories/goal.repository.js';
import {
  REPORT_LIBRARY_DEFINITIONS,
  findReportLibraryDefinition,
  type ReportLibraryDefinition,
} from './report-library.registry.js';

function dateOnly(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function enumerateDateKeys(periodStart: string, periodEnd: string): string[] {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  const days: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    days.push(dateKey(cursor));
  }
  return days;
}

/** Trailing 30-day window ending today, used for the attendance report defaults. */
function trailingThirtyDayPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodEnd = dateKey(now);
  const periodStart = dateKey(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  return { periodStart, periodEnd };
}

function displayName(worker: Pick<WorkerProfile, 'firstName' | 'lastName' | 'employeeNumber'>): string {
  return `${worker.firstName} ${worker.lastName}`.trim() || worker.employeeNumber;
}

function reviewRating(review: { finalRating?: number; calibratedRating?: number }): number | undefined {
  return typeof review.finalRating === 'number' ? review.finalRating : review.calibratedRating;
}

function latestRatedReview(
  reviews: Array<{ finalRating?: number; calibratedRating?: number; updatedAt?: Date; createdAt?: Date }>,
) {
  return reviews
    .filter((review) => typeof reviewRating(review) === 'number')
    .sort((a, b) => timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt))[0];
}

function timestamp(value: Date | string | undefined | null): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function ratingBand(rating: number | undefined): string {
  if (rating === undefined) return 'NOT_RATED';
  if (rating < 3) return 'BELOW_EXPECTATIONS';
  if (rating < 4) return 'MEETS_EXPECTATIONS';
  if (rating < 4.5) return 'EXCEEDS_EXPECTATIONS';
  return 'OUTSTANDING';
}

function goalProgress(goal: { targetValue?: number; currentValue?: number; status: string }): number {
  if (goal.status === 'ACHIEVED') return 100;
  if (!goal.targetValue || goal.targetValue <= 0) return 0;
  return Math.round(Math.min(Math.max(((goal.currentValue ?? 0) / goal.targetValue) * 100, 0), 100) * 100) / 100;
}

@ApiTags('Report Library')
@UseGuards(AuthGuard)
@Controller('reports/library')
export class ReportLibraryController {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly accrualBalanceRepo: AbsenceAccrualBalanceRepository,
    private readonly absenceRequestRepo: AbsenceRequestRepository,
    private readonly entitlementCalculationRepo: LeaveEntitlementCalculationRepository,
    private readonly leavePolicyService: LeavePolicyService,
    private readonly hcmSetupService: HcmSetupService,
    private readonly attendanceLedgerBuilder: AttendanceLedgerBuilderService,
    private readonly attendanceReportingService: AttendanceReportingService,
    private readonly learningAssignmentRepo: LearningAssignmentRepository,
    private readonly learningCourseRepo: LearningCourseRepository,
    private readonly certificationRepo: CertificationRepository,
    private readonly reviewRepo: PerformanceReviewRepository,
    private readonly goalRepo: GoalRepository,
  ) {}

  @Get('catalog')
  getCatalog() {
    return { reports: REPORT_LIBRARY_DEFINITIONS };
  }

  @Get('my/:key/run')
  async runMyReport(@Param('key') key: string, @Req() req: Request) {
    const definition = findReportLibraryDefinition('MY', key);
    if (!definition || definition.kind !== 'DATA') {
      throw new BadRequestException(`Unknown My Reports report key: ${key}`);
    }
    const tenantId = this.getTenantId(req);
    const worker = await this.resolveSelfWorker(req, tenantId);

    switch (definition.key) {
      case 'my-time-off-balance':
        return this.buildTimeOffBalanceReport(definition, worker, tenantId);
      case 'my-attendance-summary':
        return this.buildSelfAttendanceReport(definition, worker, tenantId);
      case 'my-learning-progress':
        return this.buildLearningProgressReport(definition, worker);
      default:
        throw new BadRequestException(`Unsupported My Reports report key: ${key}`);
    }
  }

  @Get('team/:key/run')
  async runTeamReport(@Param('key') key: string, @Req() req: Request) {
    const definition = findReportLibraryDefinition('TEAM', key);
    if (!definition || definition.kind !== 'DATA') {
      throw new BadRequestException(`Unknown Team Reports report key: ${key}`);
    }
    const tenantId = this.getTenantId(req);
    const manager = await this.resolveManagerWorker(req, tenantId);
    const directReports = await this.resolveDirectReports(manager, tenantId);

    switch (definition.key) {
      case 'team-attendance-summary':
        return this.buildTeamAttendanceReport(definition, manager, tenantId);
      case 'team-leave-calendar':
        return this.buildTeamLeaveCalendarReport(definition, directReports);
      case 'team-performance-distribution':
        return this.buildTeamPerformanceDistributionReport(definition, directReports);
      default:
        throw new BadRequestException(`Unsupported Team Reports report key: ${key}`);
    }
  }

  /* ─────────────────────────── shared identity resolution ─────────────────────────── */

  private getTenantId(req: Request): Uuid {
    if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
      return new Uuid(req.tenantId);
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

  private getActorEmail(req: Request): string | undefined {
    return (req.actor as { email?: string } | undefined)?.email;
  }

  /** Resolves the calling worker's own record - never trusts a client-supplied worker id. */
  private async resolveSelfWorker(req: Request, tenantId: Uuid): Promise<WorkerProfile> {
    const actorId = this.getActorId(req);
    if (Uuid.isValid(actorId)) {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return worker;
    }
    const email = this.getActorEmail(req);
    if (email) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return worker;
    }
    throw new ForbiddenException('No employee profile is linked to the authenticated user');
  }

  /** Resolves the calling manager's own worker record. Requires the MANAGER role. */
  private async resolveManagerWorker(req: Request, tenantId: Uuid): Promise<WorkerProfile> {
    if (!(req.actor?.roles ?? []).includes('MANAGER')) {
      throw new ForbiddenException('Team Reports access requires a manager user session');
    }
    const manager = await this.resolveSelfWorker(req, tenantId);
    if (manager.status !== 'ACTIVE' && manager.status !== 'REHIRED') {
      throw new ForbiddenException('Team Reports access is available only to active managers');
    }
    return manager;
  }

  /** Direct reports only - the same tenant + managerId double-check used by manager/team. */
  private async resolveDirectReports(manager: WorkerProfile, tenantId: Uuid): Promise<WorkerProfile[]> {
    const reports = await this.workerRepo.findByManagerForTenant(manager.id, tenantId);
    return reports.filter((worker) => worker.tenantId.value === tenantId.value && worker.managerId?.value === manager.id.value);
  }

  /* ─────────────────────────── MY reports ─────────────────────────── */

  private async buildTimeOffBalanceReport(definition: ReportLibraryDefinition, worker: WorkerProfile, tenantId: Uuid) {
    const setup = await this.hcmSetupService.getSetup(tenantId);
    const [balances, requests, calculations] = await Promise.all([
      this.accrualBalanceRepo.findByWorker(worker.id),
      this.absenceRequestRepo.findByWorker(worker.id),
      this.entitlementCalculationRepo.findByWorker(worker.id),
    ]);

    const balanceRows = balances.length > 0
      ? balances.map((balance) => {
        const policy = this.resolvePolicyOrFallback(setup.leavePolicies, balance.leaveType);
        return {
          type: balance.leaveType,
          label: policy.label,
          total: this.leavePolicyService.amountFromStoredHours(setup, policy, balance.accruedHours + balance.carriedOverHours),
          used: this.leavePolicyService.amountFromStoredHours(setup, policy, balance.usedHours),
          remaining: this.leavePolicyService.amountFromStoredHours(setup, policy, balance.balanceHours),
          unit: policy.unit.toLowerCase(),
        };
      })
      : setup.leavePolicies
        .filter((policy) => policy.active && policy.requestableByEmployee && policy.deductFromBalance && policy.annualEntitlement !== undefined)
        .map((policy) => ({
          type: policy.code,
          label: policy.label,
          total: policy.annualEntitlement ?? 0,
          used: 0,
          remaining: policy.annualEntitlement ?? 0,
          unit: policy.unit.toLowerCase(),
        }));

    const history = requests
      .map((request) => ({
        id: request.id.value,
        type: request.absenceType,
        startDate: dateOnly(request.startDate),
        endDate: dateOnly(request.endDate),
        status: request.status,
        calendarDays: request.calendarDays,
        workingDays: request.workingDays,
        reason: request.reason,
      }))
      .sort((left, right) => (right.startDate ?? '').localeCompare(left.startDate ?? ''));

    const entitlementCalculations = calculations
      .map((calculation) => ({
        leaveType: calculation.leaveType,
        calculatedEntitlement: calculation.calculatedEntitlement,
        usedEntitlement: calculation.usedEntitlement,
        remainingEntitlement: calculation.remainingEntitlement,
        calculationDate: dateOnly(calculation.calculationDate),
        status: calculation.status,
      }))
      .sort((left, right) => (right.calculationDate ?? '').localeCompare(left.calculationDate ?? ''));

    return {
      definition,
      generatedAt: new Date().toISOString(),
      balances: balanceRows,
      history,
      entitlementCalculations,
      summary: {
        pendingRequests: history.filter((item) => item.status === 'PENDING_APPROVAL' || item.status === 'SUBMITTED').length,
        approvedRequests: history.filter((item) => item.status === 'APPROVED').length,
        totalRemaining: balanceRows.reduce((sum, row) => sum + row.remaining, 0),
      },
    };
  }

  private resolvePolicyOrFallback(policies: LeavePolicy[], leaveType: string): LeavePolicy {
    try {
      return this.leavePolicyService.resolvePolicy({ leavePolicies: policies }, leaveType);
    } catch {
      return {
        code: leaveType,
        label: leaveType,
        active: true,
        unit: 'HOURS',
        paid: true,
        deductFromBalance: true,
        requestableByEmployee: true,
        payrollImpact: 'PAID_LEAVE',
        approvalWorkflow: 'MANAGER',
      };
    }
  }

  private async buildSelfAttendanceReport(definition: ReportLibraryDefinition, worker: WorkerProfile, tenantId: Uuid) {
    const { periodStart, periodEnd } = trailingThirtyDayPeriod();
    const days = enumerateDateKeys(periodStart, periodEnd);
    const ledgers = await Promise.all(days.map((date) => this.attendanceLedgerBuilder.buildDailyLedger(tenantId, {
      date,
      workerId: worker.id.value,
    })));
    const view = this.attendanceReportingService.buildPeriodView({
      periodStart,
      periodEnd,
      range: 'MONTHLY',
      scope: 'SELF',
      ledgers,
    });
    return { definition, generatedAt: new Date().toISOString(), ...view };
  }

  private async buildLearningProgressReport(definition: ReportLibraryDefinition, worker: WorkerProfile) {
    const [assignments, certifications] = await Promise.all([
      this.learningAssignmentRepo.findByWorker(worker.id),
      this.certificationRepo.findByWorker(worker.id),
    ]);
    const courseIds = [...new Set(assignments.map((assignment) => assignment.courseId.value))];
    const courses = await Promise.all(courseIds.map((courseId) => this.learningCourseRepo.findById(new Uuid(courseId))));
    const courseTitleById = new Map(courses.filter((course): course is NonNullable<typeof course> => Boolean(course)).map((course) => [course.id.value, course.title]));

    const assignmentRows = assignments
      .map((assignment) => ({
        id: assignment.id.value,
        courseId: assignment.courseId.value,
        courseTitle: courseTitleById.get(assignment.courseId.value) ?? 'Untitled course',
        status: assignment.status,
        assignedAt: dateOnly(assignment.assignedAt),
        dueDate: dateOnly(assignment.dueDate),
        completedAt: dateOnly(assignment.completedAt),
        score: assignment.score,
      }))
      .sort((left, right) => (right.assignedAt ?? '').localeCompare(left.assignedAt ?? ''));

    const certificationRows = certifications
      .map((certification) => ({
        id: certification.id.value,
        certificationName: certification.certificationName,
        issuingBody: certification.issuingBody,
        issueDate: dateOnly(certification.issueDate),
        expiryDate: dateOnly(certification.expiryDate),
        status: certification.status,
      }))
      .sort((left, right) => (right.issueDate ?? '').localeCompare(left.issueDate ?? ''));

    const today = dateKey(new Date());
    return {
      definition,
      generatedAt: new Date().toISOString(),
      assignments: assignmentRows,
      certifications: certificationRows,
      summary: {
        totalAssigned: assignmentRows.length,
        completed: assignmentRows.filter((row) => row.status === 'COMPLETED').length,
        inProgress: assignmentRows.filter((row) => row.status === 'IN_PROGRESS').length,
        overdue: assignmentRows.filter((row) => row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && row.dueDate !== undefined && row.dueDate < today).length,
        activeCertifications: certificationRows.filter((row) => row.status === 'ACTIVE').length,
        expiredCertifications: certificationRows.filter((row) => row.status === 'EXPIRED').length,
      },
    };
  }

  /* ─────────────────────────── TEAM reports ─────────────────────────── */

  private async buildTeamAttendanceReport(definition: ReportLibraryDefinition, manager: WorkerProfile, tenantId: Uuid) {
    const { periodStart, periodEnd } = trailingThirtyDayPeriod();
    const days = enumerateDateKeys(periodStart, periodEnd);
    const ledgers = await Promise.all(days.map((date) => this.attendanceLedgerBuilder.buildDailyLedger(tenantId, {
      date,
      managerId: manager.id.value,
    })));
    const view = this.attendanceReportingService.buildPeriodView({
      periodStart,
      periodEnd,
      range: 'MONTHLY',
      scope: 'TEAM',
      ledgers,
    });
    return { definition, generatedAt: new Date().toISOString(), ...view };
  }

  private async buildTeamLeaveCalendarReport(definition: ReportLibraryDefinition, directReports: WorkerProfile[]) {
    const today = dateKey(new Date());
    const requestsByWorker = await Promise.all(directReports.map((worker) => this.absenceRequestRepo.findByWorker(worker.id)));
    const workerById = new Map(directReports.map((worker) => [worker.id.value, worker]));

    const upcoming = requestsByWorker
      .flat()
      .filter((request) => (request.status === 'APPROVED' || request.status === 'PENDING_APPROVAL') && (dateOnly(request.endDate) ?? '') >= today)
      .map((request) => {
        const worker = workerById.get(request.workerId.value);
        return {
          id: request.id.value,
          workerId: request.workerId.value,
          workerName: worker ? displayName(worker) : 'Unknown worker',
          type: request.absenceType,
          startDate: dateOnly(request.startDate),
          endDate: dateOnly(request.endDate),
          status: request.status,
          calendarDays: request.calendarDays,
          workingDays: request.workingDays,
        };
      })
      .sort((left, right) => (left.startDate ?? '').localeCompare(right.startDate ?? ''));

    return {
      definition,
      generatedAt: new Date().toISOString(),
      upcoming,
      summary: {
        teamSize: directReports.length,
        totalUpcoming: upcoming.length,
        onLeaveToday: upcoming.filter((item) => (item.startDate ?? '') <= today && (item.endDate ?? '') >= today).length,
      },
    };
  }

  private async buildTeamPerformanceDistributionReport(definition: ReportLibraryDefinition, directReports: WorkerProfile[]) {
    const [reviewsByWorker, goalsByWorker] = await Promise.all([
      Promise.all(directReports.map((worker) => this.reviewRepo.findByWorker(worker.id))),
      Promise.all(directReports.map((worker) => this.goalRepo.findByWorker(worker.id))),
    ]);

    const ratingBandCounts = new Map<string, number>();
    const workers = directReports.map((worker, index) => {
      const reviews = reviewsByWorker[index];
      const goals = goalsByWorker[index];
      const latestReview = latestRatedReview(reviews);
      const rating = latestReview ? reviewRating(latestReview) : undefined;
      const band = ratingBand(rating);
      ratingBandCounts.set(band, (ratingBandCounts.get(band) ?? 0) + 1);
      const openGoals = goals.filter((goal) => goal.status === 'ACTIVE' || goal.status === 'IN_PROGRESS').length;
      const achievedGoals = goals.filter((goal) => goal.status === 'ACHIEVED').length;
      return {
        workerId: worker.id.value,
        workerName: displayName(worker),
        latestRating: rating ?? null,
        ratingBand: band,
        openGoals,
        achievedGoals,
        totalGoals: goals.length,
        averageGoalProgress: goals.length > 0 ? Math.round((goals.reduce((sum, goal) => sum + goalProgress(goal), 0) / goals.length) * 100) / 100 : 0,
      };
    });

    const goalStatusCounts = new Map<string, number>();
    for (const worker of workers) {
      goalStatusCounts.set('OPEN', (goalStatusCounts.get('OPEN') ?? 0) + worker.openGoals);
      goalStatusCounts.set('ACHIEVED', (goalStatusCounts.get('ACHIEVED') ?? 0) + worker.achievedGoals);
    }

    const ratedWorkers = workers.filter((worker) => worker.latestRating !== null);
    const averageRating = ratedWorkers.length > 0
      ? Math.round((ratedWorkers.reduce((sum, worker) => sum + (worker.latestRating ?? 0), 0) / ratedWorkers.length) * 100) / 100
      : null;

    return {
      definition,
      generatedAt: new Date().toISOString(),
      workerCount: directReports.length,
      averageRating,
      ratingDistribution: [...ratingBandCounts.entries()].map(([band, count]) => ({ band, count })),
      goalStatusDistribution: [...goalStatusCounts.entries()].map(([status, count]) => ({ status, count })),
      workers: workers.sort((left, right) => left.workerName.localeCompare(right.workerName)),
    };
  }
}
