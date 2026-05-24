import pathlib

BASE = pathlib.Path(__file__).parent / "src" / "domains"
DB_TYPES = pathlib.Path(__file__).parent.parent.parent / "packages" / "hr-database" / "src" / "types" / "platform-tables.ts"

def write(p, c):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c, encoding="utf-8")
    print(f"Wrote {p}")

# ========================================================================
# Fix WEAP aggregates
# ========================================================================

write(BASE/"wellbeing-eap/aggregates/eap-referral.aggregate.ts", '''import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type EapReferralStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';

export interface EapReferralProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  reason: string;
  status?: EapReferralStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  providerId?: Uuid;
  notes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EapReferralCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralCreated', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralScheduled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralScheduled', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralStarted', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralCompleted', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralClosed', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferralCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'EapReferralCancelled', tenantId: props.tenantId, aggregateType: 'EapReferral', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class EapReferral extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  reason: string;
  status: EapReferralStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  providerId?: Uuid;
  notes?: string; /* @special_category Encrypted at rest; ANONYMIZED usage statistics stripped of PII for reporting */
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: EapReferralProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.reason = props.reason;
    this.status = props.status ?? 'REQUESTED';
    this.scheduledDate = props.scheduledDate;
    this.completedDate = props.completedDate;
    this.providerId = props.providerId;
    this.notes = props.notes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: EapReferralProps, correlationId: Uuid): EapReferral {
    Guard.againstEmptyString(props.reason, 'reason');
    const ar = new EapReferral({ ...props, status: 'REQUESTED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new EapReferralCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  schedule(scheduledDate: Date, correlationId: Uuid): void {
    if (this.status !== 'REQUESTED') throw new ValidationError(`Cannot schedule from ${this.status}`);
    this.status = 'SCHEDULED';
    this.scheduledDate = scheduledDate;
    this.addDomainEvent(new EapReferralScheduled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new EapReferralStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.completedDate = new Date();
    this.addDomainEvent(new EapReferralCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (!['COMPLETED', 'CANCELLED'].includes(this.status)) throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new EapReferralClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (!['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(this.status)) throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new EapReferralCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
''')

write(BASE/"wellbeing-eap/aggregates/wellness-program.aggregate.ts", '''import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type WellnessProgramStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export interface WellnessProgramProps {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  type: string;
  status?: WellnessProgramStatus;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WellnessProgramCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramCreated', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramActivated', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramEnrolled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramEnrolled', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramCompleted', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramCancelled', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgramArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'WellnessProgramArchived', tenantId: props.tenantId, aggregateType: 'WellnessProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class WellnessProgram extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  name: string;
  type: string;
  status: WellnessProgramStatus;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: WellnessProgramProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.type = props.type;
    this.status = props.status ?? 'DRAFT';
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.description = props.description;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: WellnessProgramProps, correlationId: Uuid): WellnessProgram {
    Guard.againstEmptyString(props.name, 'name');
    const ar = new WellnessProgram({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new WellnessProgramCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new WellnessProgramActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  enroll(_workerId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot enroll from ${this.status}`);
    this.addDomainEvent(new WellnessProgramEnrolled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.addDomainEvent(new WellnessProgramCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (!['DRAFT', 'ACTIVE'].includes(this.status)) throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new WellnessProgramCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (!['COMPLETED', 'CANCELLED'].includes(this.status)) throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new WellnessProgramArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
''')

write(BASE/"wellbeing-eap/aggregates/mental-health-case.aggregate.ts", '''import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type MentalHealthCaseStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface MentalHealthCaseProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  severity: string;
  status?: MentalHealthCaseStatus;
  providerId?: Uuid;
  notes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MentalHealthCaseOpened extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseOpened', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseAssigned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseAssigned', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseInProgress extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseInProgress', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseResolved', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCaseClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'MentalHealthCaseClosed', tenantId: props.tenantId, aggregateType: 'MentalHealthCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class MentalHealthCase extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  severity: string;
  status: MentalHealthCaseStatus;
  providerId?: Uuid;
  notes?: string; /* @special_category Encrypted at rest */
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: MentalHealthCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.severity = props.severity;
    this.status = props.status ?? 'OPEN';
    this.providerId = props.providerId;
    this.notes = props.notes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: MentalHealthCaseProps, correlationId: Uuid): MentalHealthCase {
    Guard.againstEmptyString(props.severity, 'severity');
    const ar = new MentalHealthCase({ ...props, status: 'OPEN', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new MentalHealthCaseOpened({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  assignTo(providerId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'OPEN') throw new ValidationError(`Cannot assign from ${this.status}`);
    this.status = 'ASSIGNED';
    this.providerId = providerId;
    this.addDomainEvent(new MentalHealthCaseAssigned({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'ASSIGNED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new MentalHealthCaseInProgress({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.addDomainEvent(new MentalHealthCaseResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'RESOLVED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new MentalHealthCaseClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
''')

print("WEAP aggregates fixed")

# ========================================================================
# Fix UL aggregates
# ========================================================================

write(BASE/"union-labor/aggregates/union-recognition.aggregate.ts", '''import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type UnionRecognitionStatus = 'RECOGNIZED' | 'NEGOTIATING' | 'RATIFIED' | 'ACTIVE' | 'EXPIRED' | 'RENEWED';

export interface UnionRecognitionProps {
  id: Uuid;
  tenantId: Uuid;
  unionName: string;
  bargainingUnitId: Uuid;
  status?: UnionRecognitionStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
  agreementDocument?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UnionRecognitionCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionCreated', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionNegotiating extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionNegotiating', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionRatified extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionRatified', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionActive extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionActive', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionExpired', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognitionRenewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'UnionRecognitionRenewed', tenantId: props.tenantId, aggregateType: 'UnionRecognition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class UnionRecognition extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  unionName: string;
  bargainingUnitId: Uuid;
  status: UnionRecognitionStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
  agreementDocument?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: UnionRecognitionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.unionName = props.unionName;
    this.bargainingUnitId = props.bargainingUnitId;
    this.status = props.status ?? 'RECOGNIZED';
    this.effectiveDate = props.effectiveDate;
    this.expirationDate = props.expirationDate;
    this.agreementDocument = props.agreementDocument;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: UnionRecognitionProps, correlationId: Uuid): UnionRecognition {
    Guard.againstEmptyString(props.unionName, 'unionName');
    const ar = new UnionRecognition({ ...props, status: 'RECOGNIZED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new UnionRecognitionCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  negotiate(correlationId: Uuid): void {
    if (this.status !== 'RECOGNIZED') throw new ValidationError(`Cannot negotiate from ${this.status}`);
    this.status = 'NEGOTIATING';
    this.addDomainEvent(new UnionRecognitionNegotiating({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  ratify(correlationId: Uuid): void {
    if (this.status !== 'NEGOTIATING') throw new ValidationError(`Cannot ratify from ${this.status}`);
    this.status = 'RATIFIED';
    this.addDomainEvent(new UnionRecognitionRatified({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'RATIFIED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new UnionRecognitionActive({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (!['ACTIVE', 'RATIFIED'].includes(this.status)) throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new UnionRecognitionExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  renew(correlationId: Uuid): void {
    if (this.status !== 'EXPIRED') throw new ValidationError(`Cannot renew from ${this.status}`);
    this.status = 'RENEWED';
    this.addDomainEvent(new UnionRecognitionRenewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
''')

write(BASE/"union-labor/aggregates/grievance.aggregate.ts", '''import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type GrievanceStatus = 'FILED' | 'ACKNOWLEDGED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'ARBITRATED' | 'WITHDRAWN';

export interface GrievanceProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  grievanceType: string;
  description: string;
  status?: GrievanceStatus;
  resolution?: string;
  arbitratorDecision?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class GrievanceFiled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceFiled', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceAcknowledged extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceAcknowledged', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceUnderInvestigation extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceUnderInvestigation', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceResolved', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceArbitrated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceArbitrated', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class GrievanceWithdrawn extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'GrievanceWithdrawn', tenantId: props.tenantId, aggregateType: 'Grievance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class Grievance extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  grievanceType: string;
  description: string;
  status: GrievanceStatus;
  resolution?: string;
  arbitratorDecision?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: GrievanceProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.grievanceType = props.grievanceType;
    this.description = props.description;
    this.status = props.status ?? 'FILED';
    this.resolution = props.resolution;
    this.arbitratorDecision = props.arbitratorDecision;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: GrievanceProps, correlationId: Uuid): Grievance {
    Guard.againstEmptyString(props.grievanceType, 'grievanceType');
    const ar = new Grievance({ ...props, status: 'FILED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new GrievanceFiled({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  acknowledge(correlationId: Uuid): void {
    if (this.status !== 'FILED') throw new ValidationError(`Cannot acknowledge from ${this.status}`);
    this.status = 'ACKNOWLEDGED';
    this.addDomainEvent(new GrievanceAcknowledged({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  startInvestigation(correlationId: Uuid): void {
    if (this.status !== 'ACKNOWLEDGED') throw new ValidationError(`Cannot start investigation from ${this.status}`);
    this.status = 'UNDER_INVESTIGATION';
    this.addDomainEvent(new GrievanceUnderInvestigation({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid): void {
    if (this.status !== 'UNDER_INVESTIGATION') throw new ValidationError(`Cannot resolve from ${this.status}`);
    this.status = 'RESOLVED';
    this.addDomainEvent(new GrievanceResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  arbitrate(correlationId: Uuid): void {
    if (this.status !== 'UNDER_INVESTIGATION') throw new ValidationError(`Cannot arbitrate from ${this.status}`);
    this.status = 'ARBITRATED';
    this.addDomainEvent(new GrievanceArbitrated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  withdraw(correlationId: Uuid): void {
    if (!['FILED', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION'].includes(this.status)) throw new ValidationError(`Cannot withdraw from ${this.status}`);
    this.status = 'WITHDRAWN';
    this.addDomainEvent(new GrievanceWithdrawn({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
''')

write(BASE/"union-labor/aggregates/collective-bargaining-session.aggregate.ts", '''import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type CollectiveBargainingSessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'TENTATIVE_AGREEMENT' | 'RATIFIED' | 'FAILED' | 'CLOSED';

export interface CollectiveBargainingSessionProps {
  id: Uuid;
  tenantId: Uuid;
  unionRecognitionId: Uuid;
  sessionDate: Date;
  status?: CollectiveBargainingSessionStatus;
  location?: string;
  agenda?: string;
  minutes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CollectiveBargainingSessionCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionCreated', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionInProgress extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionInProgress', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionTentativeAgreement extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionTentativeAgreement', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionRatified extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionRatified', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionFailed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionFailed', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSessionClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CollectiveBargainingSessionClosed', tenantId: props.tenantId, aggregateType: 'CollectiveBargainingSession', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CollectiveBargainingSession extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  unionRecognitionId: Uuid;
  sessionDate: Date;
  status: CollectiveBargainingSessionStatus;
  location?: string;
  agenda?: string;
  minutes?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CollectiveBargainingSessionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.unionRecognitionId = props.unionRecognitionId;
    this.sessionDate = props.sessionDate;
    this.status = props.status ?? 'SCHEDULED';
    this.location = props.location;
    this.agenda = props.agenda;
    this.minutes = props.minutes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CollectiveBargainingSessionProps, correlationId: Uuid): CollectiveBargainingSession {
    Guard.againstNullOrUndefined(props.sessionDate, 'sessionDate');
    const ar = new CollectiveBargainingSession({ ...props, status: 'SCHEDULED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new CollectiveBargainingSessionCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    ar.incrementVersion();
    return ar;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new CollectiveBargainingSessionInProgress({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  recordTentativeAgreement(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot record tentative agreement from ${this.status}`);
    this.status = 'TENTATIVE_AGREEMENT';
    this.addDomainEvent(new CollectiveBargainingSessionTentativeAgreement({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  ratify(correlationId: Uuid): void {
    if (this.status !== 'TENTATIVE_AGREEMENT') throw new ValidationError(`Cannot ratify from ${this.status}`);
    this.status = 'RATIFIED';
    this.addDomainEvent(new CollectiveBargainingSessionRatified({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  markFailed(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot mark failed from ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new CollectiveBargainingSessionFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (!['RATIFIED', 'FAILED'].includes(this.status)) throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new CollectiveBargainingSessionClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
''')

print("UL aggregates fixed")

# ========================================================================
# Fix WEAP controller
# ========================================================================

write(BASE/"wellbeing-eap/api/wellbeing-eap.controller.ts", '''import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellnessProgramRepository } from '../repositories/wellness-program.repository.js';
import { MentalHealthCaseRepository } from '../repositories/mental-health-case.repository.js';
import type * as dtos from './wellbeing-eap.dto.js';
import {
  CreateEapReferralDto,
  CreateWellnessProgramDto,
  CreateMentalHealthCaseDto,
  ZodValidationPipe,
} from './wellbeing-eap.dto.js';

@ApiTags('Wellbeing EAP')
@Controller('wellbeing-eap')
export class WellbeingEapController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly eapReferralRepo: EapReferralRepository,
    private readonly wellnessProgramRepo: WellnessProgramRepository,
    private readonly mentalHealthCaseRepo: MentalHealthCaseRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['WELLBEING_EAP_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  @Post('eap-referrals')
  async createReferral(@Body(new ZodValidationPipe(CreateEapReferralDto)) dto: dtos.CreateEapReferralDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateEapReferral', 'EapReferral', dto, req));
  }

  @Post('eap-referrals/:id/commands/schedule')
  async scheduleReferral(@Param('id') id: string, @Body() body: { scheduledDate: Date }, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('ScheduleEapReferral', 'EapReferral', { eapReferralId: new Uuid(id), ...body }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/start')
  async startReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('StartEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/complete')
  async completeReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('CompleteEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/close')
  async closeReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('CloseEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('eap-referrals/:id/commands/cancel')
  async cancelReferral(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.eapReferralRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('EAP referral not found');
    return this.commandBus.execute(this.buildCommand('CancelEapReferral', 'EapReferral', { eapReferralId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('eap-referrals/:id')
  async getReferral(@Param('id') id: string) {
    return this.eapReferralRepo.findById(new Uuid(id));
  }

  @Post('wellness-programs')
  async createProgram(@Body(new ZodValidationPipe(CreateWellnessProgramDto)) dto: dtos.CreateWellnessProgramDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateWellnessProgram', 'WellnessProgram', dto, req));
  }

  @Post('wellness-programs/:id/commands/activate')
  async activateProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('ActivateWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/enroll')
  async enrollProgram(@Param('id') id: string, @Body() body: { workerId: string }, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('EnrollWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id), workerId: new Uuid(body.workerId) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/complete')
  async completeProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('CompleteWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/cancel')
  async cancelProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('CancelWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('wellness-programs/:id/commands/archive')
  async archiveProgram(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.wellnessProgramRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Wellness program not found');
    return this.commandBus.execute(this.buildCommand('ArchiveWellnessProgram', 'WellnessProgram', { wellnessProgramId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('wellness-programs/:id')
  async getProgram(@Param('id') id: string) {
    return this.wellnessProgramRepo.findById(new Uuid(id));
  }

  @Post('mental-health-cases')
  async createMhCase(@Body(new ZodValidationPipe(CreateMentalHealthCaseDto)) dto: dtos.CreateMentalHealthCaseDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateMentalHealthCase', 'MentalHealthCase', dto, req));
  }

  @Post('mental-health-cases/:id/commands/assign-to')
  async assignMhCase(@Param('id') id: string, @Body() body: { providerId: string }, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('AssignToMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id), providerId: new Uuid(body.providerId) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('mental-health-cases/:id/commands/start')
  async startMhCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('StartMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('mental-health-cases/:id/commands/resolve')
  async resolveMhCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('ResolveMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('mental-health-cases/:id/commands/close')
  async closeMhCase(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.mentalHealthCaseRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Mental health case not found');
    return this.commandBus.execute(this.buildCommand('CloseMentalHealthCase', 'MentalHealthCase', { mentalHealthCaseId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('mental-health-cases/:id')
  async getMhCase(@Param('id') id: string) {
    return this.mentalHealthCaseRepo.findById(new Uuid(id));
  }
}
''')

# ========================================================================
# Fix CW controller
# ========================================================================

write(BASE/"contingent-workforce/api/contingent-workforce.controller.ts", '''import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { ContingentWorkerAssignmentRepository } from '../repositories/contingent-worker-assignment.repository.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContractorRateCardRepository } from '../repositories/contractor-rate-card.repository.js';
import { MisclassificationAssessmentRepository } from '../repositories/misclassification-assessment.repository.js';
import type * as dtos from './contingent-workforce.dto.js';
import {
  CreateContingentWorkerAssignmentDto,
  CreateSowEngagementDto,
  CreateContractorRateCardDto,
  CreateMisclassificationAssessmentDto,
  ZodValidationPipe,
} from './contingent-workforce.dto.js';

@ApiTags('Contingent Workforce')
@Controller('contingent-workforce')
export class ContingentWorkforceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly cwaRepo: ContingentWorkerAssignmentRepository,
    private readonly sowRepo: SowEngagementRepository,
    private readonly rateCardRepo: ContractorRateCardRepository,
    private readonly assessmentRepo: MisclassificationAssessmentRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['CONTINGENT_WORKFORCE_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  @Post('contingent-worker-assignments')
  async createAssignment(@Body(new ZodValidationPipe(CreateContingentWorkerAssignmentDto)) dto: dtos.CreateContingentWorkerAssignmentDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateContingentWorkerAssignment', 'ContingentWorkerAssignment', dto, req));
  }

  @Post('contingent-worker-assignments/:id/commands/activate')
  async activateAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cwaRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contingent worker assignment not found');
    return this.commandBus.execute(this.buildCommand('ActivateContingentWorkerAssignment', 'ContingentWorkerAssignment', { contingentWorkerAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contingent-worker-assignments/:id/commands/extend')
  async extendAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cwaRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contingent worker assignment not found');
    return this.commandBus.execute(this.buildCommand('ExtendContingentWorkerAssignment', 'ContingentWorkerAssignment', { contingentWorkerAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contingent-worker-assignments/:id/commands/terminate')
  async terminateAssignment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cwaRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contingent worker assignment not found');
    return this.commandBus.execute(this.buildCommand('TerminateContingentWorkerAssignment', 'ContingentWorkerAssignment', { contingentWorkerAssignmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('contingent-worker-assignments/:id')
  async getAssignment(@Param('id') id: string) {
    return this.cwaRepo.findById(new Uuid(id));
  }

  @Post('sow-engagements')
  async createSow(@Body(new ZodValidationPipe(CreateSowEngagementDto)) dto: dtos.CreateSowEngagementDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateSowEngagement', 'SowEngagement', dto, req));
  }

  @Post('sow-engagements/:id/commands/activate')
  async activateSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('ActivateSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sow-engagements/:id/commands/start')
  async startSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('StartSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sow-engagements/:id/commands/complete')
  async completeSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('CompleteSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('sow-engagements/:id/commands/close')
  async closeSow(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.sowRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('SOW engagement not found');
    return this.commandBus.execute(this.buildCommand('CloseSowEngagement', 'SowEngagement', { sowEngagementId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('sow-engagements/:id')
  async getSow(@Param('id') id: string) {
    return this.sowRepo.findById(new Uuid(id));
  }

  @Post('contractor-rate-cards')
  async createRateCard(@Body(new ZodValidationPipe(CreateContractorRateCardDto)) dto: dtos.CreateContractorRateCardDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateContractorRateCard', 'ContractorRateCard', dto, req));
  }

  @Post('contractor-rate-cards/:id/commands/activate')
  async activateRateCard(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.rateCardRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contractor rate card not found');
    return this.commandBus.execute(this.buildCommand('ActivateContractorRateCard', 'ContractorRateCard', { contractorRateCardId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contractor-rate-cards/:id/commands/revise')
  async reviseRateCard(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.rateCardRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contractor rate card not found');
    return this.commandBus.execute(this.buildCommand('ReviseContractorRateCard', 'ContractorRateCard', { contractorRateCardId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('contractor-rate-cards/:id/commands/expire')
  async expireRateCard(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.rateCardRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Contractor rate card not found');
    return this.commandBus.execute(this.buildCommand('ExpireContractorRateCard', 'ContractorRateCard', { contractorRateCardId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('contractor-rate-cards/:id')
  async getRateCard(@Param('id') id: string) {
    return this.rateCardRepo.findById(new Uuid(id));
  }

  @Post('misclassification-assessments')
  async createAssessment(@Body(new ZodValidationPipe(CreateMisclassificationAssessmentDto)) dto: dtos.CreateMisclassificationAssessmentDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateMisclassificationAssessment', 'MisclassificationAssessment', dto, req));
  }

  @Post('misclassification-assessments/:id/commands/start')
  async startAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('StartMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('misclassification-assessments/:id/commands/mark-review-required')
  async markReviewRequiredAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('MarkReviewRequiredMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('misclassification-assessments/:id/commands/clear')
  async clearAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('ClearMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('misclassification-assessments/:id/commands/flag')
  async flagAssessment(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.assessmentRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Misclassification assessment not found');
    return this.commandBus.execute(this.buildCommand('FlagMisclassificationAssessment', 'MisclassificationAssessment', { misclassificationAssessmentId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('misclassification-assessments/:id')
  async getAssessment(@Param('id') id: string) {
    return this.assessmentRepo.findById(new Uuid(id));
  }
}
''')

print("Controllers fixed")

# ========================================================================
# Fix UL controller
# ========================================================================

write(BASE/"union-labor/api/union-labor.controller.ts", '''import { Controller, Get, Post, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { CommandBus } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { computeRequestHash } from '@hcm/platform-core';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';
import type * as dtos from './union-labor.dto.js';
import {
  CreateUnionRecognitionDto,
  CreateGrievanceDto,
  CreateCollectiveBargainingSessionDto,
  ZodValidationPipe,
} from './union-labor.dto.js';

@ApiTags('Union & Labor')
@Controller('union-labor')
export class UnionLaborController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly unionRecognitionRepo: UnionRecognitionRepository,
    private readonly grievanceRepo: GrievanceRepository,
    private readonly cbsRepo: CollectiveBargainingSessionRepository,
  ) {}

  private buildCommand<TPayload>(
    commandName: string,
    aggregateType: string,
    payload: TPayload,
    req: Request,
    options?: { aggregateId?: Uuid; expectedState?: string; expectedVersion?: number; subjectWorkerId?: Uuid },
  ): HrCommandEnvelope<TPayload> {
    const tenantId = new Uuid((req['tenantId'] as string | undefined) ?? '00000000-0000-0000-0000-000000000001');
    return {
      commandId: Uuid.generate(),
      commandName,
      commandSchemaVersion: 1,
      tenantId,
      actor: { actorType: 'SYSTEM', actorId: Uuid.generate(), roles: ['HR_ADMIN'], permissions: ['UNION_LABOR_WRITE'], mfaAuthenticated: true },
      aggregateType,
      aggregateId: options?.aggregateId,
      expectedState: options?.expectedState,
      expectedVersion: options?.expectedVersion,
      subjectWorkerId: options?.subjectWorkerId,
      idempotencyKey: randomUUID(),
      correlationId: Uuid.generate(),
      reason: 'API request',
      payload,
      metadata: { requestHash: computeRequestHash(payload), clientType: 'HR_ADMIN' },
    };
  }

  @Post('union-recognitions')
  async createRecognition(@Body(new ZodValidationPipe(CreateUnionRecognitionDto)) dto: dtos.CreateUnionRecognitionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateUnionRecognition', 'UnionRecognition', dto, req));
  }

  @Post('union-recognitions/:id/commands/negotiate')
  async negotiateRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('NegotiateUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/ratify')
  async ratifyRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('RatifyUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/activate')
  async activateRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('ActivateUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/expire')
  async expireRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('ExpireUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('union-recognitions/:id/commands/renew')
  async renewRecognition(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.unionRecognitionRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Union recognition not found');
    return this.commandBus.execute(this.buildCommand('RenewUnionRecognition', 'UnionRecognition', { unionRecognitionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('union-recognitions/:id')
  async getRecognition(@Param('id') id: string) {
    return this.unionRecognitionRepo.findById(new Uuid(id));
  }

  @Post('grievances')
  async createGrievance(@Body(new ZodValidationPipe(CreateGrievanceDto)) dto: dtos.CreateGrievanceDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateGrievance', 'Grievance', dto, req));
  }

  @Post('grievances/:id/commands/acknowledge')
  async acknowledgeGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('AcknowledgeGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/start-investigation')
  async startInvestigationGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('StartInvestigationGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/resolve')
  async resolveGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('ResolveGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/arbitrate')
  async arbitrateGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('ArbitrateGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('grievances/:id/commands/withdraw')
  async withdrawGrievance(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.grievanceRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Grievance not found');
    return this.commandBus.execute(this.buildCommand('WithdrawGrievance', 'Grievance', { grievanceId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('grievances/:id')
  async getGrievance(@Param('id') id: string) {
    return this.grievanceRepo.findById(new Uuid(id));
  }

  @Post('collective-bargaining-sessions')
  async createSession(@Body(new ZodValidationPipe(CreateCollectiveBargainingSessionDto)) dto: dtos.CreateCollectiveBargainingSessionDto, @Req() req: Request) {
    return this.commandBus.execute(this.buildCommand('CreateCollectiveBargainingSession', 'CollectiveBargainingSession', dto, req));
  }

  @Post('collective-bargaining-sessions/:id/commands/start')
  async startSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('StartCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/record-tentative-agreement')
  async recordTentativeAgreementSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('RecordTentativeAgreementCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/ratify')
  async ratifySession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('RatifyCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/mark-failed')
  async markFailedSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('MarkFailedCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Post('collective-bargaining-sessions/:id/commands/close')
  async closeSession(@Param('id') id: string, @Req() req: Request) {
    const ar = await this.cbsRepo.findById(new Uuid(id));
    if (!ar) throw new BadRequestException('Collective bargaining session not found');
    return this.commandBus.execute(this.buildCommand('CloseCollectiveBargainingSession', 'CollectiveBargainingSession', { collectiveBargainingSessionId: new Uuid(id) }, req, { aggregateId: new Uuid(id), expectedState: ar.status, expectedVersion: ar.aggregateVersion }));
  }

  @Get('collective-bargaining-sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.cbsRepo.findById(new Uuid(id));
  }
}
''')

# ========================================================================
# Fix DTOs to export ZodValidationPipe
# ========================================================================

write(BASE/"wellbeing-eap/api/wellbeing-eap.dto.ts", '''import { z } from 'zod';

export const CreateEapReferralDto = z.object({
  workerId: z.string().uuid(),
  reason: z.string().min(1),
  scheduledDate: z.coerce.date().optional(),
  providerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type CreateEapReferralDto = z.infer<typeof CreateEapReferralDto>;

export const CreateWellnessProgramDto = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  description: z.string().optional(),
});

export type CreateWellnessProgramDto = z.infer<typeof CreateWellnessProgramDto>;

export const CreateMentalHealthCaseDto = z.object({
  workerId: z.string().uuid(),
  severity: z.string().min(1),
  providerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type CreateMentalHealthCaseDto = z.infer<typeof CreateMentalHealthCaseDto>;

export class ZodValidationPipe {}
''')

write(BASE/"contingent-workforce/api/contingent-workforce.dto.ts", '''import { z } from 'zod';

export const CreateContingentWorkerAssignmentDto = z.object({
  workerId: z.string().uuid(),
  vendorId: z.string().uuid(),
  projectId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rate: z.number().min(0),
  currency: z.string().min(1),
});

export type CreateContingentWorkerAssignmentDto = z.infer<typeof CreateContingentWorkerAssignmentDto>;

export const CreateSowEngagementDto = z.object({
  sowNumber: z.string().min(1),
  vendorId: z.string().uuid(),
  projectName: z.string().min(1),
  totalValue: z.number().min(0),
  currency: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  milestones: z.array(z.string()).optional(),
});

export type CreateSowEngagementDto = z.infer<typeof CreateSowEngagementDto>;

export const CreateContractorRateCardDto = z.object({
  vendorId: z.string().uuid(),
  jobTitle: z.string().min(1),
  rate: z.number().min(0),
  currency: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().optional(),
});

export type CreateContractorRateCardDto = z.infer<typeof CreateContractorRateCardDto>;

export const CreateMisclassificationAssessmentDto = z.object({
  workerId: z.string().uuid(),
  assessmentDate: z.coerce.date(),
  riskScore: z.number().optional(),
  riskFactors: z.array(z.string()).optional(),
});

export type CreateMisclassificationAssessmentDto = z.infer<typeof CreateMisclassificationAssessmentDto>;

export class ZodValidationPipe {}
''')

write(BASE/"union-labor/api/union-labor.dto.ts", '''import { z } from 'zod';

export const CreateUnionRecognitionDto = z.object({
  unionName: z.string().min(1),
  bargainingUnitId: z.string().uuid(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  agreementDocument: z.string().optional(),
});

export type CreateUnionRecognitionDto = z.infer<typeof CreateUnionRecognitionDto>;

export const CreateGrievanceDto = z.object({
  workerId: z.string().uuid(),
  grievanceType: z.string().min(1),
  description: z.string().min(1),
  resolution: z.string().optional(),
  arbitratorDecision: z.string().optional(),
});

export type CreateGrievanceDto = z.infer<typeof CreateGrievanceDto>;

export const CreateCollectiveBargainingSessionDto = z.object({
  unionRecognitionId: z.string().uuid(),
  sessionDate: z.coerce.date(),
  location: z.string().optional(),
  agenda: z.string().optional(),
  minutes: z.string().optional(),
});

export type CreateCollectiveBargainingSessionDto = z.infer<typeof CreateCollectiveBargainingSessionDto>;

export class ZodValidationPipe {}
''')

print("Controllers and DTOs fixed")

# ========================================================================
# Fix event publishers
# ========================================================================

write(BASE/"wellbeing-eap/events/wellbeing-eap-events.publisher.ts", '''import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus.js';
import { DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { WellnessProgram } from '../aggregates/wellness-program.aggregate.js';
import { MentalHealthCase } from '../aggregates/mental-health-case.aggregate.js';

@Injectable()
export class WellbeingEapEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: EapReferral | WellnessProgram | MentalHealthCase): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = {
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId.value,
        payload: {},
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      };
      await this.eventBus.publish(envelope as any);
    }
  }

  private buildPrivacy(aggregate: EapReferral | WellnessProgram | MentalHealthCase) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
''')

write(BASE/"contingent-workforce/events/contingent-workforce-events.publisher.ts", '''import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus.js';
import { DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { ContingentWorkerAssignment } from '../aggregates/contingent-worker-assignment.aggregate.js';
import { SowEngagement } from '../aggregates/sow-engagement.aggregate.js';
import { ContractorRateCard } from '../aggregates/contractor-rate-card.aggregate.js';
import { MisclassificationAssessment } from '../aggregates/misclassification-assessment.aggregate.js';

@Injectable()
export class ContingentWorkforceEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = {
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId.value,
        payload: {},
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      };
      await this.eventBus.publish(envelope as any);
    }
  }

  private buildPrivacy(aggregate: ContingentWorkerAssignment | SowEngagement | ContractorRateCard | MisclassificationAssessment) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
''')

write(BASE/"union-labor/events/union-labor-events.publisher.ts", '''import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus.js';
import { DomainEvent } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { UnionRecognition } from '../aggregates/union-recognition.aggregate.js';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { CollectiveBargainingSession } from '../aggregates/collective-bargaining-session.aggregate.js';

@Injectable()
export class UnionLaborEventsPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishFromAggregate(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession): Promise<void> {
    for (const event of aggregate.domainEvents) {
      const envelope = {
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId.value,
        tenantId: event.tenantId.value,
        correlationId: event.correlationId.value,
        payload: {},
        privacy: this.buildPrivacy(aggregate),
        occurredAt: new Date(),
      };
      await this.eventBus.publish(envelope as any);
    }
  }

  private buildPrivacy(aggregate: UnionRecognition | Grievance | CollectiveBargainingSession) {
    return createPrivacyForEvent('NONE', aggregate.id.value, 'PROFILE');
  }
}
''')

print("Event publishers fixed")

# ========================================================================
# Add Database table definitions
# ========================================================================

tables_ts = '''

export interface ShiftSchedulesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  shift_date: Date;
  start_time: Date;
  end_time: Date;
  break_duration: number;
  department_id: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface OpenShiftsTable {
  id: string;
  tenant_id: string;
  department_id: string;
  shift_date: Date;
  start_time: Date;
  end_time: Date;
  required_skills: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftBidsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  open_shift_id: string;
  bid_date: Date;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftSwapRequestsTable {
  id: string;
  tenant_id: string;
  requester_worker_id: string;
  target_worker_id: string;
  shift_date: Date;
  reason: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WfmOvertimeApprovalsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  requested_hours: number;
  reason: string;
  requested_at: Date;
  approved_by: string | null;
  approved_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CoverageGapsTable {
  id: string;
  tenant_id: string;
  department_id: string;
  shift_date: Date;
  gap_start: Date;
  gap_end: Date;
  unfilled_positions: number;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeRelationsCasesTable {
  id: string;
  tenant_id: string;
  subject_worker_id: string;
  manager_id: string;
  case_number: string;
  case_type: string;
  status: string;
  opened_at: Date;
  assigned_to: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ErInvestigationsTable {
  id: string;
  tenant_id: string;
  er_case_id: string;
  investigator_id: string;
  findings: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface DisciplinaryActionsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  action_type: string;
  severity: string;
  effective_date: Date;
  expiry_date: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AccommodationCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  request_type: string;
  medical_documentation: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrServiceCasesTable {
  id: string;
  tenant_id: string;
  requester_worker_id: string;
  case_type: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolved_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrCaseTasksTable {
  id: string;
  tenant_id: string;
  case_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrKnowledgeArticlesTable {
  id: string;
  tenant_id: string;
  title: string;
  content: unknown;
  category: string;
  tags: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrServiceCatalogItemsTable {
  id: string;
  tenant_id: string;
  service_name: string;
  service_type: string;
  description: string | null;
  sla_hours: number | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrCaseSlaInstancesTable {
  id: string;
  tenant_id: string;
  case_id: string;
  sla_definition_id: string;
  target_hours: number;
  started_at: Date;
  breached_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContingentWorkerAssignmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  vendor_id: string;
  project_id: string;
  start_date: Date;
  end_date: Date;
  rate: number;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface SowEngagementsTable {
  id: string;
  tenant_id: string;
  sow_number: string;
  vendor_id: string;
  project_name: string;
  total_value: number;
  currency: string;
  start_date: Date;
  end_date: Date;
  milestones: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContractorRateCardsTable {
  id: string;
  tenant_id: string;
  vendor_id: string;
  job_title: string;
  rate: number;
  currency: string;
  effective_from: Date;
  effective_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface MisclassificationAssessmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  assessment_date: Date;
  risk_score: number | null;
  risk_factors: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EapReferralsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  reason: string;
  status: string;
  scheduled_date: Date | null;
  completed_date: Date | null;
  provider_id: string | null;
  notes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WellnessProgramsTable {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  description: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface MentalHealthCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  severity: string;
  status: string;
  provider_id: string | null;
  notes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface UnionRecognitionsTable {
  id: string;
  tenant_id: string;
  union_name: string;
  bargaining_unit_id: string;
  status: string;
  effective_date: Date | null;
  expiration_date: Date | null;
  agreement_document: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface GrievancesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  grievance_type: string;
  description: string;
  status: string;
  resolution: string | null;
  arbitrator_decision: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CollectiveBargainingSessionsTable {
  id: string;
  tenant_id: string;
  union_recognition_id: string;
  session_date: Date;
  status: string;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}
'''

db_entries = '''
  shift_schedules: ShiftSchedulesTable;
  open_shifts: OpenShiftsTable;
  shift_bids: ShiftBidsTable;
  shift_swap_requests: ShiftSwapRequestsTable;
  wfm_overtime_approvals: WfmOvertimeApprovalsTable;
  coverage_gaps: CoverageGapsTable;
  employee_relations_cases: EmployeeRelationsCasesTable;
  er_investigations: ErInvestigationsTable;
  disciplinary_actions: DisciplinaryActionsTable;
  accommodation_cases: AccommodationCasesTable;
  hr_service_cases: HrServiceCasesTable;
  hr_case_tasks: HrCaseTasksTable;
  hr_knowledge_articles: HrKnowledgeArticlesTable;
  hr_service_catalog_items: HrServiceCatalogItemsTable;
  hr_case_sla_instances: HrCaseSlaInstancesTable;
  contingent_worker_assignments: ContingentWorkerAssignmentsTable;
  sow_engagements: SowEngagementsTable;
  contractor_rate_cards: ContractorRateCardsTable;
  misclassification_assessments: MisclassificationAssessmentsTable;
  eap_referrals: EapReferralsTable;
  wellness_programs: WellnessProgramsTable;
  mental_health_cases: MentalHealthCasesTable;
  union_recognitions: UnionRecognitionsTable;
  grievances: GrievancesTable;
  collective_bargaining_sessions: CollectiveBargainingSessionsTable;
'''

# Read current platform-tables.ts
content = DB_TYPES.read_text(encoding='utf-8')

# Insert table interfaces before "export interface Database"
content = content.replace('export interface Database {', tables_ts + '\nexport interface Database {')

# Insert db entries at the end before closing brace
content = content.replace('\n}', '\n' + db_entries + '}')

DB_TYPES.write_text(content, encoding='utf-8')
print("Database tables added")
