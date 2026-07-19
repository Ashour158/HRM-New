import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_MORE_LINKS,
  ADMIN_MORE_MODULE,
  ADMIN_NAV_COMPLETENESS_ALLOWLIST,
  ADMIN_PRIMARY_MODULES,
} from './admin-nav-modules';

const ADMIN_PAGES_DIR = resolve(process.cwd(), 'src/pages/admin');
const ROUTES_FILE = resolve(process.cwd(), 'src/routes/index.tsx');

/** All page basenames actually surfaced by the nav (primary bar + More). */
function allNavPageRefs(): string[] {
  const fromModules = ADMIN_PRIMARY_MODULES.flatMap((module) => module.links.map((link) => link.page));
  const fromMore = ADMIN_MORE_LINKS.map((link) => link.page);
  return [...fromModules, ...fromMore].filter((page): page is string => Boolean(page));
}

/** All top-level, non-test .tsx page files under src/pages/admin. */
function adminPageFiles(): string[] {
  return readdirSync(ADMIN_PAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.tsx'))
    .filter((name) => !name.endsWith('.test.tsx'))
    .map((name) => name.replace(/\.tsx$/, ''));
}

/**
 * Every full admin route path registered in routes/index.tsx's "HR Admin
 * Portal" route block, reconstructed from the file's own literal
 * `<Route path="...">` attributes (plus the `index` route mapping to
 * `/admin` itself). This is the same source of truth the router uses, so a
 * nav link that no longer matches a real route fails this test instead of
 * silently 404-ing/bouncing in the app.
 */
function registeredAdminRoutePaths(): Set<string> {
  const source = readFileSync(ROUTES_FILE, 'utf8');
  const start = source.indexOf('{/* HR Admin Portal */}');
  const end = source.indexOf('{/* Recruiter Portal */}');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const adminBlock = source.slice(start, end);

  const paths = new Set<string>();
  if (/<Route\s+index\s+element=/.test(adminBlock)) {
    paths.add('/admin');
  }
  const pathAttrPattern = /<Route\s+path="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pathAttrPattern.exec(adminBlock)) !== null) {
    paths.add(`/admin/${match[1]}`);
  }
  return paths;
}

describe('admin primary nav modules', () => {
  it('defines exactly the 11 always-visible primary modules, in order', () => {
    expect(ADMIN_PRIMARY_MODULES.map((module) => module.label)).toEqual([
      'Home',
      'People',
      'Organization',
      'Time & Attendance',
      'Talent',
      'Performance',
      'Learning',
      'Compensation',
      'Engagement',
      'Governance',
      'Reports',
    ]);
  });

  it('gives every module a unique id and at least one link', () => {
    const ids = ADMIN_PRIMARY_MODULES.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
    ADMIN_PRIMARY_MODULES.forEach((module) => {
      expect(module.links.length).toBeGreaterThan(0);
    });
  });

  it('elevates Governance as a primary module rather than tucking it into More', () => {
    const governance = ADMIN_PRIMARY_MODULES.find((module) => module.id === 'governance');
    expect(governance).toBeDefined();
    expect(governance?.links.map((link) => link.label)).toEqual(expect.arrayContaining([
      'Compliance',
      'Country Policy',
      'Policy Center',
      'SoD Rules',
      'Access Governance',
      'Approvals Config',
      'Audit Console',
      'Field Access',
      'AI Governance',
      'DEI Analytics',
      'Contingent Workforce',
      'Union & Labor',
    ]));
  });

  it('defines the More flyout as a distinct, non-primary group', () => {
    expect(ADMIN_MORE_MODULE.label).toBe('More');
    expect(ADMIN_MORE_MODULE.id).not.toBe('governance');
    expect(ADMIN_PRIMARY_MODULES.some((module) => module.id === ADMIN_MORE_MODULE.id)).toBe(false);
    expect(ADMIN_MORE_LINKS.length).toBeGreaterThan(0);
  });

  it('gates every system-console-backed link as systemOnly, and nothing else', () => {
    const allLinks = [...ADMIN_PRIMARY_MODULES.flatMap((module) => module.links), ...ADMIN_MORE_LINKS];
    allLinks.forEach((link) => {
      if (link.path.startsWith('/admin/system-console')) {
        expect(link.systemOnly).toBe(true);
      } else {
        expect(link.systemOnly).toBeFalsy();
      }
    });
  });

  it('does not duplicate a path within the same module dropdown', () => {
    ADMIN_PRIMARY_MODULES.forEach((module) => {
      const paths = module.links.map((link) => link.path);
      expect(new Set(paths).size).toBe(paths.length);
    });
    const morePaths = ADMIN_MORE_LINKS.map((link) => link.path);
    expect(new Set(morePaths).size).toBe(morePaths.length);
  });

  describe('reachability completeness', () => {
    it('gives every admin page file a nav entry, or an explicit, documented exemption', () => {
      const navPageRefs = new Set(allNavPageRefs());
      const missing = adminPageFiles().filter(
        (page) => !navPageRefs.has(page) && !(ADMIN_NAV_COMPLETENESS_ALLOWLIST as readonly string[]).includes(page),
      );
      expect(missing).toEqual([]);
    });

    it('does not carry stale allowlist or page entries that no longer exist on disk', () => {
      const pageFiles = new Set(adminPageFiles());
      ADMIN_NAV_COMPLETENESS_ALLOWLIST.forEach((page) => {
        expect(pageFiles.has(page)).toBe(true);
      });
      allNavPageRefs().forEach((page) => {
        expect(pageFiles.has(page)).toBe(true);
      });
    });

    it('only points nav links at routes actually registered in routes/index.tsx', () => {
      const registered = registeredAdminRoutePaths();
      const allLinkPaths = [
        ...ADMIN_PRIMARY_MODULES.flatMap((module) => [module.path, ...module.links.map((link) => link.path)]),
        ADMIN_MORE_MODULE.path,
        ...ADMIN_MORE_LINKS.map((link) => link.path),
      ];
      const unregistered = allLinkPaths.filter((path) => !registered.has(path));
      expect(unregistered).toEqual([]);
    });
  });
});
