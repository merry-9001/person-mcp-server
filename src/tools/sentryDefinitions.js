import { z } from 'zod';
import { buildSentryIssuePrompt } from '../context/buildSentryIssuePrompt.js';
import { buildSentryReport, sortIssuesByLevel } from '../context/buildSentryReport.js';
import { csvResult, jsonResult, markdownResult } from '../formatters.js';
import { SentryClient } from '../sentry/client.js';

export function createSentryTools(config) {
  const client = new SentryClient(config);
  if (!client.enabled) {
    return [];
  }

  const defaultProject = config.sentryProject || '';
  const defaultQuery = config.sentryDefaultQuery || 'is:unresolved';

  return [
    {
      name: 'sentry_search_issues',
      description:
        'Search Sentry issues for the configured organization. Returns compact CSV. Requires SENTRY_AUTH_TOKEN and SENTRY_ORG.',
      schema: {
        query: z.string().optional(),
        project: z.string().optional(),
        statsPeriod: z.string().optional(),
        limit: z.number().int().positive().max(100).optional()
      },
      handler: async ({ query, project, statsPeriod = '14d', limit = config.defaultPageSize }) => {
        const searchQuery = buildSearchQuery({
          query: query ?? defaultQuery,
          project: project ?? defaultProject
        });
        const issues = await client.get(`${client.orgPath('/issues/')}`, {
          query: searchQuery,
          statsPeriod,
          limit
        });
        const rows = (Array.isArray(issues) ? issues : []).map(issueSummary);
        return csvResult(rows, {
          total: rows.length,
          query: searchQuery,
          statsPeriod
        });
      }
    },
    {
      name: 'sentry_get_issue',
      description: 'Get a single Sentry issue by numeric issue ID.',
      schema: {
        issueId: z.string()
      },
      handler: async ({ issueId }) => {
        const issue = await client.get(`${client.orgPath(`/issues/${issueId}/`)}`);
        return jsonResult(issue);
      }
    },
    {
      name: 'sentry_get_issue_context',
      description:
        'Aggregate Sentry issue detail, latest event stacktrace, and a structured LLM repair prompt (Markdown).',
      schema: {
        issueId: z.string()
      },
      handler: async ({ issueId }) => {
        const issue = await client.get(`${client.orgPath(`/issues/${issueId}/`)}`);
        const event = await fetchLatestEvent(client, issueId);
        return markdownResult(buildSentryIssuePrompt({ issue, event }));
      }
    },
    {
      name: 'sentry_generate_report',
      description:
        'Generate a Markdown Sentry alert report with level/project distribution and prioritized fix order for AI.',
      schema: {
        query: z.string().optional(),
        project: z.string().optional(),
        statsPeriod: z.string().optional(),
        maxIssues: z.number().int().positive().max(100).optional(),
        limit: z.number().int().positive().max(100).optional()
      },
      handler: async (input) => {
        const maxIssues = input.maxIssues ?? 30;
        const limit = input.limit ?? Math.min(config.defaultPageSize, 100);
        const searchQuery = buildSearchQuery({
          query: input.query ?? defaultQuery,
          project: input.project ?? defaultProject
        });
        const issues = await client.get(`${client.orgPath('/issues/')}`, {
          query: searchQuery,
          statsPeriod: input.statsPeriod ?? '14d',
          limit
        });
        const list = sortIssuesByLevel(Array.isArray(issues) ? issues : []);
        const markdown = buildSentryReport({
          issues: list,
          totalIssues: list.length,
          query: searchQuery,
          organization: config.sentryOrg,
          project: input.project ?? defaultProject,
          options: {
            maxIssues,
            sentryUrl: config.sentryUrl
          }
        });
        return markdownResult(markdown);
      }
    }
  ];
}

async function fetchLatestEvent(client, issueId) {
  try {
    const latest = await client.get(`${client.orgPath(`/issues/${issueId}/events/latest/`)}`);
    if (latest && !Array.isArray(latest)) {
      return latest;
    }
  } catch {
    // fall through to events list
  }

  const events = await client.get(`${client.orgPath(`/issues/${issueId}/events/`)}`, {
    full: true,
    limit: 1
  });
  if (Array.isArray(events) && events.length) {
    return events[0];
  }
  return null;
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

function issueSummary(issue) {
  return {
    id: issue.id,
    shortId: issue.shortId,
    title: issue.title,
    level: issue.level,
    status: issue.status,
    project: issue.project?.slug,
    count: issue.count,
    userCount: issue.userCount,
    firstSeen: issue.firstSeen,
    lastSeen: issue.lastSeen,
    culprit: issue.culprit,
    permalink: issue.permalink
  };
}
