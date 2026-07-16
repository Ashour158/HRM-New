import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminModuleWorkbench } from './module-workbench';

function renderWorkbench() {
  return render(
    <MemoryRouter initialEntries={['/admin/modules/benefits']}>
      <Routes>
        <Route path="/admin/modules/:moduleId" element={<AdminModuleWorkbench />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminModuleWorkbench accessibility', () => {
  it('renders without accessibility violations', async () => {
    const { container } = renderWorkbench();

    expect(await screen.findByRole('heading', { name: /Benefits/i })).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
