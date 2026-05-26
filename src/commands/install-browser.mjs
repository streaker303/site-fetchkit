import fs from "fs";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const playwrightCli = path.join(path.dirname(require.resolve("playwright")), "cli.js");

export function chromiumExists() {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

export function installChromium() {
  execFileSync(process.execPath, [playwrightCli, "install", "chromium"], {
    stdio: "inherit",
  });
}

export async function runInstallBrowser() {
  if (chromiumExists()) {
    process.stdout.write("[site-fetchkit] Chromium already installed.\n");
    return 0;
  }

  process.stdout.write("[site-fetchkit] Installing Playwright Chromium...\n");
  try {
    installChromium();
  } catch (error) {
    process.stderr.write(`Chromium 安装失败: ${error.message}\n`);
    return 2;
  }

  if (!chromiumExists()) {
    process.stderr.write("安装完成但 Chromium 路径仍不可用，请检查环境。\n");
    return 2;
  }

  process.stdout.write("[site-fetchkit] Chromium installed.\n");
  return 0;
}
