import { BarChart3, RefreshCcw } from 'lucide-react';
import { BusinessPageHeader } from '@/components/common/business-page';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReportingTab } from './reporting-model';

const reportingTabs: Array<{ value: ReportingTab; label: string }> = [
  { value: 'overview', label: 'Command Center' },
  { value: 'analytics', label: 'Smart Analytics' },
  { value: 'builder', label: 'Report Builder' },
  { value: 'relationships', label: 'Data Relationships' },
  { value: 'library', label: 'Library & Delivery' },
  { value: 'activity', label: 'Activity' },
];

export function ReportingPageHeader({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <BusinessPageHeader
      eyebrow="Insights"
      title="HR Reporting"
      subtitle="Track workforce, reward, talent, service, and governance activity from one reporting workspace."
      icon={BarChart3}
      actions={(
        <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCcw className="me-2 h-4 w-4" />
          Refresh
        </Button>
      )}
    />
  );
}

export function ReportingTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ReportingTab;
  onTabChange: (value: ReportingTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Reporting sections" className="inline-flex h-auto flex-wrap items-center justify-start rounded-md bg-[#f8fafc] p-1 text-muted-foreground">
      {reportingTabs.map((tab) => {
        const active = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="reporting-tabpanel"
            id={`reporting-tab-${tab.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              active && 'bg-background text-primary shadow-sm',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
