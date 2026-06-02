import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { InboxDeduplicator } from './inbox-deduplicator.js';

describe('InboxDeduplicator', () => {
  it('only treats terminally processed inbox rows as duplicates', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      selectFrom: vi.fn().mockReturnValue(chain),
    };
    const deduplicator = new InboxDeduplicator(db as never);

    await deduplicator.isProcessed(Uuid.generate(), 'platform-notifications', '1');

    expect(chain.where).toHaveBeenCalledWith('processing_status', 'in', ['SUCCESS', 'SKIPPED']);
  });
});
