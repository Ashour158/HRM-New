import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ModuleConfigureLauncher } from './module-configure-launcher';

describe('ModuleConfigureLauncher', () => {
  it('deep-links into Policy Center, Approvals Config, and Access Governance pre-scoped to the module', () => {
    render(
      <MemoryRouter>
        <ModuleConfigureLauncher
          moduleName="Compensation"
          policyArea="PAYROLL"
          approvalCommandKeyword="Compensation"
          fieldAccessEntity="compensation"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Configure Compensation')).toBeInTheDocument();

    const policiesLink = screen.getByRole('link', { name: /Compensation Policies/ });
    expect(policiesLink).toHaveAttribute('href', '/admin/system-console/policies?area=PAYROLL');

    const approvalsLink = screen.getByRole('link', { name: /Approval Paths/ });
    expect(approvalsLink).toHaveAttribute('href', '/admin/system-console/approvals?command=Compensation');

    const fieldAccessLink = screen.getByRole('link', { name: /Field Access/ });
    expect(fieldAccessLink).toHaveAttribute('href', '/admin/system-console/access-governance?entity=compensation');
  });

  it('falls back to the unfiltered Policy Center when the module has no dedicated policy area', () => {
    render(
      <MemoryRouter>
        <ModuleConfigureLauncher
          moduleName="Learning"
          approvalCommandKeyword="Learning"
          fieldAccessEntity="learning"
        />
      </MemoryRouter>,
    );

    const policiesLink = screen.getByRole('link', { name: /Policy Center/ });
    expect(policiesLink).toHaveAttribute('href', '/admin/system-console/policies');
    expect(screen.getByText(/shared Policy Center/)).toBeInTheDocument();
  });

  it('URL-encodes query param values', () => {
    render(
      <MemoryRouter>
        <ModuleConfigureLauncher
          moduleName="Recruiting"
          approvalCommandKeyword="Recruit & Hire"
          fieldAccessEntity="recruit ing"
        />
      </MemoryRouter>,
    );

    const approvalsLink = screen.getByRole('link', { name: /Approval Paths/ });
    expect(approvalsLink).toHaveAttribute('href', '/admin/system-console/approvals?command=Recruit%20%26%20Hire');

    const fieldAccessLink = screen.getByRole('link', { name: /Field Access/ });
    expect(fieldAccessLink).toHaveAttribute('href', '/admin/system-console/access-governance?entity=recruit%20ing');
  });
});
