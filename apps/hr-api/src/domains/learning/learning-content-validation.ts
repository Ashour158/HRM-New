/**
 * Deterministic parse + validation for SCORM / xAPI learning content packages.
 *
 * The aggregate carries the declared `manifest` (a structured Record) and `fileUrl`
 * rather than the raw package bytes, so this validates the declared metadata — it
 * does not fetch or unzip a file. Replaces the previous no-op `parse()`/`validate()`
 * that only flipped FSM state. Mirrors the country-policy validation engine shape.
 */

export type LearningPackageType = 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';

export interface LearningContentViolation {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export interface ParsedContentMetadata {
  readonly identifier?: string;
  readonly title?: string;
  readonly launchUrl?: string;
  readonly masteryScore?: number;
  readonly scoCount?: number;
  readonly activityId?: string;
  readonly endpoint?: string;
}

export interface LearningContentValidationResult {
  readonly valid: boolean;
  readonly decisionCode: 'VALID' | 'INVALID' | 'REQUIRES_REVIEW';
  readonly violations: LearningContentViolation[];
}

function firstString(manifest: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = manifest[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
}

function firstNumber(manifest: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = manifest[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/**
 * Extract structured metadata from a declared content-package manifest. Tolerant
 * of the common SCORM/xAPI key spellings.
 */
export function parseLearningContentManifest(
  _packageType: LearningPackageType,
  manifest: Record<string, unknown> | undefined,
): ParsedContentMetadata {
  const m = manifest ?? {};
  const scos = m.scos ?? m.organizations ?? m.items;
  return {
    identifier: firstString(m, ['identifier', 'id', 'courseId', 'manifestIdentifier']),
    title: firstString(m, ['title', 'name', 'courseTitle']),
    launchUrl: firstString(m, ['launchUrl', 'launch', 'href', 'resourceHref', 'entryPoint']),
    masteryScore: firstNumber(m, ['masteryScore', 'passingScore', 'scoreThreshold', 'minScore']),
    scoCount: Array.isArray(scos) ? scos.length : firstNumber(m, ['scoCount']),
    activityId: firstString(m, ['activityId', 'activity_id', 'iri']),
    endpoint: firstString(m, ['endpoint', 'lrsEndpoint', 'lrs']),
  };
}

const KNOWN_TYPES: ReadonlySet<string> = new Set(['SCORM_1_2', 'SCORM_2004', 'XAPI']);

/**
 * Validate a content package's declared metadata, fail-closed. SCORM requires an
 * identifier + launch URL; xAPI requires an activity id or LRS endpoint; a mastery
 * score, if present, must be within 0..100. The package must declare a file URL.
 */
export function validateLearningContentPackage(input: {
  packageType: string;
  fileUrl?: string;
  parsed: ParsedContentMetadata;
}): LearningContentValidationResult {
  const violations: LearningContentViolation[] = [];

  if (!KNOWN_TYPES.has(input.packageType)) {
    violations.push({ code: 'UNKNOWN_PACKAGE_TYPE', severity: 'ERROR', message: `Unknown package type "${input.packageType}".` });
  }

  if (!input.fileUrl || !input.fileUrl.trim()) {
    violations.push({ code: 'MISSING_FILE_URL', severity: 'ERROR', message: 'Content package has no file URL.' });
  }

  if (input.packageType === 'SCORM_1_2' || input.packageType === 'SCORM_2004') {
    if (!input.parsed.identifier) {
      violations.push({ code: 'SCORM_MISSING_IDENTIFIER', severity: 'ERROR', message: 'SCORM manifest has no identifier.' });
    }
    if (!input.parsed.launchUrl) {
      violations.push({ code: 'SCORM_MISSING_LAUNCH_URL', severity: 'ERROR', message: 'SCORM manifest has no launch URL.' });
    }
  } else if (input.packageType === 'XAPI') {
    if (!input.parsed.activityId && !input.parsed.endpoint) {
      violations.push({ code: 'XAPI_MISSING_ACTIVITY', severity: 'ERROR', message: 'xAPI package has no activity id or LRS endpoint.' });
    }
  }

  if (input.parsed.masteryScore !== undefined && (input.parsed.masteryScore < 0 || input.parsed.masteryScore > 100)) {
    violations.push({ code: 'INVALID_MASTERY_SCORE', severity: 'ERROR', message: 'Mastery score must be between 0 and 100.' });
  }

  if (!input.parsed.title) {
    violations.push({ code: 'NO_TITLE', severity: 'WARNING', message: 'Content package manifest has no title.' });
  }

  const hasError = violations.some((v) => v.severity === 'ERROR');
  const hasWarning = violations.some((v) => v.severity === 'WARNING');
  return {
    valid: !hasError,
    decisionCode: hasError ? 'INVALID' : hasWarning ? 'REQUIRES_REVIEW' : 'VALID',
    violations,
  };
}
