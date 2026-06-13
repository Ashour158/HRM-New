import { Inject, Injectable, Optional } from '@nestjs/common';
import { SCHEDULED_JOBS, type ScheduledJob } from './scheduled-job.js';

@Injectable()
export class ScheduledJobRegistry {
  private readonly jobsByName: Map<string, ScheduledJob>;

  constructor(
    @Optional()
    @Inject(SCHEDULED_JOBS)
    jobs: ScheduledJob[] | ScheduledJob[][] = [],
  ) {
    const jobsList = flattenJobs(jobs);
    this.jobsByName = new Map(jobsList.map((job) => [job.name, job]));
    if (this.jobsByName.size !== jobsList.length) {
      throw new Error('Scheduled job names must be unique');
    }
  }

  list(): ScheduledJob[] {
    return Array.from(this.jobsByName.values());
  }

  get(name: string): ScheduledJob | undefined {
    return this.jobsByName.get(name);
  }
}

function flattenJobs(jobs: ScheduledJob[] | ScheduledJob[][]): ScheduledJob[] {
  return jobs.flatMap((job) => Array.isArray(job) ? job : [job]);
}
