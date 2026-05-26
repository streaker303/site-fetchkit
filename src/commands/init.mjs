import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import * as runtime from "../runtime/index.mjs";
import { chromiumExists, installChromium } from "./install-browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../..");
const bundledSkillsRoot = path.join(packageRoot, "skills");

function defaultSkillsRoot() {
  return (
    process.env.SITE_FETCHKIT_SKILLS_ROOT ||
    path.join(os.homedir(), ".agents", "skills")
  );
}

function installBundledSkills(skillsRoot, { force = false } = {}) {
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

export async function runInit(flags) {
  runtime.ensureRuntimeLayout();
  process.stdout.write("[site-fetchkit] Runtime directories ready.\n");

  const skillsRoot = path.resolve(String(flags["skills-root"] || "").trim() || defaultSkillsRoot());
  fs.mkdirSync(skillsRoot, { recursive: true });
  const skillResults = installBundledSkills(skillsRoot, {
    force: Boolean(flags.force),
  });
  for (const result of skillResults) {
    process.stdout.write(`[site-fetchkit] Skill ${result.status}: ${result.targetDir}\n`);
  }

  if (chromiumExists()) {
    process.stdout.write("[site-fetchkit] Chromium already installed.\n");
  } else {
    process.stdout.write("[site-fetchkit] Installing Playwright Chromium...\n");
    try {
      installChromium();
    } catch (e) {
      process.stderr.write(`Chromium 安装失败: ${e.message}\n`);
      return 2;
    }
    if (!chromiumExists()) {
      process.stderr.write("安装完成但 Chromium 路径仍不可用，请检查环境。\n");
      return 2;
    }
    process.stdout.write("[site-fetchkit] Chromium installed.\n");
  }

  process.stdout.write("\n[site-fetchkit] Init complete. Ready to use.\n");
  return 0;
}
