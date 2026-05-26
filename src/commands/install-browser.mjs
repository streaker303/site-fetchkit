import { createRequire } from "module";
import { execFileSync } from "child_process";
import path from "path";

const require = createRequire(import.meta.url);

export async function runInstallBrowser() {
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
