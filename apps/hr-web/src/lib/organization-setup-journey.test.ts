import { describe, expect, it } from 'vitest';
import { buildOrganizationSetupJourney } from './organization-setup-journey';

describe('buildOrganizationSetupJourney', () => {
  it('builds a guided setup path from legal entity through manager hierarchy', () => {
    const steps = buildOrganizationSetupJourney({
      assignedWorkerCount: 3,
      legalEntityCount: 1,
      managerRelationshipCount: 2,
      orgUnitCount: 4,
      workerCount: 5,
    });

    expect(steps.map((step) => step.label)).toEqual([
      'Legal Entity',
      'Departments',
      'Employee Records',
      'Assignments',
      'Manager Hierarchy',
      'Workforce Planning',
    ]);
    expect(steps.every((step) => step.completed)).toBe(true);
    expect(steps[0]).toMatchObject({ status: '1 configured', targetTab: 'entities', tone: 'success' });
    expect(steps[2]).toMatchObject({ href: '/admin/employees/new', status: '5 workers', tone: 'success' });
    expect(steps[4]).toMatchObject({ targetTab: 'managers', status: '2 reporting lines', tone: 'success' });
  });

  it('marks missing setup steps as action required', () => {
    const steps = buildOrganizationSetupJourney({
      assignedWorkerCount: 0,
      legalEntityCount: 0,
      managerRelationshipCount: 0,
      orgUnitCount: 0,
      workerCount: 0,
    });

    expect(steps[0]).toMatchObject({ completed: false, status: 'Start here', actionLabel: 'Add entity', tone: 'attention' });
    expect(steps[1]).toMatchObject({ completed: false, status: 'Needs entity', targetTab: 'entities', tone: 'warning' });
    expect(steps[2]).toMatchObject({ completed: false, status: 'No workers', href: '/admin/employees/new', tone: 'attention' });
    expect(steps[3]).toMatchObject({ completed: false, status: 'No assignments', targetTab: 'assignments', tone: 'warning' });
    expect(steps[4]).toMatchObject({ completed: false, status: 'No managers', targetTab: 'managers', tone: 'warning' });
  });
});
