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

- **登录态持久化**：基于 Playwright `launchPersistentContext`，cookies / localStorage 自动落盘并跨进程复用。
- **HTTP / 浏览器双通道**：按站点性质选择接口请求或页面渲染，避免无必要地启动浏览器。
- **站点 Skill 生成器**：一句话生成可读、可改的站点 skill 骨架，后续基于真实页面行为继续迭代。
- **Agent 原生集成**：内置 SKILL.md 可被 Claude Code / Copilot 等识别触发，无需手动构造 CLI 命令。
- **零样板 Runtime**：站点脚本只需 `import "site-fetchkit"` 即可拿到带登录态的请求和浏览器上下文。

## 安装

要求 Node.js ≥ 20。

```bash
npm install -g site-fetchkit
site-fetchkit init
```

`init` 会准备 runtime 目录、检查系统 Chrome 与 Playwright Chromium、安装内置 skill 到 `~/.agents/skills/`。如提示缺少 Playwright Chromium，运行 `site-fetchkit install-browser`。

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

首次访问、登录态过期或站点返回未授权时，Agent 会打开一个可见浏览器窗口让你登录。完成登录后告知 Agent，登录态即被保存到 `~/.agents/state/site-fetchkit/`，后续访问同站点自动复用。

`states/` 中包含 cookies 与 localStorage，请勿提交到仓库。

## Runtime API

站点脚本通过 `site-fetchkit run` 执行时可直接导入：

```js
import {
  createRequestContext,
  createBrowserContext,
  htmlToText,
} from "site-fetchkit";
```

| 导出 | 说明 |
| --- | --- |
| `createRequestContext(site, options?)` | 创建带登录态的 Playwright `APIRequestContext`，适合接口优先的 adapter |
| `createBrowserContext(site?, options?)` | 创建浏览器上下文；传 `site` 注入登录态，不传走公开上下文。需手动关闭 `context` 与 `browser` |
| `htmlToText(html, options?)` | 去除 `script` / `style` / `noscript`，保留块级换行，解码常见 entity |

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

## 内置 Skill

| Skill | 作用 |
| --- | --- |
| `site-fetchkit` | CLI / Runtime 编排规则，约束 Agent 如何读取通用页面、复用登录态、执行站点脚本 |
| `site-fetchkit-site-creator` | 站点 skill 生成器，用于把新网站接入成独立 skill |

## 不适合的场景

- 高并发、大规模爬取。
- 绕过验证码或访问控制。
- 把所有站点解析规则塞进一个通用工具。

## 开发

```bash
npm run check    # 语法检查
npm test         # node --test
```

## License

[MIT](./LICENSE)
