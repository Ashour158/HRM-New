import { describe, expect, it } from 'vitest';
import { parseEmployeeCsv } from './employee-csv';

describe('parseEmployeeCsv', () => {
  it('parses quoted employee migration values with commas and escaped quotes', () => {
    const rows = parseEmployeeCsv([
      'employeeId,firstName,lastName,workEmail,department,legalEntityId,departmentId,managerEmployeeId,jobTitle,grossSalary,currency',
      'EMP-100,"Mona, Senior","Hassan ""Ops""",mona@example.com,"People, Finance",22222222-2222-4222-8222-222222222222,33333333-3333-4333-8333-333333333333,MGR-001,PAYROLL_SPECIALIST,12000,EGP',
    ].join('\n'));

    expect(rows).toEqual([{
      employeeId: 'EMP-100',
      firstName: 'Mona, Senior',
      lastName: 'Hassan "Ops"',
      workEmail: 'mona@example.com',
      department: 'People, Finance',
      legalEntityId: '22222222-2222-4222-8222-222222222222',
      departmentId: '33333333-3333-4333-8333-333333333333',
      managerEmployeeId: 'MGR-001',
      jobTitle: 'PAYROLL_SPECIALIST',
      grossSalary: 12000,
      currency: 'EGP',
    }]);
  });
});
