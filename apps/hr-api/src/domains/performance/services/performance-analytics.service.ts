import { Injectable } from '@nestjs/common';

type IdLike = string | { value: string };

export interface PerformanceAnalyticsWorker {
  id: IdLike;
  firstName?: string;
  lastName?: string;
  email?: unknown;
  departmentName?: string;
  jobTitle?: string;
}

export interface PerformanceAnalyticsReview {
  id: IdLike;
  workerId: IdLike;
  finalRating?: number;
  calibratedRating?: number;
  status: string;
}

export interface PerformanceAnalyticsGoal {
  id: IdLike;
  workerId: IdLike;
  targetValue?: number;
  currentValue?: number;
  status: string;
  metricName?: string;
  smartCriteria?: {
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
}

export interface PerformanceAnalyticsObjective {
  id: IdLike;
  ownerId: IdLike;
  progress?: number;
  confidenceScore?: number;
  status: string;
}

export interface PerformanceAnalyticsKeyResult {
  id: IdLike;
  objectiveId: IdLike;
  targetValue?: number;
  currentValue?: number;
  progress?: number;
  status: string;
}

export interface PerformanceAnalyticsFeedback {
  id: IdLike;
  revieweeId: IdLike;
  reviewerId: IdLike;
  relationshipType: string;
  overallRating?: number;
  strengths?: string;
  improvements?: string;
  comments?: string;
  isAnonymous?: boolean;
  status: string;
  dimensionScores?: Record<string, number>;
  areaComments?: Record<string, string>;
}

export interface PerformanceAnalyticsDevelopmentPlan {
  id: IdLike;
  workerId: IdLike;
  title?: string;
  status: string;
}

export interface BuildPerformanceAnalyticsInput {
  cycleId: string;
  anonymityThreshold?: number;
  workers: PerformanceAnalyticsWorker[];
  reviews: PerformanceAnalyticsReview[];
  goals: PerformanceAnalyticsGoal[];
  objectives: PerformanceAnalyticsObjective[];
  keyResults: PerformanceAnalyticsKeyResult[];
  feedbackResponses: PerformanceAnalyticsFeedback[];
  developmentPlans: PerformanceAnalyticsDevelopmentPlan[];
}

export interface PerformanceFeedbackSummary {
  workerId: string;
  responseCount: number;
  anonymousResponseCount: number;
  averageRating: number | null;
  strengths: string[];
  improvements: string[];
  conciseFeedback: string;
  anonymitySuppressionApplied: boolean;
  dimensionAverages: Record<string, number>;
  areaThemes: Record<string, string[]>;
}

export interface PerformanceActionPlan {
  workerId: string;
  employeeName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  currentPerformance: {
    latestRating: number | null;
    averageGoalProgress: number;
    peerAverageRating: number | null;
    activeGoalCount: number;
    openDevelopmentPlan: boolean;
  };
  timeline: {
    durationDays: number;
    reviewCheckpoints: number[];
  };
  checkInCadence: string;
  trackingMetrics: Array<{ metric: string; current: number | null; target: number | null; unit: string }>;
  successCriteria: string[];
  progressTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';
  recommendedActions: string[];
}

export interface NineBoxPlacement {
  workerId: string;
  employeeName: string;
  performanceScore: number;
  potentialScore: number;
  performanceBand: 'LOW' | 'MEDIUM' | 'HIGH';
  potentialBand: 'LOW' | 'MEDIUM' | 'HIGH';
  box: string;
}

@Injectable()
export class PerformanceAnalyticsService {
  buildCycleAnalytics(input: BuildPerformanceAnalyticsInput) {
    const workers = input.workers.map((worker) => ({
      ...worker,
      id: this.id(worker.id),
      employeeName: this.employeeName(worker),
    }));
    const reviews = input.reviews.map((review) => ({
      ...review,
      id: this.id(review.id),
      workerId: this.id(review.workerId),
      rating: this.rating(review),
    }));
    const goals = input.goals.map((goal) => ({
      ...goal,
      id: this.id(goal.id),
      workerId: this.id(goal.workerId),
      progress: this.progressFromValues(goal.currentValue, goal.targetValue),
    }));
    const objectives = input.objectives.map((objective) => ({
      ...objective,
      id: this.id(objective.id),
      ownerId: this.id(objective.ownerId),
    }));
    const keyResults = input.keyResults.map((keyResult) => ({
      ...keyResult,
      id: this.id(keyResult.id),
      objectiveId: this.id(keyResult.objectiveId),
      progress: keyResult.progress ?? this.progressFromValues(keyResult.currentValue, keyResult.targetValue),
    }));
    const feedbackResponses = input.feedbackResponses
      .filter((response) => response.status === 'SUBMITTED')
      .map((response) => ({
        ...response,
        id: this.id(response.id),
        revieweeId: this.id(response.revieweeId),
        reviewerId: this.id(response.reviewerId),
      }));
    const developmentPlans = input.developmentPlans.map((plan) => ({
      ...plan,
      id: this.id(plan.id),
      workerId: this.id(plan.workerId),
    }));

    const feedbackSummaries = this.buildFeedbackSummaries(workers, feedbackResponses, input.anonymityThreshold ?? 3);
    const nineBox = workers.map((worker) => this.placeWorkerInNineBox(worker, reviews, goals, objectives, keyResults, feedbackSummaries));
    const actionPlans = this.actionPlans(workers, reviews, goals, feedbackSummaries, developmentPlans);
    const recognitions = nineBox
      .filter((placement) => placement.performanceBand === 'HIGH')
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10)
      .map((placement) => ({
        workerId: placement.workerId,
        employeeName: placement.employeeName,
        score: placement.performanceScore,
        reason: `Recognized for rating ${this.workerRating(placement.workerId, reviews) ?? 'N/A'} with ${Math.round(placement.performanceScore)}% performance score.`,
      }));

    return {
      cycleId: input.cycleId,
      ratingDistribution: this.ratingDistribution(reviews),
      reviewCompletion: this.reviewCompletion(reviews),
      goalMetrics: this.goalMetrics(goals),
      peerFeedback: this.peerFeedbackMetrics(feedbackResponses),
      calibrationHeatmap: this.calibrationHeatmap(reviews),
      nineBox,
      recognitions,
      feedbackSummaries,
      actionPlans,
      scoreExplainability: this.scoreExplainability(workers, reviews, goals, objectives, keyResults, feedbackSummaries),
      biasChecks: this.biasChecks(workers, reviews, input.anonymityThreshold ?? 3),
      trendSignals: this.trendSignals(actionPlans),
      governance: {
        anonymityThreshold: input.anonymityThreshold ?? 3,
        performanceFormulaVersion: 'performance-analytics-v2',
        generatedAt: new Date().toISOString(),
        inputCounts: {
          workers: workers.length,
          reviews: reviews.length,
          goals: goals.length,
          feedbackResponses: feedbackResponses.length,
        },
      },
    };
  }

  private buildFeedbackSummaries(
    workers: Array<PerformanceAnalyticsWorker & { id: string; employeeName: string }>,
    responses: Array<PerformanceAnalyticsFeedback & { id: string; revieweeId: string; reviewerId: string }>,
    anonymityThreshold: number,
  ): Record<string, PerformanceFeedbackSummary> {
    return workers.reduce<Record<string, PerformanceFeedbackSummary>>((acc, worker) => {
      const workerResponses = responses.filter((response) => response.revieweeId === worker.id);
      const anonymousResponseCount = workerResponses.filter((response) => response.isAnonymous).length;
      const suppressAnonymousSummary = anonymousResponseCount > 0 && workerResponses.length < anonymityThreshold;
      const ratings = workerResponses.map((response) => response.overallRating).filter((rating): rating is number => typeof rating === 'number');
      const strengths = suppressAnonymousSummary ? [] : this.takeThemes(workerResponses.map((response) => response.strengths));
      const improvements = suppressAnonymousSummary ? [] : this.takeThemes(workerResponses.map((response) => response.improvements));
      const averageRating = suppressAnonymousSummary ? null : ratings.length ? this.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length) : null;
      const dimensionAverages = suppressAnonymousSummary ? {} : this.dimensionAverages(workerResponses.map((response) => response.dimensionScores));
      const areaThemes = suppressAnonymousSummary ? {} : this.areaThemes(workerResponses.map((response) => response.areaComments));
      acc[worker.id] = {
        workerId: worker.id,
        responseCount: workerResponses.length,
        anonymousResponseCount,
        averageRating,
        strengths,
        improvements,
        conciseFeedback: suppressAnonymousSummary
          ? `Anonymous feedback is hidden until the anonymous threshold of ${anonymityThreshold} submitted responses is met.`
          : this.conciseFeedback(strengths, improvements, averageRating),
        anonymitySuppressionApplied: suppressAnonymousSummary,
        dimensionAverages,
        areaThemes,
      };
      return acc;
    }, {});
  }

  private conciseFeedback(strengths: string[], improvements: string[], averageRating: number | null): string {
    const ratingCopy = averageRating === null ? 'No peer rating yet.' : `Average peer rating is ${averageRating}.`;
    const strengthCopy = strengths.length ? `Strengths: ${strengths.join('; ')}.` : 'Strengths: not enough submitted feedback yet.';
    const improvementCopy = improvements.length ? `Focus: ${improvements.join('; ')}.` : 'Focus: keep collecting feedback before setting a theme.';
    return `${ratingCopy} ${strengthCopy} ${improvementCopy}`;
  }

  private actionPlans(
    workers: Array<PerformanceAnalyticsWorker & { id: string; employeeName: string }>,
    reviews: Array<PerformanceAnalyticsReview & { workerId: string; rating: number | undefined }>,
    goals: Array<PerformanceAnalyticsGoal & { workerId: string; progress: number }>,
    summaries: Record<string, PerformanceFeedbackSummary>,
    developmentPlans: Array<PerformanceAnalyticsDevelopmentPlan & { workerId: string }>,
  ): PerformanceActionPlan[] {
    return workers.map((worker) => {
      const workerGoals = goals.filter((goal) => goal.workerId === worker.id);
      const averageGoalProgress = this.average(workerGoals.map((goal) => goal.progress));
      const rating = this.workerRating(worker.id, reviews);
      const feedback = summaries[worker.id];
      const openDevelopmentPlan = developmentPlans.some((plan) => plan.workerId === worker.id && ['DRAFT', 'ACTIVE', 'IN_PROGRESS'].includes(plan.status));
      const durationDays = this.actionPlanDuration(rating, averageGoalProgress, feedback?.averageRating);
      const recommendedActions: string[] = [];

      if (averageGoalProgress < 60) recommendedActions.push(`Improve goal progress from ${Math.round(averageGoalProgress)}% with weekly manager check-ins.`);
      if ((rating ?? 5) < 3) recommendedActions.push('Create a manager-owned action plan for the low review rating.');
      if ((feedback?.averageRating ?? 5) < 3) recommendedActions.push('Schedule feedback coaching using peer review themes.');
      if (!openDevelopmentPlan && recommendedActions.length > 0) recommendedActions.push('Create or activate a development plan with measurable milestones.');
      if (recommendedActions.length === 0) recommendedActions.push('Maintain current performance rhythm and consider recognition or stretch goals.');
      const riskLevel = recommendedActions.some((item) => item.includes('low review') || item.includes('peer review')) ? 'HIGH' : averageGoalProgress < 60 ? 'MEDIUM' : 'LOW';

      return {
        workerId: worker.id,
        employeeName: worker.employeeName,
        riskLevel,
        currentPerformance: {
          latestRating: rating ?? null,
          averageGoalProgress: this.round(averageGoalProgress),
          peerAverageRating: feedback?.averageRating ?? null,
          activeGoalCount: workerGoals.filter((goal) => ['DRAFT', 'ACTIVE', 'IN_PROGRESS'].includes(goal.status)).length,
          openDevelopmentPlan,
        },
        timeline: {
          durationDays,
          reviewCheckpoints: durationDays <= 30 ? [15, 30] : durationDays <= 60 ? [30, 60] : [30, 60, 90],
        },
        checkInCadence: riskLevel === 'HIGH' ? 'Weekly manager check-in' : riskLevel === 'MEDIUM' ? 'Bi-weekly manager check-in' : 'Monthly performance conversation',
        trackingMetrics: [
          { metric: 'Goal progress', current: this.round(averageGoalProgress), target: 80, unit: '%' },
          { metric: 'Peer feedback rating', current: feedback?.averageRating ?? null, target: 3.5, unit: '/5' },
          { metric: 'Latest review rating', current: rating ?? null, target: 3, unit: '/5' },
        ],
        successCriteria: [
          'Goal progress reaches at least 80%',
          'Peer feedback average is 3.5 or higher',
          'Manager confirms sustained behavior improvement at checkpoint review',
        ],
        progressTrend: this.progressTrend(rating, averageGoalProgress, feedback?.averageRating),
        recommendedActions,
      };
    });
  }

  private placeWorkerInNineBox(
    worker: PerformanceAnalyticsWorker & { id: string; employeeName: string },
    reviews: Array<PerformanceAnalyticsReview & { workerId: string; rating: number | undefined }>,
    goals: Array<PerformanceAnalyticsGoal & { workerId: string; progress: number }>,
    objectives: Array<PerformanceAnalyticsObjective & { id: string; ownerId: string }>,
    keyResults: Array<PerformanceAnalyticsKeyResult & { objectiveId: string; progress: number }>,
    summaries: Record<string, PerformanceFeedbackSummary>,
  ): NineBoxPlacement {
    const ratingScore = ((this.workerRating(worker.id, reviews) ?? 3) / 5) * 100;
    const goalScore = this.average(goals.filter((goal) => goal.workerId === worker.id).map((goal) => goal.progress));
    const feedbackScore = ((summaries[worker.id]?.averageRating ?? 3) / 5) * 100;
    const ownedObjectiveIds = objectives.filter((objective) => objective.ownerId === worker.id).map((objective) => objective.id);
    const objectiveScore = this.average(objectives.filter((objective) => objective.ownerId === worker.id).map((objective) => objective.progress ?? 0));
    const keyResultScore = this.average(keyResults.filter((keyResult) => ownedObjectiveIds.includes(keyResult.objectiveId)).map((keyResult) => keyResult.progress));
    const confidenceScore = this.average(objectives.filter((objective) => objective.ownerId === worker.id).map((objective) => (objective.confidenceScore ?? 0.5) * 100));
    const performanceScore = this.round((ratingScore * 0.55) + (goalScore * 0.3) + (feedbackScore * 0.15));
    const potentialScore = this.round((objectiveScore * 0.45) + (keyResultScore * 0.25) + (confidenceScore * 0.2) + (feedbackScore * 0.1));
    const performanceBand = this.band(performanceScore);
    const potentialBand = this.band(potentialScore);
    return {
      workerId: worker.id,
      employeeName: worker.employeeName,
      performanceScore,
      potentialScore,
      performanceBand,
      potentialBand,
      box: this.boxLabel(performanceBand, potentialBand),
    };
  }

  private scoreExplainability(
    workers: Array<PerformanceAnalyticsWorker & { id: string; employeeName: string }>,
    reviews: Array<PerformanceAnalyticsReview & { workerId: string; rating: number | undefined }>,
    goals: Array<PerformanceAnalyticsGoal & { workerId: string; progress: number }>,
    objectives: Array<PerformanceAnalyticsObjective & { id: string; ownerId: string }>,
    keyResults: Array<PerformanceAnalyticsKeyResult & { objectiveId: string; progress: number }>,
    summaries: Record<string, PerformanceFeedbackSummary>,
  ) {
    return workers.reduce<Record<string, unknown>>((acc, worker) => {
      const rating = this.workerRating(worker.id, reviews);
      const ratingScore = ((rating ?? 3) / 5) * 100;
      const goalScore = this.average(goals.filter((goal) => goal.workerId === worker.id).map((goal) => goal.progress));
      const feedbackScore = ((summaries[worker.id]?.averageRating ?? 3) / 5) * 100;
      const ownedObjectiveIds = objectives.filter((objective) => objective.ownerId === worker.id).map((objective) => objective.id);
      const objectiveScore = this.average(objectives.filter((objective) => objective.ownerId === worker.id).map((objective) => objective.progress ?? 0));
      const keyResultScore = this.average(keyResults.filter((keyResult) => ownedObjectiveIds.includes(keyResult.objectiveId)).map((keyResult) => keyResult.progress));
      const confidenceScore = this.average(objectives.filter((objective) => objective.ownerId === worker.id).map((objective) => (objective.confidenceScore ?? 0.5) * 100));
      const performanceScore = this.round((ratingScore * 0.55) + (goalScore * 0.3) + (feedbackScore * 0.15));
      const potentialScore = this.round((objectiveScore * 0.45) + (keyResultScore * 0.25) + (confidenceScore * 0.2) + (feedbackScore * 0.1));
      acc[worker.id] = {
        employeeName: worker.employeeName,
        ratingScore: this.round(ratingScore),
        goalScore: this.round(goalScore),
        feedbackScore: this.round(feedbackScore),
        objectiveScore: this.round(objectiveScore),
        keyResultScore: this.round(keyResultScore),
        confidenceScore: this.round(confidenceScore),
        performanceScore,
        potentialScore,
        performanceWeights: { rating: 0.55, goals: 0.3, feedback: 0.15 },
        potentialWeights: { objectives: 0.45, keyResults: 0.25, confidence: 0.2, feedback: 0.1 },
        summary: `Performance uses rating ${this.round(ratingScore)}%, goals ${this.round(goalScore)}%, and peer feedback ${this.round(feedbackScore)}%.`,
      };
      return acc;
    }, {});
  }

  private biasChecks(
    workers: Array<PerformanceAnalyticsWorker & { id: string; employeeName: string }>,
    reviews: Array<PerformanceAnalyticsReview & { workerId: string; rating: number | undefined }>,
    suppressionThreshold: number,
  ) {
    const departmentGroups = new Map<string, number[]>();
    for (const worker of workers) {
      const group = worker.departmentName ?? 'Unassigned';
      const rating = this.workerRating(worker.id, reviews);
      const current = departmentGroups.get(group) ?? [];
      if (typeof rating === 'number') current.push(rating);
      departmentGroups.set(group, current);
    }

    return {
      suppressionThreshold,
      departmentRatingDistribution: Array.from(departmentGroups.entries()).map(([group, ratings]) => {
        const suppressed = ratings.length > 0 && ratings.length < suppressionThreshold;
        return {
          group,
          count: ratings.length,
          averageRating: suppressed ? null : this.round(this.average(ratings)),
          suppressed,
        };
      }),
    };
  }

  private trendSignals(actionPlans: PerformanceActionPlan[]) {
    return actionPlans
      .filter((plan) => plan.riskLevel !== 'LOW' || plan.progressTrend !== 'STABLE')
      .map((plan) => ({
        workerId: plan.workerId,
        employeeName: plan.employeeName,
        signal: plan.progressTrend,
        riskLevel: plan.riskLevel,
        recommendedAction: plan.recommendedActions[0] ?? 'Keep monitoring performance signals with manager review.',
      }));
  }

  private ratingDistribution(reviews: Array<PerformanceAnalyticsReview & { rating: number | undefined }>) {
    return [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: reviews.filter((review) => Math.round(review.rating ?? 0) === rating).length,
    }));
  }

  private reviewCompletion(reviews: PerformanceAnalyticsReview[]) {
    return reviews.reduce<Record<string, number>>((acc, review) => {
      acc[review.status] = (acc[review.status] ?? 0) + 1;
      return acc;
    }, { total: reviews.length });
  }

  private goalMetrics(goals: Array<PerformanceAnalyticsGoal & { progress: number }>) {
    return {
      total: goals.length,
      active: goals.filter((goal) => ['DRAFT', 'ACTIVE', 'IN_PROGRESS'].includes(goal.status)).length,
      achieved: goals.filter((goal) => goal.status === 'ACHIEVED').length,
      atRisk: goals.filter((goal) => goal.progress < 50 && !['ACHIEVED', 'CANCELLED'].includes(goal.status)).length,
      averageProgress: this.round(this.average(goals.map((goal) => goal.progress))),
    };
  }

  private peerFeedbackMetrics(responses: Array<PerformanceAnalyticsFeedback & { revieweeId: string }>) {
    const ratings = responses.map((response) => response.overallRating).filter((rating): rating is number => typeof rating === 'number');
    return {
      submitted: responses.length,
      anonymousSubmitted: responses.filter((response) => response.isAnonymous).length,
      averageRating: ratings.length ? this.round(this.average(ratings)) : null,
      relationshipMix: responses.reduce<Record<string, number>>((acc, response) => {
        acc[response.relationshipType] = (acc[response.relationshipType] ?? 0) + 1;
        return acc;
      }, {}),
      dimensionAverages: this.dimensionAverages(responses.map((response) => response.dimensionScores)),
    };
  }

  private calibrationHeatmap(reviews: Array<PerformanceAnalyticsReview & { rating: number | undefined }>) {
    const cells = new Map<string, { calibratedRating: number; finalRating: number; count: number }>();
    for (const review of reviews) {
      const calibratedRating = Math.round(review.calibratedRating ?? review.rating ?? 0);
      const finalRating = Math.round(review.finalRating ?? review.rating ?? 0);
      if (!calibratedRating || !finalRating) continue;
      const key = `${calibratedRating}:${finalRating}`;
      const existing = cells.get(key) ?? { calibratedRating, finalRating, count: 0 };
      existing.count += 1;
      cells.set(key, existing);
    }
    return Array.from(cells.values());
  }

  private workerRating(workerId: string, reviews: Array<PerformanceAnalyticsReview & { workerId: string; rating: number | undefined }>): number | undefined {
    return reviews.find((review) => review.workerId === workerId)?.rating;
  }

  private rating(review: PerformanceAnalyticsReview): number | undefined {
    return typeof review.finalRating === 'number' ? review.finalRating : review.calibratedRating;
  }

  private progressFromValues(currentValue?: number, targetValue?: number): number {
    if (!targetValue || targetValue <= 0) return 0;
    return this.round(Math.min(Math.max(((currentValue ?? 0) / targetValue) * 100, 0), 100));
  }

  private takeThemes(values: Array<string | undefined>): string[] {
    return values
      .flatMap((value) => (value ?? '').split(/\r?\n|;/))
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  private dimensionAverages(values: Array<Record<string, number> | undefined>): Record<string, number> {
    const buckets = new Map<string, number[]>();
    for (const value of values) {
      for (const [dimension, score] of Object.entries(value ?? {})) {
        if (!Number.isFinite(score)) continue;
        const current = buckets.get(dimension) ?? [];
        current.push(score);
        buckets.set(dimension, current);
      }
    }
    return Array.from(buckets.entries()).reduce<Record<string, number>>((acc, [dimension, scores]) => {
      acc[dimension] = this.round(this.average(scores));
      return acc;
    }, {});
  }

  private areaThemes(values: Array<Record<string, string> | undefined>): Record<string, string[]> {
    const buckets = new Map<string, string[]>();
    for (const value of values) {
      for (const [area, comment] of Object.entries(value ?? {})) {
        const trimmed = comment.trim();
        if (!trimmed) continue;
        const current = buckets.get(area) ?? [];
        current.push(trimmed);
        buckets.set(area, current);
      }
    }
    return Array.from(buckets.entries()).reduce<Record<string, string[]>>((acc, [area, comments]) => {
      acc[area] = comments.slice(0, 3);
      return acc;
    }, {});
  }

  private actionPlanDuration(rating: number | undefined, goalProgress: number, peerRating?: number | null): number {
    if ((rating ?? 5) < 3 || (peerRating ?? 5) < 3) return 90;
    if (goalProgress < 60) return 60;
    return 30;
  }

  private progressTrend(rating: number | undefined, goalProgress: number, peerRating?: number | null): 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA' {
    const signals = [rating, goalProgress / 20, peerRating].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (signals.length < 2) return 'INSUFFICIENT_DATA';
    const average = this.average(signals);
    if (average >= 3.75) return 'IMPROVING';
    if (average < 2.75) return 'DECLINING';
    return 'STABLE';
  }

  private average(values: number[]): number {
    const numeric = values.filter((value) => Number.isFinite(value));
    if (!numeric.length) return 0;
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  }

  private band(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score >= 80) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  }

  private boxLabel(performance: 'LOW' | 'MEDIUM' | 'HIGH', potential: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    if (performance === 'HIGH' && potential === 'HIGH') return 'Star';
    if (performance === 'HIGH' && potential === 'MEDIUM') return 'High performer';
    if (performance === 'HIGH' && potential === 'LOW') return 'Expert';
    if (performance === 'MEDIUM' && potential === 'HIGH') return 'Emerging leader';
    if (performance === 'MEDIUM' && potential === 'MEDIUM') return 'Core contributor';
    if (performance === 'LOW' && potential === 'HIGH') return 'Potential risk';
    if (performance === 'LOW' && potential === 'LOW') return 'Performance risk';
    return 'Needs support';
  }

  private employeeName(worker: PerformanceAnalyticsWorker): string {
    const first = worker.firstName ?? '';
    const last = worker.lastName ?? '';
    const name = `${first} ${last}`.trim();
    return name || this.id(worker.id);
  }

  private id(value: IdLike): string {
    return typeof value === 'string' ? value : value.value;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
