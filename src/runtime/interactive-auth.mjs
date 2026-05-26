import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { chromium } from "playwright";

import {
  readStorageStateFile,
  exportStorageState,
} from "./auth-state-manager.mjs";
import { openSetupContext } from "./playwright-runner.mjs";
import { getSitePaths, ensureDir } from "./paths.mjs";
import {
  AuthStateMissingError,
  InteractiveAuthRequiredError,
} from "./errors.mjs";

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function mergeSiteMetadata(site, metadata) {
  const paths = getSitePaths(site);
  ensureDir(paths.metadataRoot);
  const previous = readJson(paths.metadataFile) || {};
  const next = {
    site: paths.site,
    ...previous,
    ...metadata,
  };
  writeJson(paths.metadataFile, next);
  return next;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readDevToolsPort(profileDir, timeoutMs = 5000) {
  const file = path.join(profileDir, "DevToolsActivePort");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(file)) {
      const [port] = fs.readFileSync(file, "utf8").split(/\r?\n/);
      const value = Number(port);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
    await wait(100);
  }
  return null;
}

function cleanupStaleProfile(profileDir) {
  try {
    execSync(
      `pkill -f "user-data-dir=${profileDir}" 2>/dev/null || true`,
      { stdio: "ignore", timeout: 5000 }
    );
  } catch {}
  for (const lockFile of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    const file = path.join(profileDir, lockFile);
    try { fs.rmSync(file, { force: true }); } catch {}
  }
}

async function closeProfileBrowser(profileDir, pid) {
  if (pid) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {}
    await wait(1200);
  }
  cleanupStaleProfile(profileDir);
}

export async function startInteractiveLogin(site, setupUrl) {
  if (!setupUrl) {
    throw new Error(`站点 ${site} 缺少 setup URL。`);
  }

  const paths = getSitePaths(site);
  ensureDir(paths.root);
  ensureDir(paths.profilesRoot);
  ensureDir(paths.metadataRoot);
  ensureDir(paths.profileDir);

  cleanupStaleProfile(paths.profileDir);

  const executablePath = chromium.executablePath();
  const child = spawn(
    executablePath,
    [
      `--user-data-dir=${paths.profileDir}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      setupUrl,
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );
  child.unref();
  const devtoolsPort = await readDevToolsPort(paths.profileDir);

  const metadata = mergeSiteMetadata(site, {
    setupUrl,
    pendingLogin: {
      pid: child.pid,
      devtoolsPort,
      setupUrl,
      startedAt: new Date().toISOString(),
    },
  });

  return {
    ...paths,
    pid: child.pid,
    devtoolsPort,
    metadata,
  };
}

export async function completeInteractiveLogin(site, options = {}) {
  const paths = getSitePaths(site);
  const metadata = readJson(paths.metadataFile) || {};
  const setupUrl = String(options.setupUrl || metadata.setupUrl || "").trim();

  if (!setupUrl) {
    throw new Error(`站点 ${site} 缺少 setup URL，无法保存登录态。`);
  }

  const devtoolsPort = metadata.pendingLogin?.devtoolsPort;
  const pendingPid = metadata.pendingLogin?.pid;
  let exportedFromCdp = null;
  if (devtoolsPort) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${devtoolsPort}`);
      try {
        const context = browser.contexts()[0];
        if (context) {
          exportedFromCdp = await exportStorageState(site, context, {
            setupUrl,
            pendingLogin: null,
          });
        }
      } finally {
        await browser.close().catch(() => {});
      }
    } catch {}
  }

  await closeProfileBrowser(paths.profileDir, pendingPid);

  if (exportedFromCdp) {
    return exportedFromCdp;
  }

  const { context } = await openSetupContext(site, { headless: true });
  try {
    const page = context.pages()[0] || (await context.newPage());
    await page
      .goto(setupUrl, { waitUntil: "domcontentloaded", timeout: 60000 })
      .catch(() => {});
    const exported = await exportStorageState(site, context, {
      setupUrl,
      pendingLogin: null,
    });
    return exported;
  } finally {
    await context.close();
  }
}

/**
 * Ensure a site has saved login state before a script makes authenticated requests.
 *
 * The function only checks whether a storageState file exists. It does not
 * inspect the current URL or try to prove that the session is valid. When the
 * state is missing, or `force` is true, it opens the setup URL in a visible
 * Chromium window and throws so the current agent task can stop until the user
 * finishes login.
 *
 * @param {string} site Site key used to store profile and storageState files.
 * @param {string} setupUrl Login page, site home, or representative target URL.
 * @param {object} [options] Extra options.
 * @param {boolean} [options.force=false] Open a new login browser even when state exists.
 * @returns {Promise<void>}
 * @throws When interactive login is required.
 */
export async function ensureAuthenticated(site, setupUrl, options = {}) {
  const { force = false } = options;

  if (!force) {
    try {
      readStorageStateFile(site);
      return;
    } catch (err) {
      if (!(err instanceof AuthStateMissingError)) throw err;
    }
  }

  await startInteractiveLogin(site, setupUrl);
  throw new InteractiveAuthRequiredError(site, setupUrl);
}
