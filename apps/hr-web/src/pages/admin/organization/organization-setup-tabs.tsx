import type * as React from 'react';
import { Network, Save, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { ReportingTree, type ReportingTreeNode } from './organization-trees';

type LegalEntity = {
  id: string;
  name: string;
  code?: string;
  countryCode: string;
  registrationNumber?: string | null;
  status: string;
};

type OrgUnit = {
  id: string;
  name: string;
  code?: string | null;
  legalEntityId?: string | null;
  level: number;
  parentId?: string | null;
  status: string;
};

type Worker = {
  id: string;
  departmentId?: string;
  email: string;
  employeeId: string;
  firstName: string;
  jobTitle?: string;
  lastName: string;
  legalEntityId?: string;
  managerId?: string;
};

type ManagerRelationship = {
  id: string;
  departmentId?: string | null;
  endDate?: string | null;
  isPrimary: boolean;
  managerId: string;
  managerName: string;
  startDate: string;
  workerId: string;
  workerName: string;
};

type LegalEntityForm = {
  id?: string;
  name: string;
  countryCode: string;
  registrationNumber: string;
};

type OrgUnitForm = {
  id?: string;
  name: string;
  parentOrgUnitId: string;
  legalEntityId: string;
};

type AssignmentForm = {
  workerId: string;
  legalEntityId: string;
  departmentId: string;
  managerId: string;
  jobTitle: string;
};

export function LegalEntitiesTab({
  emptyLegalEntity,
  form,
  formError,
  isLoading,
  isSaving,
  legalEntityColumns,
  legalEntities,
  onClear,
  onFormChange,
  onSave,
}: {
  emptyLegalEntity: LegalEntityForm;
  form: LegalEntityForm;
  formError: React.ReactNode;
  isLoading: boolean;
  isSaving: boolean;
  legalEntityColumns: DataTableColumn<LegalEntity>[];
  legalEntities: LegalEntity[];
  onClear: (form: LegalEntityForm) => void;
  onFormChange: (form: LegalEntityForm) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{form.id ? 'Edit Legal Entity' : 'Add Legal Entity'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="entity-name">Name</Label>
              <Input id="entity-name" value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country-code">Country Code</Label>
              <Input id="country-code" maxLength={2} value={form.countryCode} onChange={(event) => onFormChange({ ...form, countryCode: event.target.value.toUpperCase() })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">Registration Number</Label>
              <Input id="registration" value={form.registrationNumber} onChange={(event) => onFormChange({ ...form, registrationNumber: event.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              {form.id ? <Button type="button" variant="outline" onClick={() => onClear(emptyLegalEntity)}>Clear</Button> : null}
            </div>
            {formError}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legal Entities</CardTitle>
          <CardDescription>Registered operating companies and countries.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={legalEntityColumns} data={legalEntities} keyExtractor={(row) => row.id} isLoading={isLoading} emptyMessage="No legal entities created" />
        </CardContent>
      </Card>
    </div>
  );
}

export function DepartmentsTab({
  emptyOrgUnit,
  form,
  formError,
  isLoading,
  isSaving,
  legalEntities,
  onClear,
  onFormChange,
  onSave,
  orgUnitColumns,
  orgUnits,
}: {
  emptyOrgUnit: OrgUnitForm;
  form: OrgUnitForm;
  formError: React.ReactNode;
  isLoading: boolean;
  isSaving: boolean;
  legalEntities: LegalEntity[];
  onClear: (form: OrgUnitForm) => void;
  onFormChange: (form: OrgUnitForm) => void;
  onSave: () => void;
  orgUnitColumns: DataTableColumn<OrgUnit>[];
  orgUnits: OrgUnit[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{form.id ? 'Edit Department / Team' : 'Add Department / Team'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="unit-name">Name</Label>
              <Input id="unit-name" value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-entity">Legal Entity</Label>
              <select id="unit-entity" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={form.legalEntityId} onChange={(event) => onFormChange({ ...form, legalEntityId: event.target.value })} required>
                <option value="">Select entity</option>
                {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent-unit">Parent Unit</Label>
              <select id="parent-unit" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={form.parentOrgUnitId} onChange={(event) => onFormChange({ ...form, parentOrgUnitId: event.target.value })}>
                <option value="">Root department</option>
                {orgUnits.filter((unit) => unit.id !== form.id).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              {form.id ? <Button type="button" variant="outline" onClick={() => onClear(emptyOrgUnit)}>Clear</Button> : null}
            </div>
            {formError}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Departments and Teams</CardTitle>
          <CardDescription>Hierarchical org units under legal entities.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={orgUnitColumns} data={orgUnits} keyExtractor={(row) => row.id} isLoading={isLoading} emptyMessage="No departments or teams created" />
        </CardContent>
      </Card>
    </div>
  );
}

export function AssignmentsTab({
  assignmentColumns,
  form,
  formError,
  isLoading,
  isSaving,
  legalEntities,
  onFormChange,
  onSave,
  orgUnits,
  workerLabel,
  workers,
}: {
  assignmentColumns: DataTableColumn<Worker>[];
  form: AssignmentForm;
  formError: React.ReactNode;
  isLoading: boolean;
  isSaving: boolean;
  legalEntities: LegalEntity[];
  onFormChange: (form: AssignmentForm) => void;
  onSave: () => void;
  orgUnits: OrgUnit[];
  workerLabel: (worker: Worker) => string;
  workers: Worker[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5" />
            Assign Employee
          </CardTitle>
          <CardDescription>Assign a worker to entity, department, manager, and title.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="assignment-worker">Employee</Label>
              <select id="assignment-worker" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={form.workerId} onChange={(event) => onFormChange({ ...form, workerId: event.target.value })} required>
                <option value="">Select employee</option>
                {workers.map((worker) => <option key={worker.id} value={worker.id}>{workerLabel(worker)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-title">Job Title</Label>
              <Input id="assignment-title" value={form.jobTitle} onChange={(event) => onFormChange({ ...form, jobTitle: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-entity">Legal Entity</Label>
              <select id="assignment-entity" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={form.legalEntityId} onChange={(event) => onFormChange({ ...form, legalEntityId: event.target.value })}>
                <option value="">No entity</option>
                {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-department">Department / Team</Label>
              <select id="assignment-department" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={form.departmentId} onChange={(event) => onFormChange({ ...form, departmentId: event.target.value })}>
                <option value="">No department</option>
                {orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-manager">Manager</Label>
              <select id="assignment-manager" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={form.managerId} onChange={(event) => onFormChange({ ...form, managerId: event.target.value })}>
                <option value="">No manager</option>
                {workers.filter((worker) => worker.id !== form.workerId).map((worker) => <option key={worker.id} value={worker.id}>{workerLabel(worker)}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={isSaving || !form.workerId}>
              <Save className="mr-2 h-4 w-4" />
              Save Assignment
            </Button>
            {formError}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employee Organization Assignments</CardTitle>
          <CardDescription>Real worker assignments, not just setup dropdown values.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={assignmentColumns} data={workers} keyExtractor={(row) => row.id} isLoading={isLoading} emptyMessage="No workers found" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ManagerRelationshipsTab({
  isLoading,
  managerColumns,
  managerRelationships,
  reportingTree,
}: {
  isLoading: boolean;
  managerColumns: DataTableColumn<ManagerRelationship>[];
  managerRelationships: ManagerRelationship[];
  reportingTree: ReportingTreeNode[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(32rem,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Network className="h-5 w-5" />
            Reporting Tree
          </CardTitle>
          <CardDescription>Employee-to-manager hierarchy built from active reporting lines.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportingTree nodes={reportingTree} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manager Relationships</CardTitle>
          <CardDescription>Active reporting lines created from employee assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={managerColumns} data={managerRelationships} keyExtractor={(row) => row.id} isLoading={isLoading} emptyMessage="No manager relationships created" />
        </CardContent>
      </Card>
    </div>
  );
}
