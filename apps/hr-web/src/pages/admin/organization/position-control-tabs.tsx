import type * as React from 'react';
import { Briefcase, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';

type LegalEntityOption = {
  id: string;
  name: string;
};

type OrgUnitOption = {
  id: string;
  name: string;
};

type PositionControlPosition = {
  id: string;
  departmentId?: string | null;
  employmentType?: string | null;
  headcountRequestId?: string | null;
  jobFamily?: string | null;
  jobLevel?: string | null;
  legalEntityId?: string | null;
  positionCode: string;
  title: string;
  status: string;
};

type HeadcountRequest = {
  id: string;
  departmentId?: string | null;
  justification?: string;
  legalEntityId?: string | null;
  positionsRequested: number;
  requestNumber: string;
  positionsApproved?: number | null;
  requestedBy: string;
  status: string;
};

type PositionForm = {
  legalEntityId: string;
  departmentId: string;
  jobFamily: string;
  jobLevel: string;
  positionCode: string;
  title: string;
  employmentType: string;
};

type HeadcountForm = {
  legalEntityId: string;
  departmentId: string;
  requestedPositions: string;
  justification: string;
};

export function PositionsTab({
  createError,
  isCreating,
  isLoading,
  legalEntities,
  onCreate,
  onFormChange,
  orgUnits,
  positionColumns,
  positionForm,
  positionStatusCounts,
  positions,
  positionKeyExtractor,
}: {
  createError: React.ReactNode;
  isCreating: boolean;
  isLoading: boolean;
  legalEntities: LegalEntityOption[];
  onCreate: () => void;
  onFormChange: (form: PositionForm) => void;
  orgUnits: OrgUnitOption[];
  positionColumns: DataTableColumn<PositionControlPosition>[];
  positionForm: PositionForm;
  positionStatusCounts: Record<string, number>;
  positions: PositionControlPosition[];
  positionKeyExtractor: (row: PositionControlPosition) => string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5" />
            Create Position
          </CardTitle>
          <CardDescription>Approved headcount slots that can be activated, frozen, filled, vacated, or closed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="position-code">Position Code</Label>
              <Input id="position-code" value={positionForm.positionCode} onChange={(event) => onFormChange({ ...positionForm, positionCode: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-title">Title</Label>
              <Input id="position-title" value={positionForm.title} onChange={(event) => onFormChange({ ...positionForm, title: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-employment-type">Employment Type</Label>
              <select id="position-employment-type" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={positionForm.employmentType} onChange={(event) => onFormChange({ ...positionForm, employmentType: event.target.value })}>
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-entity">Legal Entity</Label>
              <select id="position-entity" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={positionForm.legalEntityId} onChange={(event) => onFormChange({ ...positionForm, legalEntityId: event.target.value })}>
                <option value="">No entity</option>
                {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-department">Department</Label>
              <select id="position-department" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={positionForm.departmentId} onChange={(event) => onFormChange({ ...positionForm, departmentId: event.target.value })}>
                <option value="">No department</option>
                {orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="position-job-family">Job Family</Label>
                <Input id="position-job-family" value={positionForm.jobFamily} onChange={(event) => onFormChange({ ...positionForm, jobFamily: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-job-level">Job Level</Label>
                <Input id="position-job-level" value={positionForm.jobLevel} onChange={(event) => onFormChange({ ...positionForm, jobLevel: event.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={isCreating || !positionForm.positionCode || !positionForm.title}>
              <Save className="mr-2 h-4 w-4" />
              Save Position
            </Button>
            {createError}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['Draft', positionStatusCounts.DRAFT ?? 0],
            ['Active', positionStatusCounts.ACTIVE ?? 0],
            ['Filled', positionStatusCounts.FILLED ?? 0],
            ['Frozen', positionStatusCounts.FROZEN ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="fusion-glass rounded-[1.5rem] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Positions</CardTitle>
            <CardDescription>Position control records from the position-control aggregate.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={positionColumns} data={positions} keyExtractor={positionKeyExtractor} isLoading={isLoading} emptyMessage="No positions created" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function VacanciesTab({
  isLoading,
  vacancyColumns,
  vacantPositions,
  positionKeyExtractor,
}: {
  isLoading: boolean;
  vacancyColumns: DataTableColumn<PositionControlPosition>[];
  vacantPositions: PositionControlPosition[];
  positionKeyExtractor: (row: PositionControlPosition) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5" />
          Vacancies
        </CardTitle>
        <CardDescription>Vacant positions created manually or by the headcount approval saga.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={vacancyColumns} data={vacantPositions} keyExtractor={positionKeyExtractor} isLoading={isLoading} emptyMessage="No vacant positions" />
      </CardContent>
    </Card>
  );
}

export function HeadcountTab({
  approvedHeadcountRequests,
  approvedSagaPositionCount,
  headcountColumns,
  headcountError,
  headcountForm,
  headcountRequests,
  isLoading,
  isSubmitting,
  legalEntities,
  onFormChange,
  onSubmit,
  orgUnits,
}: {
  approvedHeadcountRequests: HeadcountRequest[];
  approvedSagaPositionCount: number;
  headcountColumns: DataTableColumn<HeadcountRequest>[];
  headcountError: React.ReactNode;
  headcountForm: HeadcountForm;
  headcountRequests: HeadcountRequest[];
  isLoading: boolean;
  isSubmitting: boolean;
  legalEntities: LegalEntityOption[];
  onFormChange: (form: HeadcountForm) => void;
  onSubmit: () => void;
  orgUnits: OrgUnitOption[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request Headcount</CardTitle>
            <CardDescription>Submit demand for new approved positions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="headcount-positions">Positions Requested</Label>
                <Input id="headcount-positions" min="1" type="number" value={headcountForm.requestedPositions} onChange={(event) => onFormChange({ ...headcountForm, requestedPositions: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount-entity">Legal Entity</Label>
                <select id="headcount-entity" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={headcountForm.legalEntityId} onChange={(event) => onFormChange({ ...headcountForm, legalEntityId: event.target.value })}>
                  <option value="">No entity</option>
                  {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount-department">Department</Label>
                <select id="headcount-department" className="h-10 w-full rounded-lg bg-muted px-3 text-sm" value={headcountForm.departmentId} onChange={(event) => onFormChange({ ...headcountForm, departmentId: event.target.value })}>
                  <option value="">No department</option>
                  {orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount-justification">Justification</Label>
                <Input id="headcount-justification" value={headcountForm.justification} onChange={(event) => onFormChange({ ...headcountForm, justification: event.target.value })} required />
              </div>
              <Button type="submit" disabled={isSubmitting || !headcountForm.justification}>
                Submit Headcount
              </Button>
              {headcountError}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Headcount automation</CardTitle>
            <CardDescription>Approved requests are consumed by the position-headcount saga to create approved position records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Approved Requests</p>
                <p className="text-2xl font-bold">{approvedHeadcountRequests.length}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Saga Positions</p>
                <p className="text-2xl font-bold">{approvedSagaPositionCount}</p>
              </div>
            </div>
            {approvedHeadcountRequests.length > 0 ? (
              <div className="space-y-2">
                {approvedHeadcountRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-semibold">{request.requestNumber}</p>
                    <p className="text-muted-foreground">{request.positionsApproved ?? 0} positions auto-created when approved</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No approved headcount requests have produced positions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Headcount Requests</CardTitle>
          <CardDescription>Demand approvals with state transitions and downstream position creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={headcountColumns} data={headcountRequests} keyExtractor={(row) => row.id} isLoading={isLoading} emptyMessage="No headcount requests submitted" />
        </CardContent>
      </Card>
    </div>
  );
}
