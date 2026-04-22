# SonarQube MCP Fixer

基于 MCP Server 协议的 SonarQube 代码异味智能修复工具。它把 SonarQube 分散的 REST API 抽象为标准 MCP Tools，让 AI 助手可以自主完成项目搜索、问题扫描、代码定位、规则理解、修复上下文生成、状态流转、责任人指派、安全热点分析与重复代码定位。

## 技术栈

- Node.js
- MCP Server
- Stdio transport
- Express HTTP gateway
- SonarQube REST API

## 快速开始

```bash
npm install
cp .env.example .env
npm start
```

HTTP 模式：

```bash
MCP_TRANSPORT=http npm start
```

Windows PowerShell：

```powershell
$env:MCP_TRANSPORT="http"; npm start
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `SONARQUBE_URL` | SonarQube 服务地址 | `http://localhost:9000` |
| `SONARQUBE_TOKEN` | SonarQube 用户令牌 | 必填 |
| `MCP_TRANSPORT` | `stdio` 或 `http` | `stdio` |
| `HTTP_PORT` | Express 服务端口 | `3030` |
| `DEFAULT_PAGE_SIZE` | 默认分页大小 | `50` |
| `SOURCE_CONTEXT_LINES` | 源码上下文行数 | `8` |

## 13 个 MCP Tools

| Tool | 能力 |
| --- | --- |
| `sonar_search_projects` | 搜索 SonarQube 项目 |
| `sonar_get_project` | 获取项目详情 |
| `sonar_search_issues` | 检索代码异味、漏洞、Bug 等问题 |
| `sonar_get_issue` | 获取单个 Issue 详情 |
| `sonar_get_issue_context` | 聚合 Issue、源码片段、规则说明与修复 Prompt |
| `sonar_get_rule` | 查询规则详情 |
| `sonar_search_rules` | 搜索规则 |
| `sonar_get_source` | 获取源码片段 |
| `sonar_assign_issue` | 指派 Issue 责任人 |
| `sonar_transition_issue` | 流转 Issue 状态 |
| `sonar_search_security_hotspots` | 检索安全热点 |
| `sonar_get_security_hotspot` | 获取安全热点详情 |
| `sonar_get_duplications` | 查询重复代码并进行 duplication block 二次解码 |

## 输出协议

工具返回会根据数据类型采用不同格式：

- CSV + metadata：适合大列表，例如项目、Issue、规则、安全热点。
- 紧凑 JSON：适合结构化详情，例如单个 Issue、规则、源码片段。
- Markdown：适合 LLM 修复上下文和可读报告。

## MCP 客户端配置示例

```json
{
  "mcpServers": {
    "sonarqube-fixer": {
      "command": "node",
      "args": ["d:/学习/person/mcp-server/src/index.js"],
      "env": {
        "SONARQUBE_URL": "http://localhost:9000",
        "SONARQUBE_TOKEN": "your_sonarqube_token"
      }
    }
  }
}
```

## Express API

HTTP 模式会启动 Express：

- `GET /health`
- `GET /tools`
- `POST /tools/:name`

示例：

```bash
curl -X POST http://localhost:3030/tools/sonar_search_issues \
  -H "Content-Type: application/json" \
  -d "{\"projectKey\":\"my-project\",\"types\":[\"CODE_SMELL\"],\"limit\":20}"
```

## 修复闭环

典型 AI 助手工作流：

1. `sonar_search_projects` 找到项目。
2. `sonar_search_issues` 批量扫描问题。
3. `sonar_get_issue_context` 聚合源码、规则和修复 Prompt。
4. AI 修改本地代码。
5. `sonar_assign_issue` 指派责任人。
6. `sonar_transition_issue` 标记确认、误报或已解决。
7. `sonar_get_duplications` 定位重复代码块，辅助批量重构。
