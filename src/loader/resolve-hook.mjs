/**
 * Resolve hook for Node.js module customization hooks.
 * Maps bare specifier "site-fetchkit" to the actual package entry point.
 */
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const entryUrl = pathToFileURL(join(pkgRoot, "src", "index.mjs")).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier === "site-fetchkit") {
    return { url: entryUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
