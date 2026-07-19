import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamActivityCard } from './team-activity-card';
import type { RecentJoin, UpcomingAnniversary } from '@/lib/team-activity';

const anniversary: UpcomingAnniversary = {
  workerId: 'w1',
  name: 'Mona Saleh',
  hireDate: '2022-07-20T00:00:00.000Z',
  anniversaryDate: new Date('2026-07-20T00:00:00.000Z'),
  daysUntil: 8,
  yearsOfTenure: 4,
};

const recentJoin: RecentJoin = {
  workerId: 'w2',
  name: 'New Hire',
  hireDate: '2026-07-01T00:00:00.000Z',
  daysSinceHire: 11,
};

describe('TeamActivityCard', () => {
  it('renders upcoming anniversaries and recent joins when present', () => {
    render(<TeamActivityCard upcomingAnniversaries={[anniversary]} recentJoins={[recentJoin]} />);

    expect(screen.getByText('Team Activity')).toBeInTheDocument();
    expect(screen.getByText('Upcoming work anniversaries')).toBeInTheDocument();
    expect(screen.getByText('Mona Saleh')).toBeInTheDocument();
    expect(screen.getByText('4 years')).toBeInTheDocument();
    expect(screen.getByText('In 8 days')).toBeInTheDocument();

    expect(screen.getByText('Recent joins')).toBeInTheDocument();
    expect(screen.getByText('New Hire')).toBeInTheDocument();
    expect(screen.getByText('11 days ago')).toBeInTheDocument();

    expect(
      screen.queryByText('No upcoming anniversaries or new joins in the next 30 days.'),
    ).not.toBeInTheDocument();
  });

  it('renders only the anniversaries section when there are no recent joins', () => {
    render(<TeamActivityCard upcomingAnniversaries={[anniversary]} recentJoins={[]} />);
    expect(screen.getByText('Upcoming work anniversaries')).toBeInTheDocument();
    expect(screen.queryByText('Recent joins')).not.toBeInTheDocument();
  });

  it('renders only the recent joins section when there are no upcoming anniversaries', () => {
    render(<TeamActivityCard upcomingAnniversaries={[]} recentJoins={[recentJoin]} />);
    expect(screen.queryByText('Upcoming work anniversaries')).not.toBeInTheDocument();
    expect(screen.getByText('Recent joins')).toBeInTheDocument();
  });

  it('shows an empty state and stays quiet when there is no upcoming activity', () => {
    render(<TeamActivityCard upcomingAnniversaries={[]} recentJoins={[]} />);

    expect(screen.getByText('Team Activity')).toBeInTheDocument();
    expect(
      screen.getByText('No upcoming anniversaries or new joins in the next 30 days.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Upcoming work anniversaries')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent joins')).not.toBeInTheDocument();
  });

  it('shows singular "year" for a first anniversary', () => {
    render(
      <TeamActivityCard
        upcomingAnniversaries={[{ ...anniversary, yearsOfTenure: 1 }]}
        recentJoins={[]}
      />,
    );
    expect(screen.getByText('1 year')).toBeInTheDocument();
  });

  it('labels a same-day anniversary as "Today"', () => {
    render(
      <TeamActivityCard
        upcomingAnniversaries={[{ ...anniversary, daysUntil: 0 }]}
        recentJoins={[]}
      />,
    );
    expect(screen.getByText(/Today/)).toBeInTheDocument();
  });
});
