/**
 * Preload script: registers the site-fetchkit resolve hook.
 * Used via: node --import <this-file> <script.mjs>
 */
import { register } from "node:module";

register("./resolve-hook.mjs", import.meta.url);
