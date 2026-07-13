import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ADMIN_MORE_LINKS, ADMIN_PRIMARY_MODULES } from '@/lib/admin-nav-modules';
import { AdminPrimaryNav } from './admin-primary-nav';

function renderNav(canSeeSystemConsole = true, initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminPrimaryNav canSeeSystemConsole={canSeeSystemConsole} />
    </MemoryRouter>,
  );
}

describe('AdminPrimaryNav', () => {
  it('renders all 11 primary modules plus a trailing More flyout', () => {
    renderNav();

    ADMIN_PRIMARY_MODULES.forEach((module) => {
      expect(screen.getByText(module.label)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'More menu' })).toBeInTheDocument();

    // Exactly 11 primary modules - the spec calls for 11 always-visible
    // module tabs plus a distinct trailing More flyout.
    expect(ADMIN_PRIMARY_MODULES).toHaveLength(11);
  });

  it('expands a multi-page module into its member links on click', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole('button', { name: 'Governance menu' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Compliance' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Country Policy' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Union & Labor' })).toBeInTheDocument();
  });

  it('renders a single-page module as a direct link with no dropdown', () => {
    renderNav();

    const learningLink = screen.getByRole('link', { name: /Learning/i });
    expect(learningLink).toHaveAttribute('href', '/admin/learning');
    expect(screen.queryByRole('button', { name: 'Learning menu' })).not.toBeInTheDocument();
  });

  it('opens and closes the More flyout', async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = screen.getByRole('button', { name: 'More menu' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Module Catalog' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('every ADMIN_MORE_LINKS entry is reachable once More is open (with system console access)', async () => {
    const user = userEvent.setup();
    renderNav(true);

    await user.click(screen.getByRole('button', { name: 'More menu' }));
    const menu = await screen.findByRole('menu');

    ADMIN_MORE_LINKS.forEach((link) => {
      expect(within(menu).getByRole('menuitem', { name: link.label })).toBeInTheDocument();
    });
  });

  it('hides system-console-gated links from admins without system console access', async () => {
    const user = userEvent.setup();
    renderNav(false);

    await user.click(screen.getByRole('button', { name: 'Governance menu' }));
    const governanceMenu = await screen.findByRole('menu');
    expect(within(governanceMenu).queryByRole('menuitem', { name: 'Policy Center' })).not.toBeInTheDocument();
    expect(within(governanceMenu).getByRole('menuitem', { name: 'Compliance' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    // Every ADMIN_MORE_LINKS entry except Module Catalog is systemOnly, so
    // for a non-system-admin the flyout collapses to a single direct link
    // (no dropdown chevron) pointing straight at Module Catalog.
    expect(screen.queryByRole('button', { name: 'More menu' })).not.toBeInTheDocument();
    const moreLink = screen.getByRole('link', { name: /More/i });
    expect(moreLink).toHaveAttribute('href', '/admin/modules');
  });

  it('marks the active module based on the current route', () => {
    renderNav(true, '/admin/compliance');
    const governanceTrigger = screen.getByRole('button', { name: 'Governance menu' });
    expect(governanceTrigger.className).toMatch(/text-indigo-700/);
  });
});
