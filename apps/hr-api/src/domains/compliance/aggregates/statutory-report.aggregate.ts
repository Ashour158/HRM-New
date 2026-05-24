import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * Status values for the {@link StatutoryReport} lifecycle.
 */
export type StatutoryReportStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATED'
  | 'FILED'
  | 'ACCEPTED'
  | 'REJECTED';

/**
 * Properties required to construct a {@link StatutoryReport}.
 */
export interface StatutoryReportProps {
  id: Uuid;
  tenantId: Uuid;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  legalEntityId: Uuid;
  content: Record<string, unknown>;
  submittedAt?: Date;
  filedAt?: Date;
  status?: StatutoryReportStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class StatutoryReportSubmitted extends DomainEvent {
  readonly reportType: string;
  readonly reportingPeriod: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    reportType: string;
    reportingPeriod: string;
  }) {
    super({
      eventName: 'StatutoryReportSubmitted',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryReport',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.reportType = props.reportType;
    this.reportingPeriod = props.reportingPeriod;
  }
}

export class StatutoryReportValidated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'StatutoryReportValidated',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryReport',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class StatutoryReportFiled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'StatutoryReportFiled',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryReport',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class StatutoryReportAccepted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'StatutoryReportAccepted',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryReport',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class StatutoryReportRejected extends DomainEvent {
  readonly reason?: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason?: string }) {
    super({
      eventName: 'StatutoryReportRejected',
      tenantId: props.tenantId,
      aggregateType: 'StatutoryReport',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.reason = props.reason;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aggregate root representing a statutory report filed with a government authority.
 *
 * FSM lifecycle: DRAFT → SUBMITTED → VALIDATED → FILED → ACCEPTED
 *                                    └→ REJECTED (terminal)
 */
export class StatutoryReport extends AggregateRoot {
  readonly tenantId: Uuid;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  legalEntityId: Uuid;
  content: Record<string, unknown>;
  submittedAt?: Date;
  filedAt?: Date;
  status: StatutoryReportStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: StatutoryReportProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportType = props.reportType;
    this.reportingPeriod = props.reportingPeriod;
    this.countryCode = props.countryCode;
    this.legalEntityId = props.legalEntityId;
    this.content = props.content;
    this.submittedAt = props.submittedAt;
    this.filedAt = props.filedAt;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new StatutoryReport in DRAFT state.
   */
  static create(props: StatutoryReportProps, correlationId: Uuid): StatutoryReport {
    Guard.againstEmptyString(props.reportType, 'reportType');
    Guard.againstEmptyString(props.reportingPeriod, 'reportingPeriod');
    Guard.againstEmptyString(props.countryCode, 'countryCode');

    const report = new StatutoryReport({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    report.addDomainEvent(
      new StatutoryReportSubmitted({
        tenantId: report.tenantId,
        aggregateId: report.id,
        correlationId,
        reportType: report.reportType,
        reportingPeriod: report.reportingPeriod,
      }),
    );

    return report;
  }

  /**
   * Submit the report (DRAFT → SUBMITTED).
   */
  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ValidationError(`Cannot submit from state ${this.status}`);
    }
    this.status = 'SUBMITTED';
    this.submittedAt = new Date();
    this.addDomainEvent(
      new StatutoryReportSubmitted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        reportType: this.reportType,
        reportingPeriod: this.reportingPeriod,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Validate the report (SUBMITTED → VALIDATED).
   */
  validate(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') {
      throw new ValidationError(`Cannot validate from state ${this.status}`);
    }
    this.status = 'VALIDATED';
    this.addDomainEvent(
      new StatutoryReportValidated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * File the report (VALIDATED → FILED).
   */
  file(correlationId: Uuid): void {
    if (this.status !== 'VALIDATED') {
      throw new ValidationError(`Cannot file from state ${this.status}`);
    }
    this.status = 'FILED';
    this.filedAt = new Date();
    this.addDomainEvent(
      new StatutoryReportFiled({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Mark the report as accepted (FILED → ACCEPTED).
   */
  accept(correlationId: Uuid): void {
    if (this.status !== 'FILED') {
      throw new ValidationError(`Cannot accept from state ${this.status}`);
    }
    this.status = 'ACCEPTED';
    this.addDomainEvent(
      new StatutoryReportAccepted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Reject the report (SUBMITTED | VALIDATED | FILED → REJECTED).
   */
  reject(correlationId: Uuid, reason?: string): void {
    if (this.status !== 'SUBMITTED' && this.status !== 'VALIDATED' && this.status !== 'FILED') {
      throw new ValidationError(`Cannot reject from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.addDomainEvent(
      new StatutoryReportRejected({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        reason,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
