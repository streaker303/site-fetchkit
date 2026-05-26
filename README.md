# site-fetchkit

让 Agent 读取内部网站内容的运行时基座。

安装后会提供两个基础 skill：

- `site-fetchkit`：读取已有站点 skill 支持的页面内容。
- `site-fetchkit-site-creator`：为新网站创建或适配站点 skill。

用户日常只需要和 Agent 对话，不需要记底层命令。

## 安装

```bash
npm install -g site-fetchkit
site-fetchkit init
```

`init` 会安装基础 skill、创建状态目录，并安装 Playwright 使用的浏览器内核。

如果基础 skill 已存在，默认不会覆盖。需要重新安装基础 skill 时执行：

```bash
site-fetchkit init --force
```

## 读取已有站点内容

当站点已经有对应 skill，比如 `wiki-operator`、`docs-operator`、`ops-operator`，直接向 Agent 提需求。

示例：

> 获取这个 wiki 页面里的上行参数：`https://internal-wiki.example.com/pages/viewpage.action?pageId=123`

Agent 会调用对应站点 skill 读取内容，并在需要登录时引导你完成登录。你完成登录后回复“已登录”，Agent 会保存登录态并继续读取。

## 创建新站点 skill

当一个网站还没有对应 skill 时，让 Agent 使用 `site-fetchkit-site-creator` 创建。

示例：

> 使用 site-fetchkit-site-creator，帮我给内部 wiki 创建一个站点 skill。后续我给你 wiki 页面链接时，你能提取页面标题、正文、章节和接口参数。

Agent 会完成：

1. 判断站点标识和 skill 名称。
2. 创建站点 skill。
3. 验证新 skill 是否能读取代表性页面。
4. 在需要登录时引导你登录。
5. 根据页面结构调整读取方式。

创建完成后，日常读取内容就使用新生成的站点 skill，不再使用 `site-fetchkit-site-creator`。

## Wiki 示例

用户希望接入一个内部 Confluence wiki：

> 使用 site-fetchkit-site-creator，为内部 wiki 创建一个站点 skill。我要获取 wiki 页面里的标题、正文、章节和接口参数。

后续用户只需要给 wiki 链接：

> 获取这个 wiki 页面里的上行参数：`https://wiki.example.com/pages/viewpage.action?pageId=<page-id>`

Agent 会使用生成的 wiki skill 读取页面内容。登录态过期时，Agent 会打开登录窗口并等待你确认“已登录”，然后继续完成读取。

## 两个 skill 的边界

`site-fetchkit` 负责读取内容：

- 已有站点 skill 调用它读取页面、接口或 DOM。
- 它维护登录态、请求上下文和浏览器上下文。
- 它不创建、不改造站点 skill。

`site-fetchkit-site-creator` 负责创建能力：

- 新网站没有 skill 时才使用。
- 它生成 `SKILL.md`、入口脚本和 adapter。
- 创建完成后，内容读取交给新生成的站点 skill。

## 站点脚本可用能力

站点 skill 脚本可以从 `site-fetchkit` 导入：

```js
import {
  ensureAuthenticated,
  createRequestContext,
  createBrowserContext,
  createPublicBrowserContext,
  htmlToText,
} from "site-fetchkit";
```

- `ensureAuthenticated`：检查并维护站点登录态。
- `createRequestContext`：创建带登录态的 HTTP 请求上下文。
- `createBrowserContext`：创建带登录态的浏览器上下文。
- `createPublicBrowserContext`：创建不带登录态的浏览器上下文。
- `htmlToText`：把 HTML 转成纯文本。

## 底层命令

CLI 是 skill 的执行内核，不是主要用户入口。skill 底层会按需调用 `site-fetchkit create-site`、`site-fetchkit run`、`site-fetchkit login`、`site-fetchkit complete-login` 和 `site-fetchkit fetch`。
