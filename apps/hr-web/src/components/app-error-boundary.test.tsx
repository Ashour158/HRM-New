import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './app-error-boundary';

function BrokenWidget() {
  throw new Error('render failed');
  return null;
}

describe('AppErrorBoundary', () => {
  it('shows a business-readable recovery panel when a screen crashes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenWidget />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    expect(screen.queryByText(/render failed/i)).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
