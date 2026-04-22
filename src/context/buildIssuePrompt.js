export function buildIssuePrompt({ issue, rule, source }) {
  const component = issue.component || issue.project;
  const line = issue.line || issue.textRange?.startLine || 'unknown';
  const ruleName = rule?.name || issue.rule;

  return [
    `# SonarQube Issue Fix Context`,
    ``,
    `## Issue`,
    ``,
    `- Key: ${issue.key}`,
    `- Project: ${issue.project || ''}`,
    `- Component: ${component || ''}`,
    `- Line: ${line}`,
    `- Type: ${issue.type || ''}`,
    `- Severity: ${issue.severity || ''}`,
    `- Rule: ${issue.rule || ''}`,
    `- Rule Name: ${ruleName || ''}`,
    `- Message: ${issue.message || ''}`,
    ``,
    `## Rule`,
    ``,
    `- Key: ${rule?.key || issue.rule || ''}`,
    `- Language: ${rule?.langName || rule?.lang || ''}`,
    `- Type: ${rule?.type || ''}`,
    `- Severity: ${rule?.severity || ''}`,
    ``,
    rule?.htmlDesc ? stripHtml(rule.htmlDesc) : rule?.mdDesc || rule?.description || 'No rule description returned by SonarQube.',
    ``,
    `## Source Context`,
    ``,
    '```text',
    formatSource(source),
    '```',
    ``,
    `## Repair Instructions`,
    ``,
    `You are fixing a SonarQube issue in the file above. Produce the smallest safe code change that satisfies the rule while preserving behavior.`,
    `Explain the risk, the intended change, and any tests that should be run. If the issue is a false positive, explain why and recommend a SonarQube transition.`
  ].join('\n');
}

function formatSource(source) {
  if (!source?.sources?.length) {
    return 'Source code was not available.';
  }

  return source.sources
    .map((entry) => {
      const line = String(entry.line).padStart(5, ' ');
      return `${line}: ${entry.code ?? ''}`;
    })
    .join('\n');
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
