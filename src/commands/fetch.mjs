import fs from "fs";
import path from "path";

import * as runtime from "../runtime/index.mjs";

async function genericFetch(input) {
  const site = input.site || "";
  const hasState = site ? runtime.getSiteState(site).exists : false;
  const { browser, context } = await runtime.createBrowserContext(hasState ? site : null);

  try {
    const page = await context.newPage();
    await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: Number(input.timeout || 30000),
    });
    await page
      .waitForLoadState("networkidle", {
        timeout: Math.min(Number(input.timeout || 30000), 5000),
      })
      .catch(() => {});
    if (hasState) {
      await page.waitForTimeout(1500);
    }
    if (input.waitSelector) {
      await page.waitForSelector(input.waitSelector, {
        timeout: Number(input.timeout || 30000),
      });
    }

    const selector = input.extractSelector || "main, article, body";
    const content = await page.evaluate((sel) => {
      const el = document.querySelector(sel) || document.body;
      return {
        selector: sel,
        title: document.title,
        html: el?.innerHTML || "",
        text: el?.innerText || "",
      };
    }, selector);

    return {
      source: "generic",
      site: site || "public",
      transport: "browser",
      contentType: "html",
      finalUrl: page.url(),
      title: content.title,
      content,
      meta: { selector: content.selector },
      warnings: [],
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function normalizeResult(result) {
  return {
    source: result?.source ?? null,
    site: result?.site ?? null,
    transport: result?.transport ?? null,
    contentType: result?.contentType ?? null,
    finalUrl: result?.finalUrl ?? null,
    title: result?.title ?? null,
    content: result?.content ?? null,
    meta: result?.meta ?? {},
    warnings: result?.warnings ?? [],
  };
}

function formatOutput(result, format) {
  const normalized = normalizeResult(result);
  if (format === "text") {
    if (typeof normalized.content === "string") return normalized.content;
    if (typeof normalized.content?.text === "string") return normalized.content.text;
    if (typeof normalized.content?.html === "string") return normalized.content.html;
    return "";
  }
  return JSON.stringify(normalized, null, 2);
}

export async function runFetch(flags, positional) {
  const url = String(positional[0] || flags.url || "").trim();
  if (!url) {
    throw new Error("缺少参数 <url>。用法: site-fetchkit fetch <url>");
  }

  const input = {
    url,
    site: String(flags.site || "").trim(),
    waitSelector: String(flags["wait-selector"] || "").trim(),
    extractSelector: String(flags["extract-selector"] || "").trim(),
    timeout: flags.timeout,
  };

  const result = await genericFetch(input);

  const output = formatOutput(result, String(flags.format || "json").toLowerCase());
  const outputFile = String(flags.output || "").trim();

  if (outputFile) {
    fs.writeFileSync(path.resolve(process.cwd(), outputFile), output, "utf8");
  } else {
    process.stdout.write(`${output}\n`);
  }
  return 0;
}
