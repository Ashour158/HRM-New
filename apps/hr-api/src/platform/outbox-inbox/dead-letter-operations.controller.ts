import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { AuthGuard } from '../../guards/auth.guard.js';
import {
  DeadLetterOperationsService,
  type DeadLetterActor,
  type DeadLetterListQuery,
} from './dead-letter-operations.service.js';

const DEAD_LETTER_READ_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'INTERNAL_AUDITOR',
  'AUDITOR',
]);

const DEAD_LETTER_WRITE_ROLES = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
]);

interface DeadLetterCommandBody {
  reason?: string;
}

interface DeadLetterBulkCommandBody {
  ids?: string[];
  command?: 'retry' | 'skip';
  reason?: string;
}

interface DeadLetterQuery {
  status?: string;
  queue?: 'inbox' | 'outbox' | 'all';
  consumerName?: string;
  eventName?: string;
  aggregateType?: string;
  search?: string;
  limit?: string;
}

@ApiTags('Dead Letter Operations')
@UseGuards(AuthGuard)
@Controller('admin/dead-letter')
export class DeadLetterOperationsController {
  constructor(private readonly service: DeadLetterOperationsService) {}

  @Get('summary')
  async summary(@Req() req: Request) {
    this.assertReadScope(req);
    return this.service.getSummary(this.getTenantId(req));
  }

  @Get('inbox')
  async listInbox(@Req() req: Request, @Query() query: DeadLetterQuery) {
    this.assertReadScope(req);
    return this.service.listInboxEvents(this.getTenantId(req), this.toListQuery(query));
  }

  @Get('outbox')
  async listOutbox(@Req() req: Request, @Query() query: DeadLetterQuery) {
    this.assertReadScope(req);
    return this.service.listOutboxEvents(this.getTenantId(req), this.toListQuery(query));
  }

  @Post('inbox/:id/commands/retry')
  async retryInbox(
    @Param('id') id: string,
    @Body() body: DeadLetterCommandBody,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.retryInboxEvent(this.getTenantId(req), id, this.getActor(req), body.reason);
  }

  @Post('inbox/:id/commands/skip')
  async skipInbox(
    @Param('id') id: string,
    @Body() body: DeadLetterCommandBody,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.skipInboxEvent(this.getTenantId(req), id, this.getActor(req), body.reason ?? '');
  }

  @Post('inbox/commands/bulk')
  async bulkInbox(
    @Body() body: DeadLetterBulkCommandBody,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.bulkCommand(
      this.getTenantId(req),
      'inbox',
      body.command ?? 'retry',
      body.ids ?? [],
      this.getActor(req),
      body.reason,
    );
  }

  @Post('outbox/:id/commands/retry')
  async retryOutbox(
    @Param('id') id: string,
    @Body() body: DeadLetterCommandBody,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.retryOutboxEvent(this.getTenantId(req), id, this.getActor(req), body.reason);
  }

  @Post('outbox/:id/commands/skip')
  async skipOutbox(
    @Param('id') id: string,
    @Body() body: DeadLetterCommandBody,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.skipOutboxEvent(this.getTenantId(req), id, this.getActor(req), body.reason ?? '');
  }

  @Post('outbox/commands/bulk')
  async bulkOutbox(
    @Body() body: DeadLetterBulkCommandBody,
    @Req() req: Request,
  ) {
    this.assertWriteScope(req);
    return this.service.bulkCommand(
      this.getTenantId(req),
      'outbox',
      body.command ?? 'retry',
      body.ids ?? [],
      this.getActor(req),
      body.reason,
    );
  }

  @Get('export.csv')
  async exportCsv(@Req() req: Request, @Query() query: DeadLetterQuery, @Res() res: Response) {
    this.assertWriteScope(req);
    const csv = await this.service.exportCsv(this.getTenantId(req), this.toListQuery(query), this.getActor(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dead-letter-events-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('X-Data-Classification', 'CONFIDENTIAL');
    res.setHeader('X-Visibility-Scope', 'PLATFORM_ADMIN_ONLY');
    return res.send(`\uFEFF${csv}`);
  }

  private toListQuery(query: DeadLetterQuery): DeadLetterListQuery {
    return {
      queue: query.queue,
      status: query.status,
      consumerName: query.consumerName,
      eventName: query.eventName,
      aggregateType: query.aggregateType,
      search: query.search,
      limit: query.limit ? Number(query.limit) : undefined,
    };
  }

  private assertReadScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (roles.some((role) => DEAD_LETTER_READ_ROLES.has(role))) return;
    throw new ForbiddenException('Only platform, audit, or HR administrators can inspect dead-letter operations');
  }

  private assertWriteScope(req: Request): void {
    const roles = req.actor?.roles ?? [];
    if (!roles.some((role) => DEAD_LETTER_WRITE_ROLES.has(role))) {
      throw new ForbiddenException('Only platform administrators can operate dead-letter commands');
    }
    if (req.actor?.mfaAuthenticated !== true) {
      throw new ForbiddenException('Dead-letter operations require MFA');
    }
  }

  private getTenantId(req: Request): Uuid {
    const tenantId = req.tenantId;
    if (typeof tenantId === 'string' && Uuid.isValid(tenantId)) {
      return new Uuid(tenantId);
    }
    throw new ForbiddenException('Authenticated tenant is required');
  }

  private getActor(req: Request): DeadLetterActor {
    const actorId = req.actor?.actorId;
    const actorIdValue = actorId instanceof Uuid ? actorId.value : (actorId as { value?: unknown } | undefined)?.value;
    if (typeof actorIdValue !== 'string') {
      throw new ForbiddenException('Authenticated actor is required');
    }
    return {
      actorId: actorIdValue,
      actorName: req.actor?.email,
    };
  }
}
