const METRIC_LABELS = {
  ncloc: '代码行数',
  bugs: 'Bug',
  vulnerabilities: '漏洞',
  code_smells: '代码异味',
  security_hotspots: '安全热点',
  coverage: '覆盖率',
  duplicated_lines_density: '重复率',
  reliability_rating: '可靠性评级',
  security_rating: '安全评级',
  sqale_rating: '可维护性评级',
  alert_status: '质量门禁'
};

export function buildProjectReport({
  project,
  metrics = [],
  issues = [],
  facets = {},
  totalIssues = 0,
  generatedAt = new Date().toISOString(),
  options = {}
}) {
  const projectKey = project?.key || options.projectKey || 'unknown';
  const projectName = project?.name || projectKey;
  const maxIssues = options.maxIssues ?? 30;

  const metricLines = metrics
    .map((entry) => `- ${METRIC_LABELS[entry.metric] || entry.metric}: ${formatMetricValue(entry)}`)
    .join('\n');

  const facetLines = formatFacets(facets);
  const issueLines = issues.slice(0, maxIssues).map(formatIssueRow).join('\n');
  const truncated = issues.length > maxIssues;

  return [
    `# SonarQube 质量报告`,
    ``,
    `- 项目: **${projectName}** (\`${projectKey}\`)`,
    `- 生成时间: ${generatedAt}`,
    `- 未解决问题总数: ${totalIssues}`,
    options.sonarUrl ? `- SonarQube: ${options.sonarUrl}` : '',
    ``,
    `## 指标概览`,
    ``,
    metricLines || '- 暂无指标数据（请先完成 SonarScanner 扫描）',
    ``,
    facetLines ? `## 问题分布\n\n${facetLines}` : '',
    ``,
    `## 待修复问题（按严重程度排序，最多 ${maxIssues} 条）`,
    ``,
    `| 优先级 | Issue Key | 严重度 | 类型 | 文件 | 行 | 说明 |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
    issueLines || `| - | - | - | - | - | - | 无未解决问题 |`,
    truncated ? `\n> 另有 ${issues.length - maxIssues} 条未列出，可调用 \`sonar_search_issues\` 分页查询。` : '',
    ``,
    `## 一键修复指引（给 AI）`,
    ``,
    `1. 确认当前工作区是被审查业务项目，且 \`sonar.projectKey\` 为 \`${projectKey}\`。`,
    `2. 按上表从高优先级 Issue 开始，对每个 \`issueKey\` 调用 MCP 工具 \`sonar_get_issue_context\`。`,
    `3. 根据返回的 Markdown 修复上下文，在本地做**最小安全改动**，保持行为不变。`,
    `4. 每修完一批后运行项目测试；全部完成后重新执行 \`sonar-scanner\` 验证。`,
    `5. 误报用 \`sonar_transition_issue\` 标记；需指派时用 \`sonar_assign_issue\`。`,
    ``,
    `### 建议修复顺序`,
    ``,
    issues.slice(0, maxIssues).map((issue, index) => (
      `${index + 1}. \`${issue.key}\` — ${issue.severity} ${issue.type} @ ${shortComponent(issue.component)}:${issue.line || '?'}\n   → 先执行: sonar_get_issue_context({ "issueKey": "${issue.key}" })`
    )).join('\n') || '- 无待修复项'
  ].filter(Boolean).join('\n');
}

function formatMetricValue(entry) {
  if (entry.value === undefined || entry.value === null) {
    return '-';
  }

  if (entry.metric === 'coverage' || entry.metric === 'duplicated_lines_density') {
    return `${entry.value}%`;
  }

  return String(entry.value);
}

function formatFacets(facets) {
  const sections = [];

  for (const [name, values] of Object.entries(facets)) {
    if (!values?.length) {
      continue;
    }

    const lines = values.map((item) => `- ${item.val}: ${item.count}`).join('\n');
    sections.push(`### ${name}\n\n${lines}`);
  }

  return sections.join('\n\n');
}

function formatIssueRow(issue) {
  const priority = severityRank(issue.severity);
  return `| ${priority} | ${issue.key} | ${issue.severity} | ${issue.type} | ${shortComponent(issue.component)} | ${issue.line || ''} | ${escapeCell(issue.message)} |`;
}

function shortComponent(component = '') {
  const parts = String(component).split(':');
  return parts.length > 1 ? parts.slice(1).join(':') : component;
}

function escapeCell(text = '') {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

const SEVERITY_ORDER = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];

export function severityRank(severity) {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? 99 : index + 1;
}

export function sortIssuesBySeverity(issues) {
  return [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export function facetsToMap(facets = []) {
  return Object.fromEntries(
    facets.map((facet) => [facet.property, facet.values || []])
  );
}
