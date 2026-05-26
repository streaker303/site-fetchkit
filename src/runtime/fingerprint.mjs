const DEFAULT_LAUNCH_ARGS = ["--disable-blink-features=AutomationControlled"];

const DEFAULT_CONTEXT = {
  locale: "zh-CN",
  viewport: {
    width: 1440,
    height: 900,
  },
};

const DEFAULT_HEADERS = {
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7",
};

const DEFAULT_NAVIGATOR = {
  languages: ["zh-CN", "en", "en-US"],
  platform: "MacIntel",
  vendor: "Google Inc.",
  plugins: [1, 2, 3, 4, 5],
};

function mergeUnique(first = [], second = []) {
  return [...new Set([...first, ...second])];
}

export function buildChromeUserAgent(browserVersion) {
  const version = String(browserVersion || "146.0.0.0").trim() || "146.0.0.0";
  return [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "AppleWebKit/537.36 (KHTML, like Gecko)",
    `Chrome/${version}`,
    "Safari/537.36",
  ].join(" ");
}

export function createFingerprintProfile(options = {}) {
  const browserVersion =
    typeof options.browserVersion === "string" ? options.browserVersion : "";
  const contextOptions = {
    ...DEFAULT_CONTEXT,
    userAgent: buildChromeUserAgent(browserVersion),
    ...(options.contextOptions || {}),
  };

  const extraHTTPHeaders = {
    ...DEFAULT_HEADERS,
    ...(options.extraHTTPHeaders || {}),
    ...(contextOptions.extraHTTPHeaders || {}),
  };
  delete contextOptions.extraHTTPHeaders;

  return {
    launchArgs: mergeUnique(DEFAULT_LAUNCH_ARGS, options.launchArgs || []),
    contextOptions,
    extraHTTPHeaders,
    navigator: {
      ...DEFAULT_NAVIGATOR,
      ...(options.navigator || {}),
    },
  };
}

export async function applyFingerprintPatch(context, profile) {
  await context.addInitScript((navigatorProfile) => {
    const defineGetter = (target, key, value) => {
      try {
        Object.defineProperty(target, key, {
          configurable: true,
          get: () => value,
        });
      } catch {}
    };

    defineGetter(navigator, "webdriver", undefined);
    defineGetter(navigator, "languages", navigatorProfile.languages);
    defineGetter(navigator, "platform", navigatorProfile.platform);
    defineGetter(navigator, "vendor", navigatorProfile.vendor);
    defineGetter(navigator, "plugins", navigatorProfile.plugins);

    if (!window.chrome) {
      Object.defineProperty(window, "chrome", {
        configurable: true,
        value: { runtime: {} },
      });
    }
  }, profile.navigator);
}
