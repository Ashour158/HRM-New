import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Uuid } from '@hcm/shared-kernel';
import type { Request } from 'express';
import { Permissions } from '../../../decorators/permissions.decorator.js';
import { requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { IntelligenceService } from '../services/intelligence.service.js';

const AttritionFeaturesSchema = z.object({
  tenureMonths: z.number(),
  compPositionToBandMidpoint: z.number(),
  monthsSincePromotion: z.number(),
  engagementScoreTrend: z.number(),
  absenceDaysLast90: z.number(),
  managerChangesLast12Months: z.number(),
});

const AnomalyFeaturesSchema = z.object({
  hoursWorked: z.number(),
  scheduledHours: z.number(),
  overtimeHours: z.number(),
  priorPeriodNetPay: z.number(),
  currentNetPay: z.number(),
  missingPunches: z.number(),
});

const IntelligenceSignalSchema = z.discriminatedUnion('signalType', [
  z.object({
    signalType: z.literal('ATTRITION_RISK'),
    workerId: z.string().uuid(),
    periodKey: z.string().min(1),
    features: AttritionFeaturesSchema,
    audienceWorkerIds: z.array(z.string().uuid()).optional(),
  }),
  z.object({
    signalType: z.literal('ATTENDANCE_PAYROLL_ANOMALY'),
    workerId: z.string().uuid(),
    periodKey: z.string().min(1),
    features: AnomalyFeaturesSchema,
    anomalyType: z.string().min(1).optional(),
    audienceWorkerIds: z.array(z.string().uuid()).optional(),
  }),
]);

@ApiTags('Workforce Intelligence')
@Permissions('INTELLIGENCE_READ')
@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Post('events/ingest')
  async ingestSignal(@Body() body: unknown, @Req() req: Request) {
    const parsed = IntelligenceSignalSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.intelligence.publishSignal(requireTenantId(req, 'Intelligence'), parsed.data);
  }

  @Get('attrition-risk/worker/:workerId')
  async getWorkerAttritionRisk(@Param('workerId') workerId: string, @Req() req: Request) {
    if (!Uuid.isValid(workerId)) throw new BadRequestException('Invalid worker id');
    return this.intelligence.latestAttritionRiskForWorker(
      requireTenantId(req, 'Intelligence'),
      new Uuid(workerId),
      requireActor(req, 'Intelligence'),
    );
  }

  @Get('attrition-risk/tenant/:tenantId')
  async getTenantAttritionRisk(@Param('tenantId') tenantId: string, @Req() req: Request) {
    const requestTenantId = requireTenantId(req, 'Intelligence');
    if (requestTenantId.value !== tenantId) throw new BadRequestException('Tenant mismatch');
    return this.intelligence.attritionRiskForTenant(requestTenantId, requireActor(req, 'Intelligence'));
  }

  @Get('anomalies/tenant/:tenantId')
  async getTenantAnomalies(@Param('tenantId') tenantId: string, @Req() req: Request) {
    const requestTenantId = requireTenantId(req, 'Intelligence');
    if (requestTenantId.value !== tenantId) throw new BadRequestException('Tenant mismatch');
    return this.intelligence.anomaliesForTenant(requestTenantId, requireActor(req, 'Intelligence'));
  }
}
