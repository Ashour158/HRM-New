import { describe, expect, it } from 'vitest';
import {
  CreateLegalEntityDtoSchema,
  UpdateLegalEntityDtoSchema,
  CreateOrgUnitDtoSchema,
  UpdateOrgUnitDtoSchema,
  RestructureOrgUnitDtoSchema,
  AssignManagerDtoSchema,
  AssignWorkerOrganizationDtoSchema,
  AssignWorkerOrganizationByBodyDtoSchema,
  WorkforceScenarioDtoSchema,
} from './dtos.js';

const uuid1 = '11111111-1111-1111-1111-111111111111';
const uuid2 = '22222222-2222-2222-2222-222222222222';
const uuid3 = '33333333-3333-3333-3333-333333333333';

describe('CreateLegalEntityDtoSchema', () => {
  const valid = {
    legalEntityId: uuid1,
    name: 'Acme Corporation',
    countryCode: 'US',
    registrationNumber: '123456789',
  };

  it('accepts a valid payload', () => {
    expect(CreateLegalEntityDtoSchema.parse(valid)).toMatchObject(valid);
  });

  it('rejects a payload missing legalEntityId', () => {
    const { legalEntityId, ...rest } = valid;
    expect(() => CreateLegalEntityDtoSchema.parse(rest)).toThrow();
  });

  it('rejects a non-uuid legalEntityId', () => {
    expect(() => CreateLegalEntityDtoSchema.parse({ ...valid, legalEntityId: 'not-a-uuid' })).toThrow();
  });

  it('rejects a countryCode that is not exactly 2 characters', () => {
    expect(() => CreateLegalEntityDtoSchema.parse({ ...valid, countryCode: 'USA' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => CreateLegalEntityDtoSchema.parse({ ...valid, name: '' })).toThrow();
  });
});

describe('UpdateLegalEntityDtoSchema', () => {
  it('accepts an empty payload since all fields are optional', () => {
    expect(UpdateLegalEntityDtoSchema.parse({})).toEqual({});
  });

  it('accepts a partial valid payload', () => {
    expect(UpdateLegalEntityDtoSchema.parse({ name: 'Acme Corp' })).toEqual({ name: 'Acme Corp' });
  });

  it('rejects an empty name', () => {
    expect(() => UpdateLegalEntityDtoSchema.parse({ name: '' })).toThrow();
  });

  it('rejects a non-string name', () => {
    expect(() => UpdateLegalEntityDtoSchema.parse({ name: 123 })).toThrow();
  });
});

describe('CreateOrgUnitDtoSchema', () => {
  const valid = {
    orgUnitId: uuid1,
    legalEntityId: uuid2,
    name: 'Engineering',
    parentOrgUnitId: uuid3,
  };

  it('accepts a valid payload', () => {
    expect(CreateOrgUnitDtoSchema.parse(valid)).toMatchObject(valid);
  });

  it('accepts a payload without the optional parentOrgUnitId', () => {
    const { parentOrgUnitId, ...rest } = valid;
    expect(CreateOrgUnitDtoSchema.parse(rest)).toMatchObject(rest);
  });

  it('rejects a payload missing orgUnitId', () => {
    const { orgUnitId, ...rest } = valid;
    expect(() => CreateOrgUnitDtoSchema.parse(rest)).toThrow();
  });

  it('rejects a non-uuid parentOrgUnitId', () => {
    expect(() => CreateOrgUnitDtoSchema.parse({ ...valid, parentOrgUnitId: 'not-a-uuid' })).toThrow();
  });
});

describe('UpdateOrgUnitDtoSchema', () => {
  it('accepts an empty payload', () => {
    expect(UpdateOrgUnitDtoSchema.parse({})).toEqual({});
  });

  it('rejects a non-uuid parentOrgUnitId', () => {
    expect(() => UpdateOrgUnitDtoSchema.parse({ parentOrgUnitId: 'not-a-uuid' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => UpdateOrgUnitDtoSchema.parse({ name: '' })).toThrow();
  });
});

describe('RestructureOrgUnitDtoSchema', () => {
  it('accepts an empty payload', () => {
    expect(RestructureOrgUnitDtoSchema.parse({})).toEqual({});
  });

  it('accepts a null newParentOrgUnitId to move a unit to the root', () => {
    expect(RestructureOrgUnitDtoSchema.parse({ newParentOrgUnitId: null })).toEqual({ newParentOrgUnitId: null });
  });

  it('accepts a valid newParentOrgUnitId', () => {
    expect(RestructureOrgUnitDtoSchema.parse({ newParentOrgUnitId: uuid1 })).toEqual({ newParentOrgUnitId: uuid1 });
  });

  it('rejects a non-uuid newParentOrgUnitId', () => {
    expect(() => RestructureOrgUnitDtoSchema.parse({ newParentOrgUnitId: 'not-a-uuid' })).toThrow();
  });

  it('rejects an empty newName', () => {
    expect(() => RestructureOrgUnitDtoSchema.parse({ newName: '' })).toThrow();
  });
});

describe('AssignManagerDtoSchema', () => {
  const valid = { workerId: uuid1, managerId: uuid2, departmentId: uuid3 };

  it('accepts a valid payload', () => {
    expect(AssignManagerDtoSchema.parse(valid)).toMatchObject(valid);
  });

  it('accepts a payload without the optional departmentId', () => {
    const { departmentId, ...rest } = valid;
    expect(AssignManagerDtoSchema.parse(rest)).toMatchObject(rest);
  });

  it('rejects a payload missing managerId', () => {
    const { managerId, ...rest } = valid;
    expect(() => AssignManagerDtoSchema.parse(rest)).toThrow();
  });

  it('rejects a non-uuid workerId', () => {
    expect(() => AssignManagerDtoSchema.parse({ ...valid, workerId: 'not-a-uuid' })).toThrow();
  });
});

describe('AssignWorkerOrganizationDtoSchema', () => {
  it('accepts an empty payload since all fields are optional', () => {
    expect(AssignWorkerOrganizationDtoSchema.parse({})).toEqual({});
  });

  it('accepts null values to clear assignment fields', () => {
    const payload = { legalEntityId: null, departmentId: null, managerId: null, jobTitle: null };
    expect(AssignWorkerOrganizationDtoSchema.parse(payload)).toEqual(payload);
  });

  it('accepts valid uuid and jobTitle values', () => {
    const payload = { legalEntityId: uuid1, departmentId: uuid2, managerId: uuid3, jobTitle: 'Engineer' };
    expect(AssignWorkerOrganizationDtoSchema.parse(payload)).toEqual(payload);
  });

  it('rejects a non-uuid legalEntityId', () => {
    expect(() => AssignWorkerOrganizationDtoSchema.parse({ legalEntityId: 'not-a-uuid' })).toThrow();
  });

  it('rejects an empty jobTitle', () => {
    expect(() => AssignWorkerOrganizationDtoSchema.parse({ jobTitle: '' })).toThrow();
  });
});

describe('AssignWorkerOrganizationByBodyDtoSchema', () => {
  const valid = { workerId: uuid1, legalEntityId: uuid2 };

  it('accepts a valid payload with workerId', () => {
    expect(AssignWorkerOrganizationByBodyDtoSchema.parse(valid)).toMatchObject(valid);
  });

  it('rejects a payload missing workerId', () => {
    const { workerId, ...rest } = valid;
    expect(() => AssignWorkerOrganizationByBodyDtoSchema.parse(rest)).toThrow();
  });

  it('rejects a non-uuid workerId', () => {
    expect(() => AssignWorkerOrganizationByBodyDtoSchema.parse({ ...valid, workerId: 'not-a-uuid' })).toThrow();
  });
});

describe('WorkforceScenarioDtoSchema', () => {
  it('accepts an empty payload since all fields are optional', () => {
    expect(WorkforceScenarioDtoSchema.parse({})).toEqual({});
  });

  it('accepts a valid full payload', () => {
    const valid = {
      name: 'Expansion Scenario',
      branchExpansionCount: 3,
      rolesPerBranch: 12,
      adminReductionPercent: 10,
      outsourceHeadcount: 8,
      demandGrowthPercent: 15,
      automationOffsetPercent: 5,
      aiAgentCapacity: 4,
      averageCostPerFte: 36000,
    };
    expect(WorkforceScenarioDtoSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a negative branchExpansionCount', () => {
    expect(() => WorkforceScenarioDtoSchema.parse({ branchExpansionCount: -1 })).toThrow();
  });

  it('rejects a demandGrowthPercent above the allowed maximum', () => {
    expect(() => WorkforceScenarioDtoSchema.parse({ demandGrowthPercent: 1000 })).toThrow();
  });

  it('rejects a non-integer rolesPerBranch', () => {
    expect(() => WorkforceScenarioDtoSchema.parse({ rolesPerBranch: 1.5 })).toThrow();
  });
});
