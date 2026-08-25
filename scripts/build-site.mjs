#!/usr/bin/env node
/**
 * SynapseMax static build step for Cloudflare Workers Builds.
 *
 * Cloudflare executes the deploy command directly after the build command.
 * Therefore this script must leave ./public on disk for Wrangler to consume.
 * We intentionally publish only the production surface (HTML + public assets),
 * never repository documentation, source files, CI configuration or scripts.
 */

import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const output = resolve(root, "public");

// Rebuild the deployment directory from scratch so stale files cannot survive
// between builds after a source asset has been renamed or removed.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copyFileSync(resolve(root, "index.html"), resolve(output, "index.html"));

const assets = resolve(root, "assets");
if (existsSync(assets)) {
  cpSync(assets, resolve(output, "assets"), { recursive: true });
}

// Cloudflare's deploy command runs in the same workspace. Keep the output
// directory intact; Wrangler reads assets.directory from wrangler.jsonc.
console.log("SynapseMax static build: PASS");
console.log("- output: ./public");
console.log("- entry: ./public/index.html");
console.log("- assets: ./public/assets");
console.log("- ready for: npx wrangler versions upload");
