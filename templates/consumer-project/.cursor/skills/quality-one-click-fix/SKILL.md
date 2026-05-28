---
name: quality-one-click-fix
description: >-
  通过 MCP 拉取 SonarQube 静态质量与 Sentry 线上告警报告，并逐条修复。
  在用户说「一键修复质量问题」「Sonar 和 Sentry 一起修」「线上报错+代码异味」时使用。
---

# 质量一键修复（Sonar + Sentry）

## 前置条件

1. Cursor MCP 已配置本仓库 Server，且业务项目为当前工作区。
2. Sonar：`sonar-project.properties` 存在且已 `sonar-scanner`。
3. Sentry（可选）：MCP env 中已配置 `SENTRY_AUTH_TOKEN`、`SENTRY_ORG`（及可选 `SENTRY_PROJECT`）。

## 流程

### 1. 生成报告（按需）

**Sonar**（有静态扫描时）：

```json
{ "projectKey": "<sonar.projectKey>", "maxIssues": 30, "resolved": false }
```

工具：`sonar_generate_report` → 保存 `.sonar/report.md`

**Sentry**（MCP 已配置 Sentry 时）：

```json
{ "maxIssues": 20 }
```

工具：`sentry_generate_report` → 保存 `.sentry/report.md`

向用户汇总：Sonar Critical/Blocker 数量、Sentry fatal/error 数量、各前 3 条。

### 2. 逐条修复

| 来源 | 上下文工具 | 改码依据 |
| --- | --- | --- |
| Sonar | `sonar_get_issue_context` | 规则 + Sonar 源码片段 |
| Sentry | `sentry_get_issue_context` | 堆栈 + 运行时信息 |

优先顺序建议：**Sentry fatal/error（线上）** → **Sonar Blocker/Critical（静态）** → 其余。

每条：读上下文 → 最小改动修本地文件 → 批量后跑测试。

### 3. 收尾

- Sonar：提醒 `sonar-scanner` 复扫；可选 `sonar_transition_issue`。
- Sentry：部署后观察是否还有新事件；噪声问题在 Sentry UI 标记而非乱改代码。

## 约束

- 无 Sentry 配置时不要调用 `sentry_*` 工具。
- 不要跳过 `*_get_issue_context` 直接猜修复方案。

## 触发示例

- 「一键修复 Sonar 和 Sentry」
- 「先看 Sentry 告警再修 Sonar Critical」
