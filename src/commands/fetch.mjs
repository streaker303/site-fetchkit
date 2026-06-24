import fs from "fs";
import path from "path";

import * as runtime from "../runtime/index.mjs";

// 挑战页判据：只匹配真实拦截页的标题/可见正文特征（高精度）。
// 不在原始 HTML 上匹配 cf-challenge / turnstile / captcha 等 widget token —— 这些在
// 内嵌验证组件的正常页面（登录框、评论框、极简页）里也存在，按 HTML 匹配会误报，
// 导致对本可正常获取的页面无谓地触发 CloakBrowser 兜底（白下载二进制 + 误导 warning）。
// 漏判由用户显式 --browser cloak 兜底，权衡上优先避免误触发。
const STRONG_CHALLENGE_PATTERNS = [
  /just a moment/i,
  /checking your browser/i,
  /checking if the site connection is secure/i,
  /attention required/i,
  /verifying you are human/i,
  /verify you are human/i,
  /needs to review the security of your connection/i,
  /enable javascript and cookies to continue/i,
];

function isStealthFallbackEnabled() {
  const value = String(process.env.SITE_FETCHKIT_STEALTH || "challenge")
    .trim()
    .toLowerCase();
  return !["0", "false", "off", "no", "disabled"].includes(value);
}

function hasExplicitBrowser(input) {
  return Boolean(String(input.browser || process.env.SITE_FETCHKIT_BROWSER || "").trim());
}

function isAuthOrPermissionStatus(status) {
  return status === 401 || status === 403;
}

function isChallengePage(result) {
  const title = result?.title || "";
  const text = result?.content?.text || "";
  // 只在标题与可见正文上匹配，避免命中 HTML 里内嵌的脚本/widget token
  const visible = [title, text.slice(0, 5000)].join("\n");
  return STRONG_CHALLENGE_PATTERNS.some((pattern) => pattern.test(visible));
}

function shouldTryStealthFallback(input, result, hasState) {
  if (!isStealthFallbackEnabled()) return false;
  if (hasExplicitBrowser(input)) return false;
  if (hasState && isAuthOrPermissionStatus(result?.meta?.httpStatus)) return false;
  return isChallengePage(result);
}

function buildStealthFallbackWarning(error) {
  return [
    "页面疑似命中反自动化挑战，已尝试使用 CloakBrowser 兜底但未成功。",
    "常见原因是未安装 cloakbrowser JS wrapper，或首次下载二进制时外网不可达。",
    "请在 site-fetchkit 所在的同一 Node 环境安装 wrapper；",
    "全局安装使用: npm install -g cloakbrowser；项目依赖使用: npm install cloakbrowser；",
    "内网环境可提前预下载或配置 CloakBrowser 的本地二进制/镜像源。",
    error?.message || String(error),
  ].join(" ");
}

async function createFetchBrowserContext(site, input, browserName) {
  try {
    return await runtime.createBrowserContext(site, { browser: browserName || input.browser });
  } catch (error) {
    const message = error.message || String(error);
    if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
      throw new Error(
        [
          "浏览器启动失败。site-fetchkit fetch 默认使用 Playwright Chromium。",
          "请先执行: site-fetchkit install-browser",
          "如果必须使用系统 Google Chrome，可重试: site-fetchkit fetch <url> --browser chrome",
          message,
        ].join("\n")
      );
    }
    throw error;
  }
}

async function fetchWithBrowser(input, browserName, hasState) {
  const site = input.site || "";
  const { browser, context } = await createFetchBrowserContext(
    hasState ? site : null,
    input,
    browserName
  );

  try {
    const page = await context.newPage();
    const response = await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: Number(input.timeout || 30000),
    });
    await page
      .waitForLoadState("networkidle", {
        timeout: Math.min(Number(input.timeout || 30000), 5000),
      })
      .catch(() => {});
    if (hasState) {
      await page.waitForTimeout(1500);
    }
    if (input.waitSelector) {
      await page.waitForSelector(input.waitSelector, {
        timeout: Number(input.timeout || 30000),
      });
    }

    const selector = input.extractSelector || "main, article, body";
    const content = await page.evaluate((sel) => {
      const el = document.querySelector(sel) || document.body;
      return {
        selector: sel,
        title: document.title,
        html: el?.innerHTML || "",
        text: el?.innerText || "",
      };
    }, selector);
    return {
      source: "generic",
      site: site || "public",
      transport: "browser",
      contentType: "html",
      finalUrl: page.url(),
      title: content.title,
      content,
      meta: {
        selector: content.selector,
        httpStatus: response?.status() ?? null,
        browser: browserName || input.browser || process.env.SITE_FETCHKIT_BROWSER || "chromium",
        stealthFallbackAttempted: false,
        stealthFallbackUsed: false,
      },
      warnings: [],
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function genericFetch(input) {
  const site = input.site || "";
  const hasState = site ? runtime.getSiteState(site).exists : false;
  if (site && !hasState) {
    throw new Error(
      `站点 ${site} 尚未登录，需要由 Agent 执行: site-fetchkit login ${site} --url <登录入口 URL>`
    );
  }

  const result = await fetchWithBrowser(input, input.browser, hasState);
  if (!shouldTryStealthFallback(input, result, hasState)) {
    return result;
  }

  result.meta.stealthFallbackAttempted = true;
  try {
    const retried = await fetchWithBrowser(input, "cloak", hasState);
    retried.meta.stealthFallbackAttempted = true;
    retried.meta.stealthFallbackUsed = !isChallengePage(retried);
    retried.meta.previousHttpStatus = result.meta.httpStatus;
    if (!isChallengePage(retried)) {
      return retried;
    }
    result.warnings.push(
      "页面疑似命中反自动化挑战，CloakBrowser 重试后仍疑似挑战页，已返回首次抓取结果。"
    );
  } catch (error) {
    result.warnings.push(buildStealthFallbackWarning(error));
  }
  return result;
}

function normalizeResult(result) {
  return {
    source: result?.source ?? null,
    site: result?.site ?? null,
    transport: result?.transport ?? null,
    contentType: result?.contentType ?? null,
    finalUrl: result?.finalUrl ?? null,
    title: result?.title ?? null,
    content: result?.content ?? null,
    meta: result?.meta ?? {},
    warnings: result?.warnings ?? [],
  };
}

function formatOutput(result, format) {
  const normalized = normalizeResult(result);
  if (format === "text") {
    if (typeof normalized.content === "string") return normalized.content;
    if (typeof normalized.content?.text === "string") return normalized.content.text;
    if (typeof normalized.content?.html === "string") return normalized.content.html;
    return "";
  }
  return JSON.stringify(normalized, null, 2);
}

export async function runFetch(flags, positional) {
  const url = String(positional[0] || flags.url || "").trim();
  if (!url) {
    throw new Error("缺少参数 <url>。用法: site-fetchkit fetch <url>");
  }

  const input = {
    url,
    site: String(flags.site || "").trim(),
    browser: String(flags.browser || flags["browser-channel"] || "").trim(),
    waitSelector: String(flags["wait-selector"] || "").trim(),
    extractSelector: String(flags["extract-selector"] || "").trim(),
    timeout: flags.timeout,
  };

  const result = await genericFetch(input);

  const output = formatOutput(result, String(flags.format || "json").toLowerCase());
  const outputFile = String(flags.output || "").trim();

  if (outputFile) {
    fs.writeFileSync(path.resolve(process.cwd(), outputFile), output, "utf8");
  } else {
    process.stdout.write(`${output}\n`);
  }
  return 0;
}
