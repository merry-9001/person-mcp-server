import { correlateIssues } from './correlateIssues.js';

export function buildUnifiedReport({
  sonarIssues = [],
  sentryIssues = [],
  projectKey,
  organization,
  generatedAt = new Date().toISOString(),
  options = {}
}) {
  const { correlated, sonarOnly, sentryOnly } = correlateIssues(sonarIssues, sentryIssues, options);

  return [
    `# 统一质量报告（Sonar × Sentry 交叉关联）`,
    ``,
    `- 生成时间: ${generatedAt}`,
    projectKey ? `- Sonar 项目: \`${projectKey}\`` : '',
    organization ? `- Sentry 组织: **${organization}**` : '',
    `- Sonar 未解决（本页）: ${sonarIssues.length}`,
    `- Sentry 未解决（本页）: ${sentryIssues.length}`,
    `- **交叉命中（同文件 ±${options.lineTolerance ?? 5} 行）: ${correlated.length}**`,
    ``,
    `> 交叉命中表示静态扫描与线上告警指向同一位置，应合并修复而非分开处理。`,
    ``,
    `## 交叉命中（最高优先级）`,
    ``,
    formatCorrelatedTable(correlated),
    ``,
    `## Sentry 独有（线上告警）`,
    ``,
    formatSentryOnlyTable(sentryOnly.slice(0, options.maxSentryOnly ?? 15)),
    sentryOnly.length > (options.maxSentryOnly ?? 15)
      ? `\n> 另有 ${sentryOnly.length - (options.maxSentryOnly ?? 15)} 条 Sentry 独有 Issue。`
      : '',
    ``,
    `## Sonar 独有（静态质量）`,
    ``,
    formatSonarOnlyTable(sonarOnly.slice(0, options.maxSonarOnly ?? 15)),
    sonarOnly.length > (options.maxSonarOnly ?? 15)
      ? `\n> 另有 ${sonarOnly.length - (options.maxSonarOnly ?? 15)} 条 Sonar 独有 Issue。`
      : '',
    ``,
    `## 修复指引（给 AI）`,
    ``,
    `1. **先处理「交叉命中」**：对每条同时调用 \`sentry_get_issue_context\` 与 \`sonar_get_issue_context\`，在同一文件做合并修复。`,
    `2. 再处理 Sentry 独有 fatal/error，最后处理 Sonar 独有 Blocker/Critical。`,
    `3. 路径以本报告「本地路径」列为准；Sentry 堆栈中的绝对路径/webpack 前缀已归一化。`,
    ``,
    `### 建议处理顺序`,
    ``,
    formatActionList(correlated, sentryOnly, sonarOnly, options)
  ]
    .filter(Boolean)
    .join('\n');
}

function formatCorrelatedTable(clusters) {
  if (!clusters.length) {
    return `_无交叉命中。Sonar 与 Sentry 问题不在同一文件/行，或路径格式无法对齐。_';
  }

  const rows = clusters.map((cluster) => {
    const sonarKeys = cluster.sonar.map((issue) => issue.key).join(', ');
    const sentryId = cluster.sentry.id;
    const sonarSeverity = cluster.sonar.map((issue) => issue.severity).join('/');
    return `| ${cluster.score} | ${cluster.localPath || '-'} | ${cluster.line ?? ''} | ${sonarSeverity} | ${cluster.sentry.level} | ${sonarKeys} | ${sentryId} | ${escapeCell(cluster.sentry.title)} |`;
  });

  return [
    `| 分数 | 本地路径 | 行 | Sonar 严重度 | Sentry 级别 | Sonar Key | Sentry ID | 标题 |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |`,
    ...rows
  ].join('\n');
}

function formatSentryOnlyTable(items) {
  if (!items.length) {
    return `_无 Sentry 独有 Issue。_';
  }

  const rows = items.map(
    (item) =>
      `| ${item.score} | ${item.localPath || '-'} | ${item.line ?? ''} | ${item.sentry.level} | ${item.sentry.id} | ${escapeCell(item.sentry.title)} |`
  );

  return [
    `| 分数 | 本地路径 | 行 | 级别 | Sentry ID | 标题 |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...rows
  ].join('\n');
}

function formatSonarOnlyTable(items) {
  if (!items.length) {
    return `_无 Sonar 独有 Issue。_`;
  }

  const rows = items.map(
    (item) =>
      `| ${item.score} | ${item.localPath || '-'} | ${item.line ?? ''} | ${item.sonar.severity} | ${item.sonar.key} | ${escapeCell(item.sonar.message)} |`
  );

  return [
    `| 分数 | 本地路径 | 行 | 严重度 | Issue Key | 说明 |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...rows
  ].join('\n');
}

function formatActionList(correlated, sentryOnly, sonarOnly, options) {
  const maxActions = options.maxActions ?? 20;
  const actions = [];

  for (const cluster of correlated) {
    actions.push(
      `${actions.length + 1}. **[交叉]** \`${cluster.localPath}:${cluster.line ?? '?'}\`\n` +
        `   - sentry_get_issue_context({ "issueId": "${cluster.sentry.id}" })\n` +
        cluster.sonar
          .map((issue) => `   - sonar_get_issue_context({ "issueKey": "${issue.key}" })`)
          .join('\n')
    );
  }

  for (const item of sentryOnly) {
    if (actions.length >= maxActions) {
      break;
    }
    actions.push(
      `${actions.length + 1}. **[Sentry]** \`${item.sentry.id}\` — ${item.sentry.level}\n` +
        `   → sentry_get_issue_context({ "issueId": "${item.sentry.id}" })`
    );
  }

  for (const item of sonarOnly) {
    if (actions.length >= maxActions) {
      break;
    }
    actions.push(
      `${actions.length + 1}. **[Sonar]** \`${item.sonar.key}\` — ${item.sonar.severity}\n` +
        `   → sonar_get_issue_context({ "issueKey": "${item.sonar.key}" })`
    );
  }

  return actions.join('\n') || '- 无待处理项';
}

function escapeCell(text = '') {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
