import { describe, expect, it } from 'vitest';
import type { OrgUnitNode } from './org-unit.repository.js';
import { OrgUnitRepository } from './org-unit.repository.js';

function node(id: string, parentId: string | null): OrgUnitNode {
  return { id, name: id, code: null, parentId, legalEntityId: null, level: 0, path: null, status: 'ACTIVE', children: [] };
}

/**
 * HCM-P0-6: findTree() links nodes into real JS object-reference `children`
 * arrays. If write-time validation (RestructureOrgUnitHandler) is ever
 * bypassed -- a direct DB edit, a bug elsewhere, data restored from a
 * pre-fix backup -- a parentId cycle in the rows would otherwise produce a
 * genuine circular reference, and res.json() throws "Converting circular
 * structure to JSON" for the whole tenant. wouldCreateCycle is the
 * defense-in-depth check that keeps that from ever reaching serialization.
 */
describe('OrgUnitRepository.wouldCreateCycle (defense in depth for findTree)', () => {
  const repo = Object.create(OrgUnitRepository.prototype) as {
    wouldCreateCycle(n: OrgUnitNode, map: Map<string, OrgUnitNode>): boolean;
  };

  it('detects a direct self-parent', () => {
    const a = node('a', 'a');
    const map = new Map([['a', a]]);

    expect(repo.wouldCreateCycle(a, map)).toBe(true);
  });

  it('detects a 2-node cycle', () => {
    const a = node('a', 'b');
    const b = node('b', 'a');
    const map = new Map([['a', a], ['b', b]]);

    expect(repo.wouldCreateCycle(a, map)).toBe(true);
    expect(repo.wouldCreateCycle(b, map)).toBe(true);
  });

  it('detects a deeper cycle (a -> b -> c -> a)', () => {
    const a = node('a', 'c');
    const b = node('b', 'a');
    const c = node('c', 'b');
    const map = new Map([['a', a], ['b', b], ['c', c]]);

    expect(repo.wouldCreateCycle(a, map)).toBe(true);
  });

  it('does not flag a legitimate tree', () => {
    const root = node('root', null);
    const child = node('child', 'root');
    const grandchild = node('grandchild', 'child');
    const map = new Map([['root', root], ['child', child], ['grandchild', grandchild]]);

    expect(repo.wouldCreateCycle(root, map)).toBe(false);
    expect(repo.wouldCreateCycle(child, map)).toBe(false);
    expect(repo.wouldCreateCycle(grandchild, map)).toBe(false);
  });

  it('does not flag a node whose parent is missing from the map (orphan)', () => {
    const orphan = node('orphan', 'missing-parent');
    const map = new Map([['orphan', orphan]]);

    expect(repo.wouldCreateCycle(orphan, map)).toBe(false);
  });
});
