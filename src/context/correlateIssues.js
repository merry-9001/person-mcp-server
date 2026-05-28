import { levelRank } from './buildSentryReport.js';
import { severityRank } from './buildProjectReport.js';
import {
  extractSentryLine,
  extractSentryPath,
  extractSonarPath,
  lineProximity,
  pathsMatch
} from '../path/normalize.js';

export function correlateIssues(sonarIssues = [], sentryIssues = [], options = {}) {
  const lineTolerance = options.lineTolerance ?? 5;
  const minPathSegments = options.minPathSegments ?? 2;

  const correlated = [];
  const sonarOnly = [];
  const sentryOnly = [];
  const usedSonar = new Set();

  for (const sentryIssue of sentryIssues) {
    const sentryPath = extractSentryPath(sentryIssue);
    const sentryLine = extractSentryLine(sentryIssue);
    const matchedSonar = [];

    for (let index = 0; index < sonarIssues.length; index += 1) {
      if (usedSonar.has(index)) {
        continue;
      }

      const sonarIssue = sonarIssues[index];
      const sonarPath = extractSonarPath(sonarIssue.component);
      if (!pathsMatch(sentryPath, sonarPath, minPathSegments)) {
        continue;
      }
      if (!lineProximity(sentryLine, sonarIssue.line, lineTolerance)) {
        continue;
      }

      matchedSonar.push(sonarIssue);
      usedSonar.add(index);
    }

    if (matchedSonar.length) {
      correlated.push({
        localPath: pickLocalPath(sentryPath, matchedSonar),
        line: pickLine(sentryLine, matchedSonar),
        sentry: sentryIssue,
        sonar: matchedSonar,
        score: clusterScore(sentryIssue, matchedSonar)
      });
    } else {
      sentryOnly.push({
        localPath: sentryPath,
        line: sentryLine,
        sentry: sentryIssue,
        score: sentryScore(sentryIssue)
      });
    }
  }

  for (let index = 0; index < sonarIssues.length; index += 1) {
    if (usedSonar.has(index)) {
      continue;
    }
    const sonarIssue = sonarIssues[index];
    sonarOnly.push({
      localPath: extractSonarPath(sonarIssue.component),
      line: sonarIssue.line ?? null,
      sonar: sonarIssue,
      score: sonarScore(sonarIssue)
    });
  }

  correlated.sort((a, b) => a.score - b.score);
  sentryOnly.sort((a, b) => a.score - b.score);
  sonarOnly.sort((a, b) => a.score - b.score);

  return { correlated, sonarOnly, sentryOnly };
}

function pickLocalPath(sentryPath, sonarIssues) {
  const sonarPath = extractSonarPath(sonarIssues[0]?.component);
  if (!sentryPath) {
    return sonarPath;
  }
  if (!sonarPath) {
    return sentryPath;
  }
  return sentryPath.length <= sonarPath.length ? sentryPath : sonarPath;
}

function pickLine(sentryLine, sonarIssues) {
  if (Number.isFinite(sentryLine)) {
    return sentryLine;
  }
  return sonarIssues[0]?.line ?? null;
}

function clusterScore(sentryIssue, sonarIssues) {
  const sentryPart = levelRank(sentryIssue.level) * 10;
  const sonarPart = Math.min(...sonarIssues.map((issue) => severityRank(issue.severity)));
  return sentryPart + sonarPart;
}

function sentryScore(issue) {
  return 100 + levelRank(issue.level) * 10;
}

function sonarScore(issue) {
  return 200 + severityRank(issue.severity) * 10;
}
