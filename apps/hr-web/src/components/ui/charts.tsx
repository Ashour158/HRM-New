import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ChartDatum {
  label: string;
  value: number;
}

interface ChartPanelProps {
  title: string;
  data: ChartDatum[];
  height?: number;
}

const chartColors = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent-strong))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
];

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="bg-card text-card-foreground">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function LineChartPanel({ title, data, height = 240 }: ChartPanelProps) {
  return (
    <ChartFrame title={title}>
      <div role="img" style={{ height }} aria-label={`${title} line chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <RechartsTooltip />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function BarChartPanel({ title, data, height = 240 }: ChartPanelProps) {
  return (
    <ChartFrame title={title}>
      <div role="img" style={{ height }} aria-label={`${title} bar chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <RechartsTooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function DonutChartPanel({ title, data, height = 240 }: ChartPanelProps) {
  return (
    <ChartFrame title={title}>
      <div role="img" style={{ height }} aria-label={`${title} donut chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={54} outerRadius={86} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
