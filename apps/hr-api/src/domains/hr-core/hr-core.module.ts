import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { HrCoreController } from './api/hr-core.controller.js';
import { WorkerRepository } from './repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from './repositories/employment-relationship.repository.js';
import { JobAssignmentRepository } from './repositories/job-assignment.repository.js';
import { EmploymentContractRepository } from './repositories/employment-contract.repository.js';
import { PersonalDataRecordRepository } from './repositories/personal-data-record.repository.js';
import { CreateWorkerHandler } from './commands/create-worker.handler.js';
import { ActivateWorkerHandler } from './commands/activate-worker.handler.js';
import { TerminateWorkerHandler } from './commands/terminate-worker.handler.js';
import { UpdateWorkerPersonalDataHandler } from './commands/update-worker-personal-data.handler.js';
import { SuspendWorkerHandler } from './commands/suspend-worker.handler.js';
import { ReinstateWorkerHandler } from './commands/reinstate-worker.handler.js';
import { RehireWorkerHandler } from './commands/rehire-worker.handler.js';
import { UpsertWorkerProfileSectionHandler } from './commands/upsert-worker-profile-section.handler.js';
import { ApplyWorkerMassUpdateHandler } from './commands/apply-worker-mass-update.handler.js';
import { CreateJobAssignmentHandler } from './commands/create-job-assignment.handler.js';
import { ActivateJobAssignmentHandler } from './commands/activate-job-assignment.handler.js';
import { EndJobAssignmentHandler } from './commands/end-job-assignment.handler.js';
import { CreateEmploymentRelationshipHandler } from './commands/create-employment-relationship.handler.js';
import { ActivateEmploymentRelationshipHandler } from './commands/activate-employment-relationship.handler.js';
import { EndEmploymentRelationshipHandler } from './commands/end-employment-relationship.handler.js';
import { CreateEmploymentContractHandler } from './commands/create-employment-contract.handler.js';
import { SignEmploymentContractHandler } from './commands/sign-employment-contract.handler.js';
import { WorkerEventsPublisher } from './events/worker-events.publisher.js';
import { WorkerViewProjectionBuilder } from './projections/worker-view.projection.js';
import { registerWorkerProfileFsm } from './fsm/worker-profile.fsm.js';
import { registerEmploymentRelationshipFsm } from './fsm/employment-relationship.fsm.js';
import { registerJobAssignmentFsm } from './fsm/job-assignment.fsm.js';
import { registerEmploymentContractFsm } from './fsm/employment-contract.fsm.js';

@Module({
  imports: [PlatformModule, HcmSetupModule],
  controllers: [HrCoreController],
  providers: [
    WorkerRepository,
    EmploymentRelationshipRepository,
    JobAssignmentRepository,
    EmploymentContractRepository,
    PersonalDataRecordRepository,
    CreateWorkerHandler,
    ActivateWorkerHandler,
    TerminateWorkerHandler,
    UpdateWorkerPersonalDataHandler,
    SuspendWorkerHandler,
    ReinstateWorkerHandler,
    RehireWorkerHandler,
    UpsertWorkerProfileSectionHandler,
    ApplyWorkerMassUpdateHandler,
    CreateJobAssignmentHandler,
    ActivateJobAssignmentHandler,
    EndJobAssignmentHandler,
    CreateEmploymentRelationshipHandler,
    ActivateEmploymentRelationshipHandler,
    EndEmploymentRelationshipHandler,
    CreateEmploymentContractHandler,
    SignEmploymentContractHandler,
    WorkerEventsPublisher,
    WorkerViewProjectionBuilder,
  ],
  exports: [WorkerRepository, EmploymentRelationshipRepository, JobAssignmentRepository, PersonalDataRecordRepository],
})
export class HrCoreModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerWorkerProfileFsm(this.fsm);
    registerEmploymentRelationshipFsm(this.fsm);
    registerJobAssignmentFsm(this.fsm);
    registerEmploymentContractFsm(this.fsm);
  }
}
