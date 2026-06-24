import { createRequire } from "module";
import { execFileSync } from "child_process";
import path from "path";

import { ensureCloakBrowserBinary } from "../runtime/index.mjs";

const require = createRequire(import.meta.url);

function normalizeProvider(flags = {}) {
  return String(flags.provider || flags.browser || "playwright").trim().toLowerCase();
}

export async function runInstallBrowser(flags = {}) {
  const provider = normalizeProvider(flags);
  if (provider === "cloak" || provider === "cloakbrowser" || provider === "stealth") {
    process.stdout.write("[site-fetchkit] 正在准备 CloakBrowser 二进制...\n");
    let binaryPath;
    try {
      binaryPath = await ensureCloakBrowserBinary();
    } catch (error) {
      const message = error.message || String(error);
      if (/CloakBrowser 未安装|Cannot find package 'cloakbrowser'/i.test(message)) {
        throw new Error(
          [
            "CloakBrowser JS wrapper 未安装，无法预下载浏览器二进制。",
            "请先在 site-fetchkit 所在的同一 Node 环境安装 wrapper：",
            "  全局安装 site-fetchkit 时执行: npm install -g cloakbrowser",
            "  作为项目依赖使用时执行: npm install cloakbrowser",
            "安装后再执行: site-fetchkit install-browser --provider cloak",
          ].join("\n")
        );
      }
      throw error;
    }
    process.stdout.write(`[site-fetchkit] CloakBrowser 二进制可用：${binaryPath}\n`);
    return 0;
  }

  // playwright bin 入口是包根目录下的 cli.js，通过 package.json 反推路径
  // 自带 Chromium 由 Playwright 管理，关窗不退进程，是 login 流程的必要前提
  const playwrightRoot = path.dirname(require.resolve("playwright/package.json"));
  const playwrightCLI = path.join(playwrightRoot, "cli.js");
  process.stdout.write("[site-fetchkit] 正在安装 Playwright Chromium（仅登录流程使用）...\n");
  execFileSync(process.execPath, [playwrightCLI, "install", "chromium"], {
    stdio: "inherit",
  });
  process.stdout.write("[site-fetchkit] Chromium 安装完成。\n");
  return 0;
}
