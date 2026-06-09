import { describe, expect, it } from 'vitest';
import { parseEmployeeCsv } from './employee-csv';

describe('parseEmployeeCsv', () => {
  it('parses quoted employee migration values with commas and escaped quotes', () => {
    const rows = parseEmployeeCsv([
      'employeeId,firstName,lastName,workEmail,department,jobTitle,grossSalary,currency',
      'EMP-100,"Mona, Senior","Hassan ""Ops""",mona@example.com,"People, Finance",PAYROLL_SPECIALIST,12000,EGP',
    ].join('\n'));

    expect(rows).toEqual([{
      employeeId: 'EMP-100',
      firstName: 'Mona, Senior',
      lastName: 'Hassan "Ops"',
      workEmail: 'mona@example.com',
      department: 'People, Finance',
      jobTitle: 'PAYROLL_SPECIALIST',
      grossSalary: 12000,
      currency: 'EGP',
    }]);
  });
});
