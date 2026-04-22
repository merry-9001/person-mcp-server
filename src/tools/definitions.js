import { z } from 'zod';
import { buildIssuePrompt } from '../context/buildIssuePrompt.js';
import { decodeDuplications } from '../duplications/decode.js';
import { csvResult, jsonResult, markdownResult } from '../formatters.js';

const optionalStringArray = z.union([z.string(), z.array(z.string())]).optional();

export function createTools(client, config) {
  return [
    {
      name: 'sonar_search_projects',
      description: 'Search SonarQube projects and return compact CSV with metadata.',
      schema: {
        q: z.string().optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(500).optional()
      },
      handler: async ({ q, page = 1, pageSize = config.defaultPageSize }) => {
        const data = await client.get('/api/projects/search', { q, p: page, ps: pageSize });
        const rows = (data.components || []).map((project) => ({
          key: project.key,
          name: project.name,
          qualifier: project.qualifier,
          visibility: project.visibility,
          lastAnalysisDate: project.lastAnalysisDate
        }));
        return csvResult(rows, { page, pageSize, total: data.paging?.total ?? rows.length });
      }
    },
    {
      name: 'sonar_get_project',
      description: 'Get one SonarQube project by key.',
      schema: {
        projectKey: z.string()
      },
      handler: async ({ projectKey }) => {
        const data = await client.get('/api/components/show', { component: projectKey });
        return jsonResult(data.component);
      }
    },
    {
      name: 'sonar_search_issues',
      description: 'Search SonarQube issues such as code smells, bugs, vulnerabilities, and security hotspots.',
      schema: {
        projectKey: z.string().optional(),
        componentKeys: optionalStringArray,
        severities: optionalStringArray,
        types: optionalStringArray,
        statuses: optionalStringArray,
        resolved: z.boolean().optional(),
        rules: optionalStringArray,
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(500).optional()
      },
      handler: async (input) => {
        const page = input.page || 1;
        const pageSize = input.pageSize || config.defaultPageSize;
        const data = await client.get('/api/issues/search', {
          projects: input.projectKey,
          componentKeys: input.componentKeys,
          severities: input.severities,
          types: input.types,
          statuses: input.statuses,
          resolved: input.resolved,
          rules: input.rules,
          p: page,
          ps: pageSize,
          additionalFields: '_all'
        });
        const rows = (data.issues || []).map(issueSummary);
        return csvResult(rows, { page, pageSize, total: data.total ?? data.paging?.total ?? rows.length });
      }
    },
    {
      name: 'sonar_get_issue',
      description: 'Get a single SonarQube issue by issue key.',
      schema: {
        issueKey: z.string()
      },
      handler: async ({ issueKey }) => {
        const data = await client.get('/api/issues/search', { issues: issueKey, additionalFields: '_all' });
        return jsonResult(data.issues?.[0] || null);
      }
    },
    {
      name: 'sonar_get_issue_context',
      description: 'Aggregate issue detail, source snippet, rule explanation, and a structured LLM repair prompt.',
      schema: {
        issueKey: z.string(),
        contextLines: z.number().int().min(0).max(80).optional()
      },
      handler: async ({ issueKey, contextLines = config.sourceContextLines }) => {
        const issueData = await client.get('/api/issues/search', { issues: issueKey, additionalFields: '_all' });
        const issue = issueData.issues?.[0];
        if (!issue) {
          return jsonResult({ issueKey, found: false });
        }

        const line = issue.line || issue.textRange?.startLine || 1;
        const [ruleData, sourceData] = await Promise.all([
          client.get('/api/rules/show', { key: issue.rule }),
          client.get('/api/sources/lines', {
            key: issue.component,
            from: Math.max(1, line - contextLines),
            to: line + contextLines
          })
        ]);

        return markdownResult(buildIssuePrompt({
          issue,
          rule: ruleData.rule,
          source: sourceData
        }));
      }
    },
    {
      name: 'sonar_get_rule',
      description: 'Get SonarQube rule details by rule key.',
      schema: {
        ruleKey: z.string()
      },
      handler: async ({ ruleKey }) => {
        const data = await client.get('/api/rules/show', { key: ruleKey });
        return jsonResult(data.rule);
      }
    },
    {
      name: 'sonar_search_rules',
      description: 'Search SonarQube rules and return compact CSV with metadata.',
      schema: {
        q: z.string().optional(),
        languages: optionalStringArray,
        types: optionalStringArray,
        severities: optionalStringArray,
        tags: optionalStringArray,
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(500).optional()
      },
      handler: async (input) => {
        const page = input.page || 1;
        const pageSize = input.pageSize || config.defaultPageSize;
        const data = await client.get('/api/rules/search', {
          q: input.q,
          languages: input.languages,
          types: input.types,
          severities: input.severities,
          tags: input.tags,
          p: page,
          ps: pageSize
        });
        const rows = (data.rules || []).map((rule) => ({
          key: rule.key,
          name: rule.name,
          lang: rule.lang,
          langName: rule.langName,
          type: rule.type,
          severity: rule.severity,
          status: rule.status,
          tags: (rule.tags || []).join('|')
        }));
        return csvResult(rows, { page, pageSize, total: data.total ?? rows.length });
      }
    },
    {
      name: 'sonar_get_source',
      description: 'Get source lines for a SonarQube component.',
      schema: {
        componentKey: z.string(),
        from: z.number().int().positive().optional(),
        to: z.number().int().positive().optional()
      },
      handler: async ({ componentKey, from = 1, to }) => {
        const data = await client.get('/api/sources/lines', { key: componentKey, from, to });
        return jsonResult({ componentKey, from, to, sources: data.sources || [] });
      }
    },
    {
      name: 'sonar_assign_issue',
      description: 'Assign a SonarQube issue to a user login.',
      schema: {
        issueKey: z.string(),
        assignee: z.string()
      },
      handler: async ({ issueKey, assignee }) => {
        const data = await client.post('/api/issues/assign', { issue: issueKey, assignee });
        return jsonResult(data);
      }
    },
    {
      name: 'sonar_transition_issue',
      description: 'Apply a SonarQube issue workflow transition, such as confirm, falsepositive, or wontfix.',
      schema: {
        issueKey: z.string(),
        transition: z.string()
      },
      handler: async ({ issueKey, transition }) => {
        const data = await client.post('/api/issues/do_transition', { issue: issueKey, transition });
        return jsonResult(data);
      }
    },
    {
      name: 'sonar_search_security_hotspots',
      description: 'Search SonarQube security hotspots.',
      schema: {
        projectKey: z.string().optional(),
        status: z.string().optional(),
        onlyMine: z.boolean().optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(500).optional()
      },
      handler: async ({ projectKey, status, onlyMine, page = 1, pageSize = config.defaultPageSize }) => {
        const data = await client.get('/api/hotspots/search', {
          projectKey,
          status,
          onlyMine,
          p: page,
          ps: pageSize
        });
        const rows = (data.hotspots || []).map((hotspot) => ({
          key: hotspot.key,
          component: hotspot.component,
          project: hotspot.project,
          securityCategory: hotspot.securityCategory,
          vulnerabilityProbability: hotspot.vulnerabilityProbability,
          status: hotspot.status,
          line: hotspot.line,
          message: hotspot.message
        }));
        return csvResult(rows, { page, pageSize, total: data.paging?.total ?? rows.length });
      }
    },
    {
      name: 'sonar_get_security_hotspot',
      description: 'Get security hotspot details.',
      schema: {
        hotspotKey: z.string()
      },
      handler: async ({ hotspotKey }) => {
        const data = await client.get('/api/hotspots/show', { hotspot: hotspotKey });
        return jsonResult(data);
      }
    },
    {
      name: 'sonar_get_duplications',
      description: 'Get duplication blocks for a component and decode block references into concrete locations.',
      schema: {
        componentKey: z.string()
      },
      handler: async ({ componentKey }) => {
        const data = await client.get('/api/duplications/show', { key: componentKey });
        return jsonResult({
          componentKey,
          files: data.files || [],
          duplications: decodeDuplications(data)
        });
      }
    }
  ];
}

function issueSummary(issue) {
  return {
    key: issue.key,
    rule: issue.rule,
    severity: issue.severity,
    type: issue.type,
    status: issue.status,
    resolution: issue.resolution,
    component: issue.component,
    project: issue.project,
    line: issue.line || issue.textRange?.startLine,
    assignee: issue.assignee,
    message: issue.message,
    creationDate: issue.creationDate,
    updateDate: issue.updateDate
  };
}
