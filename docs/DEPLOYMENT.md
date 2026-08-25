# SynapseMax — Deployment

## Cloudflare failure `Build #0b568b11`

### Root cause

The Cloudflare deploy command was `npx wrangler versions upload`, but Wrangler had no Worker entry point and no static-assets directory. The build log explicitly reports: `Missing entry-point to Worker script or to assets directory`. fileciteturn57file0

### Fix in repository

- `wrangler.jsonc` declares `./public` as the deployment assets directory.
- `scripts/build-site.mjs` creates `./public`, copies the production `index.html`, and copies the required `assets/` directory.
- The repository itself is therefore not exposed as the public static root.

### Required Cloudflare settings

In Workers & Pages → the SynapseMax application:

- **Build command:** `node scripts/build-site.mjs`
- **Deploy command:** `npx wrangler versions upload`
- **Build output directory:** leave empty; Wrangler reads `wrangler.jsonc` and deploys `./public`.

If the dashboard already has a different deploy command, replace it with the command above. Do not use `wrangler versions upload` without the repository config and build step.

## Verification order

1. GitHub commit exists.
2. Cloudflare build reaches `build-site.mjs` successfully.
3. Wrangler reports an assets directory and completes upload.
4. `https://synapsemax.knyavik.workers.dev/` opens.
5. Logo and local assets load.
6. `https://synapsemax.ru/` opens after the production route is connected.
7. Only after those checks is the deployment considered verified.

## Visual review checklist

The user should not be asked to compare the entire site blindly. For each frontend iteration, provide a short list of visible deltas. For the current DEX foundation stage, the expected visible delta is intentionally small: the accepted prototype should remain visually stable while the first reusable HUD card is validated in isolation. Large visual changes require separate product/brand approval.
