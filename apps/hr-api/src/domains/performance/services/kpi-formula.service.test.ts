import { describe, expect, it } from 'vitest';
import { ValidationError } from '@hcm/shared-kernel';
import { KpiFormulaService } from './kpi-formula.service.js';

describe('KpiFormulaService', () => {
  it('evaluates admin-defined KPI formulas with controlled variables', () => {
    const service = new KpiFormulaService();

    expect(service.calculate({
      formula: '(measuredValue / targetValue) * 100',
      measuredValue: 72,
      targetValue: 90,
    })).toBe(80);
  });

  it('rejects unsupported variables instead of evaluating arbitrary code', () => {
    const service = new KpiFormulaService();

    expect(() => service.calculate({
      formula: 'process.exit()',
      measuredValue: 72,
      targetValue: 90,
    })).toThrow(ValidationError);
  });
});
