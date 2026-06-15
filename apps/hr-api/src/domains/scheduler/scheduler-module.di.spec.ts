import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { SchedulerModule } from './scheduler.module.js';
import { SchedulerEngineService } from './scheduler-engine.service.js';

/**
 * Boot-resolution guard. `.compile()` resolves the full DI graph (constructors run)
 * without invoking onModuleInit/onApplicationBootstrap, so it catches NestJS DI wiring
 * defects — e.g. constructor deps imported as `import type` (no runtime metadata) or
 * optional params missing `@Optional()` — that unit tests miss because they construct
 * services by hand. These defects only surface at runtime boot otherwise.
 */
describe('SchedulerModule DI resolution', () => {
  it('resolves SchedulerEngineService and its dependency graph', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SchedulerModule] }).compile();
    expect(moduleRef.get(SchedulerEngineService)).toBeInstanceOf(SchedulerEngineService);
    await moduleRef.close();
  });
});
