import * as React from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ConditionRowBuilder, PreviewPanel, WorkflowStepBuilder, type ApprovalConditionOperator } from '@/components/builder';
import { Workflow, Plus, Save, ShieldCheck, Trash2, Eye } from 'lucide-react';

type ApprovalWorkflowCondition = {
  field: string;
  operator: ApprovalConditionOperator;
  value: unknown;
};

type ApprovalConditionLogic = 'ALL' | 'ANY';

type ApprovalWorkflowStepRule = {
  code: string;
  label: string;
  active: boolean;
  order: number;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  approverType: 'ROLE' | 'WORKER';
  approverRole?: string;
  approverWorkerId?: string;
  slaHours?: number;
  escalationTiers?: Array<{
    code: string;
    label: string;
    active: boolean;
    afterHours: number;
    approverRole?: string;
    approverWorkerId?: string;
  }>;
};

type ApprovalWorkflowRule = {
  code: string;
  label: string;
  active: boolean;
  commandName: string;
  aggregateType?: string;
  slaHours?: number;
  conditions?: ApprovalWorkflowCondition[];
  conditionLogic?: ApprovalConditionLogic;
  steps: ApprovalWorkflowStepRule[];
};

type ApprovalConfigResponse = {
  tenantId: string;
  rules: ApprovalWorkflowRule[];
};

const ruleTemplates: ApprovalWorkflowRule[] = [
  {
    code: 'COMP_CHANGE_APPROVAL',
    label: 'Compensation change approval',
    active: true,
    commandName: 'ApproveCompensationChange',
    aggregateType: 'CompensationChange',
    slaHours: 24,
    steps: [
      { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 24 },
      { code: 'PAYROLL_REVIEW', label: 'Payroll review', active: true, order: 2, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'PAYROLL_ADMIN', slaHours: 24 },
    ],
  },
  {
    code: 'LONG_LEAVE_APPROVAL',
    label: 'Long leave approval',
    active: true,
    commandName: 'ApproveAbsenceRequest',
    aggregateType: 'AbsenceRequest',
    slaHours: 16,
    steps: [
      { code: 'MANAGER_REVIEW', label: 'Manager review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'MANAGER', slaHours: 16 },
      { code: 'HR_REVIEW', label: 'HR review', active: true, order: 2, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 24 },
    ],
  },
  {
    code: 'DISCIPLINARY_APPROVAL',
    label: 'Disciplinary action approval',
    active: true,
    commandName: 'ApproveDisciplinaryAction',
    aggregateType: 'DisciplinaryAction',
    slaHours: 8,
    steps: [
      { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: 8 },
      { code: 'LEGAL_SIGNOFF', label: 'Legal sign-off', active: true, order: 2, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'LEGAL', slaHours: 16 },
    ],
  },
];

export function AdminApprovalsConfig() {
  const { tenantId } = useTenant();
  const addNotification = useUIStore((state) => state.addNotification);
  const { data, isLoading, isError, error, refetch } = useApiQuery<ApprovalConfigResponse>(
    ['approval-config', tenantId],
    '/platform/workflow/approval-config',
    { enabled: Boolean(tenantId) },
  );
  const [rules, setRules] = React.useState<ApprovalWorkflowRule[]>([]);
  const [previewRuleIndex, setPreviewRuleIndex] = React.useState<number | null>(null);
  const [draggedStep, setDraggedStep] = React.useState<{ ruleIndex: number; stepIndex: number } | null>(null);

  React.useEffect(() => {
    setRules(data?.rules ?? []);
  }, [data?.rules]);

  const saveMutation = useApiMutation<ApprovalConfigResponse, { rules: ApprovalWorkflowRule[] }>(
    '/platform/workflow/approval-config',
    'post',
    [['approval-config', tenantId]],
    {
      onSuccess: () => addNotification({ title: 'Approval paths saved', message: 'Workflow routing is ready for governed commands.', type: 'success', read: false }),
      onError: () => addNotification({ title: 'Could not save approval paths', message: 'Check required fields and try again.', type: 'error', read: false }),
    },
  );

  const upsertRule = (index: number, patch: Partial<ApprovalWorkflowRule>) => {
    setRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)));
  };

  const upsertStep = (ruleIndex: number, stepIndex: number, patch: Partial<ApprovalWorkflowStepRule>) => {
    setRules((current) => current.map((rule, currentRuleIndex) => {
      if (currentRuleIndex !== ruleIndex) return rule;
      const steps = rule.steps.map((step, currentStepIndex) => (currentStepIndex === stepIndex ? { ...step, ...patch } : step));
      return { ...rule, steps };
    }));
  };

  const updateStepFromBuilder = (
    ruleIndex: number,
    stepIndex: number,
    patch: Partial<ApprovalWorkflowStepRule> & { escalationAfterHours?: number; escalationApproverRole?: string },
  ) => {
    const { escalationAfterHours, escalationApproverRole, ...stepPatch } = patch;
    const escalationPatch: Partial<ApprovalWorkflowStepRule> = { ...stepPatch };
    if (escalationAfterHours !== undefined || escalationApproverRole !== undefined) {
      const existing = rules[ruleIndex]?.steps[stepIndex]?.escalationTiers?.[0];
      escalationPatch.escalationTiers = [{
        code: existing?.code ?? 'ESCALATE_1',
        label: existing?.label ?? 'Escalation',
        active: true,
        afterHours: escalationAfterHours ?? existing?.afterHours ?? 0,
        approverRole: escalationApproverRole ?? existing?.approverRole ?? 'HR_ADMIN',
      }];
    }
    upsertStep(ruleIndex, stepIndex, escalationPatch);
  };

  const reorderSteps = (ruleIndex: number, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0) return;
    setRules((current) => current.map((rule, index) => {
      if (index !== ruleIndex || toIndex >= rule.steps.length) return rule;
      const steps = [...rule.steps];
      const [moved] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, moved);
      return { ...rule, steps: steps.map((step, currentIndex) => ({ ...step, order: currentIndex + 1 })) };
    }));
  };

  const previewItems = (rule: ApprovalWorkflowRule) => {
    const orderedSteps = [...rule.steps].sort((left, right) => left.order - right.order);
    const totalSla = orderedSteps.reduce((total, step) => total + (step.slaHours ?? 0), 0);
    const escalationCount = orderedSteps.reduce((total, step) => total + (step.escalationTiers?.length ?? 0), 0);
    const conditionCount = rule.conditions?.length ?? 0;
    return [
      { label: 'Command', value: rule.commandName },
      { label: 'Steps', value: orderedSteps.length },
      { label: 'Total SLA', value: `${totalSla}h` },
      { label: 'Escalations', value: escalationCount },
      {
        label: 'Routing conditions',
        value: conditionCount === 0 ? 'Always' : `${conditionCount} (${rule.conditionLogic ?? 'ALL'})`,
      },
    ];
  };

  const addTemplate = (template: ApprovalWorkflowRule) => {
    setRules((current) => {
      const existingCodes = new Set(current.map((rule) => rule.code));
      const code = existingCodes.has(template.code) ? `${template.code}_${current.length + 1}` : template.code;
      return [...current, { ...template, code }];
    });
  };

  const addStep = (ruleIndex: number) => {
    setRules((current) => current.map((rule, index) => {
      if (index !== ruleIndex) return rule;
      const order = rule.steps.length + 1;
      return {
        ...rule,
        steps: [
          ...rule.steps,
          { code: `STEP_${order}`, label: `Approval step ${order}`, active: true, order, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN', slaHours: rule.slaHours ?? 24 },
        ],
      };
    }));
  };

  const removeRule = (ruleIndex: number) => {
    setRules((current) => current.filter((_rule, index) => index !== ruleIndex));
  };

  const removeStep = (ruleIndex: number, stepIndex: number) => {
    setRules((current) => current.map((rule, index) => {
      if (index !== ruleIndex) return rule;
      return {
        ...rule,
        steps: rule.steps.filter((_step, currentStepIndex) => currentStepIndex !== stepIndex)
          .map((step, currentStepIndex) => ({ ...step, order: currentStepIndex + 1 })),
      };
    }));
  };

  const addCondition = (ruleIndex: number) => {
    setRules((current) => current.map((rule, index) => {
      if (index !== ruleIndex) return rule;
      const conditions = [...(rule.conditions ?? []), { field: '', operator: 'EQUALS' as ApprovalConditionOperator, value: '' }];
      return { ...rule, conditions, conditionLogic: rule.conditionLogic ?? 'ALL' };
    }));
  };

  const updateCondition = (ruleIndex: number, conditionIndex: number, patch: Partial<ApprovalWorkflowCondition>) => {
    setRules((current) => current.map((rule, index) => {
      if (index !== ruleIndex) return rule;
      const conditions = (rule.conditions ?? []).map((condition, currentConditionIndex) => (
        currentConditionIndex === conditionIndex ? { ...condition, ...patch } : condition
      ));
      return { ...rule, conditions };
    }));
  };

  const removeCondition = (ruleIndex: number, conditionIndex: number) => {
    setRules((current) => current.map((rule, index) => {
      if (index !== ruleIndex) return rule;
      const conditions = (rule.conditions ?? []).filter((_condition, currentConditionIndex) => currentConditionIndex !== conditionIndex);
      return { ...rule, conditions };
    }));
  };

  const setConditionLogic = (ruleIndex: number, conditionLogic: ApprovalConditionLogic) => {
    setRules((current) => current.map((rule, index) => (index === ruleIndex ? { ...rule, conditionLogic } : rule)));
  };

  const save = () => saveMutation.mutate({ rules });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Governance
          </div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Approval Paths</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Define which business commands require review, who approves each step, and when delayed decisions escalate.
          </p>
        </div>
        <Button onClick={save} disabled={saveMutation.isPending || rules.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          Save Approval Paths
        </Button>
      </div>

      {/* Establishes the h2 level between the page h1 and the card titles (h3),
          so the heading order is valid (a11y: heading-order). */}
      <h2 className="sr-only">Approval paths workspace</h2>

      <section className="grid gap-3 md:grid-cols-3">
        {ruleTemplates.map((template) => (
          <Card key={template.code} className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                {template.label}
                <Badge variant="outline">{template.steps.length} steps</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{template.commandName}</p>
              <Button className="mt-4" variant="outline" size="sm" onClick={() => addTemplate(template)}>
                <Plus className="mr-2 h-4 w-4" />
                Add path
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No approval paths configured"
          description="Add a template to start routing compensation, leave, disciplinary, and other governed commands."
        />
      ) : (
        <div className="space-y-4">
          {rules.map((rule, ruleIndex) => (
            <Card key={`${rule.code}-${ruleIndex}`} className="border-slate-200">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="grid flex-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="grid gap-2">
                      <Label>Path code</Label>
                      <Input value={rule.code} onChange={(event) => upsertRule(ruleIndex, { code: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Business label</Label>
                      <Input value={rule.label} onChange={(event) => upsertRule(ruleIndex, { label: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Command type</Label>
                      <Input value={rule.commandName} onChange={(event) => upsertRule(ruleIndex, { commandName: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Record type</Label>
                      <Input value={rule.aggregateType ?? ''} onChange={(event) => upsertRule(ruleIndex, { aggregateType: event.target.value })} />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove approval path" onClick={() => removeRule(ruleIndex)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {rule.steps.map((step, stepIndex) => (
                  <WorkflowStepBuilder
                    key={`${step.code}-${stepIndex}`}
                    index={stepIndex}
                    code={step.code}
                    label={step.label}
                    order={step.order}
                    mode={step.mode}
                    approverType={step.approverType}
                    approverRole={step.approverRole}
                    approverWorkerId={step.approverWorkerId}
                    slaHours={step.slaHours}
                    escalationAfterHours={step.escalationTiers?.[0]?.afterHours}
                    escalationApproverRole={step.escalationTiers?.[0]?.approverRole}
                    onChange={(patch) => updateStepFromBuilder(ruleIndex, stepIndex, patch)}
                    onMove={(direction) => reorderSteps(ruleIndex, stepIndex, direction === 'up' ? stepIndex - 1 : stepIndex + 1)}
                    onDragStart={() => setDraggedStep({ ruleIndex, stepIndex })}
                    onDrop={() => {
                      if (draggedStep?.ruleIndex === ruleIndex) {
                        reorderSteps(ruleIndex, draggedStep.stepIndex, stepIndex);
                      }
                      setDraggedStep(null);
                    }}
                    onRemove={() => removeStep(ruleIndex, stepIndex)}
                  />
                ))}

                <div className="rounded-2xl border border-dashed border-slate-300 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Routing conditions</p>
                      <p className="text-xs text-slate-500">
                        Only intercept this command when its payload satisfies these conditions. Leave empty to match every {rule.commandName || 'command'}.
                      </p>
                    </div>
                    {(rule.conditions ?? []).length > 1 ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span>Match</span>
                        <select
                          aria-label="Condition combination logic"
                          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                          value={rule.conditionLogic ?? 'ALL'}
                          onChange={(event) => setConditionLogic(ruleIndex, event.target.value as ApprovalConditionLogic)}
                        >
                          <option value="ALL">All conditions (AND)</option>
                          <option value="ANY">Any condition (OR)</option>
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {(rule.conditions ?? []).map((condition, conditionIndex) => (
                      <ConditionRowBuilder
                        key={`condition-${ruleIndex}-${conditionIndex}`}
                        index={conditionIndex}
                        field={condition.field}
                        operator={condition.operator}
                        value={condition.value === undefined || condition.value === null ? '' : String(condition.value)}
                        onChange={(patch) => updateCondition(ruleIndex, conditionIndex, patch)}
                        onRemove={() => removeCondition(ruleIndex, conditionIndex)}
                      />
                    ))}
                  </div>
                  <Button className="mt-3" variant="outline" size="sm" onClick={() => addCondition(ruleIndex)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add condition
                  </Button>
                </div>

                {previewRuleIndex === ruleIndex ? (
                  <PreviewPanel title="Sandbox approval preview" items={previewItems(rule)} />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => addStep(ruleIndex)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add approval step
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPreviewRuleIndex(previewRuleIndex === ruleIndex ? null : ruleIndex)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview approval path
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
