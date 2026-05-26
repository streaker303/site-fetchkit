---
name: site-fetchkit
description: Site FetchKit CLI/Runtime 编排规则。当用户明确要求使用 site-fetchkit，或其他站点 skill 需要通过 site-fetchkit 编排内容获取、登录态维护、脚本执行和运行时能力时使用；可直接调用 CLI 获取通用内容，但不是具体站点解析 skill。不要用于创建新站点 skill。
---

# Site FetchKit CLI / Runtime Guide

## 目标

定义 Agent 如何使用 `site-fetchkit` CLI/Runtime 编排内容获取流程。

本 skill 不是某个具体站点的解析能力，也不替用户决定普通 URL 的默认路由。它用于约束 Agent 在需要 `site-fetchkit` 时如何选择 `fetch`、`run`、`login`、Runtime API，如何复用登录态，以及通用抓取不足时如何转向站点 skill。

`site-fetchkit fetch` 可以直接获取通用页面标题、正文、HTML 或简单 DOM 内容；已有更具体站点 skill 时，站点 skill 应通过 `site-fetchkit run`、登录态和 Runtime API 编排底层获取能力，并把业务解析留在站点 skill 内。

## 触发条件

- 用户明确要求“用 site-fetchkit 获取/抓取/读取某个网页或站点内容”。
- 用户提供普通网页或文档 URL，并要求获取标题、正文、摘要、章节、HTML 或简单 DOM 内容，且全局/项目路由规则允许由 `site-fetchkit` 编排未命中专用 skill 的网页读取。
- 用户明确提到 `site-fetchkit`、`site-fetchkit CLI`、`site-fetchkit fetch`、`site-fetchkit run`、`site-fetchkit init`。
- 其他站点 skill 明确要求使用 `site-fetchkit` 编排内容获取、执行脚本或维护登录态。
- 用户明确要求检查、刷新或保存 `~/.agents/state/site-fetchkit/` 下的登录态。
- 用户要求创建、生成、适配或接入新站点 skill 时，不使用本 skill，改用 `site-fetchkit-site-creator`。
- 已命中更具体的站点 skill 时，优先使用对应站点 skill，本 skill 只作为底层 CLI/Runtime 能力被间接使用。

## 执行步骤

1. 首次使用或迁移后初始化：

```bash
site-fetchkit init
```

`init` 只安装基础 skill 并准备状态目录，不自动安装 Chromium。运行时报浏览器缺失时，再显式执行：

```bash
site-fetchkit install-browser
```

2. 用户明确要求直接用 `site-fetchkit` 获取通用页面内容，且没有更具体的站点 skill 需要优先处理时，执行：

```bash
site-fetchkit fetch "<url>"
```

如果要复用某个站点的登录态：

```bash
site-fetchkit fetch "<url>" --site <site>
```

3. 外部站点 skill 需要编排业务内容获取时，统一通过：

```bash
site-fetchkit run ~/.agents/skills/<site-skill>/scripts/<entry>.mjs --url "<url>"
```

4. 只有接口返回未授权、跳转到登录页、或站点 skill 判断登录态不可用时，才打开登录页面：

```bash
site-fetchkit login <site> --url "<target-or-login-url>"
```

`login` 会等待用户确认，保存登录态并关闭浏览器。完成后重试原请求。

5. 如果用户目标是创建新站点能力，停止本 skill 流程，切换到 `site-fetchkit-site-creator`。

## 输出要求

- 根据调用路径输出抓取正文、站点 skill 的结构化结果或原始 JSON。
- 如果触发登录，说明登录页已打开，并停止当前抓取，等待用户确认后保存状态和重试。
- 如果 `site-fetchkit fetch` 的通用抓取不足以满足业务解析，说明需要创建或定制站点 skill，而不是把业务解析堆进本 skill。

## 边界与回退

- 不创建、不改造新站点 skill；新站点创建和适配由 `site-fetchkit-site-creator` 负责。
- 不把具体站点逻辑加回 `site-fetchkit` 包源码。
- 不覆盖更具体的站点 skill；普通 URL 是否默认兜底到本 skill，由用户的全局或项目 `AGENTS.md` 决定。
- 不读取项目内 `.env.local`。
- 不依赖业务仓库源码路径、软链路径或本机特定路径。
- 常规内容抓取失败时，先报告失败原因；未经明确要求不切到可见浏览器交互。
- 登录窗口打开后，必须等待用户明确确认“已登录”再保存登录态；用户确认前不主动保存登录态，也不主动关闭登录窗口。

## 维护说明

- 外部站点脚本必须通过 `site-fetchkit run ...` 执行。
- 本 skill 只描述 CLI/Runtime 编排规则，不承载具体站点协议或业务解析。
- 站点 adapter 只负责“怎么拿原始内容”，业务解析应放在站点 skill 中。
- 登录态目录默认为 `~/.agents/state/site-fetchkit/`。
