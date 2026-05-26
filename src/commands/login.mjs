import * as runtime from "../runtime/index.mjs";

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

  const started = await runtime.startInteractiveLogin(site, setupUrl);
  process.stdout.write(`[site-fetchkit] Site: ${site}\n`);
  process.stdout.write(`[site-fetchkit] Profile: ${started.profileDir}\n`);
  process.stdout.write(`[site-fetchkit] Setup URL: ${setupUrl}\n`);
  process.stdout.write(`[site-fetchkit] Browser PID: ${started.pid}\n`);
  if (started.devtoolsPort) {
    process.stdout.write(`[site-fetchkit] DevTools Port: ${started.devtoolsPort}\n`);
  }
  process.stdout.write(
    `[site-fetchkit] 登录页面已打开。完成登录后运行：site-fetchkit complete-login ${site}\n`
  );

  return 0;
}
