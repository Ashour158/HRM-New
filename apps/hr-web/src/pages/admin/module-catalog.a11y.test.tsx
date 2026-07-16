import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminModuleCatalog } from './module-catalog';

describe('AdminModuleCatalog accessibility', () => {
  it('renders without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <AdminModuleCatalog />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'All Built HR Modules' })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
