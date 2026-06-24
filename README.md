# site-fetchkit

> 为 AI Agent 提供统一的网页内容获取运行时：登录态一次保存长期复用，站点解析以独立 skill 形式沉淀。

[![npm version](https://img.shields.io/npm/v/site-fetchkit.svg)](https://www.npmjs.com/package/site-fetchkit)
[![node](https://img.shields.io/node/v/site-fetchkit.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/site-fetchkit.svg)](./LICENSE)

```bash
npm install -g site-fetchkit
site-fetchkit init
```

之后所有日常使用都通过对 Agent 说话触发，CLI 由 Agent 与 skill 在后台编排。

## 它解决什么问题

让 Agent 读取内网 wiki / 后台 / 文档系统时，每个站点都要重复同一组事情：登录态保存、cookies 复用、HTTP 请求上下文、浏览器上下文、HTML 文本化、脚本入口、目录结构。`site-fetchkit` 把这层抽成底座，站点专属规则（章节、目录、字段映射）留在独立 skill 中迭代。

## 特性

- **登录态持久化**：cookies / localStorage 登录一次，跨会话自动复用，无需重复登录。
- **HTTP / 浏览器双通道**：按站点性质选择接口请求或页面渲染，避免无必要地启动浏览器。
- **站点 Skill 生成器**：一句话生成可读、可改的站点 skill 骨架，后续基于真实页面行为继续迭代。
- **Agent 原生集成**：内置 SKILL.md 可被 Claude Code / Copilot 等识别触发，无需手动构造 CLI 命令。
- **零样板 Runtime**：站点脚本通过 `site-fetchkit run` 启动后，只需 `import "site-fetchkit"` 即可拿到带登录态的请求和浏览器上下文。

## 安装

要求 Node.js ≥ 20。

```bash
npm install -g site-fetchkit
site-fetchkit init
```

`init` 会准备 runtime 目录、安装内置 skill 到 `~/.agents/skills/`。如提示缺少浏览器，运行 `site-fetchkit install-browser`。

少数站点会用浏览器挑战页（Cloudflare 等）拦截普通抓取。这类情况可选启用 CloakBrowser 作为反检测兜底浏览器，详见下文 [反检测兜底（CloakBrowser）](#反检测兜底cloakbrowser)。`site-fetchkit` 不默认依赖、也不分发 CloakBrowser 二进制。

## 查看版本与更新

查看当前安装的 CLI 版本：

```bash
site-fetchkit -v
```

升级 CLI 包后，执行 `update` 刷新包内置 skills：

```bash
npm install -g site-fetchkit@latest
site-fetchkit update
site-fetchkit -v
```

`site-fetchkit update` 只会覆盖刷新本包内置的 `site-fetchkit`、`site-fetchkit-site-creator` 等 skills；不会更新 npm 包本身，不会修改登录态，也不会修改用户自己创建的站点 skill。自定义 skills 目录时可传 `--skills-root <path>`。

## 使用方式：对 Agent 说话

### 创建一个站点 skill

对 Agent 说：

```text
/site-fetchkit-site-creator 为我创建一个站点 skill，
用于稳定获取 https://juejin.cn/post/7631386012625485834 文章的内容目录
```

Agent 会自动调用 `site-fetchkit create-site` 生成骨架，然后试跑、检查 adapter、必要时基于真实页面行为调整：

```text
~/.agents/skills/juejin-operator/
├── SKILL.md
└── scripts/
    ├── extract-content.mjs      # 入口：参数解析、结构化、输出
    └── adapters/
        └── fetch-content.mjs    # 抓取层：HTTP / DOM 适配
```

之后这个站点就有了一个独立可维护的 skill。

### 读取需要登录的站点

对 Agent 说：

```text
读取这个 wiki 页面的标题和正文：
https://wiki.example.com/pages/viewpage.action?pageId=123
```

首次访问、登录态过期或站点返回未授权时，Agent 会打开一个可见浏览器窗口让你登录。在浏览器里完成登录后，告诉 Agent「已登录」，Agent 会保存登录态并自动重试原请求。

`states/` 中包含 cookies 与 localStorage，请勿提交到仓库。

## Runtime API

站点脚本通过 `site-fetchkit run` 执行：

```js
import {
  createRequestContext,
  createBrowserContext,
  htmlToText,
} from "site-fetchkit";
```

不要直接用 `node <script.mjs>` 运行站点脚本；`import "site-fetchkit"` 的解析依赖 `site-fetchkit run` 提供的环境。

| 导出 | 说明 |
| --- | --- |
| `createRequestContext(site, options?)` | 创建带登录态的 Playwright `APIRequestContext`，适合接口优先的 adapter |
| `createBrowserContext(site?, options?)` | 创建浏览器上下文；传 `site` 注入登录态，不传走公开上下文。需手动关闭 `context` 与 `browser` |
| `htmlToText(html, options?)` | 去除 `script` / `style` / `noscript`，保留块级换行，解码常见 entity |

`createBrowserContext(site?, options?)` 默认使用内置浏览器。需要系统 Chrome 时传 `{ browser: "chrome" }`；已安装 CloakBrowser 时可传 `{ browser: "cloak" }` 使用反检测浏览器（见 [反检测兜底（CloakBrowser）](#反检测兜底cloakbrowser)）。

```js
await createBrowserContext("wiki", { browser: "chrome" });
```

接口优先的最小示例：

```js
import { createRequestContext, htmlToText } from "site-fetchkit";

export async function fetchSiteContent({ url, site = "wiki" }) {
  const ctx = await createRequestContext(site);
  try {
    const res = await ctx.get(url);
    const html = await res.text();
    return { status: res.status(), text: htmlToText(html) };
  } finally {
    await ctx.dispose();
  }
}
```

## 反检测兜底（CloakBrowser）

少数站点会用浏览器挑战页（Cloudflare「Just a moment…」、人机校验等）拦截普通抓取。可选启用 [CloakBrowser](https://github.com/CloakHQ/CloakBrowser)——一个内核级反指纹的 Chromium——作为兜底浏览器。它与默认的 Playwright Chromium、系统 Chrome 并列，仅按需使用。

### 启用

`site-fetchkit` 不默认依赖、也不分发 CloakBrowser 二进制。需要时在与 `site-fetchkit` 相同的 Node 环境安装 wrapper（仅控制层，约几百 KB，不含浏览器二进制）：

```bash
npm install -g cloakbrowser
```

首次真正使用时会自动下载一次浏览器二进制（约两百 MB）到 `~/.cloakbrowser` 并缓存复用。可提前预下载，避免首次使用时等待：

```bash
site-fetchkit install-browser --provider cloak
```

### 使用

- 命令行显式指定：`site-fetchkit fetch "<url>" --browser cloak`
- Runtime API 显式指定：`createBrowserContext(site, { browser: "cloak" })`
- 自动兜底：`site-fetchkit fetch` 在页面**标题或正文命中明确挑战页特征**时，自动用 CloakBrowser 重试一次；裸 HTTP 状态码（401/403/429/503）不会单独触发，已登录站点的 401/403 视为权限问题也不触发；重试仍失败时返回首次结果并附带 warning，不中断。

> 自动兜底仅作用于 `site-fetchkit fetch` 通用抓取。站点 skill 自行调用 `createRequestContext` / `createBrowserContext` 时不会自动继承，需要时在脚本里显式传 `{ browser: "cloak" }`。

用 `SITE_FETCHKIT_STEALTH=off` 关闭自动兜底。CloakBrowser 模式不叠加本工具的 JS 指纹脚本，指纹完全由其二进制提供。

### 内网 / 离线预置

二进制默认从外网下载。内网或隔离环境可用 CloakBrowser 自身的环境变量预置：

| 变量 | 作用 |
| --- | --- |
| `CLOAKBROWSER_BINARY_PATH` | 指向已预置的 Chromium，跳过下载 |
| `CLOAKBROWSER_DOWNLOAD_URL` | 指向自建 / 内网镜像源 |
| `CLOAKBROWSER_AUTO_UPDATE=false` | 关闭后台更新检查（cloak 分支已默认设为此值） |

> CloakBrowser 用于对抗指纹检测，**不用于绕过验证码、账号权限或访问控制**；遇到登录 / 权限错误应处理登录态或页面权限，而非依赖它。

## 内置 Skill

| Skill | 作用 |
| --- | --- |
| `site-fetchkit` | CLI / Runtime 编排规则，约束 Agent 如何读取通用页面、复用登录态、执行站点脚本 |
| `site-fetchkit-site-creator` | 站点 skill 生成器，用于把新网站接入成独立 skill |

## 不适合的场景

- 高并发、大规模爬取。
- 绕过验证码或访问控制。
- 依赖 CloakBrowser 兜底来绕过验证码、账号权限或未授权页面——它只对抗指纹检测，不解决权限问题。
- 把所有站点解析规则塞进一个通用工具。

## 开发

```bash
npm run check    # 语法检查
```

## License

[MIT](./LICENSE)
