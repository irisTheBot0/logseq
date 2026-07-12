# T-02: PWA Baseline Requirements & Logseq Master Current-State Audit

Scope: W3C installability criteria for a real PWA — (a) served over HTTPS, (b) a valid web app manifest (`name`/`icons`/`start_url`/`display`), (c) a registered Service Worker with a `fetch` handler enabling offline. Audit target: `github.com/logseq/logseq` branch `master` (DB-graph).

## 1. Web App Manifest — MISSING

- No `manifest.webmanifest` or `manifest.json` exists anywhere in master for the web app. A recursive tree scan (`git/trees/master?recursive=1`) matched the term "manifest" only for: `android/app/src/main/AndroidManifest.xml` (native Android, irrelevant) and `cli-e2e/.../manifests.clj` / `manifests_test.clj` (test fixtures, unrelated).
- Confirmed: top-level `statics/manifest.webmanifest` returns **404** (HTTP status from raw.githubusercontent.com).
- `public/` directory contains **only** `public/index.html`. No manifest, no icons directory, no `static/` assets tree (those are build-generated).
- The HTML entry points (`public/index.html`, `resources/index.html`, `resources/mobile/index.html`) contain **no `<link rel="manifest" ...>`** tag.

### Meta tags present in `public/index.html` / `resources/index.html`
iOS/Apple-oriented mobile web tags only — NO `theme-color`, NO `manifest`:
- `<meta name="viewport" ...>`
- `<link rel="shortcut icon" href="/static/img/logo.png">` (also `sizes="192x192"`)
- `<link rel="apple-touch-icon" href="/static/img/logo.png">`
- `<meta name="apple-mobile-web-app-title" content="Logseq">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="mobile-web-app-capable" content="yes">`
- Twitter/OpenGraph (`og:*`, `twitter:*`) descriptive cards.
- `theme-color` and a proper `manifest` link are both ABSENT.

## 2. Service Worker — NONE DEFINITIVELY (NO SW)

- Code search totals: `repo:logseq/logseq navigator.serviceWorker.register` = **0**, `registerServiceWorker` = **0**, `workbox` = **0**, `filename:sw.js` = **0**.
- The only `serviceWorker` string in the repo is a context-detection branch inside `resources/js/worker.js` (line 14: `return 'ServiceWorker'`) and `resources/mobile/js/worker.js`. This is a **Web Worker** (instantiated via `new Worker('/static/js/worker.js')`, using LightningFS for OPFS-style FS), NOT a Service Worker. It merely notes it *could* run in a ServiceWorker global (`self.skipWaiting` branch) but is **never registered with `navigator.serviceWorker.register(...)`**.
- No `sw.js`, no Workbox config, no `service-worker` registration, no `fetch` caching handler exists. The desktop and mobile apps use Electron / Capacitor instead.

**Conclusion: there is NO Service Worker in Logseq master.** (Prior assumption that "desktop uses a different mechanism" is correct — it is a Web Worker for FS, not a SW.)

## 3. HTTPS / Hosting — contextual

- Logseq Web (the hosted `logseq.com` / `publish` app and the `logseq publish` static export) is served over **HTTPS** by the official host; the docs page repeatedly references `https` URLs.
- The self-hosted/web build (`public/index.html`) hard-codes asset paths (`/static/js/...`, `/static/css/style.css`) and `window.__LSP__HOST__ = true`, indicating it is designed to be served from a **specific host root** (an LSP/Graph host), not as an origin-agnostic static PWA. Static publishing produces an export bundle, not an installable PWA.
- HTTPS is therefore a deployment property, satisfied by official hosting but not guaranteed for arbitrary self-hosting.

## 4. Gap Analysis

| PWA Requirement | Logseq master state | Evidence |
|---|---|---|
| Served over HTTPS | Partial (host-dependent) | Docs reference `https`; `public/index.html` assumes host root (`__LSP__HOST__`, `/static/...`) |
| Valid web app manifest (`name`/`icons`/`start_url`/`display`) | **MISSING** | No `manifest.webmanifest`/`manifest.json` in tree; `statics/manifest.webmanifest` = 404; no `<link rel=manifest>` in any `index.html` |
| Registered Service Worker (installable) | **MISSING** | `navigator.serviceWorker.register`=0; `sw.js`=0; `workbox`=0; only a Web Worker (`resources/js/worker.js`) |
| Service Worker offline `fetch` caching | **MISSING** | No SW registration, no fetch handler, no Workbox precache |

**Bottom line:** Logseq master is **not** a PWA. All three W3C installability pillars (manifest, SW registration, offline caching) are absent; only HTTPS-grade hosting exists at the deployment layer. The closest artifacts are iOS/Apple meta tags and a Web Worker for filesystem access — neither contributes to PWA installability.

## Sources read
- https://raw.githubusercontent.com/logseq/logseq/master/public/index.html
- https://raw.githubusercontent.com/logseq/logseq/master/resources/index.html
- https://raw.githubusercontent.com/logseq/logseq/master/resources/mobile/index.html
- https://raw.githubusercontent.com/logseq/logseq/master/resources/js/worker.js
- https://raw.githubusercontent.com/logseq/logseq/master/statics/manifest.webmanifest (HTTP 404 — confirms absence)
- API: https://api.github.com/repos/logseq/logseq/git/trees/master?recursive=1 (repo file tree)
- API: https://api.github.com/search/code queries for `serviceWorker`, `navigator.serviceWorker.register`, `registerServiceWorker`, `workbox`, `sw.js`, `service-worker`
- https://docs.logseq.com/#/page/websites (hosting/HTTPS context)
