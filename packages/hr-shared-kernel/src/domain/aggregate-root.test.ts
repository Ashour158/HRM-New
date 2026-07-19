import { describe, expect, it } from 'vitest';
import { AggregateRoot } from './aggregate-root.js';
import { Uuid } from '../value-objects/uuid.js';

class TestAggregate extends AggregateRoot {
  constructor(id: Uuid) {
    super(id);
  }
}

describe('AggregateRoot optimistic-concurrency version tracking', () => {
  it('starts version and loadedVersion at 0 for a newly created aggregate', () => {
    const aggregate = new TestAggregate(Uuid.generate());
    expect(aggregate.version).toBe(0);
    expect(aggregate.loadedVersion).toBe(0);
  });

  it('restoreVersion sets both version and loadedVersion when reconstructing from persistence', () => {
    const aggregate = new TestAggregate(Uuid.generate());
    aggregate.restoreVersion(5);
    expect(aggregate.version).toBe(5);
    expect(aggregate.loadedVersion).toBe(5);
  });

  it('incrementVersion only advances version, leaving loadedVersion at the persisted baseline', () => {
    const aggregate = new TestAggregate(Uuid.generate());
    aggregate.restoreVersion(5);

    aggregate.incrementVersion();

    expect(aggregate.version).toBe(6);
    expect(aggregate.loadedVersion).toBe(5);
  });

  it('markPersisted syncs loadedVersion to the current version after a successful save', () => {
    const aggregate = new TestAggregate(Uuid.generate());
    aggregate.restoreVersion(5);
    aggregate.incrementVersion();

    aggregate.markPersisted();

    expect(aggregate.loadedVersion).toBe(6);

    // A second transition + save on the same in-memory instance is now
    // guarded against the version it just wrote, not the stale original load.
    aggregate.incrementVersion();
    expect(aggregate.version).toBe(7);
    expect(aggregate.loadedVersion).toBe(6);
  });
});
