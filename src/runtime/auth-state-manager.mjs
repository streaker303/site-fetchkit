import fs from "fs";

import { AuthStateMissingError } from "./errors.mjs";
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
    throw new AuthStateMissingError(site, paths.stateFile);
  }
  return paths.stateFile;
}

export async function exportStorageState(site, context, metadata = {}) {
  const paths = ensureSiteLayout(site);
  await context.storageState({ path: paths.stateFile });
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
