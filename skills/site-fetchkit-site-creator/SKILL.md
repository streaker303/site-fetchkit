---
name: site-fetchkit-site-creator
description: 仅当用户明确要求为新网站/文档系统/后台页面创建、生成、适配或接入 site-fetchkit 站点 skill 时使用；不负责日常获取站点内容。
---

# Site FetchKit Site Creator

## 目标

创建或适配一个最小可运行的站点 skill，让后续读取该站点内容时可以交给对应站点 skill，并复用 `site-fetchkit` 的登录态、请求上下文和脚本运行方式。

## 触发条件

- 用户明确要求“创建/新增/生成/适配/接入一个站点 skill”。
- 用户明确提到 `site-fetchkit-site-creator`、`create-site`、`站点 skill`、`新站点 skill`。
- 其他 skill 的 `SKILL.md` 明确要求调用本 skill 来创建新站点能力。
- 用户只是给出一个普通 URL 并要求读取内容时，不触发本 skill，应使用已有站点 skill 或 `site-fetchkit`。
- 已存在明确站点 skill 时，不触发本 skill，直接使用对应站点 skill。

## 输入要求

- 必需输入：代表性 URL，最好是站点首页、登录页或目标文档 URL。
- 可选输入：站点标识 `site`、skill 名称、读取目标、是否需要章节或结构化输出。
- 缺省策略：从域名或用户描述推断 `site`，例如内部 wiki 可先用 `wiki`；skill 名默认 `<site>-operator`。

## 执行步骤

1. 确认 `site`、代表性 URL 和读取目标；信息不足时只追问缺失项。
2. 调用脚手架创建站点 skill：

```bash
site-fetchkit create-site <site> --url "<url>"
```

如需指定 skill 名：

```bash
site-fetchkit create-site <site> --url "<url>" --skill-name <site>-operator
```

3. 检查生成结构：

```text
~/.agents/skills/<site>-operator/
├── SKILL.md
└── scripts/
    ├── extract-content.mjs
    └── adapters/fetch-content.mjs
```

4. 验证脚本语法：

```bash
node --check ~/.agents/skills/<site>-operator/scripts/extract-content.mjs
node --check ~/.agents/skills/<site>-operator/scripts/adapters/fetch-content.mjs
```

5. 只为验证新 skill 是否可用，试运行代表性 URL：

```bash
site-fetchkit run ~/.agents/skills/<site>-operator/scripts/extract-content.mjs --url "<url>"
```

如果提示需要登录，执行：

```bash
site-fetchkit login <site> --url "<url>"
```

用户完成登录后，再执行：

```bash
site-fetchkit complete-login <site>
```

然后重试代表性 URL。

6. 根据试跑结果调整 adapter：

- 如果 HTTP 请求已经能拿到正文或结构化接口结果，保留 API-first / HTTP-first 实现。
- 如果只能拿到登录页、前端应用壳或空正文，把 `scripts/adapters/fetch-content.mjs` 调整为浏览器 DOM 模式。
- 如果浏览器 DOM 模式只读到弹窗、遮罩或授权提示，调整 selector，优先读取页面主体、列表、详情容器或 `document.body`。
- 如果页面内容来自稳定接口，把接口请求、字段映射和必要的参数解析集中放进 adapter。

## 输出要求

- 输出生成的 skill 路径。
- 输出主要入口命令。
- 说明是否已完成语法检查和代表性 URL 验证。
- 如果需要登录，说明已经打开登录页，并等待用户下次确认后再执行 `complete-login` 和重试。
- 不把验证结果当作最终内容获取任务；后续内容读取交给新生成的站点 skill。

## 边界与回退

- 不在站点 skill 中写业务仓库源码路径、软链路径或本机特定路径。
- 不读取项目内 `.env.local`。
- 不把具体站点逻辑加回 `site-fetchkit` 包源码。
- 不创建 `package.json`，脚本使用 `.mjs`。
- 不创建空目录、评分、基准测试或平台专用 metadata。
- 如果目标站点已有稳定 API，优先修改 `scripts/adapters/fetch-content.mjs` 为 API-first；如果是登录后的前端应用页面，改为浏览器 DOM 模式；否则保留通用 HTML 抓取。
- 登录窗口打开后，必须等待用户明确确认“已登录”再执行 `complete-login`；用户确认前不主动保存登录态，也不主动关闭登录窗口。

## 维护说明

- 保持 `scripts/extract-content.mjs` 作为入口层，只做参数解析、业务结构化和输出整理。
- 保持 `scripts/adapters/fetch-content.mjs` 作为抓取层，站点协议、接口和 DOM 适配集中放在这里。
- 新增 `references/` 或 `assets/` 前，需要确认它们会被实际复用。
