import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface PreviewPanelProps {
  title?: string;
  items: Array<{ label: string; value: string | number }>;
}

export function PreviewPanel({ title, items }: PreviewPanelProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card className="border-emerald-200 bg-emerald-50/60">
      <CardHeader>
        <CardTitle className="text-base">{title ?? t('builder.preview', { defaultValue: 'Preview' })}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-emerald-100 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-950">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
