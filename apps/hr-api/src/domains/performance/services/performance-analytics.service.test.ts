import { describe, expect, it } from 'vitest';
import { PerformanceAnalyticsService } from './performance-analytics.service.js';

describe('PerformanceAnalyticsService', () => {
  it('builds rating analytics, 9-box placement, recognition, and anonymous feedback synthesis', () => {
    const service = new PerformanceAnalyticsService();

    const summary = service.buildCycleAnalytics({
      cycleId: 'cycle-1',
      anonymityThreshold: 1,
      workers: [
        { id: 'worker-a', firstName: 'Alice', lastName: 'Smith', departmentName: 'People' },
        { id: 'worker-b', firstName: 'Omar', lastName: 'Hassan', departmentName: 'Sales' },
      ],
      reviews: [
        { id: 'review-a', workerId: 'worker-a', finalRating: 5, calibratedRating: 4, status: 'FINALIZED' },
        { id: 'review-b', workerId: 'worker-b', finalRating: 2, calibratedRating: 3, status: 'CALIBRATED' },
      ],
      goals: [
        { id: 'goal-a', workerId: 'worker-a', targetValue: 100, currentValue: 100, status: 'ACHIEVED' },
        { id: 'goal-b', workerId: 'worker-b', targetValue: 100, currentValue: 40, status: 'IN_PROGRESS' },
      ],
      objectives: [
        { id: 'objective-a', ownerId: 'worker-a', progress: 95, confidenceScore: 0.9, status: 'ACTIVE' },
      ],
      keyResults: [
        { id: 'kr-a', objectiveId: 'objective-a', targetValue: 100, currentValue: 90, progress: 90, status: 'IN_PROGRESS' },
      ],
      feedbackResponses: [
        {
          id: 'feedback-a',
          revieweeId: 'worker-a',
          reviewerId: 'peer-1',
          relationshipType: 'PEER',
          dimensionScores: { communication: 5, professionalism: 5, ethics: 4, teamwork: 5 },
          areaComments: { communication: 'Keeps stakeholders aligned', ethics: 'Acts with fairness' },
          overallRating: 5,
          strengths: 'Clear leadership and strong delivery',
          improvements: 'Delegate more decisions',
          comments: 'Trusted collaborator',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
        {
          id: 'feedback-b',
          revieweeId: 'worker-b',
          reviewerId: 'peer-2',
          relationshipType: 'PEER',
          dimensionScores: { communication: 2, professionalism: 3, ethics: 3, teamwork: 2 },
          areaComments: { communication: 'Updates are often late', teamwork: 'Needs clearer handoffs' },
          overallRating: 2,
          strengths: 'Customer empathy',
          improvements: 'Follow through and planning',
          comments: 'Needs tighter ownership',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
      ],
      developmentPlans: [
        { id: 'plan-b', workerId: 'worker-b', title: 'Execution action plan', status: 'ACTIVE' },
      ],
    });

    expect(summary.ratingDistribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 1 },
      { rating: 3, count: 0 },
      { rating: 4, count: 0 },
      { rating: 5, count: 1 },
    ]);
    expect(summary.nineBox.find((item) => item.workerId === 'worker-a')).toEqual(expect.objectContaining({
      performanceBand: 'HIGH',
      potentialBand: 'HIGH',
      box: 'Star',
    }));
    expect(summary.recognitions[0]).toEqual(expect.objectContaining({
      workerId: 'worker-a',
      reason: expect.stringContaining('rating 5'),
    }));
    expect(summary.feedbackSummaries.workerA).toBeUndefined();
    expect(summary.feedbackSummaries['worker-a']).toEqual(expect.objectContaining({
      averageRating: 5,
      responseCount: 1,
      anonymousResponseCount: 1,
      conciseFeedback: expect.stringContaining('Clear leadership'),
      dimensionAverages: expect.objectContaining({ communication: 5, professionalism: 5, ethics: 4, teamwork: 5 }),
      areaThemes: expect.objectContaining({ communication: ['Keeps stakeholders aligned'] }),
      anonymitySuppressionApplied: false,
    }));
    expect(summary.actionPlans.find((plan) => plan.workerId === 'worker-b')).toEqual(expect.objectContaining({
      currentPerformance: expect.objectContaining({
        latestRating: 2,
        averageGoalProgress: 40,
        peerAverageRating: 2,
      }),
      timeline: expect.objectContaining({
        durationDays: 90,
        reviewCheckpoints: expect.arrayContaining([30, 60, 90]),
      }),
      trackingMetrics: expect.arrayContaining([
        expect.objectContaining({ metric: 'Goal progress' }),
        expect.objectContaining({ metric: 'Peer feedback rating' }),
      ]),
      recommendedActions: expect.arrayContaining([expect.stringContaining('Improve goal progress')]),
    }));
    expect(summary.peerFeedback.dimensionAverages).toEqual(expect.objectContaining({
      communication: 3.5,
      professionalism: 4,
      ethics: 3.5,
      teamwork: 3.5,
    }));
    expect(summary.scoreExplainability['worker-a']).toEqual(expect.objectContaining({
      ratingScore: 100,
      goalScore: 100,
      feedbackScore: 100,
      performanceWeights: expect.objectContaining({ rating: 0.55, goals: 0.3, feedback: 0.15 }),
      summary: expect.stringContaining('rating'),
    }));
    expect(summary.biasChecks.departmentRatingDistribution).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: 'People', count: 1, averageRating: 5, suppressed: false }),
      expect.objectContaining({ group: 'Sales', count: 1, averageRating: 2, suppressed: false }),
    ]));
    expect(summary.trendSignals).toEqual(expect.arrayContaining([
      expect.objectContaining({ workerId: 'worker-b', signal: 'DECLINING', recommendedAction: expect.stringContaining('manager') }),
    ]));
    expect(summary.governance).toEqual(expect.objectContaining({
      anonymityThreshold: 1,
      performanceFormulaVersion: 'performance-analytics-v2',
    }));
  });

  it('suppresses anonymous 360 summaries until the peer threshold is met', () => {
    const service = new PerformanceAnalyticsService();

    const summary = service.buildCycleAnalytics({
      cycleId: 'cycle-1',
      anonymityThreshold: 3,
      workers: [
        { id: 'worker-a', firstName: 'Alice', lastName: 'Smith' },
      ],
      reviews: [],
      goals: [],
      objectives: [],
      keyResults: [],
      feedbackResponses: [
        {
          id: 'feedback-a',
          revieweeId: 'worker-a',
          reviewerId: 'peer-1',
          relationshipType: 'PEER',
          dimensionScores: { communication: 2 },
          areaComments: { communication: 'Needs clearer updates' },
          overallRating: 2,
          strengths: 'Customer care',
          improvements: 'More proactive communication',
          comments: 'Can improve',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
        {
          id: 'feedback-b',
          revieweeId: 'worker-a',
          reviewerId: 'peer-2',
          relationshipType: 'PEER',
          dimensionScores: { communication: 3 },
          areaComments: { communication: 'Sometimes late' },
          overallRating: 3,
          strengths: 'Responsive',
          improvements: 'Earlier status sharing',
          comments: 'Mixed',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
      ],
      developmentPlans: [],
    });

    expect(summary.feedbackSummaries['worker-a']).toEqual(expect.objectContaining({
      responseCount: 2,
      anonymousResponseCount: 2,
      averageRating: null,
      strengths: [],
      improvements: [],
      dimensionAverages: {},
      areaThemes: {},
      anonymitySuppressionApplied: true,
    }));
    expect(summary.feedbackSummaries['worker-a'].conciseFeedback).toContain('anonymous threshold');
  });

  it('suppresses anonymous 360 feedback independently by source category', () => {
    const service = new PerformanceAnalyticsService();

    const summary = service.buildCycleAnalytics({
      cycleId: 'cycle-1',
      anonymityThreshold: 2,
      workers: [
        { id: 'worker-a', firstName: 'Alice', lastName: 'Smith' },
      ],
      reviews: [],
      goals: [],
      objectives: [],
      keyResults: [],
      feedbackResponses: [
        {
          id: 'feedback-peer-a',
          revieweeId: 'worker-a',
          reviewerId: 'peer-1',
          relationshipType: 'PEER',
          dimensionScores: { communication: 4 },
          areaComments: { communication: 'Keeps the team aligned' },
          overallRating: 4,
          strengths: 'Clear team updates',
          improvements: 'Keep delegating',
          comments: 'Good peer signal',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
        {
          id: 'feedback-peer-b',
          revieweeId: 'worker-a',
          reviewerId: 'peer-2',
          relationshipType: 'PEER',
          dimensionScores: { communication: 5 },
          areaComments: { communication: 'Reliable risk sharing' },
          overallRating: 5,
          strengths: 'Strong delivery partner',
          improvements: 'More async notes',
          comments: 'Strong peer signal',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
        {
          id: 'feedback-manager-a',
          revieweeId: 'worker-a',
          reviewerId: 'manager-1',
          relationshipType: 'MANAGER',
          dimensionScores: { communication: 1 },
          areaComments: { communication: 'This single manager source must stay hidden' },
          overallRating: 1,
          strengths: 'Private manager strength',
          improvements: 'Private manager concern',
          comments: 'Single manager bucket',
          isAnonymous: true,
          status: 'SUBMITTED',
        },
      ],
      developmentPlans: [],
    });

    expect(summary.feedbackSummaries['worker-a']).toEqual(expect.objectContaining({
      responseCount: 3,
      anonymousResponseCount: 3,
      averageRating: 4.5,
      anonymitySuppressionApplied: true,
      sourceSuppression: expect.arrayContaining([
        expect.objectContaining({ relationshipType: 'PEER', submitted: 2, threshold: 2, suppressed: false }),
        expect.objectContaining({ relationshipType: 'MANAGER', submitted: 1, threshold: 2, suppressed: true }),
      ]),
      dimensionAverages: { communication: 4.5 },
    }));
    expect(summary.feedbackSummaries['worker-a'].strengths).toEqual([
      'Clear team updates',
      'Strong delivery partner',
    ]);
    expect(summary.feedbackSummaries['worker-a'].conciseFeedback).toContain('manager feedback is hidden');
    expect(summary.peerFeedback).toEqual(expect.objectContaining({
      submitted: 2,
      anonymousSubmitted: 2,
      averageRating: 4.5,
      relationshipMix: { PEER: 2 },
    }));
    expect(summary.governance.inputCounts).toEqual(expect.objectContaining({
      feedbackResponses: 3,
      visibleFeedbackResponses: 2,
    }));
    expect(summary.governance.sourceSuppression).toEqual([
      expect.objectContaining({ relationshipType: 'MANAGER', suppressed: true }),
    ]);
  });

  it('projects persisted improvement action plans while keeping submitted 360 outcomes current', () => {
    const service = new PerformanceAnalyticsService();

    const summary = service.buildCycleAnalytics({
      cycleId: 'employee-profile:worker-a',
      anonymityThreshold: 1,
      workers: [
        { id: 'worker-a', firstName: 'Amina', lastName: 'Nour' },
      ],
      reviews: [
        { id: 'review-a', workerId: 'worker-a', finalRating: 3.4, status: 'FINALIZED' },
      ],
      goals: [
        { id: 'goal-a', workerId: 'worker-a', targetValue: 100, currentValue: 55, status: 'IN_PROGRESS' },
      ],
      objectives: [],
      keyResults: [],
      feedbackResponses: [
        {
          id: 'feedback-a',
          revieweeId: 'worker-a',
          reviewerId: 'peer-1',
          relationshipType: 'PEER',
          dimensionScores: { communication: 4, teamwork: 5 },
          areaComments: { communication: 'Clearer launch updates this month' },
          overallRating: 4.5,
          strengths: 'Strong partner in launch planning',
          improvements: 'Earlier risk escalation',
          comments: 'Good momentum',
          isAnonymous: false,
          status: 'SUBMITTED',
        },
      ],
      developmentPlans: [],
      improvementPlans: [
        {
          id: 'pip-a',
          workerId: 'worker-a',
          status: 'ACTIVE',
          objectives: ['Raise goal delivery above 75%', 'Keep peer handoffs predictable'],
          planDurationDays: 45,
          checkInCadence: 'Twice-weekly manager action-plan check-in',
          trackingMetrics: [
            { metric: 'Goal recovery', current: 55, target: 75, unit: '%' },
          ],
          successCriteria: ['Two consecutive launch milestones land on time'],
        },
      ],
    });

    expect(summary.feedbackSummaries['worker-a']).toEqual(expect.objectContaining({
      averageRating: 4.5,
      responseCount: 1,
      dimensionAverages: { communication: 4, teamwork: 5 },
    }));
    expect(summary.actionPlans[0]).toEqual(expect.objectContaining({
      riskLevel: 'MEDIUM',
      checkInCadence: 'Twice-weekly manager action-plan check-in',
      timeline: expect.objectContaining({ durationDays: 45 }),
      currentPerformance: expect.objectContaining({
        peerAverageRating: 4.5,
        averageGoalProgress: 55,
        openDevelopmentPlan: true,
      }),
      trackingMetrics: [
        { metric: 'Goal recovery', current: 55, target: 75, unit: '%' },
      ],
      successCriteria: ['Two consecutive launch milestones land on time'],
      recommendedActions: expect.arrayContaining([
        'Advance action plan objective: Raise goal delivery above 75%',
      ]),
    }));
  });

  it('chooses the active current improvement plan deterministically when multiple plans are open', () => {
    const service = new PerformanceAnalyticsService();

    const summary = service.buildCycleAnalytics({
      cycleId: 'employee-profile:worker-a',
      anonymityThreshold: 1,
      workers: [
        { id: 'worker-a', firstName: 'Amina', lastName: 'Nour' },
      ],
      reviews: [],
      goals: [
        { id: 'goal-a', workerId: 'worker-a', targetValue: 100, currentValue: 70, status: 'IN_PROGRESS' },
      ],
      objectives: [],
      keyResults: [],
      feedbackResponses: [],
      developmentPlans: [],
      improvementPlans: [
        {
          id: 'pip-draft',
          workerId: 'worker-a',
          status: 'DRAFT',
          objectives: ['Do not choose draft plan'],
          planDurationDays: 90,
          checkInCadence: 'Monthly draft check-in',
        },
        {
          id: 'pip-active',
          workerId: 'worker-a',
          status: 'ACTIVE',
          objectives: ['Use active plan first'],
          planDurationDays: 30,
          checkInCadence: 'Weekly active check-in',
        },
      ],
    });

    expect(summary.actionPlans[0]).toEqual(expect.objectContaining({
      checkInCadence: 'Weekly active check-in',
      timeline: expect.objectContaining({ durationDays: 30 }),
      recommendedActions: expect.arrayContaining([
        'Advance action plan objective: Use active plan first',
      ]),
    }));
  });
});
