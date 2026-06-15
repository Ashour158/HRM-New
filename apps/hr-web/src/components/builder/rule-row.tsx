import { Badge } from '@/components/ui/badge';

export interface RuleRowProps {
  code: string;
  label: string;
  outcome?: string;
  status?: string;
  detail?: string;
}

export function RuleRow({ code, label, outcome, status = 'Active', detail }: RuleRowProps): JSX.Element {
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{label}</p>
          <Badge variant="outline">{code}</Badge>
        </div>
        {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {outcome ? <Badge>{outcome}</Badge> : null}
        <Badge variant="secondary">{status}</Badge>
      </div>
    </div>
  );
}
