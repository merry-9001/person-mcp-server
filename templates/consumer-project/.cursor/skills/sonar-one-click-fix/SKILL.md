---
name: sonar-one-click-fix
description: >-
  通过 sonarqube-fixer MCP 拉取 SonarQube 质量报告并逐条修复代码异味、Bug、漏洞。
  在用户说「一键修复 Sonar」「修复代码异味」「按 Sonar 报告修」或项目根目录存在
  sonar-project.properties 时使用。
---

# Sonar 一键修复（业务项目侧）

## 前置条件

1. 业务项目已配置 `sonar-project.properties` 且执行过 `sonar-scanner`（SonarQube 中已有扫描结果）。
2. Cursor MCP 已启用 `sonarqube-fixer`（见项目 `.cursor/mcp.json` 或用户全局 MCP 配置）。
3. 当前打开的工作区是**被审查的业务项目**，不是 mcp-server 仓库本身。

## 读取项目 Key

从 `sonar-project.properties` 解析 `sonar.projectKey`。若用户指定了项目名，以用户为准。

## 标准流程

### 1. 生成报告

调用 MCP 工具 `sonar_generate_report`：

```json
{
  "projectKey": "<从 sonar-project.properties 读取>",
  "maxIssues": 30,
  "resolved": false
}
```

将返回的 Markdown 保存到 `.sonar/report.md`（若目录不存在则创建），并向用户简要汇报：问题总数、Blocker/Critical 数量、前 5 条高优先级问题。

### 2. 逐条修复

按报告「建议修复顺序」从高优先级开始：

1. 调用 `sonar_get_issue_context`，参数 `{ "issueKey": "<key>" }`。
2. 根据返回的 Issue、规则说明、源码上下文，在**当前工作区**修改对应文件。
3. 遵循最小改动原则；若判定为误报，说明理由并建议 `sonar_transition_issue`（如 `falsepositive`），不要强行改代码。
4. 每修复 3～5 条或一批同文件问题后，运行项目已有测试命令（如 `npm test`、`mvn test`）；无测试则做语法/类型检查。

### 3. 收尾

1. 提醒用户重新执行 `sonar-scanner` 刷新 SonarQube 结果。
2. 可选：对已确认修复的 Issue 调用 `sonar_transition_issue`（如 `confirm` / `resolve`）。
3. 更新 `.sonar/report.md` 备注本次已处理的 issue key 列表。

## 约束

- 不要修改与 Issue 无关的文件。
- 不要跳过 `sonar_get_issue_context` 直接猜测规则含义。
- 一次对话默认最多处理报告中的 `maxIssues` 条；用户要求「全部修复」时分批继续。

## 触发示例

- 「一键修复 Sonar 问题」
- 「根据 Sonar 报告修代码异味」
- 「生成 Sonar 报告并开始修复 Critical」
