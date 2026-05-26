#!/usr/bin/env node

import { runInit } from "../commands/init.mjs";
import { runInstallBrowser } from "../commands/install-browser.mjs";
import { runCreateSite } from "../commands/create-site.mjs";
import { runLogin } from "../commands/login.mjs";
import { runCompleteLogin } from "../commands/complete-login.mjs";
import { runFetch } from "../commands/fetch.mjs";
import { runRun } from "../commands/run.mjs";

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 3; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
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
  install-browser   Install the Playwright-managed Chromium binary
  create-site       Scaffold a new site skill
  login <site>      Open a visible browser for manual login
  complete-login    Close login browser and save storageState
  fetch <url>       Fetch page content with the generic browser mode
  run <script>      Run a script with site-fetchkit module resolution

Options:
  --help, -h        Show help
`);
}

const command = process.argv[2] || "";
const { flags, positional } = parseArgs(process.argv);

async function main() {
  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  if (flags.help || flags.h) {
    printHelp();
    return 0;
  }

  switch (command) {
    case "init":
      return runInit(flags);
    case "install-browser":
      return runInstallBrowser(flags);
    case "create-site":
      return runCreateSite(flags, positional);
    case "login":
      return runLogin(flags, positional);
    case "complete-login":
      return runCompleteLogin(flags, positional);
    case "fetch":
      return runFetch(flags, positional);
    case "run":
      return runRun(flags, positional);
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
