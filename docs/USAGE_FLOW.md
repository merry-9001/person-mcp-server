# SonarQube MCP Fixer 使用流程详解

这份文档解释三个问题：

1. 这个项目到底是做什么的。
2. 你是不是用它来审查别的项目。
3. SonarQube、Cursor、MCP Server、被审查项目之间怎么配合。

## 1. 先说结论

是的，这个项目通常是用来审查和修复“别的项目”的代码质量问题。

但是要注意分工：

| 角色 | 作用 |
| --- | --- |
| 被审查项目 | 你的业务项目，比如 Vue、React、Java、Node.js、Spring Boot 项目 |
| SonarQube | 扫描被审查项目，发现代码异味、Bug、安全漏洞、重复代码 |
| 本项目 | MCP Server，把 SonarQube 的 REST API 封装成 AI 能调用的工具 |
| Cursor / AI IDE | 连接 MCP Server，让 AI 查询 SonarQube 问题并辅助修改代码 |
| LLM 大模型 | 理解问题、规则和源码上下文，生成修复建议或直接修改代码 |

一句话：

```text
SonarQube 负责发现问题，本项目负责把问题交给 AI，Cursor 负责让 AI 在代码里修问题。
```

## 2. 整体架构

```text
┌────────────────────┐
│  被审查的业务项目   │
│  比如 app-web       │
└─────────┬──────────┘
          │
          │ 1. SonarScanner 扫描代码
          ▼
┌────────────────────┐
│     SonarQube       │
│  保存问题、规则、源码 │
└─────────┬──────────┘
          │
          │ 2. REST API
          ▼
┌────────────────────┐
│  本项目 MCP Server  │
│  sonarqube-mcp-fixer│
└─────────┬──────────┘
          │
          │ 3. MCP Tools
          ▼
┌────────────────────┐
│ Cursor / AI 助手    │
│ 查询问题并修复代码   │
└────────────────────┘
```

## 3. 这个项目是不是扫描器？

不是。

这个项目本身不扫描代码，也不自己判断代码有没有问题。

真正扫描代码的是 SonarQube。SonarQube 会通过 SonarScanner、CI/CD 插件或构建工具插件分析你的业务项目，然后把结果存到 SonarQube 服务里。

本项目做的是协议适配：

```text
SonarQube REST API
        ↓
13 个 MCP Tools
        ↓
Cursor / AI 助手可调用能力
```

例如 SonarQube 原始接口是：

```text
/api/issues/search
/api/rules/show
/api/sources/lines
/api/hotspots/search
/api/duplications/show
```

本项目封装成：

```text
sonar_search_issues
sonar_get_issue_context
sonar_get_rule
sonar_get_source
sonar_get_duplications
```

这样大模型不用理解一堆分散的 SonarQube API，只需要调用 MCP 工具。

## 4. 你在 Cursor 里写的是什么？

你现在这个项目是一个 MCP Server 项目。

也就是说，你是在 Cursor 里开发一个“AI 工具插件服务”。它不是被审查的业务系统，而是给 Cursor / AI 助手使用的工具层。

项目启动后，它会暴露两种使用方式：

### 方式一：MCP stdio 模式

这是给 Cursor、Claude Desktop、MCP Client 等 AI 工具使用的模式。

```text
Cursor
  ↓ stdio
本项目 MCP Server
  ↓ REST API
SonarQube
```

### 方式二：HTTP 模式

这是给你本地调试接口用的模式。

```text
浏览器 / Postman / curl
  ↓ HTTP
本项目 Express Server
  ↓ REST API
SonarQube
```

HTTP 模式不是标准 MCP 接入方式，主要方便你调试每个工具能不能正常访问 SonarQube。

## 5. SonarQube 应该怎么配置？

### 第一步：启动 SonarQube

如果你本地还没有 SonarQube，可以用 Docker 启动一个社区版：

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community
```

启动后访问：

```text
http://localhost:9000
```

默认账号密码通常是：

```text
admin / admin
```

第一次登录后，SonarQube 会要求你修改密码。

### 第二步：创建 SonarQube Token

登录 SonarQube 后：

```text
右上角头像
  → My Account
  → Security
  → Generate Tokens
```

生成一个 token，例如：

```text
squ_xxxxxxxxxxxxxxxxxxxxx
```

这个 token 配给本项目的 `SONARQUBE_TOKEN`。

### 第三步：配置本项目环境变量

本项目需要知道 SonarQube 在哪里，以及用什么 token 访问它。

PowerShell 示例：

```powershell
$env:SONARQUBE_URL="http://localhost:9000"
$env:SONARQUBE_TOKEN="你的_sonarqube_token"
npm start
```

这里的：

```text
SONARQUBE_URL=http://localhost:9000
```

就是 SonarQube Web 页面地址，不要加 `/api`。

错误写法：

```text
http://localhost:9000/api
```

正确写法：

```text
http://localhost:9000
```

## 6. 被审查项目怎么接入 SonarQube？

假设你有一个业务项目：

```text
D:/work/my-vue-app
```

你需要先让 SonarQube 扫描它。

### 方式一：使用 sonar-scanner

在业务项目根目录创建：

```text
sonar-project.properties
```

示例：

```properties
sonar.projectKey=my-vue-app
sonar.projectName=My Vue App
sonar.sources=src
sonar.host.url=http://localhost:9000
sonar.token=你的_sonarqube_token
```

然后在业务项目目录执行：

```bash
sonar-scanner
```

扫描完成后，SonarQube 页面里会出现 `my-vue-app` 项目。

### 方式二：CI/CD 扫描

如果是公司项目，通常会在 Jenkins、GitLab CI、GitHub Actions 里跑 SonarQube 扫描。

流程类似：

```text
提交代码
  ↓
CI 拉取代码
  ↓
执行测试和构建
  ↓
执行 SonarScanner
  ↓
结果上传 SonarQube
```

只要 SonarQube 里已经有项目和问题，本 MCP Server 就可以读取。

## 7. Cursor 里怎么配置这个 MCP Server？

在 Cursor 的 MCP 配置里加入类似内容：

```json
{
  "mcpServers": {
    "sonarqube-fixer": {
      "command": "node",
      "args": ["d:/学习/person/mcp-server/src/index.js"],
      "env": {
        "SONARQUBE_URL": "http://localhost:9000",
        "SONARQUBE_TOKEN": "你的_sonarqube_token"
      }
    }
  }
}
```

配置完成后，Cursor 的 AI 助手就能看到本项目提供的 13 个工具。

## 8. 一次完整的 AI 修复流程

下面是一条真实的使用链路。

### 第一步：扫描业务项目

先进入被审查项目：

```bash
cd D:/work/my-vue-app
sonar-scanner
```

扫描后，SonarQube 中出现项目：

```text
my-vue-app
```

### 第二步：启动 MCP Server

进入本项目：

```bash
cd D:/学习/person/mcp-server
```

PowerShell：

```powershell
$env:SONARQUBE_URL="http://localhost:9000"
$env:SONARQUBE_TOKEN="你的_sonarqube_token"
npm start
```

如果通过 Cursor MCP 配置启动，则不需要你手动执行 `npm start`，Cursor 会按配置自动启动。

### 第三步：AI 搜索 SonarQube 项目

AI 调用：

```text
sonar_search_projects
```

查询 SonarQube 里有哪些项目。

### 第四步：AI 查询问题列表

AI 调用：

```text
sonar_search_issues
```

例如查询：

```json
{
  "projectKey": "my-vue-app",
  "types": ["CODE_SMELL"],
  "pageSize": 20
}
```

返回的是紧凑 CSV，适合大模型低成本阅读：

```text
key,rule,severity,type,status,component,line,message
AXxxx,typescript:S3776,CRITICAL,CODE_SMELL,OPEN,my-vue-app:src/App.vue,42,Refactor this function...
```

### 第五步：AI 获取单个问题修复上下文

AI 拿到某个 issue key 后，调用：

```text
sonar_get_issue_context
```

例如：

```json
{
  "issueKey": "AXxxx",
  "contextLines": 8
}
```

本项目会自动向 SonarQube 查询：

```text
/api/issues/search
/api/rules/show
/api/sources/lines
```

然后聚合成 Markdown：

```text
Issue 详情
规则说明
源码片段
修复指令 Prompt
```

这一步是本项目最重要的能力，因为它把分散上下文合成了适合大模型理解的材料。

### 第六步：AI 修改业务项目代码

Cursor AI 根据上下文去修改被审查项目里的代码。

注意：本 MCP Server 只提供 SonarQube 数据，不直接代表它一定能改业务代码。真正修改代码的是 Cursor 里的 AI 编程能力，它需要打开或访问被审查项目的代码目录。

推荐方式：

```text
Cursor 打开业务项目 my-vue-app
同时 Cursor 配置了 sonarqube-fixer MCP Server
```

这样 AI 既能读写业务项目文件，又能调用 SonarQube MCP Tools。

### 第七步：重新扫描确认

AI 修完后，你重新跑：

```bash
sonar-scanner
```

然后 SonarQube 会更新问题状态。

### 第八步：推进问题状态

如果需要，还可以让 AI 调用：

```text
sonar_assign_issue
sonar_transition_issue
```

例如：

- 指派责任人
- 标记误报
- 标记不会修复
- 确认问题

## 9. HTTP 调试流程

如果你想先不用 Cursor，只验证本项目能不能访问 SonarQube，可以用 HTTP 模式。

PowerShell：

```powershell
$env:MCP_TRANSPORT="http"
$env:SONARQUBE_URL="http://localhost:9000"
$env:SONARQUBE_TOKEN="你的_sonarqube_token"
npm start
```

访问健康检查：

```text
http://localhost:3030/health
```

查看工具列表：

```text
http://localhost:3030/tools
```

查询问题：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3030/tools/sonar_search_issues" `
  -ContentType "application/json" `
  -Body '{"projectKey":"my-vue-app","types":["CODE_SMELL"],"pageSize":20}'
```

生成修复上下文：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3030/tools/sonar_get_issue_context" `
  -ContentType "application/json" `
  -Body '{"issueKey":"AXxxx","contextLines":8}'
```

## 10. 推荐的本地开发方式

推荐你准备两个目录：

```text
D:/学习/person/mcp-server     # 本项目，MCP Server
D:/work/my-vue-app           # 被审查的业务项目
```

开发和使用时：

1. SonarQube 跑在 `http://localhost:9000`。
2. `my-vue-app` 通过 `sonar-scanner` 上传分析结果。
3. Cursor 打开 `my-vue-app`。
4. Cursor MCP 配置指向 `D:/学习/person/mcp-server/src/index.js`。
5. AI 调用 MCP Tools 查询问题。
6. AI 在 `my-vue-app` 里修改代码。
7. 重新执行 `sonar-scanner` 验证问题是否消失。

## 11. 本项目 13 个工具在流程中的作用

| Tool | 用在什么时候 |
| --- | --- |
| `sonar_search_projects` | 找 SonarQube 里有哪些项目 |
| `sonar_get_project` | 查看某个项目详情 |
| `sonar_search_issues` | 批量查代码异味、Bug、漏洞 |
| `sonar_get_issue` | 查看单个 Issue 原始详情 |
| `sonar_get_issue_context` | 生成 AI 修复上下文 |
| `sonar_get_rule` | 单独查规则说明 |
| `sonar_search_rules` | 搜索 SonarQube 规则 |
| `sonar_get_source` | 获取某个文件的源码片段 |
| `sonar_assign_issue` | 给 Issue 指派责任人 |
| `sonar_transition_issue` | 流转 Issue 状态 |
| `sonar_search_security_hotspots` | 搜索安全热点 |
| `sonar_get_security_hotspot` | 查看安全热点详情 |
| `sonar_get_duplications` | 查询重复代码块并解码位置 |

## 12. 常见误区

### 误区一：这个项目会自动扫描代码

不会。

扫描代码的是 SonarQube / SonarScanner。

### 误区二：这个项目就是被审查项目

通常不是。

这个项目是 MCP 工具服务，被审查项目是另一个业务项目。

### 误区三：配置了 MCP 就不需要 SonarQube

不对。

MCP Server 只是读取 SonarQube 的数据。如果 SonarQube 里没有项目、没有扫描结果，那么 MCP Tools 也查不到问题。

### 误区四：AI 能修复就不需要重新扫描

不对。

AI 修改代码后，仍然需要重新执行 SonarScanner，让 SonarQube 确认问题是否真的消失。

## 13. 最小可跑通流程

如果你只想先跑通最小链路，按下面做：

1. 启动 SonarQube。

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community
```

2. 登录 `http://localhost:9000`，创建 token。

3. 准备一个业务项目，添加 `sonar-project.properties`。

```properties
sonar.projectKey=my-demo
sonar.projectName=My Demo
sonar.sources=src
sonar.host.url=http://localhost:9000
sonar.token=你的_sonarqube_token
```

4. 在业务项目里执行：

```bash
sonar-scanner
```

5. 在 Cursor MCP 配置里加入本项目。

```json
{
  "mcpServers": {
    "sonarqube-fixer": {
      "command": "node",
      "args": ["d:/学习/person/mcp-server/src/index.js"],
      "env": {
        "SONARQUBE_URL": "http://localhost:9000",
        "SONARQUBE_TOKEN": "你的_sonarqube_token"
      }
    }
  }
}
```

6. 在 Cursor 里让 AI 执行：

```text
查询 SonarQube 项目 my-demo 的代码异味，并为严重问题生成修复上下文。
```

7. AI 调用 MCP Tools，定位问题并修复业务项目代码。

8. 重新执行：

```bash
sonar-scanner
```

确认问题是否修复。

