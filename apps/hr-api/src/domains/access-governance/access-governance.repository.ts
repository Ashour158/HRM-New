import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql, type Insertable, type Kysely, type Selectable } from 'kysely';

export type RoleRecord = Selectable<Database['roles']>;
export type PermissionRecord = Selectable<Database['permissions']>;
export type AbacPolicyRecord = Selectable<Database['abac_policies']>;
export type FieldAccessPolicyRecord = Selectable<Database['field_access_policies']>;
export type SodRuleRecord = Selectable<Database['sod_rules']>;
export type UserRoleRecord = Selectable<Database['user_roles']> & { role_code: string };
export type ServiceAccountRecord = Selectable<Database['service_accounts']>;
export type ServiceAccountCredentialRecord = Selectable<Database['service_account_credentials']>;
export type AccessReviewCampaignRecord = Selectable<Database['access_review_campaigns']>;
export type AccessReviewItemRecord = Selectable<Database['access_review_items']> & {
  role_code: string | null;
  permission_code: string | null;
  service_account_code: string | null;
};
export type AccessReviewWorkflowEventRecord = Selectable<Database['access_review_workflow_events']>;
export type RolePermissionRecord = {
  role_id: string;
  permission_id: string;
  role_code: string;
  permission_code: string;
};

@Injectable()
export class AccessGovernanceRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async listRoles(tenantId: Uuid): Promise<RoleRecord[]> {
    return this.db
      .selectFrom('roles')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('code', 'asc')
      .execute();
  }

  async createRole(tenantId: Uuid, input: Omit<Insertable<Database['roles']>, 'id' | 'tenant_id' | 'created_at'>): Promise<RoleRecord> {
    return this.db
      .insertInto('roles')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: new Date().toISOString(),
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateRole(tenantId: Uuid, roleId: Uuid, input: Partial<Omit<Insertable<Database['roles']>, 'id' | 'tenant_id' | 'created_at'>>): Promise<RoleRecord | undefined> {
    return this.db
      .updateTable('roles')
      .set(input)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', roleId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listPermissions(tenantId: Uuid): Promise<PermissionRecord[]> {
    return this.db
      .selectFrom('permissions')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('domain', 'asc')
      .orderBy('code', 'asc')
      .execute();
  }

  async createPermission(tenantId: Uuid, input: Omit<Insertable<Database['permissions']>, 'id' | 'tenant_id'>): Promise<PermissionRecord> {
    return this.db
      .insertInto('permissions')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updatePermission(
    tenantId: Uuid,
    permissionId: Uuid,
    input: Partial<Omit<Insertable<Database['permissions']>, 'id' | 'tenant_id'>>,
  ): Promise<PermissionRecord | undefined> {
    return this.db
      .updateTable('permissions')
      .set(input)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', permissionId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listRolePermissions(tenantId: Uuid): Promise<RolePermissionRecord[]> {
    const result = await sql<RolePermissionRecord>`
      SELECT rp.role_id, rp.permission_id, r.code AS role_code, p.code AS permission_code
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.tenant_id = ${tenantId.value}
        AND p.tenant_id = ${tenantId.value}
      ORDER BY r.code ASC, p.code ASC
    `.execute(this.db);
    return result.rows;
  }

  async replaceRolePermissions(tenantId: Uuid, roleId: Uuid, permissionIds: Uuid[]): Promise<RolePermissionRecord[]> {
    await sql`
      DELETE FROM role_permissions
      WHERE role_id = ${roleId.value}
        AND EXISTS (
          SELECT 1 FROM roles r
          WHERE r.id = role_permissions.role_id
            AND r.tenant_id = ${tenantId.value}
        )
    `.execute(this.db);

    for (const permissionId of permissionIds) {
      await this.assignRolePermission(tenantId, roleId, permissionId);
    }

    return this.listRolePermissions(tenantId);
  }

  async assignRolePermission(tenantId: Uuid, roleId: Uuid, permissionId: Uuid): Promise<void> {
    await sql`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT ${roleId.value}, ${permissionId.value}
      WHERE EXISTS (SELECT 1 FROM roles WHERE id = ${roleId.value} AND tenant_id = ${tenantId.value})
        AND EXISTS (SELECT 1 FROM permissions WHERE id = ${permissionId.value} AND tenant_id = ${tenantId.value})
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `.execute(this.db);
  }

  async removeRolePermission(tenantId: Uuid, roleId: Uuid, permissionId: Uuid): Promise<void> {
    await sql`
      DELETE FROM role_permissions
      WHERE role_id = ${roleId.value}
        AND permission_id = ${permissionId.value}
        AND EXISTS (SELECT 1 FROM roles WHERE id = ${roleId.value} AND tenant_id = ${tenantId.value})
    `.execute(this.db);
  }

  async listUserRoles(tenantId: Uuid): Promise<UserRoleRecord[]> {
    const result = await sql<UserRoleRecord>`
      SELECT ur.*, r.code AS role_code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.tenant_id = ${tenantId.value}
      ORDER BY ur.assigned_at DESC
    `.execute(this.db);
    return result.rows;
  }

  async assignUserRole(
    tenantId: Uuid,
    userId: Uuid,
    roleId: Uuid,
    assignedBy: Uuid | undefined,
    expiresAt: Date | null,
  ): Promise<UserRoleRecord[]> {
    await sql`
      INSERT INTO user_roles (id, tenant_id, user_id, role_id, assigned_by, assigned_at, expires_at)
      SELECT ${Uuid.generate().value}, ${tenantId.value}, ${userId.value}, ${roleId.value}, ${assignedBy?.value ?? null}, NOW(), ${expiresAt}
      WHERE EXISTS (SELECT 1 FROM roles WHERE id = ${roleId.value} AND tenant_id = ${tenantId.value})
      ON CONFLICT (tenant_id, user_id, role_id)
      DO UPDATE SET
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `.execute(this.db);

    return this.listUserRoles(tenantId);
  }

  async removeUserRole(tenantId: Uuid, userId: Uuid, roleId: Uuid): Promise<UserRoleRecord[]> {
    await sql`
      DELETE FROM user_roles
      WHERE tenant_id = ${tenantId.value}
        AND user_id = ${userId.value}
        AND role_id = ${roleId.value}
    `.execute(this.db);
    return this.listUserRoles(tenantId);
  }

  /**
   * Recomputes a user's effective role codes and permission codes from their
   * current, non-expired role assignments -- the source of truth JWT issuance
   * and refresh must resync from whenever access governance changes what
   * roles/permissions a user or role has.
   */
  async computeEffectiveUserAccess(tenantId: Uuid, userId: Uuid): Promise<{ roles: string[]; permissions: string[] }> {
    const result = await sql<{ role_code: string; permission_code: string | null }>`
      SELECT DISTINCT r.code AS role_code, p.code AS permission_code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.tenant_id = ${tenantId.value}
        AND ur.user_id = ${userId.value}
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `.execute(this.db);

    const roles = Array.from(new Set(result.rows.map((row) => row.role_code)));
    const permissions = Array.from(
      new Set(result.rows.map((row) => row.permission_code).filter((code): code is string => Boolean(code))),
    );
    return { roles, permissions };
  }

  /**
   * user_ids currently holding a role, used to fan out a resync to every
   * affected user when a role's permission set changes rather than just when
   * a single user's role assignment changes.
   */
  async listUserIdsForRole(tenantId: Uuid, roleId: Uuid): Promise<string[]> {
    const result = await sql<{ user_id: string }>`
      SELECT DISTINCT user_id
      FROM user_roles
      WHERE tenant_id = ${tenantId.value}
        AND role_id = ${roleId.value}
    `.execute(this.db);
    return result.rows.map((row) => row.user_id);
  }

  async listServiceAccounts(tenantId: Uuid): Promise<ServiceAccountRecord[]> {
    return this.db
      .selectFrom('service_accounts')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('code', 'asc')
      .execute();
  }

  async findServiceAccount(tenantId: Uuid, accountId: Uuid): Promise<ServiceAccountRecord | undefined> {
    return this.db
      .selectFrom('service_accounts')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', accountId.value)
      .executeTakeFirst();
  }

  async createServiceAccount(
    tenantId: Uuid,
    input: Omit<Insertable<Database['service_accounts']>, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>,
  ): Promise<ServiceAccountRecord> {
    const now = new Date().toISOString();
    return this.db
      .insertInto('service_accounts')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: now,
        updated_at: now,
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateServiceAccount(
    tenantId: Uuid,
    accountId: Uuid,
    input: Partial<Omit<Insertable<Database['service_accounts']>, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>,
  ): Promise<ServiceAccountRecord | undefined> {
    return this.db
      .updateTable('service_accounts')
      .set({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', accountId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listServiceAccountCredentials(tenantId: Uuid): Promise<ServiceAccountCredentialRecord[]> {
    return this.db
      .selectFrom('service_account_credentials')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('issued_at', 'desc')
      .execute();
  }

  async findServiceAccountCredential(
    tenantId: Uuid,
    accountId: Uuid,
    credentialId: Uuid,
  ): Promise<ServiceAccountCredentialRecord | undefined> {
    return this.db
      .selectFrom('service_account_credentials')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('service_account_id', '=', accountId.value)
      .where('id', '=', credentialId.value)
      .executeTakeFirst();
  }

  async createServiceAccountCredential(
    tenantId: Uuid,
    input: Omit<Insertable<Database['service_account_credentials']>, 'id' | 'tenant_id' | 'issued_at' | 'created_at' | 'updated_at'>,
  ): Promise<ServiceAccountCredentialRecord> {
    const now = new Date().toISOString();
    return this.db
      .insertInto('service_account_credentials')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        issued_at: now,
        created_at: now,
        updated_at: now,
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateServiceAccountCredential(
    tenantId: Uuid,
    accountId: Uuid,
    credentialId: Uuid,
    input: Partial<Omit<Insertable<Database['service_account_credentials']>, 'id' | 'tenant_id' | 'service_account_id' | 'issued_at' | 'created_at' | 'updated_at'>>,
  ): Promise<ServiceAccountCredentialRecord | undefined> {
    return this.db
      .updateTable('service_account_credentials')
      .set({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .where('tenant_id', '=', tenantId.value)
      .where('service_account_id', '=', accountId.value)
      .where('id', '=', credentialId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listAccessReviewCampaigns(tenantId: Uuid): Promise<AccessReviewCampaignRecord[]> {
    return this.db
      .selectFrom('access_review_campaigns')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async findAccessReviewCampaign(tenantId: Uuid, campaignId: Uuid): Promise<AccessReviewCampaignRecord | undefined> {
    return this.db
      .selectFrom('access_review_campaigns')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', campaignId.value)
      .executeTakeFirst();
  }

  async createAccessReviewCampaign(
    tenantId: Uuid,
    input: Omit<Insertable<Database['access_review_campaigns']>, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>,
  ): Promise<AccessReviewCampaignRecord> {
    const now = new Date().toISOString();
    return this.db
      .insertInto('access_review_campaigns')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: now,
        updated_at: now,
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateAccessReviewCampaign(
    tenantId: Uuid,
    campaignId: Uuid,
    input: Partial<Omit<Insertable<Database['access_review_campaigns']>, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>,
  ): Promise<AccessReviewCampaignRecord | undefined> {
    return this.db
      .updateTable('access_review_campaigns')
      .set({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', campaignId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listAccessReviewItems(tenantId: Uuid): Promise<AccessReviewItemRecord[]> {
    const result = await sql<AccessReviewItemRecord>`
      SELECT
        ari.*,
        r.code AS role_code,
        p.code AS permission_code,
        sa.code AS service_account_code
      FROM access_review_items ari
      LEFT JOIN roles r ON r.id = ari.role_id
      LEFT JOIN permissions p ON p.id = ari.permission_id
      LEFT JOIN service_accounts sa ON sa.id = ari.service_account_id
      WHERE ari.tenant_id = ${tenantId.value}
      ORDER BY ari.created_at DESC
    `.execute(this.db);
    return result.rows;
  }

  async listAccessReviewItemsForCampaign(tenantId: Uuid, campaignId: Uuid): Promise<AccessReviewItemRecord[]> {
    const items = await this.listAccessReviewItems(tenantId);
    return items.filter((item) => item.campaign_id === campaignId.value);
  }

  async createAccessReviewItem(
    tenantId: Uuid,
    input: Omit<Insertable<Database['access_review_items']>, 'id' | 'tenant_id' | 'created_at'>,
  ): Promise<AccessReviewItemRecord[]> {
    await this.db
      .insertInto('access_review_items')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: new Date().toISOString(),
        ...input,
      })
      .execute();
    return this.listAccessReviewItems(tenantId);
  }

  async updateAccessReviewItem(
    tenantId: Uuid,
    itemId: Uuid,
    input: Partial<Omit<Insertable<Database['access_review_items']>, 'id' | 'tenant_id' | 'campaign_id' | 'created_at'>>,
  ): Promise<AccessReviewItemRecord | undefined> {
    await this.db
      .updateTable('access_review_items')
      .set(input)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', itemId.value)
      .execute();
    return (await this.listAccessReviewItems(tenantId)).find((item) => item.id === itemId.value);
  }

  async listAccessReviewWorkflowEvents(tenantId: Uuid): Promise<AccessReviewWorkflowEventRecord[]> {
    return this.db
      .selectFrom('access_review_workflow_events')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async createAccessReviewWorkflowEvent(
    tenantId: Uuid,
    input: Omit<Insertable<Database['access_review_workflow_events']>, 'id' | 'tenant_id' | 'created_at'>,
  ): Promise<AccessReviewWorkflowEventRecord> {
    return this.db
      .insertInto('access_review_workflow_events')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: new Date().toISOString(),
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listAbacPolicies(tenantId: Uuid): Promise<AbacPolicyRecord[]> {
    return this.db
      .selectFrom('abac_policies')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'desc')
      .execute();
  }

  async createAbacPolicy(tenantId: Uuid, input: Omit<Insertable<Database['abac_policies']>, 'id' | 'tenant_id' | 'created_at'>): Promise<AbacPolicyRecord> {
    return this.db
      .insertInto('abac_policies')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: new Date().toISOString(),
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateAbacPolicy(
    tenantId: Uuid,
    policyId: Uuid,
    input: Partial<Omit<Insertable<Database['abac_policies']>, 'id' | 'tenant_id' | 'created_at'>>,
  ): Promise<AbacPolicyRecord | undefined> {
    return this.db
      .updateTable('abac_policies')
      .set(input)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', policyId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listFieldAccessPolicies(tenantId: Uuid): Promise<FieldAccessPolicyRecord[]> {
    return this.db
      .selectFrom('field_access_policies')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('field_path', 'asc')
      .execute();
  }

  async createFieldAccessPolicy(
    tenantId: Uuid,
    input: Omit<Insertable<Database['field_access_policies']>, 'id' | 'tenant_id' | 'created_at'>,
  ): Promise<FieldAccessPolicyRecord> {
    return this.db
      .insertInto('field_access_policies')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: new Date().toISOString(),
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateFieldAccessPolicy(
    tenantId: Uuid,
    policyId: Uuid,
    input: Partial<Omit<Insertable<Database['field_access_policies']>, 'id' | 'tenant_id' | 'created_at'>>,
  ): Promise<FieldAccessPolicyRecord | undefined> {
    return this.db
      .updateTable('field_access_policies')
      .set(input)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', policyId.value)
      .returningAll()
      .executeTakeFirst();
  }

  async listSodRules(tenantId: Uuid): Promise<SodRuleRecord[]> {
    return this.db
      .selectFrom('sod_rules')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('code', 'asc')
      .execute();
  }

  async createSodRule(tenantId: Uuid, input: Omit<Insertable<Database['sod_rules']>, 'id' | 'tenant_id' | 'created_at'>): Promise<SodRuleRecord> {
    return this.db
      .insertInto('sod_rules')
      .values({
        id: Uuid.generate().value,
        tenant_id: tenantId.value,
        created_at: new Date().toISOString(),
        ...input,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateSodRule(
    tenantId: Uuid,
    ruleId: Uuid,
    input: Partial<Omit<Insertable<Database['sod_rules']>, 'id' | 'tenant_id' | 'created_at'>>,
  ): Promise<SodRuleRecord | undefined> {
    return this.db
      .updateTable('sod_rules')
      .set(input)
      .where('tenant_id', '=', tenantId.value)
      .where('id', '=', ruleId.value)
      .returningAll()
      .executeTakeFirst();
  }
}
