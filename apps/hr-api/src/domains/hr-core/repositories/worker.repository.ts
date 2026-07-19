import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid, Email } from '@hcm/shared-kernel';
import { WorkerProfile, type WorkerStatus, type EmploymentType } from '../aggregates/worker-profile.aggregate.js';

/**
 * Repository for {@link WorkerProfile} aggregates.
 * Maps DB rows to/from the aggregate and ensures tenant isolation.
 */
@Injectable()
export class WorkerRepository extends BaseRepository<'workers', WorkerProfile> {
  protected readonly tableName = 'workers' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for worker query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<WorkerProfile | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['workers']) : undefined;
  }

  async findByIdForTenant(id: Uuid, tenantId: Uuid): Promise<WorkerProfile | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('id', '=', id.value)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['workers']) : undefined;
  }

  async findByEmployeeNumber(employeeNumber: string): Promise<WorkerProfile | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('employee_number', '=', employeeNumber)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['workers']) : undefined;
  }

  async findByEmployeeNumberForTenant(employeeNumber: string, tenantId: Uuid): Promise<WorkerProfile | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('employee_number', '=', employeeNumber)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['workers']) : undefined;
  }

  async findByEmployeeNumbersForTenant(employeeNumbers: string[], tenantId: Uuid): Promise<Map<string, WorkerProfile>> {
    if (employeeNumbers.length === 0) return new Map();
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('employee_number', 'in', employeeNumbers)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    const byEmployeeNumber = new Map<string, WorkerProfile>();
    for (const row of rows) {
      const worker = this.toAggregate(row as unknown as Database['workers']);
      byEmployeeNumber.set((row as unknown as Database['workers']).employee_number, worker);
    }
    return byEmployeeNumber;
  }

  async findByEmail(email: string): Promise<WorkerProfile | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('email', '=', email)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['workers']) : undefined;
  }

  async findByEmailForTenant(email: string, tenantId: Uuid): Promise<WorkerProfile | undefined> {
    const row = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('email', '=', email)
      .where('tenant_id', '=', tenantId.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['workers']) : undefined;
  }

  async findByEmailsForTenant(emails: string[], tenantId: Uuid): Promise<Map<string, WorkerProfile>> {
    if (emails.length === 0) return new Map();
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('email', 'in', emails)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    const byEmail = new Map<string, WorkerProfile>();
    for (const row of rows) {
      const worker = this.toAggregate(row as unknown as Database['workers']);
      byEmail.set((row as unknown as Database['workers']).email, worker);
    }
    return byEmail;
  }

  async findByManager(managerId: Uuid): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('manager_id', '=', managerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findByManagerForTenant(managerId: Uuid, tenantId: Uuid): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('manager_id', '=', managerId.value)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findByDepartment(departmentId: Uuid): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('department_id', '=', departmentId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findByDepartmentForTenant(departmentId: Uuid, tenantId: Uuid): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('department_id', '=', departmentId.value)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findByLegalEntity(legalEntityId: Uuid): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('legal_entity_id', '=', legalEntityId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findByLegalEntityForTenant(legalEntityId: Uuid, tenantId: Uuid): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('legal_entity_id', '=', legalEntityId.value)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findActive(): Promise<WorkerProfile[]> {
    const rows = await this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async findByStatusForTenant(status: WorkerStatus, tenantId: Uuid, options?: { limit?: number; offset?: number }): Promise<WorkerProfile[]> {
    let dbQuery = this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', status)
      // Deterministic order is required for limit/offset paging to be stable
      // across pages (unordered LIMIT/OFFSET results are not guaranteed).
      .orderBy('id', 'asc');

    if (options?.limit !== undefined) {
      dbQuery = dbQuery.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      dbQuery = dbQuery.offset(options.offset);
    }

    const rows = await dbQuery.execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<WorkerProfile[]> {
    let dbQuery = this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId());

    if (query) {
      const like = `%${query}%`;
      dbQuery = dbQuery.where((eb: any) =>
        eb.or([
          eb('first_name', 'ilike', like),
          eb('last_name', 'ilike', like),
          eb('email', 'ilike', like),
          eb('employee_number', 'ilike', like),
        ])
      );
    }

    // Deterministic order is required for limit/offset paging to be stable
    // across pages (unordered LIMIT/OFFSET results are not guaranteed).
    dbQuery = dbQuery.orderBy('id', 'asc');

    if (options?.limit !== undefined) {
      dbQuery = dbQuery.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      dbQuery = dbQuery.offset(options.offset);
    }

    const rows = await dbQuery.execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async searchForTenant(
    query: string,
    tenantId: Uuid,
    options?: {
      limit?: number;
      offset?: number;
      status?: WorkerStatus;
      departmentId?: Uuid;
      managerId?: Uuid;
      legalEntityId?: Uuid;
    },
  ): Promise<WorkerProfile[]> {
    let dbQuery = this.executor
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value);

    if (options?.status) {
      dbQuery = dbQuery.where('status', '=', options.status);
    }
    if (options?.departmentId) {
      dbQuery = dbQuery.where('department_id', '=', options.departmentId.value);
    }
    if (options?.managerId) {
      dbQuery = dbQuery.where('manager_id', '=', options.managerId.value);
    }
    if (options?.legalEntityId) {
      dbQuery = dbQuery.where('legal_entity_id', '=', options.legalEntityId.value);
    }
    if (query) {
      const like = `%${query}%`;
      dbQuery = dbQuery.where((eb: any) =>
        eb.or([
          eb('first_name', 'ilike', like),
          eb('last_name', 'ilike', like),
          eb('email', 'ilike', like),
          eb('employee_number', 'ilike', like),
        ])
      );
    }

    // Deterministic order is required for limit/offset paging to be stable
    // across pages (unordered LIMIT/OFFSET results are not guaranteed).
    dbQuery = dbQuery.orderBy('id', 'asc');

    if (options?.limit !== undefined) {
      dbQuery = dbQuery.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      dbQuery = dbQuery.offset(options.offset);
    }

    const rows = await dbQuery.execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  // Used by the narrow-scope worker-directory search (open to EMPLOYEE/MANAGER and other
  // non-admin roles). Deliberately excludes the email column from the ILIKE match: unlike
  // searchForTenant() (admin-only), this path must not let a caller probe partial email
  // addresses to learn whether a guessed address exists in the tenant.
  async searchDirectoryForTenant(
    query: string,
    tenantId: Uuid,
    options?: { limit?: number; offset?: number },
  ): Promise<WorkerProfile[]> {
    let dbQuery = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value);

    if (query) {
      const like = `%${query}%`;
      dbQuery = dbQuery.where((eb: any) =>
        eb.or([
          eb('first_name', 'ilike', like),
          eb('last_name', 'ilike', like),
          eb('employee_number', 'ilike', like),
        ])
      );
    }

    if (options?.limit !== undefined) {
      dbQuery = dbQuery.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      dbQuery = dbQuery.offset(options.offset);
    }

    const rows = await dbQuery.execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['workers']));
  }

  async save(entity: WorkerProfile): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['workers']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['workers']>);
    }
  }

  private toAggregate(row: Database['workers']): WorkerProfile {
    return new WorkerProfile({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      employeeNumber: row.employee_number,
      status: row.status as WorkerStatus,
      firstName: row.first_name,
      lastName: row.last_name,
      email: new Email(row.email ?? ''),
      hireDate: row.hire_date,
      terminationDate: row.termination_date ?? undefined,
      legalEntityId: row.legal_entity_id ? new Uuid(row.legal_entity_id) : undefined,
      departmentId: row.department_id ? new Uuid(row.department_id) : undefined,
      managerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      jobTitle: row.job_title ?? undefined,
      employmentType: row.employment_type as EmploymentType,
      aggregateVersion: row.aggregate_version,
      dataClassification: row.data_classification as 'CONFIDENTIAL',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: WorkerProfile): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      employee_number: entity.employeeNumber,
      status: entity.status,
      first_name: entity.firstName,
      last_name: entity.lastName,
      email: entity.email.toString(),
      hire_date: entity.hireDate,
      termination_date: entity.terminationDate ?? null,
      legal_entity_id: entity.legalEntityId?.value ?? null,
      department_id: entity.departmentId?.value ?? null,
      manager_id: entity.managerId?.value ?? null,
      job_title: entity.jobTitle ?? null,
      employment_type: entity.employmentType,
      aggregate_version: entity.aggregateVersion,
      data_classification: entity.dataClassification,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
