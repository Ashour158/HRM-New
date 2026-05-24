
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/common/data-table';
import { formatNumber } from '@/lib/utils';
import { Building2, Network, Users, Map } from 'lucide-react';
import type { OrgUnit } from '@/types';

interface OrgChartNode {
  id: string;
  name: string;
  title: string;
  children?: OrgChartNode[];
}

interface OrganizationData {
  legalEntities: OrgUnit[];
  departments: OrgUnit[];
  orgChart: OrgChartNode;
  managerRelationships: Array<{
    workerId: string;
    workerName: string;
    managerId: string;
    managerName: string;
  }>;
}

/**
 * Organization management page with org chart, legal entities, and departments.
 */
export function AdminOrganization() {
  const { data, isLoading } = useApiQuery<OrganizationData>(
    ['admin-organization'],
    '/admin/organization'
  );

  const entityColumns = [
    { key: 'name', header: 'Name', cell: (row: OrgUnit) => row.name },
    { key: 'type', header: 'Type', cell: (row: OrgUnit) => <Badge variant="outline">{row.type}</Badge> },
    {
      key: 'manager',
      header: 'Manager',
      cell: (row: OrgUnit) => row.managerName || '-',
    },
    {
      key: 'headcount',
      header: 'Headcount',
      cell: (row: OrgUnit) => formatNumber(row.headcount),
    },
  ];

  const relationshipColumns = [
    {
      key: 'worker',
      header: 'Worker',
      cell: (row: OrganizationData['managerRelationships'][0]) => row.workerName,
    },
    {
      key: 'manager',
      header: 'Manager',
      cell: (row: OrganizationData['managerRelationships'][0]) => row.managerName,
    },
  ];

  function OrgChartTree({ node, level = 0 }: { node: OrgChartNode; level?: number }) {
    return (
      <div className="ml-4">
        <div
          className="flex items-center gap-2 rounded-lg border p-3 my-2"
          style={{ marginLeft: `${level * 20}px` }}
        >
          <Network className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{node.name}</p>
            <p className="text-xs text-muted-foreground">{node.title}</p>
          </div>
        </div>
        {node.children?.map((child) => (
          <OrgChartTree key={child.id} node={child} level={level + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Organization
          </h2>
          <p className="text-muted-foreground">Manage organizational structure</p>
        </div>
      </div>

      <Tabs defaultValue="org-chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="org-chart">Org Chart</TabsTrigger>
          <TabsTrigger value="entities">Legal Entities</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="managers">Manager Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="org-chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Map className="h-5 w-5" />
                Organization Chart
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : data?.orgChart ? (
                <OrgChartTree node={data.orgChart} />
              ) : (
                <p className="text-sm text-muted-foreground">No org chart data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legal Entities</CardTitle>
              <CardDescription>Registered legal entities</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={entityColumns}
                data={data?.legalEntities ?? []}
                keyExtractor={(row) => row.id}
                isLoading={isLoading}
                emptyMessage="No legal entities found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Departments</CardTitle>
              <CardDescription>Organizational units and teams</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={entityColumns}
                data={data?.departments ?? []}
                keyExtractor={(row) => row.id}
                isLoading={isLoading}
                emptyMessage="No departments found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="managers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manager Relationships
              </CardTitle>
              <CardDescription>Worker-to-manager assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={relationshipColumns}
                data={data?.managerRelationships ?? []}
                keyExtractor={(row) => row.workerId}
                isLoading={isLoading}
                emptyMessage="No manager relationships found"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
