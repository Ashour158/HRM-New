import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Query,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { LegalEntityRepository } from '../repositories/legal-entity.repository.js';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { ManagerRelationshipRepository } from '../repositories/manager-relationship.repository.js';
import { LegalEntityFsm } from '../fsm/legal-entity.fsm.js';
import { LegalEntityProjection } from '../projections/legal-entity.projection.js';
import type { OrgUnit } from '../aggregates/org-unit.aggregate.js';
import type { ManagerRelationship } from '../aggregates/manager-relationship.aggregate.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { PersonalDataRecordRepository } from '../../hr-core/repositories/personal-data-record.repository.js';
import type { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import type { PersonalDataRecord } from '../../hr-core/aggregates/personal-data-record.aggregate.js';
import { PositionRepository } from '../../position-control/repositories/position.repository.js';
import { HeadcountRequestRepository } from '../../position-control/repositories/headcount-request.repository.js';
import { AuthGuard } from '../../../guards/auth.guard.js';
import type { Position } from '../../position-control/aggregates/position.aggregate.js';
import type { HeadcountRequest } from '../../position-control/aggregates/headcount-request.aggregate.js';
import {
  CreateLegalEntityDto,
  UpdateLegalEntityDto,
  CreateOrgUnitDto,
  UpdateOrgUnitDto,
  RestructureOrgUnitDto,
  AssignManagerDto,
  AssignWorkerOrganizationDto,
  AssignWorkerOrganizationByBodyDto,
  WorkforceScenarioDto,
} from './dtos.js';

type WorkerOrganizationAssignmentResult = {
  workerId: string;
  legalEntityId: string | null;
  departmentId: string | null;
  managerId: string | null;
  jobTitle: string | null;
};

type ManagerReplacementPlan = {
  commandResult?: unknown;
  previousRelationship?: ManagerRelationship;
  assignedRelationshipId?: Uuid;
};

type PlanningProfile = {
  worker: WorkerProfile;
  records: Map<string, Record<string, unknown>>;
};

type PlanningLegalEntity = { id: string; name: string; countryCode?: string; status?: string };
type PlanningOrgUnit = { id: string; name: string; legalEntityId?: string | null; parentId?: string | null; status?: string };

type PlanningData = {
  tenantId: Uuid;
  legalEntities: PlanningLegalEntity[];
  orgUnits: PlanningOrgUnit[];
  workers: WorkerProfile[];
  activeWorkers: WorkerProfile[];
  profiles: PlanningProfile[];
  positions: Position[];
  headcountRequests: HeadcountRequest[];
  managerRelationships: ManagerRelationship[];
};

type OrganizationSetupStep = {
  code: string;
  label: string;
  category: string;
  status: 'READY' | 'ACTION_REQUIRED' | 'BLOCKED' | 'OPTIONAL';
  count: number;
  completed: boolean;
  target: string;
  blockers: string[];
  nextAction: string;
};

const ORGANIZATION_ADMIN_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'WORKFORCE_PLANNING_ADMIN',
  'FINANCE_ADMIN',
  'EXECUTIVE',
]);

@ApiTags('Organization')
@UseGuards(AuthGuard)
@Controller(['hr/organization', 'organization'])
export class OrganizationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly legalEntityRepo: LegalEntityRepository,
    private readonly orgUnitRepo: OrgUnitRepository,
    private readonly managerRelationshipRepo: ManagerRelationshipRepository,
    private readonly workerRepo: WorkerRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly positionRepo: PositionRepository,
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly legalEntityFsm: LegalEntityFsm,
    private readonly projection: LegalEntityProjection,
  ) {}

  @Get('summary')
  async getOrganizationSummary(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    const tenantUuid = new Uuid(tenantId);
    const [legalEntities, orgUnits, orgTree, relationships] = await Promise.all([
      this.legalEntityRepo.findByTenant(tenantUuid),
      this.orgUnitRepo.findByTenant(tenantUuid),
      this.orgUnitRepo.findTree(tenantUuid),
      this.managerRelationshipRepo.findByTenant(tenantUuid),
    ]);

    const relationshipViews = await Promise.all(relationships.map((relationship) => this.toManagerRelationshipDisplay(relationship)));

    return {
      legalEntities: legalEntities.map((entity) => this.projection.toView(entity)),
      orgUnits: orgUnits.map((unit) => this.toOrgUnitView(unit)),
      orgChart: orgTree,
      managerRelationships: relationshipViews,
    };
  }

  @Get('setup-journey')
  async getOrganizationSetupJourney(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const data = await this.collectPlanningData(req);
    const steps = this.buildOrganizationSetupJourney(data);
    return {
      tenantId: data.tenantId.value,
      generatedAt: new Date().toISOString(),
      status: steps.every((step) => step.status === 'READY' || step.status === 'OPTIONAL') ? 'READY' : 'ACTION_REQUIRED',
      steps,
      summary: {
        legalEntities: data.legalEntities.length,
        orgUnits: data.orgUnits.length,
        positions: data.positions.length,
        workers: data.workers.length,
        activeWorkers: data.activeWorkers.length,
        assignedWorkers: data.workers.filter((worker) => worker.legalEntityId || worker.departmentId).length,
        managerRelationships: data.managerRelationships.filter((relationship) => relationship.status === 'ACTIVE').length,
      },
    };
  }

  @Get('hierarchy-tree')
  async getHierarchyTree(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const data = await this.collectPlanningData(req);
    return {
      tenantId: data.tenantId.value,
      generatedAt: new Date().toISOString(),
      tree: this.buildOrganizationHierarchyTree(data),
      reportingEdges: data.managerRelationships
        .filter((relationship) => relationship.status === 'ACTIVE')
        .map((relationship) => ({
          relationshipId: relationship.id.value,
          workerId: relationship.workerId.value,
          workerName: this.workerNameById(relationship.workerId.value, data.workers),
          managerId: relationship.managerId.value,
          managerName: this.workerNameById(relationship.managerId.value, data.workers),
          departmentId: relationship.departmentId?.value ?? null,
          primary: relationship.isPrimary,
        })),
      warnings: this.buildHierarchyWarnings(data),
    };
  }

  // ------------------------------------------------------------------
  // Legal Entities
  // ------------------------------------------------------------------

  @Post('legal-entities')
  async createLegalEntity(@Body() dto: CreateLegalEntityDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateLegalEntity', 'LegalEntity', undefined, {
      legalEntityId: new Uuid(dto.legalEntityId),
      name: dto.name,
      countryCode: dto.countryCode,
      registrationNumber: dto.registrationNumber,
    });
    return this.executeCommand(command);
  }

  @Post('legal-entities/:id/commands/activate')
  async activateLegalEntity(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'ActivateLegalEntity', 'LegalEntity', id, {
      legalEntityId: new Uuid(id),
    });
    return this.executeCommand(command);
  }

  @Post('legal-entities/:id/commands/deactivate')
  async deactivateLegalEntity(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'DeactivateLegalEntity', 'LegalEntity', id, {
      legalEntityId: new Uuid(id),
      reason: 'Deactivated via API',
    });
    return this.executeCommand(command);
  }

  @Patch('legal-entities/:id')
  async updateLegalEntity(@Param('id') id: string, @Body() dto: UpdateLegalEntityDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'UpdateLegalEntity', 'LegalEntity', id, {
      legalEntityId: new Uuid(id),
      name: dto.name,
      registrationNumber: dto.registrationNumber,
    });
    return this.executeCommand(command);
  }

  @Get('legal-entities')
  async listLegalEntities(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    const entities = await this.legalEntityRepo.findByTenant(new Uuid(tenantId));
    return entities.map((e) => this.projection.toView(e));
  }

  @Get('legal-entities/:id')
  async getLegalEntity(@Param('id') id: string) {
    const entity = await this.legalEntityRepo.findById(new Uuid(id));
    if (!entity) throw new NotFoundException('LegalEntity not found');
    return this.projection.toView(entity);
  }

  @Get('legal-entities/:id/allowed-actions')
  async getAllowedActions(@Param('id') id: string) {
    const entity = await this.legalEntityRepo.findById(new Uuid(id));
    if (!entity) throw new NotFoundException('LegalEntity not found');
    return { allowedActions: this.legalEntityFsm.getAllowedActions(entity.status) };
  }

  // ------------------------------------------------------------------
  // Org Units
  // ------------------------------------------------------------------

  @Post('org-units')
  async createOrgUnit(@Body() dto: CreateOrgUnitDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'CreateOrgUnit', 'OrgUnit', undefined, {
      orgUnitId: new Uuid(dto.orgUnitId),
      legalEntityId: new Uuid(dto.legalEntityId),
      name: dto.name,
      parentOrgUnitId: dto.parentOrgUnitId ? new Uuid(dto.parentOrgUnitId) : undefined,
    });
    return this.executeCommand(command);
  }

  @Post('org-units/:id/commands/activate')
  async activateOrgUnit(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'ActivateOrgUnit', 'OrgUnit', id, {
      orgUnitId: new Uuid(id),
    });
    return this.executeCommand(command);
  }

  @Post('org-units/:id/commands/restructure')
  async restructureOrgUnit(@Param('id') id: string, @Body() dto: RestructureOrgUnitDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'RestructureOrgUnit', 'OrgUnit', id, {
      orgUnitId: new Uuid(id),
      newParentOrgUnitId: dto.newParentOrgUnitId === null
        ? null
        : dto.newParentOrgUnitId ? new Uuid(dto.newParentOrgUnitId) : undefined,
      newName: dto.newName,
    });
    return this.executeCommand(command);
  }

  @Patch('org-units/:id')
  async updateOrgUnit(@Param('id') id: string, @Body() dto: UpdateOrgUnitDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'UpdateOrgUnit', 'OrgUnit', id, {
      orgUnitId: new Uuid(id),
      name: dto.name,
      parentOrgUnitId: dto.parentOrgUnitId ? new Uuid(dto.parentOrgUnitId) : undefined,
    });
    return this.executeCommand(command);
  }

  @Get('org-units')
  async listOrgUnits(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    const entities = await this.orgUnitRepo.findByTenant(new Uuid(tenantId));
    return entities.map((e) => this.toOrgUnitView(e));
  }

  @Get('org-units/tree')
  async getOrgUnitTree(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    return this.orgUnitRepo.findTree(new Uuid(tenantId));
  }

  @Get('org-units/:id')
  async getOrgUnit(@Param('id') id: string) {
    const entity = await this.orgUnitRepo.findById(new Uuid(id));
    if (!entity) throw new NotFoundException('OrgUnit not found');
    return this.toOrgUnitView(entity);
  }

  // ------------------------------------------------------------------
  // Manager Relationships
  // ------------------------------------------------------------------

  @Post('manager-relationships')
  async assignManager(@Body() dto: AssignManagerDto, @Req() req: Request) {
    const workerId = new Uuid(dto.workerId);
    const managerId = new Uuid(dto.managerId);
    const departmentId = dto.departmentId ? new Uuid(dto.departmentId) : undefined;
    return this.reconcileManagerRelationship(req, workerId, managerId, departmentId);
  }

  @Post('manager-relationships/:id/commands/end')
  async endManagerRelationship(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'EndManagerRelationship', 'ManagerRelationship', id, {
      relationshipId: new Uuid(id),
    });
    return this.executeCommand(command);
  }

  @Get('manager-relationships/worker/:workerId')
  async getManagerRelationships(@Param('workerId') workerId: string) {
    const entities = await this.managerRelationshipRepo.findByWorker(new Uuid(workerId));
    return entities.map((e) => this.toManagerRelationshipView(e));
  }

  @Get('manager-relationships')
  async listManagerRelationships(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    const entities = await this.managerRelationshipRepo.findByTenant(new Uuid(tenantId));
    return Promise.all(entities.map((entity) => this.toManagerRelationshipDisplay(entity)));
  }

  @Patch('worker-assignments/:workerId')
  async assignWorkerOrganization(
    @Param('workerId') workerId: string,
    @Body() dto: AssignWorkerOrganizationDto,
    @Req() req: Request,
  ) {
    const tenantId = this.requireTenant(req);
    const workerUuid = new Uuid(workerId);
    const worker = await this.workerRepo.findById(workerUuid);
    if (!worker) throw new NotFoundException('Worker not found');
    if (worker.tenantId.value !== tenantId.value) {
      throw new BadRequestException('Worker belongs to a different tenant');
    }

    const departmentId = this.resolveAssignmentUuid(dto, 'departmentId', worker.departmentId);
    const legalEntityId = this.resolveAssignmentUuid(dto, 'legalEntityId', worker.legalEntityId);
    const managerId = this.resolveAssignmentUuid(dto, 'managerId', worker.managerId);
    const managerFieldProvided = this.hasAssignmentField(dto, 'managerId') && dto.managerId !== undefined;
    let managerPlan: ManagerReplacementPlan = {};

    if (managerFieldProvided && managerId) {
      managerPlan = await this.assignReplacementManager(req, worker.id, managerId, departmentId);
    } else if (managerFieldProvided && managerId === undefined) {
      const existing = await this.managerRelationshipRepo.findActiveForWorker(worker.id);
      if (existing) {
        managerPlan = { previousRelationship: existing };
      }
    }

    const payload = this.buildWorkerOrganizationPayload(worker.id, dto);
    const command = this.buildCommand(req, 'UpdateWorkerOrganizationAssignment', 'WorkerProfile', worker.id.value, payload);
    command.subjectWorkerId = worker.id;
    command.expectedVersion = worker.aggregateVersion;

    try {
      await this.executeCommand(command);
    } catch (error) {
      if (managerPlan.assignedRelationshipId) {
        await this.compensateAssignedManager(req, managerPlan.assignedRelationshipId);
      }
      throw error;
    }

    if (managerPlan.previousRelationship) {
      await this.endManagerRelationshipEntity(req, managerPlan.previousRelationship);
    }

    return this.toWorkerAssignmentResult(worker.id, {
      legalEntityId,
      departmentId,
      managerId,
      jobTitle: this.resolveAssignmentText(dto, 'jobTitle', worker.jobTitle),
    });
  }

  @Post('assignments')
  async assignWorkerOrganizationByBody(
    @Body() dto: AssignWorkerOrganizationByBodyDto,
    @Req() req: Request,
  ) {
    const { workerId, ...assignment } = dto;
    return this.assignWorkerOrganization(workerId, assignment, req);
  }

  // ------------------------------------------------------------------
  // Workforce Planning
  // ------------------------------------------------------------------

  @Get('org-chart')
  async getDynamicOrgChart(
    @Req() req: Request,
    @Query('groupBy') groupBy = 'department',
  ) {
    this.assertOrganizationAdminScope(req);
    const data = await this.collectPlanningData(req);
    return {
      groupBy,
      filters: ['department', 'location', 'grade', 'businessUnit', 'manager', 'costCenter', 'legalEntity'],
      nodes: this.buildDynamicOrgChart(data, groupBy),
    };
  }

  @Get('workforce-planning')
  async getWorkforcePlanningDashboard(@Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const data = await this.collectPlanningData(req);
    const totalPositions = data.positions.length;
    const vacancies = data.positions.filter((position) => position.status === 'VACANT' || position.status === 'ACTIVE');
    const filledPositions = data.positions.filter((position) => position.status === 'FILLED');
    const pendingHeadcount = data.headcountRequests
      .filter((request) => request.status === 'SUBMITTED' || request.status === 'UNDER_REVIEW')
      .reduce((sum, request) => sum + request.positionsRequested, 0);
    const approvedHeadcount = data.headcountRequests
      .filter((request) => request.status === 'APPROVED')
      .reduce((sum, request) => sum + (request.positionsApproved ?? request.positionsRequested), 0);
    const annualCost = this.calculateAnnualWorkforceCost(data.profiles);
    const skillsGap = this.buildSkillsGap(data);
    const risks = this.buildStrategicRisks(data, vacancies.length, totalPositions);
    const forecast = this.buildAiForecast(data.activeWorkers.length, vacancies.length, approvedHeadcount, pendingHeadcount);

    return {
      summary: {
        currentHeadcount: data.workers.length,
        activeHeadcount: data.activeWorkers.length,
        legalEntities: data.legalEntities.length,
        departments: data.orgUnits.length,
        totalPositions,
        filledPositions: filledPositions.length,
        vacancies: vacancies.length,
        pendingHeadcount,
        approvedHeadcount,
      },
      orgChart: {
        byDepartment: this.buildDynamicOrgChart(data, 'department'),
        byLegalEntity: this.buildDynamicOrgChart(data, 'legalEntity'),
        byManager: this.buildDynamicOrgChart(data, 'manager'),
      },
      headcountPlan: this.buildHeadcountPlan(data),
      workforceCostPlan: annualCost,
      skillsGap,
      strategicDashboard: risks,
      aiForecast: forecast,
    };
  }

  @Post('workforce-scenarios/simulate')
  async simulateWorkforceScenario(@Body() dto: WorkforceScenarioDto, @Req() req: Request) {
    this.assertOrganizationAdminScope(req);
    const data = await this.collectPlanningData(req);
    const baselineCost = this.calculateAnnualWorkforceCost(data.profiles);
    const baselineHeadcount = data.activeWorkers.length;
    const averageCost = dto.averageCostPerFte ?? (baselineHeadcount > 0
      ? Math.round(baselineCost.totalAnnualCost / baselineHeadcount)
      : 36000);
    const expansionHeadcount = (dto.branchExpansionCount ?? 0) * (dto.rolesPerBranch ?? 0);
    const demandHeadcount = Math.round(baselineHeadcount * ((dto.demandGrowthPercent ?? 0) / 100));
    const adminReduction = Math.round(baselineHeadcount * ((dto.adminReductionPercent ?? 0) / 100));
    const automationReduction = Math.round(baselineHeadcount * ((dto.automationOffsetPercent ?? 0) / 100));
    const outsourceHeadcount = dto.outsourceHeadcount ?? 0;
    const aiAgentCapacity = dto.aiAgentCapacity ?? 0;
    const projectedHeadcount = Math.max(
      0,
      baselineHeadcount + expansionHeadcount + demandHeadcount - adminReduction - automationReduction - outsourceHeadcount - aiAgentCapacity,
    );
    const projectedCost = Math.round(projectedHeadcount * averageCost);

    return {
      name: dto.name ?? 'Scenario',
      baseline: {
        headcount: baselineHeadcount,
        annualCost: baselineCost.totalAnnualCost,
        averageCostPerFte: averageCost,
      },
      drivers: {
        expansionHeadcount,
        demandHeadcount,
        adminReduction,
        automationReduction,
        outsourceHeadcount,
        aiAgentCapacity,
      },
      projected: {
        headcount: projectedHeadcount,
        annualCost: projectedCost,
        headcountDelta: projectedHeadcount - baselineHeadcount,
        costDelta: projectedCost - baselineCost.totalAnnualCost,
      },
      recommendation: this.recommendScenarioAction(projectedHeadcount, baselineHeadcount, data.positions),
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private async collectPlanningData(req: Request): Promise<PlanningData> {
    const tenantId = this.requireTenant(req);
    const [legalEntityAggregates, orgUnitAggregates, workers, positions, headcountRequests, managerRelationships] = await Promise.all([
      this.legalEntityRepo.findByTenant(tenantId),
      this.orgUnitRepo.findByTenant(tenantId),
      this.workerRepo.searchForTenant('', tenantId, { limit: 5000 }),
      this.positionRepo.findAll(tenantId),
      this.headcountRepo.findAll(tenantId),
      this.managerRelationshipRepo.findByTenant(tenantId),
    ]);
    const profiles = await Promise.all(workers.map(async (worker) => {
      const records = await this.personalDataRepo.findByWorkerForTenant(worker.id, tenantId);
      return { worker, records: this.recordsByCategory(records) };
    }));

    return {
      tenantId,
      legalEntities: legalEntityAggregates.map((entity) => this.projection.toView(entity) as PlanningLegalEntity),
      orgUnits: orgUnitAggregates.map((unit) => this.toOrgUnitView(unit)),
      workers,
      activeWorkers: workers.filter((worker) => worker.status === 'ACTIVE' || worker.status === 'REHIRED'),
      profiles,
      positions,
      headcountRequests,
      managerRelationships,
    };
  }

  private recordsByCategory(records: PersonalDataRecord[]): Map<string, Record<string, unknown>> {
    return new Map(records.map((record) => [record.dataCategory, (record.payload ?? {}) as Record<string, unknown>]));
  }

  private buildOrganizationSetupJourney(data: PlanningData): OrganizationSetupStep[] {
    const assignedWorkers = data.workers.filter((worker) => worker.legalEntityId || worker.departmentId).length;
    const activeManagerRelationships = data.managerRelationships.filter((relationship) => relationship.status === 'ACTIVE').length;
    const hasLegalEntity = data.legalEntities.length > 0;
    const hasOrgUnits = data.orgUnits.length > 0;
    const hasWorkers = data.workers.length > 0;
    const hasAssignments = assignedWorkers > 0;
    const hasManagers = activeManagerRelationships > 0;

    return [
      this.setupStep('company-profile', 'Company profile', 'Foundation', true, 1, '/admin/system-console/settings', [], 'Review tenant and company profile'),
      this.setupStep('legal-entities', 'Legal entities', 'Foundation', hasLegalEntity, data.legalEntities.length, '/admin/organization?tab=entities', [], 'Create the first legal entity'),
      this.setupStep('org-units', 'Departments and org units', 'Structure', hasOrgUnits, data.orgUnits.length, '/admin/organization?tab=departments', hasLegalEntity ? [] : ['Create legal entity first'], 'Create departments or org units'),
      this.setupStep('positions', 'Positions and headcount', 'Structure', data.positions.length > 0, data.positions.length, '/admin/organization?tab=planning', hasOrgUnits ? [] : ['Create departments first'], 'Create approved positions'),
      this.setupStep('employees', 'Employee records', 'People', hasWorkers, data.workers.length, '/admin/employees/new', hasOrgUnits ? [] : ['Create departments first'], 'Create employee records'),
      this.setupStep('assignments', 'Worker assignments', 'People', hasAssignments, assignedWorkers, '/admin/organization?tab=assignments', hasWorkers ? [] : ['Create employees first'], 'Assign entity, department, and job title'),
      this.setupStep('manager-hierarchy', 'Manager hierarchy', 'Reporting', hasManagers, activeManagerRelationships, '/admin/organization?tab=managers', hasAssignments ? [] : ['Assign workers first'], 'Assign manager reporting lines'),
    ];
  }

  private setupStep(
    code: string,
    label: string,
    category: string,
    completed: boolean,
    count: number,
    target: string,
    blockers: string[],
    nextAction: string,
  ): OrganizationSetupStep {
    const blocked = blockers.length > 0 && !completed;
    return {
      code,
      label,
      category,
      status: completed ? 'READY' : blocked ? 'BLOCKED' : code === 'positions' ? 'OPTIONAL' : 'ACTION_REQUIRED',
      count,
      completed,
      target,
      blockers,
      nextAction: completed ? 'Review' : nextAction,
    };
  }

  private buildOrganizationHierarchyTree(data: PlanningData): Array<Record<string, unknown>> {
    const roots = data.legalEntities.map((entity) => ({
      id: entity.id,
      type: 'LEGAL_ENTITY',
      name: entity.name,
      countryCode: entity.countryCode ?? null,
      status: entity.status ?? 'UNKNOWN',
      children: this.buildOrgUnitNodes(data, entity.id, null),
      positions: data.positions
        .filter((position) => position.legalEntityId?.value === entity.id && !position.departmentId)
        .map((position) => this.positionNode(position)),
      workers: data.workers
        .filter((worker) => worker.legalEntityId?.value === entity.id && !worker.departmentId)
        .map((worker) => this.workerNode(worker, data)),
    }));
    const unassignedWorkers = data.workers.filter((worker) => !worker.legalEntityId && !worker.departmentId);
    if (unassignedWorkers.length > 0) {
      roots.push({
        id: 'unassigned',
        type: 'LEGAL_ENTITY',
        name: 'Unassigned',
        countryCode: null,
        status: 'ACTION_REQUIRED',
        children: [],
        positions: [],
        workers: unassignedWorkers.map((worker) => this.workerNode(worker, data)),
      });
    }
    return roots;
  }

  private buildOrgUnitNodes(data: PlanningData, legalEntityId: string, parentId: string | null): Array<Record<string, unknown>> {
    return data.orgUnits
      .filter((unit) => unit.legalEntityId === legalEntityId && (unit.parentId ?? null) === parentId)
      .map((unit) => ({
        id: unit.id,
        type: 'ORG_UNIT',
        name: unit.name,
        status: unit.status ?? 'UNKNOWN',
        parentId: unit.parentId ?? null,
        positions: data.positions
          .filter((position) => position.departmentId?.value === unit.id)
          .map((position) => this.positionNode(position)),
        workers: data.workers
          .filter((worker) => worker.departmentId?.value === unit.id)
          .map((worker) => this.workerNode(worker, data)),
        children: this.buildOrgUnitNodes(data, legalEntityId, unit.id),
      }));
  }

  private positionNode(position: Position) {
    return {
      id: position.id.value,
      type: 'POSITION',
      code: position.positionCode,
      title: position.title,
      status: position.status,
      filledByWorkerId: position.filledByWorkerId?.value ?? null,
    };
  }

  private workerNode(worker: WorkerProfile, data: PlanningData) {
    return {
      id: worker.id.value,
      type: 'WORKER',
      employeeNumber: worker.employeeNumber,
      name: this.workerDisplayName(worker),
      jobTitle: worker.jobTitle ?? null,
      status: worker.status,
      managerId: worker.managerId?.value ?? null,
      managerName: worker.managerId ? this.workerNameById(worker.managerId.value, data.workers) : null,
    };
  }

  private buildHierarchyWarnings(data: PlanningData) {
    const workerIds = new Set(data.workers.map((worker) => worker.id.value));
    const activeWorkerIds = new Set(data.workers.filter((worker) => worker.status === 'ACTIVE' || worker.status === 'REHIRED').map((worker) => worker.id.value));
    const warnings: Array<{ type: string; severity: 'INFO' | 'WARNING' | 'BLOCKER'; message: string; workerId?: string; relationshipId?: string }> = [];
    for (const worker of data.workers) {
      if (!worker.legalEntityId) warnings.push({ type: 'MISSING_LEGAL_ENTITY', severity: 'WARNING', workerId: worker.id.value, message: `${this.workerDisplayName(worker)} is not assigned to a legal entity.` });
      if (!worker.departmentId) warnings.push({ type: 'MISSING_DEPARTMENT', severity: 'WARNING', workerId: worker.id.value, message: `${this.workerDisplayName(worker)} is not assigned to a department.` });
      if ((worker.status === 'ACTIVE' || worker.status === 'REHIRED') && !worker.managerId) warnings.push({ type: 'MISSING_MANAGER', severity: 'INFO', workerId: worker.id.value, message: `${this.workerDisplayName(worker)} has no manager assigned.` });
      if (worker.managerId && !activeWorkerIds.has(worker.managerId.value)) warnings.push({ type: 'INACTIVE_OR_MISSING_MANAGER', severity: 'BLOCKER', workerId: worker.id.value, message: `${this.workerDisplayName(worker)} reports to a missing or inactive manager.` });
    }
    for (const relationship of data.managerRelationships.filter((item) => item.status === 'ACTIVE')) {
      if (!workerIds.has(relationship.workerId.value) || !workerIds.has(relationship.managerId.value)) {
        warnings.push({ type: 'ORPHAN_MANAGER_RELATIONSHIP', severity: 'BLOCKER', relationshipId: relationship.id.value, message: 'A manager relationship references a worker outside the tenant hierarchy.' });
      }
      if (relationship.workerId.value === relationship.managerId.value) {
        warnings.push({ type: 'SELF_MANAGER_RELATIONSHIP', severity: 'BLOCKER', relationshipId: relationship.id.value, message: 'A worker cannot report to themselves.' });
      }
    }
    return warnings;
  }

  private buildDynamicOrgChart(data: PlanningData, groupBy: string) {
    const groups = new Map<string, {
      id: string;
      name: string;
      headcount: number;
      positionCount: number;
      vacancies: number;
      annualCost: number;
      employees: Array<{ id: string; name: string; jobTitle?: string; status: string }>;
    }>();

    const ensureGroup = (id: string, name: string) => {
      const existing = groups.get(id);
      if (existing) return existing;
      const created = { id, name, headcount: 0, positionCount: 0, vacancies: 0, annualCost: 0, employees: [] };
      groups.set(id, created);
      return created;
    };

    for (const profile of data.profiles) {
      const key = this.resolveGroupKey(profile, data, groupBy);
      const group = ensureGroup(key.id, key.name);
      group.headcount += profile.worker.status === 'ACTIVE' || profile.worker.status === 'REHIRED' ? 1 : 0;
      group.annualCost += this.annualCompensation(profile.records.get('COMPENSATION'));
      group.employees.push({
        id: profile.worker.id.value,
        name: this.workerDisplayName(profile.worker),
        jobTitle: profile.worker.jobTitle,
        status: profile.worker.status,
      });
    }

    for (const position of data.positions) {
      const id = this.positionGroupId(position, groupBy);
      const name = this.groupNameFromId(id, data, groupBy);
      const group = ensureGroup(id, name);
      group.positionCount += 1;
      if (position.status === 'VACANT' || position.status === 'ACTIVE') {
        group.vacancies += 1;
      }
    }

    return [...groups.values()].sort((left, right) => right.headcount - left.headcount || left.name.localeCompare(right.name));
  }

  private buildHeadcountPlan(data: PlanningData) {
    const departmentGroups = this.buildDynamicOrgChart(data, 'department');
    const requestsByDepartment = new Map<string, { requested: number; approved: number; pending: number }>();
    for (const request of data.headcountRequests) {
      const key = request.departmentId?.value ?? 'unassigned';
      const entry = requestsByDepartment.get(key) ?? { requested: 0, approved: 0, pending: 0 };
      entry.requested += request.positionsRequested;
      if (request.status === 'APPROVED') {
        entry.approved += request.positionsApproved ?? request.positionsRequested;
      }
      if (request.status === 'SUBMITTED' || request.status === 'UNDER_REVIEW') {
        entry.pending += request.positionsRequested;
      }
      requestsByDepartment.set(key, entry);
    }

    return departmentGroups.map((group) => {
      const request = requestsByDepartment.get(group.id) ?? { requested: 0, approved: 0, pending: 0 };
      return {
        departmentId: group.id,
        departmentName: group.name,
        currentHeadcount: group.headcount,
        approvedPositions: group.positionCount,
        vacancies: group.vacancies,
        pendingRequests: request.pending,
        approvedRequests: request.approved,
        forecastDemand: Math.max(group.positionCount, group.headcount + request.pending + group.vacancies),
      };
    });
  }

  private calculateAnnualWorkforceCost(profiles: PlanningProfile[]) {
    const salary = profiles.reduce((sum, profile) => sum + this.annualCompensation(profile.records.get('COMPENSATION')), 0);
    const benefits = Math.round(salary * 0.12);
    const socialInsuranceAndTax = Math.round(salary * 0.18);
    const overtime = Math.round(salary * 0.05);
    const allowancesTravelRelocation = Math.round(salary * 0.03);
    const training = Math.round(salary * 0.02);

    return {
      salary,
      benefits,
      socialInsuranceAndTax,
      overtime,
      allowancesTravelRelocation,
      training,
      contractorCost: Math.round(this.countContractors(profiles) * (salary / Math.max(1, profiles.length)) * 0.8),
      totalAnnualCost: salary + benefits + socialInsuranceAndTax + overtime + allowancesTravelRelocation + training,
    };
  }

  private buildSkillsGap(data: PlanningData) {
    const currentSkills = new Map<string, number>();
    for (const profile of data.profiles) {
      const skillsPayload = profile.records.get('SKILLS') ?? {};
      for (const skill of this.payloadArray(skillsPayload.skills)) {
        const name = this.readString(skill, 'name');
        if (name) currentSkills.set(name, (currentSkills.get(name) ?? 0) + 1);
      }
      for (const license of this.payloadArray(skillsPayload.licenses)) {
        const name = this.readString(license, 'name');
        if (name) currentSkills.set(name, (currentSkills.get(name) ?? 0) + 1);
      }
    }

    const futureNeeds = new Map<string, number>();
    for (const position of data.positions) {
      const need = position.jobFamily ?? position.title;
      futureNeeds.set(need, (futureNeeds.get(need) ?? 0) + 1);
    }
    if (futureNeeds.size === 0) {
      ['People Leadership', 'Compliance', 'Data Analysis', 'Digital Operations'].forEach((skill) => futureNeeds.set(skill, 1));
    }

    return [...futureNeeds.entries()].map(([skill, required]) => {
      const available = currentSkills.get(skill) ?? 0;
      return {
        skill,
        required,
        available,
        gap: Math.max(0, required - available),
        severity: required - available >= 3 ? 'HIGH' : required > available ? 'MEDIUM' : 'LOW',
      };
    }).sort((left, right) => right.gap - left.gap || left.skill.localeCompare(right.skill));
  }

  private buildStrategicRisks(data: PlanningData, vacancies: number, totalPositions: number) {
    const retirementRisk = data.profiles.filter((profile) => this.ageFromProfile(profile) >= 58).length;
    const terminatedByDepartment = new Map<string, number>();
    for (const worker of data.workers.filter((item) => item.status === 'TERMINATED')) {
      const key = worker.departmentId?.value ?? 'unassigned';
      terminatedByDepartment.set(key, (terminatedByDepartment.get(key) ?? 0) + 1);
    }
    const activeRelationships = data.managerRelationships.filter((relationship) => relationship.status === 'ACTIVE');
    const managers = new Set(activeRelationships.map((relationship) => relationship.managerId.value));
    const successionGaps = [...managers].filter((managerId) => {
      const directReports = activeRelationships.filter((relationship) => relationship.managerId.value === managerId).length;
      return directReports < 2;
    }).length;

    return {
      vacancyRiskPercent: totalPositions > 0 ? Math.round((vacancies / totalPositions) * 100) : 0,
      retirementRisk,
      successionGaps,
      criticalRolesWithoutBackup: data.positions.filter((position) => position.status === 'VACANT' && /lead|manager|director|chief|head/i.test(position.title)).length,
      attritionHotspots: [...terminatedByDepartment.entries()].map(([departmentId, terminations]) => ({
        departmentId,
        departmentName: this.groupNameFromId(departmentId, data, 'department'),
        terminations,
      })),
      genderBalance: this.genderBalance(data.profiles),
      productivityPerEmployee: data.activeWorkers.length > 0 ? Math.round((totalPositions + data.headcountRequests.length) / data.activeWorkers.length * 100) / 100 : 0,
    };
  }

  private buildAiForecast(currentHeadcount: number, vacancies: number, approvedHeadcount: number, pendingHeadcount: number) {
    const baseDemand = currentHeadcount + vacancies + approvedHeadcount + Math.round(pendingHeadcount * 0.5);
    return [12, 24, 36].map((months) => {
      const growth = 1 + (0.06 * (months / 12));
      const automationOffset = 0.02 * (months / 12);
      const forecastDemand = Math.max(0, Math.round(baseDemand * growth - currentHeadcount * automationOffset));
      return {
        horizonMonths: months,
        forecastHeadcountDemand: forecastDemand,
        deltaFromToday: forecastDemand - currentHeadcount,
        confidence: months === 12 ? 'HIGH' : months === 24 ? 'MEDIUM' : 'LOW',
        drivers: ['current vacancies', 'approved headcount', 'pending demand', 'growth trend', 'automation offset'],
      };
    });
  }

  private recommendScenarioAction(projectedHeadcount: number, baselineHeadcount: number, positions: Position[]): string {
    const vacancies = positions.filter((position) => position.status === 'VACANT' || position.status === 'ACTIVE').length;
    if (projectedHeadcount > baselineHeadcount + vacancies) {
      return 'Open headcount requests before the scenario starts; projected demand exceeds available vacancies.';
    }
    if (projectedHeadcount < baselineHeadcount) {
      return 'Review redeployment, outsourcing, and automation impact with HR, Finance, and Legal before execution.';
    }
    return 'Scenario fits within current workforce capacity if vacancies are actively managed.';
  }

  private resolveGroupKey(profile: PlanningProfile, data: PlanningData, groupBy: string): { id: string; name: string } {
    const worker = profile.worker;
    const basic = profile.records.get('BASIC') ?? {};
    const contact = profile.records.get('CONTACT') ?? {};
    const custom = profile.records.get('CUSTOM') ?? {};
    switch (groupBy) {
      case 'legalEntity':
        return { id: worker.legalEntityId?.value ?? 'unassigned', name: this.groupNameFromId(worker.legalEntityId?.value ?? 'unassigned', data, 'legalEntity') };
      case 'manager':
        return { id: worker.managerId?.value ?? 'unassigned', name: worker.managerId ? this.workerNameById(worker.managerId.value, data.workers) : 'No manager' };
      case 'location':
        return { id: this.readNestedName(contact.workLocation) ?? 'unassigned', name: this.readNestedName(contact.workLocation) ?? 'No location' };
      case 'grade':
        return { id: this.stringFromRecord(custom, ['grade', 'jobGrade', 'level']) ?? 'unassigned', name: this.stringFromRecord(custom, ['grade', 'jobGrade', 'level']) ?? 'No grade' };
      case 'businessUnit':
        return { id: this.stringFromRecord(custom, ['businessUnit', 'business_unit']) ?? 'unassigned', name: this.stringFromRecord(custom, ['businessUnit', 'business_unit']) ?? 'No business unit' };
      case 'costCenter':
        return { id: this.stringFromRecord(custom, ['costCenter', 'cost_center']) ?? 'unassigned', name: this.stringFromRecord(custom, ['costCenter', 'cost_center']) ?? 'No cost center' };
      case 'department':
      default:
        return { id: worker.departmentId?.value ?? 'unassigned', name: this.groupNameFromId(worker.departmentId?.value ?? 'unassigned', data, 'department') || this.stringFromRecord(basic, ['departmentName']) || 'No department' };
    }
  }

  private positionGroupId(position: Position, groupBy: string): string {
    if (groupBy === 'legalEntity') return position.legalEntityId?.value ?? 'unassigned';
    if (groupBy === 'grade') return position.jobLevel ?? 'unassigned';
    if (groupBy === 'businessUnit') return position.jobFamily ?? 'unassigned';
    return position.departmentId?.value ?? 'unassigned';
  }

  private groupNameFromId(id: string, data: PlanningData, groupBy: string): string {
    if (id === 'unassigned') return 'Unassigned';
    if (groupBy === 'legalEntity') return data.legalEntities.find((entity) => entity.id === id)?.name ?? id;
    if (groupBy === 'department') return data.orgUnits.find((unit) => unit.id === id)?.name ?? id;
    return id;
  }

  private annualCompensation(payload: Record<string, unknown> | undefined): number {
    if (!payload) return 0;
    const gross = Number(payload.grossSalaryAmount ?? payload.salaryAmount ?? payload.netSalaryAmount ?? 0);
    return Number.isFinite(gross) ? Math.max(0, Math.round(gross)) : 0;
  }

  private countContractors(profiles: PlanningProfile[]): number {
    return profiles.filter((profile) => ['CONTRACTOR', 'CONSULTANT'].includes(profile.worker.employmentType)).length;
  }

  private ageFromProfile(profile: PlanningProfile): number {
    const dateOfBirth = profile.records.get('BASIC')?.dateOfBirth;
    if (typeof dateOfBirth !== 'string') return 0;
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) return 0;
    return Math.floor((Date.now() - birth.getTime()) / 31_557_600_000);
  }

  private genderBalance(profiles: PlanningProfile[]) {
    const counts = new Map<string, number>();
    for (const profile of profiles) {
      const gender = typeof profile.records.get('BASIC')?.gender === 'string'
        ? String(profile.records.get('BASIC')?.gender)
        : 'UNSPECIFIED';
      counts.set(gender, (counts.get(gender) ?? 0) + 1);
    }
    return [...counts.entries()].map(([gender, count]) => ({ gender, count }));
  }

  private payloadArray(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
  }

  private readString(value: Record<string, unknown>, key: string): string | undefined {
    const raw = value[key];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  }

  private stringFromRecord(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.readString(record, key);
      if (value) return value;
    }
    return undefined;
  }

  private readNestedName(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      return this.stringFromRecord(record, ['name', 'city', 'location', 'label']);
    }
    return undefined;
  }

  private workerNameById(workerId: string, workers: WorkerProfile[]): string {
    const worker = workers.find((candidate) => candidate.id.value === workerId);
    return worker ? this.workerDisplayName(worker) : workerId;
  }

  private workerDisplayName(worker: WorkerProfile): string {
    return `${worker.firstName} ${worker.lastName}`.trim() || worker.employeeNumber;
  }

  private buildCommand<TPayload>(
    req: Request,
    commandName: string,
    aggregateType: string,
    aggregateId: string | undefined,
    payload: TPayload,
  ): HrCommandEnvelope<TPayload> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID missing');
    }
    const actor = req.actor;
    if (!actor) {
      throw new UnauthorizedException('Actor missing');
    }
    this.assertOrganizationAdminScope(req);
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId: new Uuid(tenantId),
      actor,
      aggregateType,
      aggregateId: aggregateId ? new Uuid(aggregateId) : undefined,
      idempotencyKey: crypto.randomUUID(),
      correlationId: Uuid.generate(),
      reason: `${commandName} via API`,
      payload,
      metadata: {
        requestHash: computeRequestHash(payload),
        clientType: 'HR_ADMIN',
      },
    };
  }

  private async executeCommand<T>(command: HrCommandEnvelope<T>) {
    const result = await this.commandBus.execute(command) as CommandResult<unknown> | {
      success: false;
      errorCode?: string;
      errorMessage?: string;
    };
    if (result.success === false) {
      throw new BadRequestException(result.errorMessage ?? result.errorCode ?? 'Organization command failed');
    }
    return result;
  }

  private requireTenant(req: Request): Uuid {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID missing');
    }
    return new Uuid(tenantId);
  }

  private assertOrganizationAdminScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => ORGANIZATION_ADMIN_ROLES.has(role))) return;
    throw new ForbiddenException('Only HR, workforce planning, finance, or executive administrators can access organization administration');
  }

  private async reconcileManagerRelationship(
    req: Request,
    workerId: Uuid,
    managerId: Uuid,
    departmentId?: Uuid,
  ) {
    const plan = await this.assignReplacementManager(req, workerId, managerId, departmentId);
    if (plan.previousRelationship) {
      await this.endManagerRelationshipEntity(req, plan.previousRelationship);
    }
    return plan.commandResult;
  }

  private async assignReplacementManager(
    req: Request,
    workerId: Uuid,
    managerId: Uuid,
    departmentId?: Uuid,
  ): Promise<ManagerReplacementPlan> {
    const existing = await this.managerRelationshipRepo.findActiveForWorker(workerId);
    if (existing && this.managerRelationshipMatches(existing, managerId, departmentId)) {
      return {
        commandResult: {
          success: true,
          data: {
            id: existing.id.value,
            workerId: existing.workerId.value,
            managerId: existing.managerId.value,
            status: existing.status,
          },
        },
      };
    }
    const assignCommand = this.buildCommand(req, 'AssignManager', 'ManagerRelationship', undefined, {
      workerId,
      managerId,
      departmentId,
    });
    assignCommand.subjectWorkerId = workerId;
    const commandResult = await this.executeCommand(assignCommand);
    const resultData = commandResult.data as { id?: string } | undefined;
    return {
      commandResult,
      previousRelationship: existing,
      assignedRelationshipId: resultData?.id ? new Uuid(resultData.id) : undefined,
    };
  }

  private async endManagerRelationshipEntity(req: Request, relationship: ManagerRelationship) {
    const endCommand = this.buildCommand(req, 'EndManagerRelationship', 'ManagerRelationship', relationship.id.value, {
      relationshipId: relationship.id,
    });
    endCommand.subjectWorkerId = relationship.workerId;
    return this.executeCommand(endCommand);
  }

  private async compensateAssignedManager(req: Request, relationshipId: Uuid): Promise<void> {
    try {
      const endCommand = this.buildCommand(req, 'EndManagerRelationship', 'ManagerRelationship', relationshipId.value, {
        relationshipId,
        endDate: new Date(),
      });
      await this.executeCommand(endCommand);
    } catch (error) {
      console.error(`Failed to compensate manager assignment ${relationshipId.value}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private managerRelationshipMatches(existing: ManagerRelationship, managerId: Uuid, departmentId?: Uuid) {
    return existing.managerId.value === managerId.value
      && (existing.departmentId?.value ?? null) === (departmentId?.value ?? null);
  }

  private hasAssignmentField(dto: AssignWorkerOrganizationDto, field: keyof AssignWorkerOrganizationDto): boolean {
    return Object.prototype.hasOwnProperty.call(dto, field);
  }

  private resolveAssignmentUuid(
    dto: AssignWorkerOrganizationDto,
    field: 'legalEntityId' | 'departmentId' | 'managerId',
    current?: Uuid,
  ): Uuid | undefined {
    if (!this.hasAssignmentField(dto, field) || dto[field] === undefined) {
      return current;
    }
    return dto[field] === null || dto[field] === '' ? undefined : new Uuid(dto[field]);
  }

  private resolveAssignmentText(
    dto: AssignWorkerOrganizationDto,
    field: 'jobTitle',
    current?: string,
  ): string | undefined {
    if (!this.hasAssignmentField(dto, field) || dto[field] === undefined) {
      return current;
    }
    return dto[field] === null || dto[field] === '' ? undefined : dto[field];
  }

  private buildWorkerOrganizationPayload(workerId: Uuid, dto: AssignWorkerOrganizationDto) {
    const payload: {
      workerId: Uuid;
      legalEntityId?: Uuid | null;
      departmentId?: Uuid | null;
      managerId?: Uuid | null;
      jobTitle?: string | null;
    } = { workerId };
    if (this.hasAssignmentField(dto, 'legalEntityId') && dto.legalEntityId !== undefined) {
      payload.legalEntityId = dto.legalEntityId === null || dto.legalEntityId === '' ? null : new Uuid(dto.legalEntityId);
    }
    if (this.hasAssignmentField(dto, 'departmentId') && dto.departmentId !== undefined) {
      payload.departmentId = dto.departmentId === null || dto.departmentId === '' ? null : new Uuid(dto.departmentId);
    }
    if (this.hasAssignmentField(dto, 'managerId') && dto.managerId !== undefined) {
      payload.managerId = dto.managerId === null || dto.managerId === '' ? null : new Uuid(dto.managerId);
    }
    if (this.hasAssignmentField(dto, 'jobTitle') && dto.jobTitle !== undefined) {
      payload.jobTitle = dto.jobTitle === null || dto.jobTitle === '' ? null : dto.jobTitle;
    }
    return payload;
  }

  private toWorkerAssignmentResult(
    workerId: Uuid,
    assignment: { legalEntityId?: Uuid; departmentId?: Uuid; managerId?: Uuid; jobTitle?: string },
  ): WorkerOrganizationAssignmentResult {
    return {
      workerId: workerId.value,
      legalEntityId: assignment.legalEntityId?.value ?? null,
      departmentId: assignment.departmentId?.value ?? null,
      managerId: assignment.managerId?.value ?? null,
      jobTitle: assignment.jobTitle ?? null,
    };
  }

  private toOrgUnitView(entity: OrgUnit) {
    return {
      id: entity.id.value,
      tenantId: entity.tenantId.value,
      name: entity.name,
      code: entity.code,
      parentId: entity.parentId?.value ?? null,
      legalEntityId: entity.legalEntityId?.value ?? null,
      level: entity.level,
      path: entity.path,
      status: entity.status,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toManagerRelationshipView(entity: ManagerRelationship) {
    return {
      id: entity.id.value,
      tenantId: entity.tenantId.value,
      workerId: entity.workerId.value,
      managerId: entity.managerId.value,
      departmentId: entity.departmentId?.value ?? null,
      isPrimary: entity.isPrimary,
      startDate: entity.startDate.toISOString(),
      endDate: entity.endDate?.toISOString() ?? null,
      status: entity.status,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private async toManagerRelationshipDisplay(entity: ManagerRelationship) {
    const [worker, manager] = await Promise.all([
      this.workerRepo.findById(entity.workerId),
      this.workerRepo.findById(entity.managerId),
    ]);
    return {
      ...this.toManagerRelationshipView(entity),
      workerName: worker ? `${worker.firstName} ${worker.lastName}` : entity.workerId.value,
      managerName: manager ? `${manager.firstName} ${manager.lastName}` : entity.managerId.value,
    };
  }
}
