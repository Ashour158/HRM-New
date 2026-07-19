import { Award, PartyPopper, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { RecentJoin, UpcomingAnniversary } from '@/lib/team-activity';

export interface TeamActivityCardProps {
  upcomingAnniversaries: UpcomingAnniversary[];
  recentJoins: RecentJoin[];
  className?: string;
}

function daysUntilLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

function daysSinceLabel(daysSinceHire: number): string {
  if (daysSinceHire === 0) return 'Today';
  if (daysSinceHire === 1) return 'Yesterday';
  return `${daysSinceHire} days ago`;
}

/**
 * Lightweight team-activity widget for the manager team list view: upcoming
 * work anniversaries and recent joins, computed client-side from the same
 * `/manager/team` roster the page already fetches (see
 * `computeUpcomingTeamEvents` in `@/lib/team-activity`).
 *
 * Birthdays are intentionally omitted: the roster's `Worker` type does not
 * expose a date-of-birth field to this view.
 */
export function TeamActivityCard({ upcomingAnniversaries, recentJoins, className }: TeamActivityCardProps) {
  const hasActivity = upcomingAnniversaries.length > 0 || recentJoins.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PartyPopper className="h-5 w-5 text-fuchsia-500" />
          Team Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <p className="text-sm text-slate-500">
            No upcoming anniversaries or new joins in the next 30 days.
          </p>
        ) : (
          <div className="space-y-5">
            {upcomingAnniversaries.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Award className="h-4 w-4 text-amber-500" />
                  Upcoming work anniversaries
                </div>
                <ul className="space-y-2">
                  {upcomingAnniversaries.map((event) => (
                    <li
                      key={`${event.workerId}-anniversary`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{event.name}</p>
                        <p className="text-xs text-slate-500">
                          <span>{formatDate(event.anniversaryDate)}</span>{' - '}
                          <span>{daysUntilLabel(event.daysUntil)}</span>
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {event.yearsOfTenure} {event.yearsOfTenure === 1 ? 'year' : 'years'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recentJoins.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <UserPlus className="h-4 w-4 text-emerald-500" />
                  Recent joins
                </div>
                <ul className="space-y-2">
                  {recentJoins.map((event) => (
                    <li
                      key={`${event.workerId}-new-hire`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{event.name}</p>
                        <p className="text-xs text-slate-500">{formatDate(event.hireDate)}</p>
                      </div>
                      <Badge variant="default">{daysSinceLabel(event.daysSinceHire)}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
