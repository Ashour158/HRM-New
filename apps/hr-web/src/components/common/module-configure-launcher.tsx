import { Link } from 'react-router-dom';
import { EyeOff, Settings2, ShieldCheck, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';

/**
 * A single, real PolicyArea code from apps/hr-api's POLICY_AREAS list
 * (see apps/hr-api/src/domains/policy-center/policy-center.types.ts).
 * Only set this for a module when Policy Center genuinely governs that
 * module's runtime config today - do not invent a mapping that would send
 * an admin to a policy screen that does not actually control their module.
 */
export type LauncherPolicyArea =
  | 'EMPLOYEE_SETUP'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'ACCESS_GOVERNANCE'
  | 'COUNTRY_POLICY'
  | 'COMPLIANCE'
  | 'BENEFITS'
  | 'GLOBAL_HR'
  | 'DEI_ANALYTICS'
  | 'ENGAGEMENT';

export interface ModuleConfigureLauncherProps {
  /** Human readable module name, e.g. "Compensation". */
  moduleName: string;
  /**
   * Real PolicyArea to pre-scope Policy Center with (?area=). Omit when this
   * module has no dedicated policy area yet - the Policies action then opens
   * the unfiltered Policy Center instead of guessing at a wrong scope.
   */
  policyArea?: LauncherPolicyArea;
  /**
   * Keyword used to pre-filter Approvals Config (?command=) by substring
   * match against each approval path's command name and label.
   */
  approvalCommandKeyword: string;
  /**
   * Keyword used to pre-filter Access Governance's Field Access tab
   * (?entity=) by substring match against each field policy's field path.
   */
  fieldAccessEntity: string;
  className?: string;
}

/**
 * Consistent "Configure <Module>" launcher rendered on every module admin
 * page. Deep-links into the cross-cutting Policy Center, Approvals Config,
 * and Access Governance tools, pre-scoped to this module via query params
 * so the admin lands on this module's slice instead of the unfiltered tool.
 */
export function ModuleConfigureLauncher({
  moduleName,
  policyArea,
  approvalCommandKeyword,
  fieldAccessEntity,
  className,
}: ModuleConfigureLauncherProps) {
  const policyHref = policyArea
    ? `/admin/system-console/policies?area=${encodeURIComponent(policyArea)}`
    : '/admin/system-console/policies';
  const approvalsHref = `/admin/system-console/approvals?command=${encodeURIComponent(approvalCommandKeyword)}`;
  const fieldAccessHref = `/admin/system-console/access-governance?entity=${encodeURIComponent(fieldAccessEntity)}`;

  return (
    <Card className={`fusion-glass rounded-2xl border-transparent ${className ?? ''}`.trim()} data-testid="module-configure-launcher">
      <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          {/*
            Intentionally not a heading element (h1-h6): this card is dropped into many
            different pages at different points in their heading hierarchy, and a real
            heading here would make the a11y heading-order unpredictable per insertion
            point. The bold label communicates the same thing visually.
          */}
          <p className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Settings2 className="h-4 w-4" />
            {`Configure ${moduleName}`}
          </p>
          <CardDescription>
            {policyArea
              ? `Jump straight to ${moduleName}'s policy rules, approval paths, and field access controls.`
              : `Jump to ${moduleName}'s approval paths and field access controls, and the shared Policy Center.`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={policyHref}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {policyArea ? `${moduleName} Policies` : 'Policy Center'}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={approvalsHref}>
              <Workflow className="mr-2 h-4 w-4" />
              Approval Paths
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={fieldAccessHref}>
              <EyeOff className="mr-2 h-4 w-4" />
              Field Access
            </Link>
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
