import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { chromium } from "playwright";

import * as runtime from "../runtime/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../..");
const bundledSkillsRoot = path.join(packageRoot, "skills");

export function defaultSkillsRoot() {
  return (
    process.env.SITE_FETCHKIT_SKILLS_ROOT ||
    path.join(os.homedir(), ".agents", "skills")
  );
}

export function installBundledSkills(skillsRoot, { force = false } = {}) {
  const results = [];
  if (!fs.existsSync(bundledSkillsRoot)) {
    return results;
  }

  for (const entry of fs.readdirSync(bundledSkillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceDir = path.join(bundledSkillsRoot, entry.name);
    const sourceSkillFile = path.join(sourceDir, "SKILL.md");
    if (!fs.existsSync(sourceSkillFile)) continue;

    const targetDir = path.join(skillsRoot, entry.name);
    if (!force && fs.existsSync(targetDir)) {
      results.push({ targetDir, status: "skipped" });
      continue;
    }

    fs.cpSync(sourceDir, targetDir, {
      recursive: true,
      force: true,
    });
    results.push({ targetDir, status: "installed" });
  }
  return results;
}

async function checkChrome() {
  try {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    await browser.close();
    process.stdout.write("[site-fetchkit] 系统 Chrome 可用 ✓\n");
  } catch {
    process.stdout.write(
      "[site-fetchkit] 警告：未检测到系统 Google Chrome。无头抓取功能不可用，请安装 Google Chrome。\n"
    );
  }
}

async function checkPlaywrightChromium() {
  try {
    // 不指定 channel → 使用 Playwright 自带 Chromium（登录流程专用）
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    process.stdout.write("[site-fetchkit] Playwright Chromium 可用 ✓\n");
  } catch {
    process.stdout.write(
      "[site-fetchkit] 警告：Playwright Chromium 未安装，登录功能不可用。\n  请先运行：site-fetchkit install-browser\n"
    );
  }
}

export async function runInit(flags) {
  runtime.ensureRuntimeLayout();
  process.stdout.write("[site-fetchkit] Runtime directories ready.\n");

  await checkChrome();
  await checkPlaywrightChromium();

  const skillsRoot = path.resolve(String(flags["skills-root"] || "").trim() || defaultSkillsRoot());
  fs.mkdirSync(skillsRoot, { recursive: true });
  const skillResults = installBundledSkills(skillsRoot, {
    force: Boolean(flags.force),
  });
  for (const result of skillResults) {
    process.stdout.write(`[site-fetchkit] Skill ${result.status}: ${result.targetDir}\n`);
  }

  process.stdout.write("\n[site-fetchkit] Init complete. Ready to use.\n");
  return 0;
}
