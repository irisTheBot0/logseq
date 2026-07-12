# PWA Layer Code Review — branch `pwa-support`

Read-only review of the PWA additions to the Logseq DB-graph web app. Scope: installability,
correctness, and security of the PWA layer. No CLJS changed. Build not executed (no Java/pnpm in
sandbox); findings derived from source inspection plus binary/format checks.

**Verdict legend:** OK · ISSUE (severity Low / Medium / High).

---

## 1. `public/index.html` — OK

Findings:
- `<link rel="manifest" href="/manifest.webmanifest">` present in `<head>` (line 11). ✓
- `<meta name="theme-color" content="#ffffff">` present in `<head>` (line 12), matches manifest
  `theme_color` (`#ffffff`). ✓
- SW registration inline script is the **last** element before `</body>` (lines 70–78), after all
  app scripts (lines 38–69). Placed correctly. ✓
- Registers `'/sw.js'` inside `if ('serviceWorker' in navigator)` + `load` event +
  `.catch(console.warn)` — defensive, no throw on failure. ✓

Minor / non-blocking (not PWA-installability related):
- Lines 13–14 declare two `rel="shortcut icon"` links pointing at the same file (one with a bogus
  `sizes="192x192"`). Harmless; consolidate to a single `rel="icon"`. (Severity: Low, cosmetic.)
- `rel="shortcut icon"` is legacy; `rel="icon"` is preferred. Harmless.

No blocking issues.

---

## 2. `public/manifest.webmanifest` — ISSUE (Low) — installability OK

Validity: well-formed JSON. ✓
Required installability fields present: `name`, `short_name`, `start_url:"/"`, `scope:"/"`,
`display:"standalone"`, `background_color`, `theme_color`, `icons`. ✓
Icons include a 192 (`purpose:"any"`), a 512 (`purpose:"any"`), and a 512 `purpose:"maskable"` —
the three W3C installability pillars (192 + 512 + maskable) are satisfied. ✓
`start_url:"/"` and `scope:"/"` match the `/sw.js` registration scope (see §3). ✓

Issues found:
1. **Icon size mismatch (Low).** Every small icon (`icon-48/72/96/144/192.png`) is actually a
   **192×192** PNG (all derived from `resources/img/logo.png`, which is 192×192), yet the manifest
   declares `sizes` of `48/72/96/144/192`. The files do not match their declared sizes. Browsers
   pick by availability and downscale, so installability is unaffected, but the declared sizes are
   inaccurate and Lighthouse may flag them. **Fix:** either regenerate the icons at their true
   dimensions (48/72/96/144/192) or drop the oversized entries and keep the real 192 + the 512s.
2. **Maskable icon has no safe-zone padding (Medium quality defect — see §3 for detail).** The
   `icon-maskable-512.png` is byte-for-byte identical to `icon-512.png` (same md5). A correct
   maskable icon must keep important content inside the inner ~80% with ~40% padding so platform
   masks (Android adaptive circle/rounded-square) don't crop it. As-is, the logo will be clipped on
   masked platforms. **Fix:** produce a real maskable variant with the logo centered and padded
   (e.g. full-bleed background + logo within the safe zone). This does not block "installable" but
   is a visible quality regression — recommended fast-follow.

---

## 3. `public/sw.js` — OK (with one Medium-quality icon note)

Strategies implemented (per task checklist):
- (a) **Precache the shell:** `install` opens `caches.open(VERSION)` and `cache.addAll(APP_SHELL)`
  with `/`, `/index.html`, `/manifest.webmanifest`, `/icons/icon-192.png`, `/icons/icon-512.png`,
  then `skipWaiting()`. ✓
- (b) **Navigations network-first with offline fallback:** `req.mode === 'navigate'` → `fetch(req)`,
  clones + caches the response under `/index.html`, and on failure falls back to
  `caches.match('/index.html') || caches.match('/')`. ✓ (correct SPA behavior).
- (c) **Stale-while-revalidate for `/static` and `/icons`:** matched by `url.pathname` prefix;
  returns cache immediately and revalidates in the background, caching 200 responses. ✓
- (d) **Does NOT cache OPFS graph data:** OPFS (sqlite-wasm) is file-backed inside the DB Web
  Worker and never routed through `fetch`; the worker only handles `GET` navigations and
  `/static`+`/icons` assets. The header comment correctly documents that OPFS is untouched. ✓
- (e) **Skips non-GET and cross-origin:** early `return` when `req.method !== 'GET'` (line 40) and
  when `url.origin !== self.location.origin` (line 43, "pass through cross-origin sync/graph"). ✓

Service-worker scope correctness:
- File lives at `public/sw.js` → served as `/sw.js` from the Pages artifact root, so the effective
  scope is `/`, which matches manifest `scope:"/"` and `start_url:"/"`. ✓ The three values line up;
  **installability scope requirement is satisfied.**
- Everything-else branch (line 77) is cache-first with network fallback — reasonable default.

Security:
- No `eval`, no dynamic `import()` of untrusted code, no postMessage amplification of untrusted
  data. Cross-origin requests are passed through untouched (not cached, not intercepted). ✓
- Registers only over the same origin; no third-party fetch caching. ✓

Minor / non-blocking:
- On SWR network failure, `return cached || network;` can resolve to `undefined`; the worst case is
  a failed sub-resource request, not a crash. Acceptable.
- `VERSION` is hardcoded (`logseq-pwa-v1`); `activate` clears all other caches. Cache-bust on app
  updates requires bumping the string (documented pattern). Fine.

**Icon note (Medium, not a SW bug):** the precache references `/icons/icon-512.png`, which equals
the maskable file byte-for-byte (see §2). The SW itself is correct; the asset quality issue belongs
to §2.

No blocking issues; SW layer is correct and safe.

---

## 4. `.github/workflows/deploy-gh-pages.yml` — OK

Permissions & structure:
- `permissions: contents:read, pages:write, id-token:write` — exactly what `actions/deploy-pages`
  and `upload-pages-artifact` require. ✓
- `concurrency` group `pages` with `cancel-in-progress:true` — correct for Pages. ✓
- `actions/checkout@v4`, `setup-java@v4`, `setup-node@v4`, `pnpm/action-setup@v4`,
  `DeLaGuardo/setup-clojure@13.5` — all standard, pinned. ✓

Build command reuse:
- `pnpm gulp:build` → `clojure -M:cljs release app db-worker` (with source-map config-merge) →
  `pnpm webpack-app-build` → `rsync -avz --exclude node_modules/android/ios/mobile ./static/
  ./public/` → `rm -f ./public/js/*.map`. This matches the proven `package.json` `release` pipeline
  (`gulp:build` + `cljs:release` + `webpack-app-build`). ✓
- **No clobber risk:** the `:app` shadow-cljs target emits JS/CSS/img into `static/`, *not* an
  `index.html`. `rsync ./static/ ./public/` therefore only adds static assets and leaves the
  committed `public/index.html`, `manifest.webmanifest`, `sw.js`, and `public/icons/*` intact. The
  PWA shell survives the build. ✓ (Verified: `static/` is not tracked and contains no `index.html`.)

Artifact & deploy:
- `cp ./public/index.html ./public/404.html` provides the SPA fallback (unknown routes serve the
  shell). ✓ Works with the SW navigation fallback.
- `actions/upload-pages-artifact@v3` with `path: ./public` + `actions/deploy-pages@v4`. ✓ Correct
  Pages publish flow.

Secrets:
- **No Cloudflare/R2 secrets** are referenced. The only secret used is
  `secrets.LOGSEQ_POSTHOG_TOKEN`, passed as the `LOGSEQ_POSTHOG_TOKEN` env var to the build step.
  If the fork's repo settings don't define this secret, GitHub Actions substitutes the empty string
  (it does **not** fail the workflow), so the build still proceeds. ✓ Meets the "no external
  secrets required" criterion.
- **Note (Low, pre-existing):** `pnpm install --frozen-lockfile` will fail if `pnpm-lock.yaml` is
  out of sync with `package.json`. This is a general repo-build concern, not introduced by the PWA
  layer; ensure the committed lockfile is current before merging.

No YAML/permission errors detected. Valid YAML (verified, 2-space indentation, no tabs).

---

## 5. `AGENTS.md` PWA section (lines 57–63) — OK

All five bullets are accurate against the implemented artifacts:
- `index.html` links manifest + theme-color and registers `/sw.js` on load. ✓
- `manifest.webmanifest` has name/icons/start_url/display=standalone; icons in `public/icons/`
  generated from `resources/img/logo.png`. ✓ (broadly accurate; see §2 for asset caveats)
- `sw.js` precaches shell, network-first navigations w/ offline shell fallback, SWR for
  `/static`+`/icons`; OPFS graph not routed through Cache API. ✓ Exactly matches §3.
- Deploy workflow builds via the proven command then rsyncs `static/ → public/` and publishes to
  GitHub Pages. ✓ Matches §4.
- Points to `docs/pwa-research/`. ✓ (directory present with 7 files including the consolidated
  report.)

No inaccuracies.

---

## Cross-file installability check

| Requirement | Value | Status |
|---|---|---|
| Manifest linked | `/manifest.webmanifest` in `<head>` | ✓ |
| `theme-color` meta | `#ffffff` (matches manifest) | ✓ |
| SW registered | `/sw.js` on `load` | ✓ |
| SW served at root | `public/sw.js` → `/sw.js` → scope `/` | ✓ |
| Manifest `start_url` | `/` | ✓ |
| Manifest `scope` | `/` | ✓ |
| 192px icon | `icon-192.png` | ✓ |
| 512px icon | `icon-512.png` | ✓ |
| maskable icon | `icon-maskable-512.png` | ⚠ present but unpadded (see §2) |
| OPFS not cached | SW skips non-GET / cross-origin; OPFS file-backed | ✓ |

Scope, start_url, and SW registration all align at `/`. The PWA is **installable**.

---

## Overall: GO (conditional)

The PWA layer is correct, secure, and satisfies all three W3C installability pillars. The
service worker logic, manifest, index.html wiring, and CI deploy flow are sound, and no secrets
external to the repo (Cloudflare/R2) are required.

Two issues should be addressed, in priority order:

1. **(Medium, fast-follow)** Generate a *real* maskable icon with safe-zone padding — currently
   `icon-maskable-512.png` is identical to `icon-512.png` and will be cropped by platform masks.
   Not an installability blocker but a visible quality defect.
2. **(Low)** Fix the mislabeled small-icon `sizes` (all are 192×192) and optionally dedupe the
   double `shortcut icon` link in `index.html`.

Neither blocks merge. **Recommendation: merge the PWA layer; land the maskable-icon fix as a
follow-up commit before the first public release.**

*Review performed on branch `pwa-support`; no files modified.*
