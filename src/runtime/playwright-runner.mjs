import { chromium, request } from "playwright";

import { readStorageStateFile } from "./auth-state-manager.mjs";
import {
  applyFingerprintPatch,
  createFingerprintProfile,
} from "./fingerprint.mjs";
import { ensureSiteLayout } from "./paths.mjs";

function readBrowserVersion(browserOrVersion) {
  if (typeof browserOrVersion === "string") return browserOrVersion;
  if (browserOrVersion && typeof browserOrVersion.version === "function") {
    return browserOrVersion.version();
  }
  return "";
}

function buildProfile(options = {}, browserOrVersion = "") {
  const profileOptions = {
    ...(options.fingerprint || {}),
    browserVersion: readBrowserVersion(browserOrVersion),
    contextOptions: options.contextOptions,
    extraHTTPHeaders: options.extraHTTPHeaders,
    launchArgs: options.launchOptions?.args || options.args || [],
  };
  return createFingerprintProfile(profileOptions);
}

function buildContextOptions(profile, options = {}) {
  return {
    ...profile.contextOptions,
    ...(options.contextOptions || {}),
    extraHTTPHeaders: profile.extraHTTPHeaders,
  };
}

export async function openSetupContext(site, options = {}) {
  const paths = ensureSiteLayout(site);
  const launchOptions = {
    ...(options.launchOptions || {}),
  };
  const profile = buildProfile(options);
  launchOptions.args = profile.launchArgs;

  const context = await chromium.launchPersistentContext(paths.profileDir, {
    headless: options.headless ?? false,
    ...launchOptions,
    ...buildContextOptions(profile, options),
  });
  await applyFingerprintPatch(context, profile);

  return {
    paths,
    context,
  };
}

/**
 * Create a Playwright APIRequestContext that reuses a saved site storageState.
 *
 * Use this in site scripts when the target content can be fetched through HTTP
 * endpoints or HTML pages without running page scripts.
 *
 * @param {string} site Site key whose storageState should be loaded.
 * @param {object} [options] Playwright request context options.
 * @param {object} [options.requestOptions] Extra options forwarded to `request.newContext`.
 * @returns {Promise<import("playwright").APIRequestContext>} Authenticated request context.
 * @throws When the site has no saved storageState.
 */
export async function createRequestContext(site, options = {}) {
  const profile = buildProfile(options);
  const {
    contextOptions,
    fingerprint,
    launchOptions,
    requestOptions,
    ...directOptions
  } = options;
  return request.newContext({
    ...directOptions,
    storageState: readStorageStateFile(site),
    ignoreHTTPSErrors: true,
    userAgent: profile.contextOptions.userAgent,
    extraHTTPHeaders: profile.extraHTTPHeaders,
    ...(requestOptions || {}),
  });
}

/**
 * Launch a headless Chromium browser context with saved login state.
 *
 * Use this when a site needs DOM execution, client-side rendering, or browser
 * APIs that cannot be covered by `createRequestContext`.
 *
 * @param {string} site Site key whose storageState should be loaded.
 * @param {object} [options] Browser launch and context options.
 * @param {boolean} [options.headless=true] Whether Chromium runs headless.
 * @param {object} [options.launchOptions] Options forwarded to `chromium.launch`.
 * @param {object} [options.contextOptions] Options forwarded to `browser.newContext`.
 * @returns {Promise<{browser: import("playwright").Browser, context: import("playwright").BrowserContext}>}
 * @throws When the site has no saved storageState.
 */
export async function createBrowserContext(site, options = {}) {
  const launchOptions = {
    ...(options.launchOptions || {}),
  };
  const profile = buildProfile(options);
  launchOptions.args = profile.launchArgs;

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    ...launchOptions,
  });
  const browserProfile = buildProfile(options, browser);
  const context = await browser.newContext({
    storageState: readStorageStateFile(site),
    ignoreHTTPSErrors: true,
    ...buildContextOptions(browserProfile, options),
  });
  await applyFingerprintPatch(context, browserProfile);
  return {
    browser,
    context,
  };
}

/**
 * Launch a browser context without saved login state.
 *
 * Use this for public pages, first-pass diagnostics, or fallback extraction
 * where authentication is not required.
 *
 * @param {object} [options] Browser launch and context options.
 * @param {boolean} [options.headless=true] Whether Chromium runs headless.
 * @param {object} [options.launchOptions] Options forwarded to `chromium.launch`.
 * @param {object} [options.contextOptions] Options forwarded to `browser.newContext`.
 * @returns {Promise<{browser: import("playwright").Browser, context: import("playwright").BrowserContext}>}
 */
export async function createPublicBrowserContext(options = {}) {
  const launchOptions = {
    ...(options.launchOptions || {}),
  };
  const profile = buildProfile(options);
  launchOptions.args = profile.launchArgs;

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    ...launchOptions,
  });
  const browserProfile = buildProfile(options, browser);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    ...buildContextOptions(browserProfile, options),
  });
  await applyFingerprintPatch(context, browserProfile);
  return {
    browser,
    context,
  };
}
