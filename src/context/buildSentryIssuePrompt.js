import { formatEventStacktrace, formatEventTags } from '../sentry/stacktrace.js';

export function buildSentryIssuePrompt({ issue, event }) {
  const project = issue.project?.slug || issue.project?.name || '';
  const metadata = issue.metadata || {};
  const title = issue.title || metadata.title || metadata.value || 'Unknown issue';
  const culprit = issue.culprit || event?.culprit || '';
  const location = event?.location || metadata.filename || '';
  const line = metadata.lineno || metadata.line || event?.context?.line || '';

  return [
    `# Sentry Issue Fix Context`,
    ``,
    `## Issue`,
    ``,
    `- ID: ${issue.id}`,
    `- Short ID: ${issue.shortId || ''}`,
    `- Title: ${title}`,
    `- Level: ${issue.level || ''}`,
    `- Status: ${issue.status || ''}`,
    `- Project: ${project}`,
    `- Culprit: ${culprit}`,
    `- Location: ${location}${line ? `:${line}` : ''}`,
    `- First Seen: ${issue.firstSeen || ''}`,
    `- Last Seen: ${issue.lastSeen || ''}`,
    `- Count: ${issue.count ?? ''}`,
    `- User Count: ${issue.userCount ?? ''}`,
    `- Permalink: ${issue.permalink || ''}`,
    ``,
    `## Latest Event`,
    ``,
    event
      ? [
          `- Event ID: ${event.id || event.eventID || ''}`,
          `- Platform: ${event.platform || issue.platform || ''}`,
          `- Release: ${findTag(event, 'release') || issue.lastRelease?.version || ''}`,
          `- Environment: ${findTag(event, 'environment') || ''}`,
          `- Tags: ${formatEventTags(event)}`,
          ``,
          `### Stacktrace`,
          ``,
          '```text',
          formatEventStacktrace(event),
          '```'
        ].join('\n')
      : '_No latest event with stacktrace was returned. Check Sentry UI or query events manually._',
    ``,
    `## Repair Instructions`,
    ``,
    `You are fixing a production/runtime error reported by Sentry. Focus on the root cause in **in-app** frames.`,
    `Produce the smallest safe code change; add tests or guards if the error is reproducible.`,
    `If this is noise or expected behavior, explain why and recommend resolving/ignoring in Sentry instead of changing code.`,
    `After fixing, deploy and verify the issue stops occurring; link the fix to release tags when possible.`
  ].join('\n');
}

function findTag(event, key) {
  return (event?.tags || []).find((tag) => tag.key === key)?.value || '';
}
