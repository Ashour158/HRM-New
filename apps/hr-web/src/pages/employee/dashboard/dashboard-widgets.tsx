import * as React from 'react';
import { MapPin } from 'lucide-react';
import {
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  hasCoordinateEvidence,
  type CoordinateEvidence,
} from '@/lib/attendance-location';
import { cn } from '@/lib/utils';

export function AttendanceLocationMap({
  point,
  subtitle,
  title,
}: {
  point: CoordinateEvidence;
  subtitle?: string;
  title: string;
}) {
  const embedUrl = buildGoogleMapsEmbedUrl(point, import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const searchUrl = buildGoogleMapsSearchUrl(point);
  if (!hasCoordinateEvidence(point)) return null;

  return (
    <div className="overflow-hidden fusion-glass rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h4 className="font-semibold text-[#0f172a]">{title}</h4>
          {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
        {searchUrl ? (
          <a className="text-sm font-semibold text-[#4f46e5] underline" href={searchUrl} rel="noreferrer" target="_blank">
            Open in Google Maps
          </a>
        ) : null}
      </div>
      {embedUrl ? (
        <iframe
          className="h-64 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title={title}
        />
      ) : (
        <div className="grid h-64 place-items-center bg-slate-50 px-5 text-center text-sm text-slate-600">
          <div>
            <MapPin className="mx-auto mb-3 h-6 w-6 text-[#4f46e5]" />
            <p className="font-medium text-slate-800">Map preview is not configured.</p>
            <p className="mt-1">Your location was captured and can still be reviewed by HR.</p>
          </div>
        </div>
      )}
      <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 md:grid-cols-3">
        <span>Latitude: <strong>{point.latitude}</strong></span>
        <span>Longitude: <strong>{point.longitude}</strong></span>
        <span>Accuracy: <strong>{point.accuracyMeters !== undefined ? `${point.accuracyMeters}m` : 'not reported'}</strong></span>
      </div>
    </div>
  );
}

export function FeedRow({
  icon,
  title,
  subtitle,
  rightTitle,
  rightSubtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rightTitle?: string;
  rightSubtitle?: string;
}) {
  return (
    <div className="fusion-glass rounded-2xl p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-orange-50">{icon}</div>
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        {rightTitle ? (
          <div className="ms-auto min-w-[180px] text-sm">
            <p className="font-semibold">{rightTitle}</p>
            <p className="text-slate-600">{rightSubtitle}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function KpiTile({
  icon: Icon,
  value,
  label,
  gradient,
  shadow,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  gradient: string;
  shadow: string;
}) {
  return (
    <div className={cn('fusion-hover relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-lg', gradient, shadow)}>
      <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
      <div className="relative flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="relative mt-5 font-headline text-4xl font-extrabold leading-none tracking-tight">{value}</p>
      <p className="relative mt-2 text-xs font-semibold text-white/80">{label}</p>
    </div>
  );
}
