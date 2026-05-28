/**
 * Normalize file paths from Sonar component keys and Sentry stack/culprit
 * into comparable workspace-relative suffixes for cross-source correlation.
 */

const PATH_PREFIX_RE =
  /^(?:webpack:\/\/\/\.?\/?|webpack-internal:\/\/\/|app:\/\/\/|file:\/\/\/|[a-z]:\\|\/)/i;

export function normalizePath(raw) {
  if (!raw) {
    return '';
  }

  let path = String(raw).trim().replace(/\\/g, '/');
  path = path.replace(PATH_PREFIX_RE, '');
  path = path.replace(/^\.+\//, '');
  path = path.split('?')[0].split('#')[0];
  path = path.replace(/\/+/g, '/').replace(/^\/+/, '');

  return path;
}

export function extractSonarPath(component = '') {
  const text = String(component);
  const colonIndex = text.indexOf(':');
  const path = colonIndex >= 0 ? text.slice(colonIndex + 1) : text;
  return normalizePath(path);
}

export function extractSentryPath(issue) {
  const metadata = issue?.metadata || {};
  if (metadata.filename) {
    return normalizePath(metadata.filename);
  }

  const culprit = issue?.culprit || '';
  const inMatch = culprit.match(/\s+in\s+(.+)$/i);
  if (inMatch) {
    return normalizePath(inMatch[1]);
  }

  return normalizePath(culprit);
}

export function extractSentryLine(issue) {
  const metadata = issue?.metadata || {};
  const line = metadata.lineno ?? metadata.line;
  return line === undefined || line === null ? null : Number(line);
}

export function pathsMatch(pathA, pathB, minSegments = 2) {
  const a = normalizePath(pathA);
  const b = normalizePath(pathB);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  if (a.endsWith(`/${b}`) || b.endsWith(`/${a}`)) {
    return true;
  }
  return sharedSuffixSegments(a, b) >= minSegments;
}

export function lineProximity(lineA, lineB, tolerance = 5) {
  const a = Number(lineA);
  const b = Number(lineB);
  if (!Number.isFinite(a) && !Number.isFinite(b)) {
    return true;
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }
  return Math.abs(a - b) <= tolerance;
}

function sharedSuffixSegments(pathA, pathB) {
  const segmentsA = pathA.split('/').filter(Boolean);
  const segmentsB = pathB.split('/').filter(Boolean);
  let matched = 0;
  let i = segmentsA.length - 1;
  let j = segmentsB.length - 1;

  while (i >= 0 && j >= 0 && segmentsA[i] === segmentsB[j]) {
    matched += 1;
    i -= 1;
    j -= 1;
  }

  return matched;
}
