import { Uuid } from '@hcm/shared-kernel';

export interface SavedViewProps {
  id: Uuid;
  tenantId: Uuid;
  userId: Uuid;
  listKey: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  isDefault: boolean;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SavedView {
  readonly id: Uuid;
  readonly tenantId: Uuid;
  readonly userId: Uuid;
  readonly listKey: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  isDefault: boolean;
  aggregateVersion: number;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: SavedViewProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.listKey = props.listKey;
    this.name = props.name;
    this.filters = props.filters;
    this.columns = props.columns;
    this.isDefault = props.isDefault;
    this.aggregateVersion = props.aggregateVersion ?? 0;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: Omit<SavedViewProps, 'id' | 'aggregateVersion' | 'createdAt' | 'updatedAt'> & { id?: Uuid }): SavedView {
    return new SavedView({
      ...props,
      id: props.id ?? Uuid.generate(),
      aggregateVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static rehydrate(props: SavedViewProps): SavedView {
    return new SavedView(props);
  }

  update(input: { name?: string; filters?: Record<string, unknown>; columns?: string[]; isDefault?: boolean }): void {
    if (input.name !== undefined) this.name = input.name;
    if (input.filters !== undefined) this.filters = input.filters;
    if (input.columns !== undefined) this.columns = input.columns;
    if (input.isDefault !== undefined) this.isDefault = input.isDefault;
    this.aggregateVersion += 1;
    this.updatedAt = new Date();
  }
}
