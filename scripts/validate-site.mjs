#!/usr/bin/env node
/**
 * SynapseMax release guard.
 *
 * This is intentionally dependency-free so it can run in Cloudflare/GitHub CI
 * without installing a test framework. It catches the high-cost mistakes we
 * explicitly agreed not to ship: wrong canonical domain, wrong public email,
 * stale .ai references, and broken local asset references.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = resolve(process.cwd());
const htmlPath = resolve(root, "index.html");
const html = readFileSync(htmlPath, "utf8");

const failures = [];

function requireMatch(pattern, message) {
  if (!pattern.test(html)) failures.push(message);
}

requireMatch(/https:\/\/synapsemax\.ru\//, "Canonical HTTPS domain is missing.");
requireMatch(/hello@synapsemax\.ru/, "Canonical public email is missing.");

if (/synapsemax\.ai/i.test(html)) {
  failures.push("Unapproved .ai domain reference found in index.html.");
}

// Local asset URLs are checked conservatively. Data URLs, absolute URLs and
// anchors are intentionally ignored because they are not repository assets.
const assetPattern = /(?:src|href)=["']([^"']+)["']/gi;
let match;
while ((match = assetPattern.exec(html)) !== null) {
  const ref = match[1];
  if (!ref || ref.startsWith("#") || ref.startsWith("data:") || /^https?:\/\//i.test(ref)) continue;
  if (/^(mailto:|tel:|javascript:)/i.test(ref)) continue;

  const clean = ref.split("?")[0].split("#")[0];
  if (!clean || clean.endsWith("/")) continue;

  const assetPath = resolve(dirname(htmlPath), clean);
  if (!existsSync(assetPath)) failures.push(`Missing local asset: ${clean}`);
}

if (failures.length) {
  console.error("SynapseMax release guard: FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SynapseMax release guard: PASS");
console.log("- canonical domain: synapsemax.ru");
console.log("- public email: hello@synapsemax.ru");
console.log("- no unapproved .ai references");
console.log("- local asset references resolved");
