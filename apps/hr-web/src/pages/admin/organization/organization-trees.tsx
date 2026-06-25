import { Badge } from '@/components/ui/badge';
import { Network, UserCog } from 'lucide-react';

export type OrganizationTreeNode = {
  id: string;
  name: string;
  level: number;
  status: string;
  children?: OrganizationTreeNode[];
};

export type ReportingTreeNode = {
  id: string;
  name: string;
  employeeId?: string;
  jobTitle?: string;
  departmentId?: string | null;
  directReports: ReportingTreeNode[];
};

export function OrgTree({ nodes, depth = 0 }: { nodes: OrganizationTreeNode[]; depth?: number }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No active org structure yet. Create a legal entity, then add departments or teams.</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <div key={node.id}>
          <div className="fusion-glass flex items-center gap-3 rounded-2xl p-3" style={{ marginInlineStart: depth * 20 }}>
            <Network className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{node.name}</p>
              <p className="text-xs text-muted-foreground">{node.status} · level {node.level}</p>
            </div>
            <Badge variant="outline">{node.children?.length ?? 0} children</Badge>
          </div>
          {node.children && node.children.length > 0 ? <OrgTree nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

export function ReportingTree({
  nodes,
  depth = 0,
  visited = new Set<string>(),
}: {
  nodes: ReportingTreeNode[];
  depth?: number;
  visited?: Set<string>;
}) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No active employee reporting lines yet.</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => {
        const hasCycle = visited.has(node.id);
        const nextVisited = new Set(visited);
        nextVisited.add(node.id);

        return (
          <div key={`${node.id}-${depth}`}>
            <div className="fusion-glass flex items-center gap-3 rounded-2xl p-3" style={{ marginInlineStart: depth * 20 }}>
              <UserCog className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{node.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {node.jobTitle ?? 'No title'}{node.employeeId ? ` · ${node.employeeId}` : ''}
                </p>
              </div>
              <Badge variant={node.directReports.length > 0 ? 'default' : 'outline'}>{node.directReports.length}</Badge>
            </div>
            {!hasCycle && node.directReports.length > 0 ? (
              <ReportingTree nodes={node.directReports} depth={depth + 1} visited={nextVisited} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
