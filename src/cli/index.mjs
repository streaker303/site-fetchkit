#!/usr/bin/env node

import fs from "fs";

import { runInit } from "../commands/init.mjs";
import { runCreateSite } from "../commands/create-site.mjs";
import { runInstallBrowser } from "../commands/install-browser.mjs";
import { runLogin, runConfirmLogin } from "../commands/login.mjs";
import { runFetch } from "../commands/fetch.mjs";
import { runRun } from "../commands/run.mjs";
import { runUpdate } from "../commands/update.mjs";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 3; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      if (token === "-h") {
        flags.h = true;
        continue;
      }
      if (token === "-v") {
        flags.v = true;
        continue;
      }
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positional };
}

function printHelp() {
  process.stdout.write(`site-fetchkit

Usage:
  site-fetchkit <command> [options]

Commands:
  init              Install bundled skills and prepare the runtime
  install-browser   Install Playwright Chromium (required for login and default fetch)
  create-site       Scaffold a new site skill
  login <site>      Open a visible browser and wait for Agent confirmation
  confirm-login     Confirm the visible login flow and save storageState
  fetch <url>       Fetch page content with the generic browser mode
  run <script>      Run a script with site-fetchkit module resolution
  update            Refresh bundled skills after upgrading the CLI package

Options:
  --help, -h        Show help
  --version, -v     Show version

Command notes:
  fetch defaults to Playwright Chromium. Use --browser chrome only when system Chrome is required.
  login no longer requires terminal Enter. After login, run confirm-login <site>.
  login requests --url with the saved state by default. Use --validate-url <url> or --no-validate.
  run must be used for external site scripts that import "site-fetchkit".
`);
}

const command = process.argv[2] || "";
const { flags, positional } = parseArgs(process.argv);

function printVersion() {
  process.stdout.write(`${packageJson.version}\n`);
}

async function main() {
  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  if (command === "--version" || command === "-v") {
    printVersion();
    return 0;
  }

  if (command !== "run" && (flags.help || flags.h)) {
    printHelp();
    return 0;
  }

  if (command !== "run" && (flags.version || flags.v)) {
    printVersion();
    return 0;
  }

  switch (command) {
    case "init":
      return runInit(flags);
    case "install-browser":
      return runInstallBrowser();
    case "create-site":
      return runCreateSite(flags, positional);
    case "login":
      return runLogin(flags, positional);
    case "confirm-login":
      return runConfirmLogin(flags, positional);
    case "fetch":
      return runFetch(flags, positional);
    case "run":
      return runRun(flags, positional);
    case "update":
      return runUpdate(flags);
    default:
      printHelp();
      throw new Error(`未知命令：${command}`);
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error.message || String(error)}\n`);
    process.exitCode = 1;
  });
