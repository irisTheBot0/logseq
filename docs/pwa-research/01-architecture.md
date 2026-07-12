# T-01 — Logseq Web Architecture on `master` (DB-graph) & Build Pipeline

Logseq `master` is the DB-graph rewrite: ClojureScript compiled by **shadow-cljs**, with **Gulp** handling static-asset bundling/CSS and desktop packaging (per CODEBASE_OVERVIEW.md). The in-memory graph is a **DataScript** DB whose durable backing store is **SQLite-WASM persisted in OPFS**, both living inside a dedicated Web Worker.

## 1. Tech stack reality (shadow-cljs.edn / gulpfile.js / package.json)

- Compiler: `shadow-cljs ^3.4.6` (deps in `package.json` devDeps). CSS via PostCSS/Tailwind; asset copy + webpack React globals via Gulp; `vite`/`webpack` also present for JS bundling.
- shadow-cljs `:builds` targets:

| Build | `:target` | Output | Purpose |
|-------|-----------|--------|---------|
| `:app` | `:browser` | `./static/js` | **The web/desktop frontend SPA** (`frontend.core/init`) |
| `:db-worker` | `:browser` (`:web-worker true`) | `./static/js` | DataScript+SQLite worker (`frontend.worker.db-worker/init`) |
| `:db-worker-node` | `:node-script` | `static/db-worker-node.js` | Node/CLI variant of the worker |
| `:mobile` | `:browser` | `./static/mobile/js` | Capacitor iOS/Android shell (`mobile.core/init`) |
| `:electron` | `:node-script` | `static/electron.js` | Electron main process |
| `:publishing` | `:browser` | `./static/js/publishing` | Static export/publish bundle |
| `:test`, `:test-no-worker`, `:gen-malli-kondo-config` | node | — | tests/tooling |

- Gulp tasks: `clean`, `build`/`buildMobile` (syncResourceFile, syncAssetFiles, buildCSS), `watch`, `electron`, `electronMaker(Unsigned)`, `cap`. Gulp copies `node_modules` assets incl. `sqlite3.wasm`, `lightning-fs`, pdfjs, and React globals into `static/js`.

## 2. Does master still produce a *web* build artifact?

- **Yes.** The `:app` browser build is the SPA and is still first-class: `pnpm release` = `gulp:build` → `cljs:release` (`release app db-worker db-worker-node publishing electron`) → `webpack-app-build`. Dev server `:dev-http {3001 ["static" "."]}` serves it directly.
- However there is **no dedicated "logseq.com web app" deploy target** in this repo — the browser `:app` bundle is consumed by Electron (desktop) and Capacitor (mobile), not published as a standalone hosted PWA. Only a release-time CDN asset-path exists: `:db-worker :release {:asset-path "https://asset.logseq.com/static/js"}`. So the *web artifact exists and runs in any browser from `static/`, but master ships no packaged hosted-web deployment.*

## 3. How the DB-graph web app loads/persists a graph

- **In-memory DB:** DataScript connection lives **inside the db-worker**, not the main thread (`*datascript-conns` in `frontend.worker.db-core`). The UI talks to it over **Comlink** RPC (`frontend.persist_db.browser`, `frontend.worker.db-worker`).
- **Persistence:** `frontend.worker.db-core/new-sqlite-storage` reifies DataScript's `IStorage` over a SQLite table `kvs(addr, content, addresses)` — DataScript nodes are transit-serialized rows. Backed by **`@sqlite.org/sqlite-wasm`** whose file (`/db.sqlite`) lives in an **OPFS pool** (`<get-opfs-pool`, `install-opfs-pool`, `frontend.common.file.opfs`). WAL checkpointing + export/import of the raw `.sqlite` file are supported.
- **Getting a graph into the browser:** create/open via worker (`create-or-open`/`open-db` in db-core); import of external graphs through `frontend.handler.db_based.import`. Data restored from SQLite `kvs` rows into DataScript on open. Electron uses `frontend.fs/node`; browser uses OPFS.

## 4. The separate worker asset — what & why

- `src/main/frontend/worker/` = the `:db-worker` build, a real Web Worker (`:web-worker true`, `importScripts('db-worker-bundle.js')`, `worker.js` bootstrap). React is **forbidden** in worker scope (explicit guard).
- Runs: SQLite-WASM engine, DataScript store/IStorage, outliner ops, search/vector index, RTC sync (`frontend.worker.sync`), migrations/validation, markdown mirror.
- Why: keep heavy DB/SQLite/sync work off the UI thread; `frontend.worker.shared_service` elects a master worker so multiple tabs share one DB connection (BroadcastChannel-based).

## 5. How to serve the web app today

- Dev: `pnpm watch` (or `pnpm dev`) runs `gulp:watch` + `clojure -M:cljs watch app db-worker …` + webpack; shadow-cljs `:dev-http` serves **`http://localhost:3001`** from the `static/` dir (mobile at `3002`).
- Static output dir: **`static/`** (JS in `static/js`, entry `resources/index.html` → `static/index.html`). Release: `pnpm release` populates `static/`; that directory is a servable static site (SPA + `db-worker.js` + `sqlite3.wasm`). No official standalone hosted-web pipeline is provided.

## Sources read
- https://raw.githubusercontent.com/logseq/logseq/master/shadow-cljs.edn
- https://raw.githubusercontent.com/logseq/logseq/master/package.json
- https://raw.githubusercontent.com/logseq/logseq/master/gulpfile.js
- https://raw.githubusercontent.com/logseq/logseq/master/CODEBASE_OVERVIEW.md
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/db_worker.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/db_core.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/shared_service.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db/browser.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/common/file/opfs.cljs
- https://api.github.com/repos/logseq/logseq/git/trees/master?recursive=1
