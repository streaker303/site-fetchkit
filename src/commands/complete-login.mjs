import * as runtime from "../runtime/index.mjs";

export async function runCompleteLogin(flags, positional) {
  const site = String(positional[0] || "").trim();
  if (!site) {
    throw new Error("缺少参数 <site>。用法: site-fetchkit complete-login <site>");
  }

  const exported = await runtime.completeInteractiveLogin(site, {
    setupUrl: String(flags.url || "").trim(),
  });

  process.stdout.write(`[site-fetchkit] 登录态已保存：${exported.stateFile}\n`);
  return 0;
}
