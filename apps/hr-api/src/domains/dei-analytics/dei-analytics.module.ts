import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { DeiAnalyticsController } from './api/dei-analytics.controller.js';
import { DeiReportFsmRegistrar } from './fsm/dei-report.fsm.js';
import { PayGapReportFsmRegistrar } from './fsm/pay-gap-report.fsm.js';
import { PayEquityReviewFsmRegistrar } from './fsm/pay-equity-review.fsm.js';
import { AttritionSegmentReportFsmRegistrar } from './fsm/attrition-segment-report.fsm.js';
import { DeiReportRepository } from './repositories/dei-report.repository.js';
import { PayGapReportRepository } from './repositories/pay-gap-report.repository.js';
import { PayEquityReviewRepository } from './repositories/pay-equity-review.repository.js';
import { AttritionSegmentReportRepository } from './repositories/attrition-segment-report.repository.js';
import { CreateDeiReportHandler } from './commands/create-dei-report.handler.js';
import { GenerateDeiReportHandler } from './commands/generate-dei-report.handler.js';
import { ReviewDeiReportHandler } from './commands/review-dei-report.handler.js';
import { PublishDeiReportHandler } from './commands/publish-dei-report.handler.js';
import { CreatePayGapReportHandler } from './commands/create-pay-gap-report.handler.js';
import { CalculatePayGapReportHandler } from './commands/calculate-pay-gap-report.handler.js';
import { ReviewPayGapReportHandler } from './commands/review-pay-gap-report.handler.js';
import { PublishPayGapReportHandler } from './commands/publish-pay-gap-report.handler.js';
import { CreatePayEquityReviewHandler } from './commands/create-pay-equity-review.handler.js';
import { StartPayEquityReviewHandler } from './commands/start-pay-equity-review.handler.js';
import { RecordPayEquityFindingsHandler } from './commands/record-pay-equity-findings.handler.js';
import { StartPayEquityRemediationHandler } from './commands/start-pay-equity-remediation.handler.js';
import { ClosePayEquityReviewHandler } from './commands/close-pay-equity-review.handler.js';
import { CreateAttritionSegmentReportHandler } from './commands/create-attrition-segment-report.handler.js';
import { GenerateAttritionSegmentReportHandler } from './commands/generate-attrition-segment-report.handler.js';
import { PublishAttritionSegmentReportHandler } from './commands/publish-attrition-segment-report.handler.js';
import { DeiAnalyticsEventsPublisher } from './events/dei-analytics-events.publisher.js';

@Module({
  imports: [PlatformModule],
  controllers: [DeiAnalyticsController],
  providers: [
    DeiReportFsmRegistrar, PayGapReportFsmRegistrar, PayEquityReviewFsmRegistrar, AttritionSegmentReportFsmRegistrar,
    DeiReportRepository, PayGapReportRepository, PayEquityReviewRepository, AttritionSegmentReportRepository,
    CreateDeiReportHandler, GenerateDeiReportHandler, ReviewDeiReportHandler, PublishDeiReportHandler,
    CreatePayGapReportHandler, CalculatePayGapReportHandler, ReviewPayGapReportHandler, PublishPayGapReportHandler,
    CreatePayEquityReviewHandler, StartPayEquityReviewHandler, RecordPayEquityFindingsHandler, StartPayEquityRemediationHandler, ClosePayEquityReviewHandler,
    CreateAttritionSegmentReportHandler, GenerateAttritionSegmentReportHandler, PublishAttritionSegmentReportHandler,
    DeiAnalyticsEventsPublisher,
  ],
  exports: [DeiReportRepository, PayGapReportRepository, PayEquityReviewRepository, AttritionSegmentReportRepository],
})
export class DeiAnalyticsModule {}
