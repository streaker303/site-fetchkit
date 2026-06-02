import { chromium, request } from "playwright";

import { readStorageStateFile } from "./auth-state-manager.mjs";
import { ensureSiteLayout } from "./paths.mjs";

const BROWSER_ARGS = ["--disable-blink-features=AutomationControlled"];

const CONTEXT_DEFAULTS = {
  locale: "zh-CN",
  viewport: { width: 1440, height: 900 },
};

const EXTRA_HTTP_HEADERS = {
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7",
};

const NAVIGATOR_PROFILE = {
  languages: ["zh-CN", "en", "en-US"],
  platform: "MacIntel",
  vendor: "Google Inc.",
};

function normalizeBrowserName(input) {
  const value = String(input || process.env.SITE_FETCHKIT_BROWSER || "chromium")
    .trim()
    .toLowerCase();
  if (!value || value === "chromium" || value === "bundled" || value === "playwright") {
    return "chromium";
  }
  if (value === "system" || value === "google-chrome") {
    return "chrome";
  }
  return value;
}

function buildBrowserLaunchOptions(options = {}) {
  const browserName = normalizeBrowserName(
    options.browser || options.browserChannel || options.channel
  );
  const launchOptions = {
    headless: options.headless ?? true,
    args: [...BROWSER_ARGS, ...(options.args || [])],
  };
  if (browserName !== "chromium") {
    launchOptions.channel = browserName;
  }
  return { browserName, launchOptions };
}

function buildUserAgent(browser) {
  let version = "136.0.0.0";
  if (browser && typeof browser.version === "function") {
    version = browser.version() || version;
  }
  return [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "AppleWebKit/537.36 (KHTML, like Gecko)",
    `Chrome/${version}`,
    "Safari/537.36",
  ].join(" ");
}

function buildContextOptions(browser, extra = {}) {
  return {
    ...CONTEXT_DEFAULTS,
    userAgent: buildUserAgent(browser),
    extraHTTPHeaders: { ...EXTRA_HTTP_HEADERS, ...(extra.extraHTTPHeaders || {}) },
    ...(extra.contextOptions || {}),
  };
}

async function hardenFingerprint(context) {
  await context.addInitScript((profile) => {
    const def = (target, key, value) => {
      try {
        Object.defineProperty(target, key, { configurable: true, get: () => value });
      } catch {}
    };
    def(navigator, "webdriver", undefined);
    def(navigator, "languages", profile.languages);
    def(navigator, "platform", profile.platform);
    def(navigator, "vendor", profile.vendor);
    def(navigator, "plugins", [1, 2, 3, 4, 5]);
    if (!window.chrome) {
      Object.defineProperty(window, "chrome", { configurable: true, value: { runtime: {} } });
    }
  }, NAVIGATOR_PROFILE);
}

export async function openSetupContext(site, options = {}) {
  const paths = ensureSiteLayout(site);
  // 使用 launchPersistentContext：Chrome 会把 cookies 持续写入 profileDir 磁盘
  // 即使用户关闭浏览器窗口或 Cmd+Q，登录态数据已落盘，可通过 extractStateFromProfile 恢复
  // 登录流程默认使用 Playwright Chromium，需提前执行：site-fetchkit install-browser
  const context = await chromium.launchPersistentContext(paths.profileDir, {
    headless: false,
    args: [...BROWSER_ARGS, ...(options.args || [])],
    ...buildContextOptions(null, options),
  });
  await hardenFingerprint(context);
  return { paths, context };
}

export async function extractStateFromProfile(profileDir) {
  // 无头方式重新打开已落盘的 profile，读取 storageState 后关闭
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: [...BROWSER_ARGS],
  });
  try {
    return await context.storageState();
  } finally {
    await context.close().catch(() => {});
  }
}

export async function createRequestContext(site, options = {}) {
  return request.newContext({
    storageState: readStorageStateFile(site),
    ignoreHTTPSErrors: true,
    userAgent: buildUserAgent(null),
    extraHTTPHeaders: { ...EXTRA_HTTP_HEADERS, ...(options.extraHTTPHeaders || {}) },
    ...(options.requestOptions || {}),
  });
}

export async function createBrowserContext(site = null, options = {}) {
  const { launchOptions } = buildBrowserLaunchOptions(options);
  const browser = await chromium.launch(launchOptions);
  const contextOptions = {
    ignoreHTTPSErrors: true,
    ...buildContextOptions(browser, options),
  };
  if (site) {
    contextOptions.storageState = readStorageStateFile(site);
  }
  const context = await browser.newContext(contextOptions);
  await hardenFingerprint(context);
  return { browser, context };
}
