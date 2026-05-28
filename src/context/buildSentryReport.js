const LEVEL_ORDER = ['fatal', 'error', 'warning', 'info', 'debug'];

export function sortIssuesByLevel(issues) {
  return [...issues].sort((a, b) => levelRank(a.level) - levelRank(b.level));
}

export function levelRank(level) {
  const index = LEVEL_ORDER.indexOf(String(level || '').toLowerCase());
  return index === -1 ? 99 : index + 1;
}

export function buildSentryReport({
  issues = [],
  totalIssues = 0,
  query,
  organization,
  project,
  generatedAt = new Date().toISOString(),
  options = {}
}) {
  const maxIssues = options.maxIssues ?? 30;
  const levelCounts = countBy(issues, 'level');
  const projectCounts = countBy(issues, (issue) => issue.project?.slug || issue.project?.name || 'unknown');
  const rows = issues.slice(0, maxIssues).map(formatIssueRow).join('\n');
  const truncated = issues.length > maxIssues;

  return [
    `# Sentry 告警报告`,
    ``,
    `- 组织: **${organization}**`,
    project ? `- 项目过滤: \`${project}\`` : '',
    query ? `- 查询: \`${query}\`` : '',
    `- 生成时间: ${generatedAt}`,
    `- 未解决问题数: ${totalIssues}`,
    options.sentryUrl ? `- Sentry: ${options.sentryUrl}` : '',
    ``,
    `## 级别分布（当前页）`,
    ``,
    formatCountList(levelCounts) || '- 无数据',
    ``,
    `## 项目分布（当前页）`,
    ``,
    formatCountList(projectCounts) || '- 无数据',
    ``,
    `## 待处理 Issue（按级别排序，最多 ${maxIssues} 条）`,
    ``,
    `| 优先级 | Issue ID | 级别 | 状态 | 项目 | 次数 | 最后出现 | 标题 |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |`,
    rows || `| - | - | - | - | - | - | - | 无匹配 Issue |`,
    truncated ? `\n> 另有 ${issues.length - maxIssues} 条未列出。` : '',
    ``,
    `## 修复指引（给 AI）`,
    ``,
    `1. 在业务项目工作区定位 culprit / 堆栈中的 in-app 文件。`,
    `2. 对每个 Issue ID 调用 \`sentry_get_issue_context\` 获取完整堆栈与修复说明。`,
    `3. 最小改动修复；部署后观察 Sentry 是否停止新增事件。`,
    `4. 预期行为或第三方库问题：在 Sentry 标记 resolved/ignored，勿盲目改业务逻辑。`,
    ``,
    `### 建议处理顺序`,
    ``,
    issues
      .slice(0, maxIssues)
      .map(
        (issue, index) =>
          `${index + 1}. \`${issue.id}\` — ${issue.level} ×${issue.count ?? '?'} — ${escapeInline(issue.title)}\n   → sentry_get_issue_context({ "issueId": "${issue.id}" })`
      )
      .join('\n') || '- 无待处理项'
  ]
    .filter(Boolean)
    .join('\n');
}

function countBy(items, keyOrFn) {
  const counts = new Map();
  for (const item of items) {
    const key = typeof keyOrFn === 'function' ? keyOrFn(item) : item[keyOrFn];
    const normalized = String(key || 'unknown').toLowerCase();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return counts;
}

function formatCountList(counts) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `- ${key}: ${count}`)
    .join('\n');
}

function formatIssueRow(issue) {
  return `| ${levelRank(issue.level)} | ${issue.id} | ${issue.level || ''} | ${issue.status || ''} | ${issue.project?.slug || ''} | ${issue.count ?? ''} | ${issue.lastSeen || ''} | ${escapeCell(issue.title)} |`;
}

function escapeCell(text = '') {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function escapeInline(text = '') {
  return String(text).replace(/`/g, "'");
}
