# Turning Logseq Web (master / DB-graph) into a Cross-Platform PWA — Research Report

## Executive Summary

Logseq `master` is the DB-graph rewrite: a ClojureScript SPA compiled by shadow-cljs, whose graph lives in a DataScript DB backed by **SQLite-WASM persisted in OPFS**, all inside a dedicated Web Worker. The browser `:app` build artifact still exists and runs from `static/`, but master ships **no hosted-web/PWA deploy target and none of the three W3C installability pillars** — there is no web app manifest, no registered Service Worker, and no offline `fetch` caching. The good news: the hardest problem (local-first, offline data) is already solved by OPFS + sqlite-wasm, and Logseq already owns Electron (desktop), Capacitor (`android/` + `ios/`), and an official self-hostable sync engine (`deps/db-sync`). A real cross-platform PWA is therefore mostly *assembly and hardening* — add manifest + SW, harden OPFS persistence, point sync at a self-hosted `deps/db-sync`, and satisfy AGPL §13 with a public source repo — with native store shells as an optional later phase.

## Current State vs PWA Requirements — Gap Table

| Area | Current state (master) | PWA requirement | Gap |
|---|---|---|---|
| **Architecture** | CLJS/shadow-cljs SPA; DataScript in a Web Worker; browser `:app` build runs from `static/` | Servable static app-shell | None structurally — artifact exists; no hosted-web deploy target |
| **Manifest** | Absent; only Apple/iOS meta tags; no `theme-color`, no `<link rel=manifest>` | Valid `manifest.webmanifest` (name/icons/start_url/display) | **Must build** |
| **Service Worker** | None (only a Web Worker for FS; `serviceWorker.register`=0, `workbox`=0) | Registered SW with offline `fetch` caching | **Must build** |
| **Storage** | OPFS + sqlite-wasm (`/db.sqlite`); `storage.persist()` requested; binary export/import | Offline data + eviction protection | Data offline-OK; needs quota UI + persist prompt hardening |
| **Cross-platform** | Electron desktop; Capacitor `android/`+`ios/` (appId `com.logseq.app`); rich plugin set | Install across desktop + mobile | Reuse existing shells; web/PWA tier missing |
| **Sync** | Official paid hosted Sync on `deps/db-sync`; custom Sync Server URL supported (PR #12459) | Multi-device sync | Self-host `deps/db-sync` (no SaaS) |
| **Licensing** | AGPL-3.0 (verbatim); §13 network-use triggers source disclosure | Compliant distribution | Public source repo + in-app source link; rename fork |

## Effort Estimate (Workstreams)

| Workstream | Estimate | Person-weeks |
|---|---|---|
| Add web app manifest + theme-color/icon meta | Small | ~0.5 |
| Author Service Worker (app-shell precache + wasm caching; leave OPFS data as-is) | Small–Medium | ~1.5 |
| Harden OPFS persistence (`persist()` prompt, quota UI via `storage.estimate()`, export/import UX) | Medium | ~2 |
| Self-host sync via `logseq-selfhost` (`deps/db-sync`) + wire custom Sync URL | Medium | ~2.5 |
| AGPL §13 compliance (public source repo + in-app source link + rename/de-brand) | Small | ~0.5 |
| Capacitor/Tauri native shell for stores (reuse existing Capacitor) | Large | ~4 |
| Build-pipeline glue (hosted-web deploy target from `static/`, HTTPS) | Small–Medium | ~1 |
| **Total ballpark** | | **~12 person-weeks** (≈8 without native store shells) |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OPFS eviction on iOS Safari (non-persistent origin wiped under pressure) | Medium–High | High | Prompt `navigator.storage.persist()`; quota UI; keep binary export/import; prefer Capacitor on iOS |
| AGPL store friction (readable-source expectation, §13 offer) | Medium | Medium | Public git repo + in-app "Source" link; ship readable source + build scripts; don't obfuscate |
| `deps/db-sync` self-host maturity (Cognito JWT auth coupling) | Medium | Medium | Use maintained `logseq-selfhost` Docker; review/replace JWT issuer; data stays E2E regardless |
| Build-pipeline complexity (CLJS/shadow-cljs + Gulp + webpack) | Medium | Medium | Reuse existing `pnpm release`; add thin hosted-web target only; minimize forked build surface |
| iOS PWA limitations (no background sync, pre-16.4 no push, A2HS-only install) | High | Medium | Ship Capacitor iOS app as the "real" iOS path; treat browser PWA as best-effort on iOS |
| Trademark/impersonation ("Logseq" name/logo) | Medium | Medium | Rename fork, drop logo, factual "based on Logseq" attribution only |

*(Note: 429/rate-limit is a research-time artifact, not a project risk — excluded.)*

## Phased Roadmap

### Phase 0 — Foundation (manifest + SW + HTTPS)
- **Tasks:** Add `manifest.webmanifest` (name/icons/start_url/display) + `theme-color`; add `<link rel=manifest>` to entry HTML; author SW that precaches app shell (HTML, JS bundles, CSS, fonts) + `sqlite-wasm` `.wasm`/VFS glue with stale-while-revalidate + navigation fallback; register via `navigator.serviceWorker.register`; add a hosted-web deploy target serving `static/` over HTTPS.
- **Exit criteria:** Lighthouse "installable"; app boots offline (engine loads with no network); A2HS works on Chrome/Android.

### Phase 1 — Offline hardening + persist prompt
- **Tasks:** Prompt `storage.persist()` on first run with clear UX; quota warning via `storage.estimate()`; polished binary export/import backup flow; quota-exceeded handling on OPFS writes.
- **Exit criteria:** Persistent-storage grant obtained where supported; user sees quota status; verified graph survives reload and (where grantable) storage pressure.

### Phase 2 — Sync self-host
- **Tasks:** Deploy `yshalsager/logseq-selfhost` (Docker: `deps/db-sync` node adapter + web) on a small VPS/home server; wire client "Sync Server URL" (PR #12459) to the instance; review/replace Cognito JWT auth; verify E2E tx-diff sync across two devices.
- **Exit criteria:** Live multi-device sync over a self-hosted, no-SaaS endpoint; no plaintext readable server-side.

### Phase 3 — Native shells / store distribution
- **Tasks:** Extend existing Capacitor app (`static/mobile`) for Android + iOS; keep Electron for desktop; use Capacitor-native fallbacks where web APIs are missing (share target, notifications, secure storage, background backup); build store artifacts via existing `sync-android-release`/`sync-ios-release`.
- **Exit criteria:** Signed Android + iOS builds pass store review; desktop Electron builds intact; feature parity with PWA plus native fallbacks.

### Phase 4 — Licensing / compliance polish
- **Tasks:** Publish complete corresponding source (web + wrapper + build scripts) to a public git repo; add prominent in-app "Source code" link; rename/de-brand the fork; preserve AGPL notices; ensure readable (non-obfuscated) source and exact build command.
- **Exit criteria:** §13 offer satisfied for any network user; no Logseq trademark reuse; combined work licensed AGPL-3.0.

## Recommendation

The minimal viable path is to **assemble a PWA tier on top of assets Logseq already owns** rather than rewrite anything: reuse the existing Electron desktop build, the Capacitor `android/`+`ios/` shells, and the official `deps/db-sync` sync engine self-hosted via `logseq-selfhost` (no credit card, private, E2E). Only four things must be built new — a **web app manifest**, a **Service Worker** (app-shell + wasm precache; OPFS data is already offline), **OPFS persistence hardening** (`persist()` prompt + quota UI + export/import), and a **public source repo with an in-app source link** for AGPL §13. Ship the browser PWA for zero-install/desktop use, lean on the Capacitor apps for real iOS/Android (given iOS PWA storage/background limits), and defer native store shells until the PWA + self-host sync are proven.

## Sources Appendix (merged, deduped)

- https://raw.githubusercontent.com/logseq/logseq/master/shadow-cljs.edn
- https://raw.githubusercontent.com/logseq/logseq/master/package.json
- https://raw.githubusercontent.com/logseq/logseq/master/gulpfile.js
- https://raw.githubusercontent.com/logseq/logseq/master/CODEBASE_OVERVIEW.md
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/db_worker.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/db_core.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/shared_service.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/platform.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/platform/browser.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db/browser.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/storage.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/common/file/opfs.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/public/index.html
- https://raw.githubusercontent.com/logseq/logseq/master/resources/index.html
- https://raw.githubusercontent.com/logseq/logseq/master/resources/mobile/index.html
- https://raw.githubusercontent.com/logseq/logseq/master/resources/js/worker.js
- https://raw.githubusercontent.com/logseq/logseq/master/statics/manifest.webmanifest (HTTP 404 — confirms absence)
- https://raw.githubusercontent.com/logseq/logseq/master/capacitor.config.ts
- https://raw.githubusercontent.com/logseq/logseq/master/deps/db-sync/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/deps/db-sync/src/logseq/db_sync/worker/auth.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/deps/db-sync/src/logseq/db_sync/worker/handler/sync.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/LICENSE.md
- https://raw.githubusercontent.com/logseq/logseq/master/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/CONTRIBUTING.md
- https://raw.githubusercontent.com/yshalsager/logseq-selfhost/master/README.md
- https://raw.githubusercontent.com/yshalsager/logseq-selfhost/master/images/sync/README.md
- https://api.github.com/repos/logseq/logseq/git/trees/master?recursive=1
- https://api.github.com/repos/logseq/logseq/contents/android
- https://api.github.com/repos/logseq/logseq/contents/ios
- https://api.github.com/repos/yshalsager/logseq-selfhost (57★, AGPL-3.0, pushed 2026-07-11)
- https://api.github.com/search/code (queries: serviceWorker, navigator.serviceWorker.register, registerServiceWorker, workbox, sw.js, service-worker)
- https://github.com/logseq/logseq (repo metadata, AGPL-3.0, master/DB-graph)
- https://github.com/logseq/logseq/pull/12459 (Custom Sync Server URL, merged 2026-04-13)
- https://docs.logseq.com/#/page/websites (hosting/HTTPS context)
- https://docs.logseq.com/ and https://logseq.com/ (SPA shells; content in code/PRs)
- https://v2.tauri.app/start/ (Tauri platforms, bundle size, mobile beta)
- https://developer.chrome.com/docs/android/trusted-web-activity/overview (TWA/Bubblewrap)
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Installable_PWAs
- https://www.gnu.org/licenses/agpl-3.0.html (§13, Corresponding Source)
- https://choosealicense.com/licenses/agpl-3.0/
- https://developer.apple.com/app-store/review/guidelines/ (§4.1 Copycats, §5.2 IP)
- https://play.google.com/about/developer-content-policy/ (Impersonation)
