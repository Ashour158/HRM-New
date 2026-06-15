import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PreviewPanel, RuleRow, WorkflowStepBuilder } from '.';

describe('builder primitives accessibility', () => {
  it('renders without accessibility violations', async () => {
    const { container } = render(
      <div>
        <WorkflowStepBuilder
          index={0}
          code="HR_REVIEW"
          label="HR review"
          order={1}
          mode="SEQUENTIAL"
          approverType="ROLE"
          approverRole="HR_ADMIN"
          slaHours={24}
          onChange={vi.fn()}
          onMove={vi.fn()}
          onRemove={vi.fn()}
        />
        <RuleRow code="LATE_GRACE" label="Late arrival grace" outcome="Deduct" />
        <PreviewPanel items={[{ label: 'Steps', value: 2 }]} />
      </div>,
    );

    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
