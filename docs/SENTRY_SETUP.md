# Sentry 接入说明

配置环境变量后，MCP Server 会额外暴露 **4 个 Sentry 工具**，与 SonarQube 工具并存，供 Cursor AI 拉取线上告警并生成修复上下文。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SENTRY_AUTH_TOKEN` | 是 | Sentry User Auth Token（需 `event:read` 等读权限） |
| `SENTRY_ORG` | 是 | 组织 slug，如 `my-company` |
| `SENTRY_URL` | 否 | 默认 `https://sentry.io`；自建填实例根地址 |
| `SENTRY_PROJECT` | 否 | 默认项目 slug，自动加入搜索 `project:xxx` |
| `SENTRY_DEFAULT_QUERY` | 否 | 默认 `is:unresolved` |

未配置 `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` 时，**不会注册**任何 `sentry_*` 工具（SonarQube 仍可用）。

## MCP Tools

| Tool | 作用 |
| --- | --- |
| `sentry_search_issues` | 搜索 Issue 列表（CSV） |
| `sentry_get_issue` | 单条 Issue JSON |
| `sentry_get_issue_context` | Issue + 最新事件堆栈 + AI 修复 Markdown |
| `sentry_generate_report` | 告警汇总报告 + 建议修复顺序 |

## Cursor MCP 配置示例

```json
{
  "mcpServers": {
    "sonarqube-fixer": {
      "command": "node",
      "args": ["D:/学习/person/mcp-server/src/index.js"],
      "env": {
        "SONARQUBE_URL": "http://localhost:9000",
        "SONARQUBE_TOKEN": "your_sonar_token",
        "SENTRY_URL": "https://sentry.io",
        "SENTRY_AUTH_TOKEN": "your_sentry_token",
        "SENTRY_ORG": "my-org",
        "SENTRY_PROJECT": "my-frontend"
      }
    }
  }
}
```

## 典型流程（与 Sonar 并行）

```text
sentry_generate_report          # 看线上告警总览
        ↓
sentry_get_issue_context × N    # 每条运行时错误
        ↓
AI 改业务项目代码
        ↓
部署后观察 Sentry 是否停止新增事件
```

可与 Sonar 流程组合：

```text
sonar_generate_report + sentry_generate_report
        ↓
分别 sonar_get_issue_context / sentry_get_issue_context 修复
```

## 创建 Sentry Token

Sentry → Settings → Account → API → Auth Tokens → Create New Token  
建议 scope：`event:read`、`project:read`、`org:read`

## 自托管 Sentry

```env
SENTRY_URL=https://sentry.mycompany.com
```

其余与 SaaS 相同。
