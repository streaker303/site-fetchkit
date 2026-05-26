import * as runtime from "../runtime/index.mjs";
import readline from "node:readline";

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

export async function runLogin(flags, positional) {
  const site = String(positional[0] || "").trim();
  if (!site) {
    throw new Error("缺少参数 <site>。用法: site-fetchkit login <site> --url <setupUrl>");
  }

  const current = runtime.getSiteState(site);
  const setupUrl = String(flags.url || "").trim() || current.metadata.setupUrl;

  if (!setupUrl) {
    throw new Error(`站点 ${site} 缺少 setup URL。首次登录请通过 --url 传入。`);
  }

  const exported = await runtime.withSiteLock(site, async () => {
    const { paths, context } = await runtime.openSetupContext(site);
    try {
      // 复用上次 profile 留下的页面，或新建一个
      const page = context.pages()[0] || await context.newPage();
      await page.goto(setupUrl, {
        waitUntil: "domcontentloaded",
        timeout: Number(flags.timeout || 60000),
      });

      process.stdout.write(`[site-fetchkit] Site: ${site}\n`);
      process.stdout.write(`[site-fetchkit] Setup URL: ${setupUrl}\n`);
      await waitForEnter(
        "\n请在浏览器中完成登录，确认可以正常访问目标站点后，回到终端按 Enter 继续...\n"
      );

      try {
        return await runtime.exportStorageState(site, context, { setupUrl });
      } catch (err) {
        // 用户关闭了浏览器（Cmd+Q / 关窗）后才按 Enter
        // launchPersistentContext 已把 cookies 写入 profileDir，无头重新打开提取
        if (err.message?.includes("closed") || err.message?.includes("Target")) {
          process.stdout.write("[site-fetchkit] 浏览器已关闭，正在从本地配置文件提取登录态...\n");
          const state = await runtime.extractStateFromProfile(paths.profileDir);
          return runtime.exportStorageState(site, state, { setupUrl });
        }
        throw err;
      }
    } finally {
      await context.close().catch(() => {});
    }
  });

  process.stdout.write(`[site-fetchkit] 登录态已保存：${exported.stateFile}\n`);

  return 0;
}
