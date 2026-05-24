import { Module, OnModuleInit } from '@nestjs/common';
import { OrganizationController } from './api/organization.controller.js';
import { LegalEntityRepository } from './repositories/legal-entity.repository.js';
import { OrgUnitRepository } from './repositories/org-unit.repository.js';
import { ManagerRelationshipRepository } from './repositories/manager-relationship.repository.js';
import { LegalEntityEventsPublisher } from './events/legal-entity-events.publisher.js';
import { LegalEntityFsm } from './fsm/legal-entity.fsm.js';
import { OrgUnitFsm } from './fsm/org-unit.fsm.js';
import { LegalEntityProjection } from './projections/legal-entity.projection.js';
import { CreateLegalEntityHandler } from './commands/create-legal-entity.handler.js';
import { ActivateLegalEntityHandler } from './commands/activate-legal-entity.handler.js';
import { DeactivateLegalEntityHandler } from './commands/deactivate-legal-entity.handler.js';
import { UpdateLegalEntityHandler } from './commands/update-legal-entity.handler.js';
import { CreateOrgUnitHandler } from './commands/create-org-unit.handler.js';
import { ActivateOrgUnitHandler } from './commands/activate-org-unit.handler.js';
import { RestructureOrgUnitHandler } from './commands/restructure-org-unit.handler.js';
import { UpdateOrgUnitHandler } from './commands/update-org-unit.handler.js';
import { AssignManagerHandler } from './commands/assign-manager.handler.js';
import { EndManagerRelationshipHandler } from './commands/end-manager-relationship.handler.js';

/**
 * Organization Management domain module.
 *
 * Owns LegalEntity, OrgUnit, and ManagerRelationship aggregates.
 */
@Module({
  controllers: [OrganizationController],
  providers: [
    LegalEntityRepository,
    OrgUnitRepository,
    ManagerRelationshipRepository,
    LegalEntityEventsPublisher,
    LegalEntityFsm,
    OrgUnitFsm,
    LegalEntityProjection,
    CreateLegalEntityHandler,
    ActivateLegalEntityHandler,
    DeactivateLegalEntityHandler,
    UpdateLegalEntityHandler,
    CreateOrgUnitHandler,
    ActivateOrgUnitHandler,
    RestructureOrgUnitHandler,
    UpdateOrgUnitHandler,
    AssignManagerHandler,
    EndManagerRelationshipHandler,
  ],
  exports: [
    LegalEntityRepository,
    OrgUnitRepository,
    ManagerRelationshipRepository,
    LegalEntityFsm,
    OrgUnitFsm,
  ],
})
export class OrganizationModule implements OnModuleInit {
  constructor(
    private readonly legalEntityFsm: LegalEntityFsm,
    private readonly orgUnitFsm: OrgUnitFsm,
  ) {}

  onModuleInit(): void {
    this.legalEntityFsm.register();
    this.orgUnitFsm.register();
  }
}
