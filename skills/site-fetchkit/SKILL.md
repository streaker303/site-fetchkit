---
name: site-fetchkit
description: 当用户明确要求使用 site-fetchkit 获取站点内容，或其他站点 skill 明确要求使用 site-fetchkit CLI/运行时来抓取内容、维护登录态、执行脚本时使用；不要用于创建新站点 skill。
---

# Site FetchKit

## 目标

使用 `site-fetchkit` 获取站点内容，并统一处理登录态、无头浏览器、HTTP 请求上下文和外部站点 skill 脚本运行。

## 触发条件

- 用户明确要求“用 site-fetchkit 获取/抓取/读取某个站点内容”。
- 用户明确提到 `site-fetchkit`、`site-fetchkit CLI`、`site-fetchkit run`、`site-fetchkit init`。
- 其他站点 skill 明确要求使用 `site-fetchkit` 执行脚本、抓取内容或维护登录态。
- 用户明确要求检查、刷新或保存 `~/.agents/state/site-fetchkit/` 下的登录态。
- 不应仅因用户给出普通网页 URL 自动触发；普通 URL 应先由更具体的站点 skill、项目规则或通用网页读取规则决定。
- 用户要求创建、生成、适配或接入新站点 skill 时，不使用本 skill，改用 `site-fetchkit-site-creator`。

## 执行步骤

1. 首次使用或迁移后初始化：

```bash
site-fetchkit init
```

`init` 会安装基础 skill、准备状态目录，并自动安装 Playwright 管理的 Chromium。

2. 有现成站点 skill 时，按该 skill 的 `SKILL.md` 执行。脚本统一通过：

```bash
site-fetchkit run ~/.agents/skills/<site-skill>/scripts/<entry>.mjs --url "<url>"
```

3. 如果用户目标是创建新站点能力，停止本 skill 流程，切换到 `site-fetchkit-site-creator`。

4. 仅需通用页面正文时，可直接抓取：

```bash
site-fetchkit fetch "<url>" --site <site>
```

如果没有站点登录态，也可以先用公共模式尝试：

```bash
site-fetchkit fetch "<url>"
```

5. 只有缺少 `storageState`、接口返回未授权、或站点 skill 判断登录态不可用时，才打开登录页面：

```bash
site-fetchkit login <site> --url "<target-or-login-url>"
```

用户下一次确认已登录后执行：

```bash
site-fetchkit complete-login <site>
```

然后重试原请求。

## 输出要求

- 输出抓取到的正文、结构化结果或原始 JSON。
- 如果触发登录，说明登录页已打开，并停止当前抓取，等待用户下次确认后再保存状态和重试。
- 如果通用抓取不足以满足业务解析，说明需要创建或定制站点 skill。

## 边界与回退

- 不创建、不改造新站点 skill；新站点创建和适配由 `site-fetchkit-site-creator` 负责。
- 不把具体站点逻辑加回 `site-fetchkit` 包源码。
- 不读取项目内 `.env.local`。
- 不依赖业务仓库源码路径、软链路径或本机特定路径。
- 常规内容抓取失败时，先报告失败原因；未经明确要求不切到可见浏览器交互。
- 登录窗口打开后，必须等待用户明确确认“已登录”再执行 `complete-login`；用户确认前不主动保存登录态，也不主动关闭登录窗口。

## 维护说明

- 外部站点脚本必须通过 `site-fetchkit run ...` 执行。
- 站点 adapter 只负责“怎么拿原始内容”，业务解析应放在站点 skill 中。
- 登录态目录默认为 `~/.agents/state/site-fetchkit/`。
