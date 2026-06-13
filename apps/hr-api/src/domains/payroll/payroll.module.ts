import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { HrCoreModule } from '../hr-core/hr-core.module.js';
import { TimeAttendanceModule } from '../time-attendance/time-attendance.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { PayrollController } from './api/payroll.controller.js';
import { EmployeePayrollController } from './api/employee-payroll.controller.js';
import { PayrollCycleRepository } from './repositories/payroll-cycle.repository.js';
import { PayrollInputRepository } from './repositories/payroll-input.repository.js';
import { PayrollCalculationRunRepository } from './repositories/payroll-calculation-run.repository.js';
import { PayrollResultLineRepository } from './repositories/payroll-result-line.repository.js';
import { PayrollPaymentBatchRepository } from './repositories/payroll-payment-batch.repository.js';
import { PayrollPayslipArtifactRepository } from './repositories/payroll-payslip-artifact.repository.js';
import { PayrollExportJobRepository } from './repositories/payroll-export-job.repository.js';
import { PayrollGlPostingRepository } from './repositories/payroll-gl-posting.repository.js';
import { CreatePayrollCycleHandler } from './commands/create-payroll-cycle.handler.js';
import { OpenPayrollCycleHandler } from './commands/open-payroll-cycle.handler.js';
import { StartPayrollInputCollectionHandler } from './commands/start-payroll-input-collection.handler.js';
import { StartPayrollValidationHandler } from './commands/start-payroll-validation.handler.js';
import { StartPayrollCalculationHandler } from './commands/start-payroll-calculation.handler.js';
import { StartPayrollReviewHandler } from './commands/start-payroll-review.handler.js';
import { ApprovePayrollCycleHandler } from './commands/approve-payroll-cycle.handler.js';
import { ClosePayrollCycleHandler } from './commands/close-payroll-cycle.handler.js';
import { ExportPayrollCycleHandler } from './commands/export-payroll-cycle.handler.js';
import { CancelPayrollCycleHandler } from './commands/cancel-payroll-cycle.handler.js';
import { CreatePayrollInputHandler } from './commands/create-payroll-input.handler.js';
import { SubmitPayrollInputHandler } from './commands/submit-payroll-input.handler.js';
import { ApprovePayrollInputHandler } from './commands/approve-payroll-input.handler.js';
import { RejectPayrollInputHandler } from './commands/reject-payroll-input.handler.js';
import { CorrectPayrollInputHandler } from './commands/correct-payroll-input.handler.js';
import { StartPayrollCalculationRunHandler } from './commands/start-payroll-calculation-run.handler.js';
import { ValidatePayrollCalculationRunHandler } from './commands/validate-payroll-calculation-run.handler.js';
import { FinalizePayrollCalculationRunHandler } from './commands/finalize-payroll-calculation-run.handler.js';
import { FailPayrollCalculationRunHandler } from './commands/fail-payroll-calculation-run.handler.js';
import { CalculatePayrollResultLineHandler } from './commands/calculate-payroll-result-line.handler.js';
import { ExplainPayrollResultLineHandler } from './commands/explain-payroll-result-line.handler.js';
import { ReviewPayrollResultLineHandler } from './commands/review-payroll-result-line.handler.js';
import { LockPayrollResultLineHandler } from './commands/lock-payroll-result-line.handler.js';
import {
  ApprovePayrollPaymentBatchHandler,
  CreatePayrollGlPostingHandler,
  CreatePayrollPaymentBatchHandler,
  ExportPayrollPaymentBatchHandler,
  GeneratePayrollPayslipArtifactsHandler,
  PublishPayrollCyclePayslipsHandler,
  ReconcilePayrollPaymentBatchHandler,
  SavePayrollExportJobHandler,
} from './commands/payroll-enterprise-artifact.handlers.js';
import { PayrollEventsPublisher } from './events/payroll-events.publisher.js';
import { PayrollCalculationSaga } from './sagas/payroll-calculation-saga.js';
import { PayrollInputBuilderSaga } from './sagas/payroll-input-builder-saga.js';
import { PayrollCycleCalculationService } from './services/payroll-cycle-calculation.service.js';
import { PayrollCycleGovernanceService } from './services/payroll-cycle-governance.service.js';
import { PayrollInputOrchestrationService } from './services/payroll-input-orchestration.service.js';
import { PayrollApprovedInputProjectionService } from './services/payroll-approved-input-projection.service.js';
import { PayrollArtifactService } from './services/payroll-artifact.service.js';
import { PayrollEnterpriseWorkflowService } from './services/payroll-enterprise-workflow.service.js';
import { PayrollBankFileService } from './services/payroll-bank-file.service.js';
import { PayrollGlPostingService } from './services/payroll-gl-posting.service.js';
import { PayrollStatutoryPolicyService } from './services/payroll-statutory-policy.service.js';
import { registerPayrollCycleFsm } from './fsm/payroll-cycle.fsm.js';
import { registerPayrollInputFsm } from './fsm/payroll-input.fsm.js';
import { registerPayrollCalculationRunFsm } from './fsm/payroll-calculation-run.fsm.js';
import { registerPayrollResultLineFsm } from './fsm/payroll-result-line.fsm.js';

@Module({
  imports: [PlatformModule, HcmSetupModule, HrCoreModule, TimeAttendanceModule],
  controllers: [PayrollController, EmployeePayrollController],
  providers: [
    PayrollCycleRepository,
    PayrollInputRepository,
    PayrollCalculationRunRepository,
    PayrollResultLineRepository,
    PayrollPaymentBatchRepository,
    PayrollPayslipArtifactRepository,
    PayrollExportJobRepository,
    PayrollGlPostingRepository,
    CreatePayrollCycleHandler,
    OpenPayrollCycleHandler,
    StartPayrollInputCollectionHandler,
    StartPayrollValidationHandler,
    StartPayrollCalculationHandler,
    StartPayrollReviewHandler,
    ApprovePayrollCycleHandler,
    ClosePayrollCycleHandler,
    ExportPayrollCycleHandler,
    CancelPayrollCycleHandler,
    CreatePayrollInputHandler,
    SubmitPayrollInputHandler,
    ApprovePayrollInputHandler,
    RejectPayrollInputHandler,
    CorrectPayrollInputHandler,
    StartPayrollCalculationRunHandler,
    ValidatePayrollCalculationRunHandler,
    FinalizePayrollCalculationRunHandler,
    FailPayrollCalculationRunHandler,
    CalculatePayrollResultLineHandler,
    ExplainPayrollResultLineHandler,
    ReviewPayrollResultLineHandler,
    LockPayrollResultLineHandler,
    CreatePayrollPaymentBatchHandler,
    ApprovePayrollPaymentBatchHandler,
    ExportPayrollPaymentBatchHandler,
    ReconcilePayrollPaymentBatchHandler,
    GeneratePayrollPayslipArtifactsHandler,
    PublishPayrollCyclePayslipsHandler,
    CreatePayrollGlPostingHandler,
    SavePayrollExportJobHandler,
    PayrollEventsPublisher,
    PayrollCalculationSaga,
    PayrollInputBuilderSaga,
    PayrollCycleCalculationService,
    PayrollCycleGovernanceService,
    PayrollInputOrchestrationService,
    PayrollApprovedInputProjectionService,
    PayrollArtifactService,
    PayrollEnterpriseWorkflowService,
    PayrollBankFileService,
    PayrollGlPostingService,
    PayrollStatutoryPolicyService,
  ],
  exports: [
    PayrollCycleRepository,
    PayrollInputRepository,
    PayrollCalculationRunRepository,
    PayrollResultLineRepository,
    PayrollPaymentBatchRepository,
    PayrollPayslipArtifactRepository,
    PayrollExportJobRepository,
    PayrollGlPostingRepository,
    PayrollCycleCalculationService,
    PayrollCycleGovernanceService,
    PayrollInputOrchestrationService,
    PayrollApprovedInputProjectionService,
    PayrollArtifactService,
    PayrollEnterpriseWorkflowService,
    PayrollBankFileService,
    PayrollGlPostingService,
    PayrollStatutoryPolicyService,
  ],
})
export class PayrollModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerPayrollCycleFsm(this.fsm);
    registerPayrollInputFsm(this.fsm);
    registerPayrollCalculationRunFsm(this.fsm);
    registerPayrollResultLineFsm(this.fsm);
  }
}
