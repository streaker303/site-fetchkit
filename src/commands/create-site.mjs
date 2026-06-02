import fs from "fs";
import os from "os";
import path from "path";

function normalizeSite(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultSkillsRoot() {
  return (
    process.env.SITE_FETCHKIT_SKILLS_ROOT ||
    path.join(os.homedir(), ".agents", "skills")
  );
}

function writeFileSafe(file, content, force) {
  if (!force && fs.existsSync(file)) {
    throw new Error(`文件已存在：${file}。如需覆盖请加 --force。`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function buildSkillMarkdown({ site, skillName, setupUrl }) {
  const displayUrl = setupUrl || `<${site} 登录或入口 URL>`;
  return `---
name: ${skillName}
description: 当用户提供 ${site} 站点链接，并要求读取标题、正文、章节、摘要或结构化内容时触发。底层抓取统一走 site-fetchkit；默认复用已保存登录态，常规读取不打开可见浏览器。
---

# ${skillName}

## 目标

读取 ${site} 站点内容，并把登录态、HTTP 请求和脚本运行统一交给 \`site-fetchkit\`。

## 触发条件

- 用户提供 ${site} 站点链接，并要求读取标题、正文、章节、摘要或结构化内容。
- 用户要求基于 ${site} 页面提取信息或后续做业务解析。
- 相邻但不应触发的场景：创建新的站点 skill，应使用 \`site-fetchkit-site-creator\`。

## 输入要求

- 必需输入：目标 URL。
- 可选输入：输出格式、章节名称、业务字段或其他后续解析条件。
- 缺省策略：默认使用 \`${site}\` 作为站点标识，默认输出 JSON。

## 执行步骤

1. 默认假定现有 ${site} 登录态可用，先直接执行提取。入口脚本必须通过 \`site-fetchkit run\` 启动，不能直接 \`node scripts/extract-content.mjs\`：

\`\`\`bash
site-fetchkit run ~/.agents/skills/${skillName}/scripts/extract-content.mjs --url "${displayUrl}"
\`\`\`

2. 仅在实际抓取出现鉴权失败、登录过期或无权限时，由 Agent 打开登录页，不要求用户手动执行命令：

\`\`\`bash
site-fetchkit login ${site} --url "${displayUrl}"
\`\`\`

\`login\` 会打开可见浏览器并等待 Agent 的外部确认信号，不要求用户在终端按 Enter。登录窗口打开后，停止当前抓取并告诉用户：完成登录后回复“已登录”。

3. 用户回复“已登录”后，先执行确认命令保存登录态：

\`\`\`bash
site-fetchkit confirm-login ${site}
\`\`\`

看到“登录态已保存”后，再重试原提取命令。\`confirm-login\` 会让仍在运行的登录流程保存 state；业务层是否真正登录成功、是否有页面权限，由本 skill 判断。如果该站点无法通过 HTTP 请求校验，可在启动登录时使用 \`--no-validate\`，或通过 \`--validate-url <url>\` 指定校验入口。

## 输出要求

- 输出来源 URL、最终 URL、标题、正文文本和必要的原始 HTML。
- 如果需要登录，说明登录页已打开，并等待用户回复“已登录”；收到确认后执行 \`site-fetchkit confirm-login ${site}\` 保存登录态和重试。
- 如果通用 HTML 抓取不能满足业务解析，说明需要定制 \`scripts/adapters/fetch-content.mjs\`。

## 边界与回退

- 不读取项目内 \`.env.local\`。
- 不依赖业务仓库源码路径、软链路径或本机特定路径。
- 脚本必须通过 \`site-fetchkit run ...\` 执行；\`run\` 会预先挂载 Node ESM loader，让脚本内的 \`import "site-fetchkit"\` 能解析到当前 CLI 包。
- 常规读取不主动打开可见浏览器。
- 站点有稳定 API 时，优先把 \`scripts/adapters/fetch-content.mjs\` 改成 API-first；否则保留通用 HTML 抓取。

## 维护说明

- \`scripts/extract-content.mjs\` 是入口层，只做参数解析、业务结构化和输出整理。
- \`scripts/adapters/fetch-content.mjs\` 是抓取层，站点协议、接口和 DOM 适配集中放在这里。
- 新增 \`references/\` 或 \`assets/\` 前，需要确认它们会被实际复用。
`;
}

function buildFetchScript(site) {
  return `import {
  createRequestContext,
  htmlToText,
} from "site-fetchkit";

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);
  return htmlToText(match?.[1] || "");
}

export async function fetchSiteContent(input) {
  const site = input.site || "${site}";
  const context = await createRequestContext(site);
  try {
    const response = await context.get(input.url);
    const html = await response.text();
    if (!response.ok()) {
      throw new Error(\`${site} 内容请求失败：HTTP \${response.status()}\`);
    }

    return {
      site,
      finalUrl: response.url(),
      status: response.status(),
      title: extractTitle(html),
      html,
      text: htmlToText(html),
    };
  } finally {
    await context.dispose();
  }
}
`;
}

function buildExtractScript(site) {
  return `#!/usr/bin/env node

import fs from "fs";
import path from "path";

import { fetchSiteContent } from "./adapters/fetch-content.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function formatText(result) {
  return [
    \`# \${result.title || "${site} 内容"}\`,
    "",
    result.content.text,
  ].join("\\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const url = String(args.url || "").trim();
  if (!url) {
    throw new Error("缺少参数 --url <url>");
  }

  const fetched = await fetchSiteContent({
    url,
    site: String(args.site || "${site}").trim(),
  });

  const result = {
    source: {
      site: fetched.site,
      url,
      finalUrl: fetched.finalUrl,
      status: fetched.status,
      title: fetched.title,
    },
    content: {
      html: fetched.html,
      text: fetched.text,
      charCount: fetched.text.length,
    },
    warnings: [],
  };

  const output =
    String(args.format || "json").toLowerCase() === "text"
      ? formatText({ ...result.source, content: result.content })
      : JSON.stringify(result, null, 2);

  if (args.output) {
    fs.writeFileSync(path.resolve(process.cwd(), args.output), output, "utf8");
  } else {
    console.log(output);
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
`;
}

export async function runCreateSite(flags, positional) {
  const site = normalizeSite(positional[0] || flags.site);
  if (!site) {
    throw new Error("缺少参数 <site>。用法: site-fetchkit create-site <site> [--url <setupUrl>]");
  }

  const skillName = normalizeSite(flags["skill-name"]) || `${site}-operator`;
  const skillsRoot = path.resolve(
    String(flags["skills-root"] || "").trim() || defaultSkillsRoot()
  );
  const targetDir = path.join(skillsRoot, skillName);
  const force = Boolean(flags.force);
  const setupUrl = String(flags.url || "").trim();

  if (!force && fs.existsSync(targetDir)) {
    throw new Error(`skill 已存在：${targetDir}。如需覆盖请加 --force。`);
  }

  writeFileSafe(
    path.join(targetDir, "SKILL.md"),
    buildSkillMarkdown({ site, skillName, setupUrl }),
    force
  );
  writeFileSafe(
    path.join(targetDir, "scripts", "adapters", "fetch-content.mjs"),
    buildFetchScript(site),
    force
  );
  writeFileSafe(
    path.join(targetDir, "scripts", "extract-content.mjs"),
    buildExtractScript(site),
    force
  );

  process.stdout.write(`[site-fetchkit] Site skill created: ${targetDir}\n`);
  process.stdout.write(
    `[site-fetchkit] Try: site-fetchkit run ${path.join(
      targetDir,
      "scripts",
      "extract-content.mjs"
    )} --url "${setupUrl || "<url>"}"\n`
  );
  return 0;
}
