import fs from "fs";
import os from "os";
import path from "path";

const AGENTS_ROOT = path.join(os.homedir(), ".agents");
const FETCHER_STATE_ROOT = path.join(
  AGENTS_ROOT,
  "state",
  "site-fetchkit"
);

function getFetcherStateRoot() {
  return process.env.SITE_FETCHKIT_STATE_ROOT || FETCHER_STATE_ROOT;
}

function normalizeSite(site) {
  return String(site || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getSitePaths(site) {
  const siteKey = normalizeSite(site);
  const root = getFetcherStateRoot();
  const profilesRoot = path.join(root, "profiles");
  const statesRoot = path.join(root, "states");
  const metadataRoot = path.join(root, "metadata");
  const locksRoot = path.join(root, "locks");

  return {
    site: siteKey,
    root,
    profilesRoot,
    statesRoot,
    metadataRoot,
    locksRoot,
    profileDir: path.join(profilesRoot, siteKey),
    stateFile: path.join(statesRoot, `${siteKey}.json`),
    metadataFile: path.join(metadataRoot, `${siteKey}.json`),
    lockFile: path.join(locksRoot, `${siteKey}.lock`),
    loginConfirmFile: path.join(locksRoot, `${siteKey}.login-confirm`),
    loginResultFile: path.join(locksRoot, `${siteKey}.login-result.json`),
  };
}

export function ensureSiteLayout(site) {
  const paths = getSitePaths(site);
  ensureDir(paths.root);
  ensureDir(paths.profilesRoot);
  ensureDir(paths.statesRoot);
  ensureDir(paths.metadataRoot);
  ensureDir(paths.locksRoot);
  ensureDir(paths.profileDir);
  return paths;
}

export function ensureRuntimeLayout() {
  const root = getFetcherStateRoot();
  ensureDir(root);
  ensureDir(path.join(root, "profiles"));
  ensureDir(path.join(root, "states"));
  ensureDir(path.join(root, "metadata"));
  ensureDir(path.join(root, "locks"));
  return root;
}
