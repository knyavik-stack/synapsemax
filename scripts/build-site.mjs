#!/usr/bin/env node
/**
 * SynapseMax static build step.
 *
 * Cloudflare is configured to deploy only ./public. This prevents project
 * documentation, source files and CI configuration from becoming public
 * static assets. The source of truth remains index.html + assets/ in the repo.
 */

import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const output = resolve(root, "public");

// Rebuild the deployment directory from scratch so stale assets cannot leak
// into a later deployment after a file is removed from the source tree.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copyFileSync(resolve(root, "index.html"), resolve(output, "index.html"));

const assets = resolve(root, "assets");
if (existsSync(assets)) {
  cpSync(assets, resolve(output, "assets"), { recursive: true });
}

console.log("SynapseMax static build: PASS");
console.log("- output: ./public");
console.log("- entry: ./public/index.html");
console.log("- assets: ./public/assets");
