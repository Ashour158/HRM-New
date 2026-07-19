import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { RecruitingModule } from './recruiting.module.js';
import { PositionControlModule } from '../position-control/position-control.module.js';
import { CompensationModule } from '../compensation/compensation.module.js';

describe('RecruitingModule metadata', () => {
  it('imports PositionControlModule so PositionRepository is available in DI', () => {
    const imports = Reflect.getMetadata('imports', RecruitingModule) ?? [];
    expect(imports).toContain(PositionControlModule);
  });

  it('imports CompensationModule so CompensationBandRepository is available in DI for the offer-compensation gate', () => {
    const imports = Reflect.getMetadata('imports', RecruitingModule) ?? [];
    expect(imports).toContain(CompensationModule);
  });
});
