# 其他项目接入：报告 + 一键修复

本文说明如何让**任意业务项目**通过 Cursor（或其他 MCP 客户端）调用本 MCP Server，生成 SonarQube 报告，并用 Skill 驱动 AI 逐条修复。

## 架构

```text
业务项目 (my-app)          SonarQube              本项目 (mcp-server)
     │                        │                         │
     │ sonar-scanner          │                         │
     ├───────────────────────►│                         │
     │                        │◄──── REST API ──────────┤
     │                        │                         │
Cursor 打开 my-app ──MCP stdio──► sonar_generate_report   │
     │                        │     sonar_get_issue_context
     │◄── Skill 驱动 AI 改本地代码 ─────────────────────┘
```

要点：

- **扫描**在业务项目里做（`sonar-scanner`），不是 MCP Server。
- **读数据 / 出报告**走 MCP 工具（`sonar_generate_report` 等）。
- **改代码**在业务项目工作区里由 AI 完成，靠项目内 Skill 约束流程。

## 三步接入

### 1. 业务项目接入 SonarQube

复制模板并修改：

```text
templates/consumer-project/sonar-project.properties.example
  → 业务项目根目录/sonar-project.properties
```

在业务项目执行：

```bash
sonar-scanner
```

### 2. 配置 MCP（Cursor）

**方式 A：业务项目本地配置（推荐团队共享）**

复制：

```text
templates/consumer-project/.cursor/mcp.json.example
  → 业务项目/.cursor/mcp.json
```

把 `args` 里的路径改成你本机 `mcp-server` 的 `src/index.js` 绝对路径，并填写 `SONARQUBE_URL`、`SONARQUBE_TOKEN`。

**方式 B：用户全局 MCP 配置**

在 Cursor Settings → MCP 中同样添加上述 `sonarqube-fixer` 条目，所有项目可用。

### 3. 安装一键修复 Skill

复制：

```text
templates/consumer-project/.cursor/skills/sonar-one-click-fix/
  → 业务项目/.cursor/skills/sonar-one-click-fix/
```

在 Cursor 中打开**业务项目**，对 AI 说：

```text
一键修复 Sonar 问题
```

或：

```text
先生成 Sonar 报告，再按优先级修复 Critical
```

## 推荐工作流

| 步骤 | 操作 | MCP 工具 |
| --- | --- | --- |
| 1 | 扫描业务项目 | （终端）`sonar-scanner` |
| 2 | 生成质量报告 | `sonar_generate_report` |
| 3 | 保存报告（可选） | AI 写入 `.sonar/report.md` |
| 4 | 逐条修复 | `sonar_get_issue_context` + 改本地文件 |
| 5 | 验证 | （终端）`sonar-scanner` |
| 6 | 流转 Issue | `sonar_transition_issue` / `sonar_assign_issue` |

## 新增工具：sonar_generate_report

一次调用返回 Markdown，包含：

- 项目指标（Bug、漏洞、异味、覆盖率等）
- 问题分布（按严重度 / 类型 / 状态）
- 按优先级排序的待修复列表
- 给 AI 的「建议修复顺序」与 `sonar_get_issue_context` 调用提示

示例参数：

```json
{
  "projectKey": "my-app",
  "types": ["CODE_SMELL", "BUG"],
  "resolved": false,
  "maxIssues": 30
}
```

## 其他 AI 应用

任何支持 MCP stdio 的客户端（Claude Desktop、Continue 等）均可使用同一套配置：

- `command`: `node`
- `args`: `["/path/to/mcp-server/src/index.js"]`
- `env`: `SONARQUBE_URL`、`SONARQUBE_TOKEN`

HTTP 模式（`MCP_TRANSPORT=http`）适合脚本拉报告，但不替代标准 MCP 接入。

## Sentry 线上告警（可选）

在 MCP `env` 中增加 `SENTRY_AUTH_TOKEN`、`SENTRY_ORG` 后，AI 可调用 `sentry_generate_report` / `sentry_get_issue_context`。  
组合 Skill：`templates/consumer-project/.cursor/skills/quality-one-click-fix/`。  
详见 [SENTRY_SETUP.md](./SENTRY_SETUP.md)。

## 常见问题

**Q：MCP 配在 mcp-server 仓库里，能修业务项目吗？**  
A：Cursor 必须**打开业务项目**作为工作区，AI 才能改业务代码；MCP 可在全局或业务项目 `.cursor/mcp.json` 中配置。

**Q：没有 Skill 能修吗？**  
A：能。直接让 AI「调用 sonar_generate_report，再逐条 sonar_get_issue_context 修复」。Skill 只是把流程写死，减少漏步骤。

**Q：报告存在哪？**  
A：默认由 AI 写入业务项目的 `.sonar/report.md`（Skill 约定）；也可只在对话中展示不落盘。
