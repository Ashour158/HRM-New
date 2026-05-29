import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { LegalEntityRepository } from '../repositories/legal-entity.repository.js';
import { OrgUnitRepository } from '../repositories/org-unit.repository.js';
import { ManagerRelationshipRepository } from '../repositories/manager-relationship.repository.js';
import { LegalEntityFsm } from '../fsm/legal-entity.fsm.js';
import { LegalEntityProjection } from '../projections/legal-entity.projection.js';
import type { OrgUnit } from '../aggregates/org-unit.aggregate.js';
import type { ManagerRelationship } from '../aggregates/manager-relationship.aggregate.js';
import {
  CreateLegalEntityDto,
  UpdateLegalEntityDto,
  CreateOrgUnitDto,
  UpdateOrgUnitDto,
  RestructureOrgUnitDto,
  AssignManagerDto,
} from './dtos.js';

@ApiTags('Organization')
@Controller('hr/organization')
export class OrganizationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly legalEntityRepo: LegalEntityRepository,
    private readonly orgUnitRepo: OrgUnitRepository,
    private readonly managerRelationshipRepo: ManagerRelationshipRepository,
    private readonly legalEntityFsm: LegalEntityFsm,
    private readonly projection: LegalEntityProjection,
  ) {}

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
    return this.commandBus.execute(command);
  }

  @Post('legal-entities/:id/commands/activate')
  async activateLegalEntity(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'ActivateLegalEntity', 'LegalEntity', id, {
      legalEntityId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Post('legal-entities/:id/commands/deactivate')
  async deactivateLegalEntity(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'DeactivateLegalEntity', 'LegalEntity', id, {
      legalEntityId: new Uuid(id),
      reason: 'Deactivated via API',
    });
    return this.commandBus.execute(command);
  }

  @Patch('legal-entities/:id')
  async updateLegalEntity(@Param('id') id: string, @Body() dto: UpdateLegalEntityDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'UpdateLegalEntity', 'LegalEntity', id, {
      legalEntityId: new Uuid(id),
      name: dto.name,
      registrationNumber: dto.registrationNumber,
    });
    return this.commandBus.execute(command);
  }

  @Get('legal-entities')
  async listLegalEntities(@Req() req: Request) {
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
    return this.commandBus.execute(command);
  }

  @Post('org-units/:id/commands/activate')
  async activateOrgUnit(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'ActivateOrgUnit', 'OrgUnit', id, {
      orgUnitId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Post('org-units/:id/commands/restructure')
  async restructureOrgUnit(@Param('id') id: string, @Body() dto: RestructureOrgUnitDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'RestructureOrgUnit', 'OrgUnit', id, {
      orgUnitId: new Uuid(id),
      newParentOrgUnitId: dto.newParentOrgUnitId ? new Uuid(dto.newParentOrgUnitId) : undefined,
      newName: dto.newName,
    });
    return this.commandBus.execute(command);
  }

  @Patch('org-units/:id')
  async updateOrgUnit(@Param('id') id: string, @Body() dto: UpdateOrgUnitDto, @Req() req: Request) {
    const command = this.buildCommand(req, 'UpdateOrgUnit', 'OrgUnit', id, {
      orgUnitId: new Uuid(id),
      name: dto.name,
      parentOrgUnitId: dto.parentOrgUnitId ? new Uuid(dto.parentOrgUnitId) : undefined,
    });
    return this.commandBus.execute(command);
  }

  @Get('org-units')
  async listOrgUnits(@Req() req: Request) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant ID missing');
    const entities = await this.orgUnitRepo.findByTenant(new Uuid(tenantId));
    return entities.map((e) => this.toOrgUnitView(e));
  }

  @Get('org-units/tree')
  async getOrgUnitTree(@Req() req: Request) {
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
    const command = this.buildCommand(req, 'AssignManager', 'ManagerRelationship', undefined, {
      workerId: new Uuid(dto.workerId),
      managerId: new Uuid(dto.managerId),
      departmentId: dto.departmentId ? new Uuid(dto.departmentId) : undefined,
    });
    return this.commandBus.execute(command);
  }

  @Post('manager-relationships/:id/commands/end')
  async endManagerRelationship(@Param('id') id: string, @Req() req: Request) {
    const command = this.buildCommand(req, 'EndManagerRelationship', 'ManagerRelationship', id, {
      relationshipId: new Uuid(id),
    });
    return this.commandBus.execute(command);
  }

  @Get('manager-relationships/worker/:workerId')
  async getManagerRelationships(@Param('workerId') workerId: string) {
    const entities = await this.managerRelationshipRepo.findByWorker(new Uuid(workerId));
    return entities.map((e) => this.toManagerRelationshipView(e));
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

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
}
