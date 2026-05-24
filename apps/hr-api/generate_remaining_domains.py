import pathlib

BASE = pathlib.Path(__file__).parent / "src" / "domains"

def write(p, c):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c, encoding="utf-8")
    print(f"Wrote {p}")

# ========================================================================
# UNION & LABOR - Events publisher, controller, DTOs, module
# ========================================================================

write(BASE/"union-labor/events/union-labor-events.publisher.ts", '''import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus.js';
import type { DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { HrEventEnvelope } from '@hcm/command-contracts';
import { UnionRecognition } from '../aggregates/union-recognition.aggregate.js';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { CollectiveBargainingSession } from '../aggregates/collective-bargaining-session.aggregate.js';

@Injectable()
export class UnionLaborEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = HrEventEnvelope.create({
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId,
        payload: event.payload,
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      });
      await this.eventBus.publish(envelope);
    }
  }

  private buildPrivacy(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
''')

write(BASE/"union-labor/api/union-labor.controller.ts", '''import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { ZodValidationPipe } from '../../../platform/validation/zod-validation.pipe.js';
import { JwtAuthGuard } from '../../../platform/security/jwt-auth.guard.js';
import { Uuid } from '@hcm/shared-kernel';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import {
  CreateUnionRecognitionDto,
  CreateGrievanceDto,
  CreateCollectiveBargainingSessionDto,
} from './union-labor.dto.js';

@ApiTags('Union & Labor')
@UseGuards(JwtAuthGuard)
@Controller('union-labor')
export class UnionLaborController {
  constructor(private readonly commandBus: CommandBus) {}

  private buildCommand(action: string, tenantId: Uuid, payload: unknown, roles: string[] = ['HR_ADMIN']) {
    return {
      commandId: Uuid.generate(),
      commandName: action,
      tenantId,
      payload,
      correlationId: randomUUID(),
      actor: { id: Uuid.generate(), roles },
      occurredAt: new Date(),
    };
  }

  @Post('union-recognitions')
  async createRecognition(@Body(new ZodValidationPipe(CreateUnionRecognitionDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateUnionRecognition', new Uuid(req['tenantId']), dto));
  }

  @Get('union-recognitions/:id')
  async getRecognition(@Param('id') id: string) {
    return { id };
  }

  @Post('union-recognitions/:id/commands/:action')
  async recognitionCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { unionRecognitionId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}UnionRecognition`, new Uuid(req['tenantId']), payload));
  }

  @Post('grievances')
  async createGrievance(@Body(new ZodValidationPipe(CreateGrievanceDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateGrievance', new Uuid(req['tenantId']), dto));
  }

  @Get('grievances/:id')
  async getGrievance(@Param('id') id: string) {
    return { id };
  }

  @Post('grievances/:id/commands/:action')
  async grievanceCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { grievanceId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}Grievance`, new Uuid(req['tenantId']), payload));
  }

  @Post('collective-bargaining-sessions')
  async createSession(@Body(new ZodValidationPipe(CreateCollectiveBargainingSessionDto)) dto: unknown, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCollectiveBargainingSession', new Uuid(req['tenantId']), dto));
  }

  @Get('collective-bargaining-sessions/:id')
  async getSession(@Param('id') id: string) {
    return { id };
  }

  @Post('collective-bargaining-sessions/:id/commands/:action')
  async sessionCommand(@Param('id') id: string, @Param('action') action: string, @Req() req: Request) {
    const payload = { collectiveBargainingSessionId: new Uuid(id) };
    return this.commandBus.execute(this.buildCommand(`${action[0].toUpperCase()}${action.slice(1)}CollectiveBargainingSession`, new Uuid(req['tenantId']), payload));
  }
}
''')

write(BASE/"union-labor/api/union-labor.dto.ts", '''import { z } from 'zod';

export const CreateUnionRecognitionDto = z.object({
  unionName: z.string().min(1),
  bargainingUnitId: z.string().uuid(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  agreementDocument: z.string().optional(),
});

export const CreateGrievanceDto = z.object({
  workerId: z.string().uuid(),
  grievanceType: z.string().min(1),
  description: z.string().min(1),
  resolution: z.string().optional(),
  arbitratorDecision: z.string().optional(),
});

export const CreateCollectiveBargainingSessionDto = z.object({
  unionRecognitionId: z.string().uuid(),
  sessionDate: z.coerce.date(),
  location: z.string().optional(),
  agenda: z.string().optional(),
  minutes: z.string().optional(),
});
''')

write(BASE/"union-labor/union-labor.module.ts", '''import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { UnionLaborController } from './api/union-labor.controller.js';
import { UnionLaborEventsPublisher } from './events/union-labor-events.publisher.js';
import { UnionRecognitionRepository } from './repositories/union-recognition.repository.js';
import { GrievanceRepository } from './repositories/grievance.repository.js';
import { CollectiveBargainingSessionRepository } from './repositories/collective-bargaining-session.repository.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { registerUnionRecognitionFsm } from './fsm/union-recognition.fsm.js';
import { registerGrievanceFsm } from './fsm/grievance.fsm.js';
import { registerCollectiveBargainingSessionFsm } from './fsm/collective-bargaining-session.fsm.js';
import { CreateUnionRecognitionHandler } from './commands/create-union-recognition.handler.js';
import { NegotiateUnionRecognitionHandler } from './commands/negotiate-union-recognition.handler.js';
import { RatifyUnionRecognitionHandler } from './commands/ratify-union-recognition.handler.js';
import { ActivateUnionRecognitionHandler } from './commands/activate-union-recognition.handler.js';
import { ExpireUnionRecognitionHandler } from './commands/expire-union-recognition.handler.js';
import { RenewUnionRecognitionHandler } from './commands/renew-union-recognition.handler.js';
import { CreateGrievanceHandler } from './commands/create-grievance.handler.js';
import { AcknowledgeGrievanceHandler } from './commands/acknowledge-grievance.handler.js';
import { StartInvestigationGrievanceHandler } from './commands/start-investigation-grievance.handler.js';
import { ResolveGrievanceHandler } from './commands/resolve-grievance.handler.js';
import { ArbitrateGrievanceHandler } from './commands/arbitrate-grievance.handler.js';
import { WithdrawGrievanceHandler } from './commands/withdraw-grievance.handler.js';
import { CreateCollectiveBargainingSessionHandler } from './commands/create-collective-bargaining-session.handler.js';
import { StartCollectiveBargainingSessionHandler } from './commands/start-collective-bargaining-session.handler.js';
import { RecordTentativeAgreementCollectiveBargainingSessionHandler } from './commands/record-tentative-agreement-collective-bargaining-session.handler.js';
import { RatifyCollectiveBargainingSessionHandler } from './commands/ratify-collective-bargaining-session.handler.js';
import { MarkFailedCollectiveBargainingSessionHandler } from './commands/mark-failed-collective-bargaining-session.handler.js';
import { CloseCollectiveBargainingSessionHandler } from './commands/close-collective-bargaining-session.handler.js';

const HANDLERS = [
  CreateUnionRecognitionHandler,
  NegotiateUnionRecognitionHandler,
  RatifyUnionRecognitionHandler,
  ActivateUnionRecognitionHandler,
  ExpireUnionRecognitionHandler,
  RenewUnionRecognitionHandler,
  CreateGrievanceHandler,
  AcknowledgeGrievanceHandler,
  StartInvestigationGrievanceHandler,
  ResolveGrievanceHandler,
  ArbitrateGrievanceHandler,
  WithdrawGrievanceHandler,
  CreateCollectiveBargainingSessionHandler,
  StartCollectiveBargainingSessionHandler,
  RecordTentativeAgreementCollectiveBargainingSessionHandler,
  RatifyCollectiveBargainingSessionHandler,
  MarkFailedCollectiveBargainingSessionHandler,
  CloseCollectiveBargainingSessionHandler,
];

const REPOS = [UnionRecognitionRepository, GrievanceRepository, CollectiveBargainingSessionRepository];

@Module({
  imports: [PlatformModule],
  controllers: [UnionLaborController],
  providers: [...REPOS, ...HANDLERS, UnionLaborEventsPublisher],
  exports: REPOS,
})
export class UnionLaborModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit() {
    registerUnionRecognitionFsm(this.fsm);
    registerGrievanceFsm(this.fsm);
    registerCollectiveBargainingSessionFsm(this.fsm);
  }
}
''')

print("UL all done")
