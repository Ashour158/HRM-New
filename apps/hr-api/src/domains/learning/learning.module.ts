import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../hr-core/repositories/worker.repository.js';
import { LearningController } from './api/learning.controller.js';
import { LearningCourseRepository } from './repositories/learning-course.repository.js';
import { LearningAssignmentRepository } from './repositories/learning-assignment.repository.js';
import { CertificationRepository } from './repositories/certification.repository.js';
import { LearningContentPackageRepository } from './repositories/learning-content-package.repository.js';
import { CreateLearningCourseHandler } from './commands/create-learning-course.handler.js';
import { PublishLearningCourseHandler } from './commands/publish-learning-course.handler.js';
import { ArchiveLearningCourseHandler } from './commands/archive-learning-course.handler.js';
import { RetireLearningCourseHandler } from './commands/retire-learning-course.handler.js';
import { CreateLearningAssignmentHandler } from './commands/create-learning-assignment.handler.js';
import { StartLearningAssignmentHandler } from './commands/start-learning-assignment.handler.js';
import { CompleteLearningAssignmentHandler } from './commands/complete-learning-assignment.handler.js';
import { ExpireLearningAssignmentHandler } from './commands/expire-learning-assignment.handler.js';
import { CancelLearningAssignmentHandler } from './commands/cancel-learning-assignment.handler.js';
import { CreateCertificationHandler } from './commands/create-certification.handler.js';
import { RenewCertificationHandler } from './commands/renew-certification.handler.js';
import { ExpireCertificationHandler } from './commands/expire-certification.handler.js';
import { RevokeCertificationHandler } from './commands/revoke-certification.handler.js';
import { CreateLearningContentPackageHandler } from './commands/create-learning-content-package.handler.js';
import { ParseLearningContentPackageHandler } from './commands/parse-learning-content-package.handler.js';
import { ValidateLearningContentPackageHandler } from './commands/validate-learning-content-package.handler.js';
import { PublishLearningContentPackageHandler } from './commands/publish-learning-content-package.handler.js';
import { DeprecateLearningContentPackageHandler } from './commands/deprecate-learning-content-package.handler.js';
import { LearningEventsPublisher } from './events/learning-events.publisher.js';
import { registerLearningCourseFsm } from './fsm/learning-course.fsm.js';
import { registerLearningAssignmentFsm } from './fsm/learning-assignment.fsm.js';
import { registerCertificationFsm } from './fsm/certification.fsm.js';
import { registerLearningContentPackageFsm } from './fsm/learning-content-package.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [LearningController],
  providers: [
    WorkerRepository,
    LearningCourseRepository,
    LearningAssignmentRepository,
    CertificationRepository,
    LearningContentPackageRepository,
    CreateLearningCourseHandler,
    PublishLearningCourseHandler,
    ArchiveLearningCourseHandler,
    RetireLearningCourseHandler,
    CreateLearningAssignmentHandler,
    StartLearningAssignmentHandler,
    CompleteLearningAssignmentHandler,
    ExpireLearningAssignmentHandler,
    CancelLearningAssignmentHandler,
    CreateCertificationHandler,
    RenewCertificationHandler,
    ExpireCertificationHandler,
    RevokeCertificationHandler,
    CreateLearningContentPackageHandler,
    ParseLearningContentPackageHandler,
    ValidateLearningContentPackageHandler,
    PublishLearningContentPackageHandler,
    DeprecateLearningContentPackageHandler,
    LearningEventsPublisher,
  ],
  exports: [LearningCourseRepository, LearningAssignmentRepository, CertificationRepository, LearningContentPackageRepository],
})
export class LearningModule implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerLearningCourseFsm(this.fsm);
    registerLearningAssignmentFsm(this.fsm);
    registerCertificationFsm(this.fsm);
    registerLearningContentPackageFsm(this.fsm);
  }
}
