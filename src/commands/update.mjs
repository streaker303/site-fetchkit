import fs from "fs";
import path from "path";

import {
  defaultSkillsRoot,
  installBundledSkills,
} from "./init.mjs";

export function runUpdate(flags) {
  const skillsRoot = path.resolve(String(flags["skills-root"] || "").trim() || defaultSkillsRoot());
  fs.mkdirSync(skillsRoot, { recursive: true });

  const skillResults = installBundledSkills(skillsRoot, { force: true });
  if (skillResults.length === 0) {
    process.stdout.write("[site-fetchkit] No bundled skills found.\n");
    return 0;
  }

  for (const result of skillResults) {
    process.stdout.write(`[site-fetchkit] Skill refreshed: ${result.targetDir}\n`);
  }

  process.stdout.write("\n[site-fetchkit] Update complete. Bundled skills are refreshed.\n");
  return 0;
}
