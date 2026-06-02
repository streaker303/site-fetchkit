import fs from "fs";

import { ensureSiteLayout, getSitePaths } from "./paths.mjs";

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function getSiteState(site) {
  const paths = ensureSiteLayout(site);
  return {
    ...paths,
    exists: fs.existsSync(paths.stateFile),
    metadata: readJson(paths.metadataFile) || {},
  };
}

export function readStorageStateFile(site) {
  const paths = getSitePaths(site);
  if (!fs.existsSync(paths.stateFile)) {
    throw new Error(
      `站点 ${site} 尚未登录，需要由 Agent 执行: site-fetchkit login ${site} --url <登录入口 URL>`
    );
  }
  return paths.stateFile;
}

export async function exportStorageState(site, contextOrState, metadata = {}) {
  const paths = ensureSiteLayout(site);
  if (typeof contextOrState?.storageState === "function") {
    // 传入的是 BrowserContext，直接调用 .storageState() 写文件
    await contextOrState.storageState({ path: paths.stateFile });
  } else {
    // 传入的是已提取的 storageState 对象（浏览器已关闭时的回退路径）
    writeJson(paths.stateFile, contextOrState);
  }
  const previous = readJson(paths.metadataFile) || {};
  const next = {
    site: paths.site,
    updatedAt: new Date().toISOString(),
    ...previous,
    ...metadata,
  };
  writeJson(paths.metadataFile, next);
  return {
    ...paths,
    metadata: next,
  };
}

export async function withSiteLock(site, action) {
  const paths = ensureSiteLayout(site);
  let fd;
  try {
    fd = fs.openSync(paths.lockFile, "wx");
  } catch {
    throw new Error(`站点 ${site} 当前已有登录配置在执行，请稍后重试。`);
  }
  try {
    return await action(paths);
  } finally {
    fs.closeSync(fd);
    fs.rmSync(paths.lockFile, { force: true });
  }
}
