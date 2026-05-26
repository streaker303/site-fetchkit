/**
 * Base error class for site-fetchkit runtime failures.
 *
 * Consumers can check `error.code` to branch on stable failure categories while
 * still preserving the human-readable message.
 */
export class SiteFetchKitError extends Error {
  constructor(message, code = "SITE_FETCHKIT_ERROR", details = {}) {
    super(message);
    this.name = "SiteFetchKitError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Raised when a script asks for authenticated state that has not been saved.
 */
export class AuthStateMissingError extends SiteFetchKitError {
  constructor(site, stateFile) {
    super(
      `站点 ${site} 尚未完成登录配置，缺少 storageState：${stateFile}`,
      "AUTH_STATE_MISSING",
      { site, stateFile }
    );
    this.name = "AuthStateMissingError";
  }
}

/**
 * Raised by site scripts when a saved session is present but no longer usable.
 */
export class AuthExpiredError extends SiteFetchKitError {
  constructor(site, url) {
    super(
      `站点 ${site} 的登录态已失效，当前跳转到登录页：${url}`,
      "AUTH_EXPIRED",
      { site, url }
    );
    this.name = "AuthExpiredError";
  }
}

/**
 * Raised after site-fetchkit opens a visible browser for user login.
 */
export class InteractiveAuthRequiredError extends SiteFetchKitError {
  constructor(site, setupUrl) {
    super(
      `站点 ${site} 需要登录，已打开登录页面：${setupUrl}。完成登录后执行 site-fetchkit complete-login ${site}。`,
      "INTERACTIVE_AUTH_REQUIRED",
      { site, setupUrl }
    );
    this.name = "InteractiveAuthRequiredError";
  }
}
