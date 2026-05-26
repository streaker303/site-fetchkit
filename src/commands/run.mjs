import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const loaderPath = resolve(__dirname, "../loader/register.mjs");

export function runRun(flags, positional) {
  const script = positional[0];
  if (!script) {
    process.stderr.write("用法: site-fetchkit run <script.mjs> [args...]\n");
    return 1;
  }

  const scriptPath = resolve(script);
  const scriptArgs = process.argv.slice(process.argv.indexOf(script) + 1);

  return new Promise((res) => {
    const child = spawn(process.execPath, ["--import", loaderPath, scriptPath, ...scriptArgs], {
      stdio: "inherit",
    });
    child.on("close", (code) => res(code || 0));
  });
}
