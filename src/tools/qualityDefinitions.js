import { z } from 'zod';
import { buildUnifiedReport } from '../context/buildUnifiedReport.js';
import { sortIssuesBySeverity } from '../context/buildProjectReport.js';
import { sortIssuesByLevel } from '../context/buildSentryReport.js';
import { markdownResult } from '../formatters.js';
import { SentryClient } from '../sentry/client.js';

const optionalStringArray = z.union([z.string(), z.array(z.string())]).optional();

export function createQualityTools(sonarClient, config) {
  const sentryClient = new SentryClient(config);
  const defaultProject = config.sentryProject || '';
  const defaultQuery = config.sentryDefaultQuery || 'is:unresolved';

  return [
    {
      name: 'quality_generate_unified_report',
      description:
        'Correlate SonarQube static issues with Sentry runtime alerts by normalized file path and line proximity. Returns a unified Markdown report with cross-hit clusters (same location), Sentry-only, and Sonar-only buckets plus merged fix order.',
      schema: {
        projectKey: z.string(),
        query: z.string().optional(),
        project: z.string().optional(),
        types: optionalStringArray,
        severities: optionalStringArray,
        resolved: z.boolean().optional(),
        statsPeriod: z.string().optional(),
        maxIssues: z.number().int().positive().max(100).optional(),
        lineTolerance: z.number().int().min(0).max(50).optional(),
        minPathSegments: z.number().int().min(1).max(6).optional()
      },
      handler: async (input) => {
        const maxIssues = input.maxIssues ?? 30;
        const pageSize = Math.min(config.defaultPageSize, 100);
        const lineTolerance = input.lineTolerance ?? 5;
        const minPathSegments = input.minPathSegments ?? 2;

        const sonarPromise = sonarClient.get('/api/issues/search', {
          projects: input.projectKey,
          types: input.types,
          severities: input.severities,
          resolved: input.resolved ?? false,
          p: 1,
          ps: pageSize,
          additionalFields: '_all'
        });

        let sentryIssues = [];
        if (sentryClient.enabled) {
          const searchQuery = buildSearchQuery({
            query: input.query ?? defaultQuery,
            project: input.project ?? defaultProject
          });
          const sentryData = await sentryClient.get(`${sentryClient.orgPath('/issues/')}`, {
            query: searchQuery,
            statsPeriod: input.statsPeriod ?? '14d',
            limit: pageSize
          });
          sentryIssues = Array.isArray(sentryData) ? sentryData : [];
        }

        const sonarData = await sonarPromise;
        const sonarIssues = sortIssuesBySeverity((sonarData.issues || []).map(sonarSummary));
        const sortedSentry = sortIssuesByLevel(sentryIssues.map(sentrySummary));

        const markdown = buildUnifiedReport({
          sonarIssues,
          sentryIssues: sortedSentry,
          projectKey: input.projectKey,
          organization: config.sentryOrg,
          options: {
            lineTolerance,
            minPathSegments,
            maxActions: maxIssues,
            maxSonarOnly: maxIssues,
            maxSentryOnly: maxIssues
          }
        });

        return markdownResult(markdown);
      }
    }
  ];
}

function buildSearchQuery({ query, project }) {
  const parts = [];
  if (query) {
    parts.push(query);
  }
  if (project) {
    parts.push(`project:${project}`);
  }
  return parts.join(' ').trim() || 'is:unresolved';
}

function sonarSummary(issue) {
  return {
    key: issue.key,
    severity: issue.severity,
    type: issue.type,
    component: issue.component,
    line: issue.line || issue.textRange?.startLine,
    message: issue.message
  };
}

function sentrySummary(issue) {
  return {
    id: issue.id,
    title: issue.title,
    level: issue.level,
    status: issue.status,
    culprit: issue.culprit,
    metadata: issue.metadata,
    count: issue.count
  };
}
