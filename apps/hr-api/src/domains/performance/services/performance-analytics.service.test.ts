import { describe, expect, it } from 'vitest';
import { PerformanceAnalyticsService } from './performance-analytics.service.js';

describe('PerformanceAnalyticsService', () => {
  it('builds rating analytics, 9-box placement, recognition, and anonymous feedback synthesis', () => {
    const service = new PerformanceAnalyticsService();

    const summary = service.buildCycleAnalytics({
      cycleId: 'cycle-1',
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
      anonymitySuppressionApplied: true,
    }));
    expect(summary.actionPlans.find((plan) => plan.workerId === 'worker-b')).toEqual(expect.objectContaining({
      recommendedActions: expect.arrayContaining([expect.stringContaining('Improve goal progress')]),
    }));
  });
});
