import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

/**
 * Properties required to construct or rehydrate a {@link HeadcountBudget} aggregate.
 */
export interface HeadcountBudgetProps {
  id: Uuid;
  tenantId: Uuid;
  departmentId: Uuid;
  fiscalYear: number;
  ceiling: number;
  setBy: Uuid;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ── Domain Events ─────────────────────────────────────────────── */

class HeadcountBudgetSet extends DomainEvent {}
class HeadcountBudgetCeilingUpdated extends DomainEvent {}

/* ── Aggregate ─────────────────────────────────────────────────── */

/**
 * HeadcountBudget aggregate root.
 *
 * Represents the budgeted FTE/headcount ceiling for a single org unit
 * (`departmentId`) for a single fiscal year. There is at most one
 * HeadcountBudget per (tenantId, departmentId, fiscalYear) tuple — see the
 * `headcount_budgets_tenant_department_year_unique` constraint.
 *
 * This is a deliberately minimal aggregate: it has no FSM/lifecycle states
 * (unlike Position/HeadcountRequest). It only ever exists in one implicit
 * "configured" state; `updateCeiling` re-sets the ceiling in place rather
 * than transitioning between named states.
 */
export class HeadcountBudget extends AggregateRoot {
  readonly tenantId: Uuid;
  readonly departmentId: Uuid;
  readonly fiscalYear: number;
  ceiling: number;
  setBy: Uuid;
  createdAt: Date;
  updatedAt: Date;

  private constructor(props: HeadcountBudgetProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.departmentId = props.departmentId;
    this.fiscalYear = props.fiscalYear;
    this.ceiling = props.ceiling;
    this.setBy = props.setBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();

    if (props.aggregateVersion) {
      for (let i = 0; i < props.aggregateVersion; i++) {
        this.incrementVersion();
      }
    }
  }

  /**
   * Factory method that creates a new HeadcountBudget.
   */
  static create(props: HeadcountBudgetProps): HeadcountBudget {
    HeadcountBudget.assertValidCeiling(props.ceiling);
    HeadcountBudget.assertValidFiscalYear(props.fiscalYear);
    const budget = new HeadcountBudget(props);
    budget.addDomainEvent(
      new HeadcountBudgetSet({
        eventName: 'HeadcountBudgetSet',
        tenantId: budget.tenantId,
        aggregateType: 'headcountBudget',
        aggregateId: budget.id,
        correlationId: props.id,
      }),
    );
    return budget;
  }

  /**
   * Rehydrate an existing HeadcountBudget without emitting creation events.
   */
  static restore(props: HeadcountBudgetProps): HeadcountBudget {
    return new HeadcountBudget(props);
  }

  /**
   * Re-set the budgeted ceiling for this org unit/fiscal year.
   */
  updateCeiling(newCeiling: number, setBy: Uuid, correlationId: Uuid): void {
    HeadcountBudget.assertValidCeiling(newCeiling);
    this.ceiling = newCeiling;
    this.setBy = setBy;
    this.bumpVersion();
    this.addDomainEvent(
      new HeadcountBudgetCeilingUpdated({
        eventName: 'HeadcountBudgetCeilingUpdated',
        tenantId: this.tenantId,
        aggregateType: 'headcountBudget',
        aggregateId: this.id,
        correlationId,
        version: this.version,
      }),
    );
  }

  private static assertValidCeiling(ceiling: number): void {
    if (!Number.isInteger(ceiling) || ceiling < 0) {
      throw new ValidationError('Headcount budget ceiling must be a non-negative integer');
    }
  }

  private static assertValidFiscalYear(fiscalYear: number): void {
    if (!Number.isInteger(fiscalYear) || fiscalYear < 1900) {
      throw new ValidationError('Headcount budget fiscal year must be a valid integer year');
    }
  }

  private bumpVersion(): void {
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
