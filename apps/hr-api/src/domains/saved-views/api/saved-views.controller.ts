import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { Permissions } from '../../../decorators/permissions.decorator.js';
import { requireActor, requireTenantId } from '../../../platform/http/request-context.js';
import { SavedView } from '../aggregates/saved-view.aggregate.js';
import { SavedViewsRepository } from '../repositories/saved-views.repository.js';

interface SavedViewDto {
  listKey?: unknown;
  name?: unknown;
  filters?: unknown;
  columns?: unknown;
  isDefault?: unknown;
}

@ApiTags('Saved Views')
@Controller('saved-views')
export class SavedViewsController {
  constructor(private readonly repository: SavedViewsRepository) {}

  @Get(':listKey')
  @Permissions('SAVED_VIEW_READ')
  async listViews(@Param('listKey') listKey: string, @Req() req: Request) {
    const context = this.requestContext(req);
    const normalizedListKey = this.requireNonEmptyString(listKey, 'listKey');
    const views = await this.repository.findByUserAndList(context.tenantId, context.userId, normalizedListKey);
    return views.map((view) => this.serialize(view));
  }

  @Post()
  @Permissions('SAVED_VIEW_CREATE')
  async createView(@Body() dto: SavedViewDto, @Req() req: Request) {
    const context = this.requestContext(req);
    const input = this.normalizeCreate(dto);
    if (input.isDefault) {
      await this.repository.unsetDefaultForList(context.tenantId, context.userId, input.listKey);
    }
    const saved = await this.repository.save(SavedView.create({
      tenantId: context.tenantId,
      userId: context.userId,
      listKey: input.listKey,
      name: input.name,
      filters: input.filters,
      columns: input.columns,
      isDefault: input.isDefault,
    }));
    return this.serialize(saved);
  }

  @Patch(':id')
  @Permissions('SAVED_VIEW_UPDATE')
  async updateView(@Param('id') id: string, @Body() dto: SavedViewDto, @Req() req: Request) {
    const context = this.requestContext(req);
    const viewId = new Uuid(id);
    const view = await this.repository.findByIdForUser(context.tenantId, context.userId, viewId);
    if (!view) throw new NotFoundException('Saved view not found');
    const input = this.normalizeUpdate(dto);
    if (input.isDefault) {
      await this.repository.unsetDefaultForList(context.tenantId, context.userId, view.listKey, viewId);
    }
    view.update(input);
    const saved = await this.repository.save(view);
    return this.serialize(saved);
  }

  @Delete(':id')
  @Permissions('SAVED_VIEW_DELETE')
  async deleteView(@Param('id') id: string, @Req() req: Request) {
    const context = this.requestContext(req);
    const deleted = await this.repository.delete(context.tenantId, context.userId, new Uuid(id));
    if (!deleted) throw new NotFoundException('Saved view not found');
    return { deleted: true };
  }

  private requestContext(req: Request): { tenantId: Uuid; userId: Uuid } {
    const tenantId = requireTenantId(req, 'Saved views');
    const actor = requireActor(req, 'Saved views');
    const actorId = actor.actorId;
    if (!actorId) {
      throw new BadRequestException('Saved views require a user actor');
    }
    return { tenantId, userId: actorId };
  }

  private normalizeCreate(dto: SavedViewDto): { listKey: string; name: string; filters: Record<string, unknown>; columns: string[]; isDefault: boolean } {
    return {
      listKey: this.requireNonEmptyString(dto.listKey, 'listKey'),
      name: this.requireNonEmptyString(dto.name, 'name'),
      filters: this.asRecord(dto.filters),
      columns: this.asStringArray(dto.columns),
      isDefault: dto.isDefault === true,
    };
  }

  private normalizeUpdate(dto: SavedViewDto): { name?: string; filters?: Record<string, unknown>; columns?: string[]; isDefault?: boolean } {
    const input: { name?: string; filters?: Record<string, unknown>; columns?: string[]; isDefault?: boolean } = {};
    if (dto.name !== undefined) input.name = this.requireNonEmptyString(dto.name, 'name');
    if (dto.filters !== undefined) input.filters = this.asRecord(dto.filters);
    if (dto.columns !== undefined) input.columns = this.asStringArray(dto.columns);
    if (dto.isDefault !== undefined) input.isDefault = dto.isDefault === true;
    return input;
  }

  private requireNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('filters must be an object');
    }
    return value as Record<string, unknown>;
  }

  private asStringArray(value: unknown): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw new BadRequestException('columns must be a string array');
    }
    return value;
  }

  private serialize(view: SavedView) {
    return {
      id: view.id.value,
      tenantId: view.tenantId.value,
      userId: view.userId.value,
      listKey: view.listKey,
      name: view.name,
      filters: view.filters,
      columns: view.columns,
      isDefault: view.isDefault,
      aggregateVersion: view.aggregateVersion,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    };
  }
}
