import * as runtime from "../runtime/index.mjs";
import fs from "fs";

function isTruthy(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberFlag(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function clearLoginControlFiles(paths) {
  fs.rmSync(paths.loginConfirmFile, { force: true });
  fs.rmSync(paths.loginResultFile, { force: true });
}

function writeLoginResult(paths, result) {
  writeJson(paths.loginResultFile, {
    updatedAt: new Date().toISOString(),
    ...result,
  });
}

async function waitForLoginConfirmation(site, paths, flags) {
  const timeoutMs = numberFlag(flags["confirm-timeout"], 0);
  const intervalMs = numberFlag(flags["confirm-interval"], 500);
  const startedAt = Date.now();

  process.stdout.write(`[site-fetchkit] Site: ${site}\n`);
  process.stdout.write("[site-fetchkit] 登录窗口已打开。\n");
  process.stdout.write(
    "[site-fetchkit] 完成登录后告诉 Agent“已登录”，Agent 会确认并保存登录态。\n"
  );
  process.stdout.write(
    `[site-fetchkit] Confirm command: site-fetchkit confirm-login ${site}\n`
  );

  while (!fs.existsSync(paths.loginConfirmFile)) {
    if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `站点 ${site} 登录等待超时。浏览器仍可保留，重新触发登录后再确认。`
      );
    }
    await sleep(intervalMs);
  }
}

async function exportStateFromProfile(site, paths, flags) {
  const current = runtime.getSiteState(site);
  const setupUrl = String(flags.url || "").trim() || current.metadata.setupUrl || "";
  const state = await runtime.extractStateFromProfile(paths.profileDir);
  const exportedState = await exportValidatedState(
    site,
    state,
    setupUrl ? { setupUrl } : {},
    flags
  );
  writeLoginResult(paths, {
    ok: true,
    stateFile: exportedState.stateFile,
    metadata: exportedState.metadata,
    recoveredFromProfile: true,
  });
  fs.rmSync(paths.lockFile, { force: true });
  fs.rmSync(paths.loginConfirmFile, { force: true });
  return exportedState;
}

function assertStorageStateCaptured(site, storageState) {
  const cookies = Array.isArray(storageState?.cookies) ? storageState.cookies : [];
  const origins = Array.isArray(storageState?.origins) ? storageState.origins : [];
  if (cookies.length === 0 && origins.length === 0) {
    throw new Error(
      `站点 ${site} 登录态保存失败：未捕获到 cookie 或 origin storage。请确认已完成登录后再告知 Agent。`
    );
  }
}

async function validateSavedState(site, validateUrl, flags) {
  if (isTruthy(flags["no-validate"]) || !validateUrl) {
    return;
  }
  const ctx = await runtime.createRequestContext(site);
  try {
    const response = await ctx.get(validateUrl, {
      timeout: Number(flags["validate-timeout"] ?? flags.timeout ?? 30000),
    });
    const status = response.status();
    if (status === 401 || status === 403) {
      throw new Error(
        [
          `站点 ${site} 登录态保存后校验失败：HTTP ${status} ${response.url()}`,
          "CLI 只做通用保存校验；如果该站点需要特殊校验，请交给对应站点 skill 处理。",
          "如需跳过通用请求校验，可使用 --no-validate。",
        ].join("\n")
      );
    }
  } finally {
    await ctx.dispose();
  }
}

async function exportValidatedState(site, state, metadata, flags) {
  const validateUrl = String(flags["validate-url"] || metadata.setupUrl || "").trim();
  assertStorageStateCaptured(site, state);
  const exported = await runtime.exportStorageState(site, state, {
    ...metadata,
    validateUrl: isTruthy(flags["no-validate"]) ? "" : validateUrl,
  });
  await validateSavedState(site, validateUrl, flags);
  return exported;
}

async function openLoginContext(site) {
  try {
    return await runtime.openSetupContext(site);
  } catch (error) {
    const message = error.message || String(error);
    if (/Executable doesn't exist|browserType\.launchPersistentContext/i.test(message)) {
      throw new Error(
        [
          "登录浏览器启动失败。site-fetchkit login 使用 Playwright Chromium。",
          "请先执行: site-fetchkit install-browser",
          message,
        ].join("\n")
      );
    }
    throw error;
  }
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

  const exported = await runtime.withSiteLock(site, async (lockedPaths) => {
    clearLoginControlFiles(lockedPaths);
    const { paths, context } = await openLoginContext(site);
    const metadata = { setupUrl };
    try {
      // 复用上次 profile 留下的页面，或新建一个
      const page = context.pages()[0] || await context.newPage();
      await page.goto(setupUrl, {
        waitUntil: "domcontentloaded",
        timeout: Number(flags.timeout || 60000),
      });

      process.stdout.write(`[site-fetchkit] Setup URL: ${setupUrl}\n`);
      await waitForLoginConfirmation(site, paths, flags);

      try {
        const state = await context.storageState();
        const exportedState = await exportValidatedState(site, state, metadata, flags);
        writeLoginResult(paths, {
          ok: true,
          stateFile: exportedState.stateFile,
          metadata: exportedState.metadata,
        });
        return exportedState;
      } catch (err) {
        // 用户确认前关闭了浏览器（Cmd+Q / 关窗）
        // launchPersistentContext 已把 cookies 写入 profileDir，无头重新打开提取
        if (err.message?.includes("closed") || err.message?.includes("Target")) {
          process.stdout.write("[site-fetchkit] 浏览器已关闭，正在从本地配置文件提取登录态...\n");
          const state = await runtime.extractStateFromProfile(paths.profileDir);
          const exportedState = await exportValidatedState(site, state, metadata, flags);
          writeLoginResult(paths, {
            ok: true,
            stateFile: exportedState.stateFile,
            metadata: exportedState.metadata,
          });
          return exportedState;
        }
        throw err;
      }
    } catch (err) {
      writeLoginResult(paths, {
        ok: false,
        message: err.message || String(err),
      });
      throw err;
    } finally {
      fs.rmSync(paths.loginConfirmFile, { force: true });
      await context.close().catch(() => {});
    }
  });

  process.stdout.write(`[site-fetchkit] 登录态已保存：${exported.stateFile}\n`);

  return 0;
}

export async function runConfirmLogin(flags, positional) {
  const site = String(positional[0] || "").trim();
  if (!site) {
    throw new Error("缺少参数 <site>。用法: site-fetchkit confirm-login <site>");
  }

  const paths = runtime.ensureSiteLayout(site);
  if (!fs.existsSync(paths.lockFile)) {
    throw new Error(`站点 ${site} 当前没有进行中的登录窗口。`);
  }

  const startedAt = Date.now();
  const timeoutMs = numberFlag(flags.timeout, 60000);
  const intervalMs = numberFlag(flags.interval, 250);
  writeJson(paths.loginConfirmFile, {
    site: paths.site,
    confirmedAt: new Date().toISOString(),
  });

  while (Date.now() - startedAt <= timeoutMs) {
    const result = readJson(paths.loginResultFile);
    if (result) {
      if (result.ok) {
        process.stdout.write(`[site-fetchkit] 登录态已保存：${result.stateFile}\n`);
        return 0;
      }
      throw new Error(result.message || `站点 ${site} 登录保存失败。`);
    }
    if (!fs.existsSync(paths.lockFile)) {
      throw new Error(`站点 ${site} 登录流程已结束，但没有返回保存结果。`);
    }
    await sleep(intervalMs);
  }

  try {
    const exportedState = await exportStateFromProfile(site, paths, flags);
    process.stdout.write(
      `[site-fetchkit] 登录态已从浏览器配置恢复并保存：${exportedState.stateFile}\n`
    );
    return 0;
  } catch (error) {
    throw new Error(
      [
        `站点 ${site} 登录确认已发送，但等待保存结果超时。`,
        "尝试从浏览器 profile 恢复登录态也失败；请关闭旧登录浏览器或结束旧登录命令后重新触发登录。",
        error.message || String(error),
      ].join("\n")
    );
  }
}
