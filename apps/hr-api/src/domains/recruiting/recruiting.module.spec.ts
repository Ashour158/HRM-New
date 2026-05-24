import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { RecruitingModule } from './recruiting.module.js';
import { PositionControlModule } from '../position-control/position-control.module.js';

describe('RecruitingModule metadata', () => {
  it('imports PositionControlModule so PositionRepository is available in DI', () => {
    const imports = Reflect.getMetadata('imports', RecruitingModule) ?? [];
    expect(imports).toContain(PositionControlModule);
  });
});
