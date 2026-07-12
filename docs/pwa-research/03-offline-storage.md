# T-03 — Offline Behavior & Storage Strategy for a Logseq Web PWA

## Summary of findings

The Logseq DB-graph web app does **not** use IndexedDB or in-browser DataScript for
graph persistence. Instead it runs **`@sqlite.org/sqlite-wasm`** inside a Web Worker
(`db-worker.js`) and persists the whole graph as a single SQLite file (`/db.sqlite`)
in the browser's **Origin Private File System (OPFS)** via the `OpfsSAHPoolDb` VFS.
localStorage is used only for small UI/settings EDN blobs (`frontend.storage`), never
for graph data. There is **no Service Worker and no web app manifest** in the repo
today, so the web build is not offline-capable as shipped.

## 1. Browser persistence today (where the DB graph lives)

- Graph lives in **OPFS**, not IndexedDB. `worker/platform/browser.cljs` calls
  `.installOpfsSAHPoolVfs` and opens `new (.-OpfsSAHPoolDb pool) path` with
  `repo-path = "/db.sqlite"`.
- The SQLite module is `@sqlite.org/sqlite-wasm` (pinned `3.51.2-build9` in
  `package.json`); `package.json` has **no** `idb`/`dexie`/`comlink` graph-store dep.
- A `MagicPortal` bridges OPFS handles (`window.pfs`/`window.fs`) into the worker.
- `frontend.storage` = localStorage only (EDN settings), not graph data.
- Confirmed no DataScript-in-IndexedDB path for DB graphs: persistence is the
  `PersistentDB` protocol (`persist_db/browser.cljs` `InBrowser` record) backed by
  sqlite-wasm/OPFS.

## 2. Graph load / save flow

- On load: `create-or-open-db` → `get-initial-data` opens the OPFS SQLite file and
  reads it into the in-memory DataScript DB.
- **Automatic local persistence:** sqlite-wasm writes through to OPFS synchronously
  on each transaction; periodic `wal-checkpoint` (`checkpoint-db!`). No manual "save"
  needed between sessions — reopen restores from `/db.sqlite` in OPFS.
- `ask-persist-permission!` calls `navigator.storage.persist()` at startup to request
  the "persistent" storage grant (avoids silent eviction).
- Export/Import: `<export-db` / `<import-db` serialize the OPFS `/db.sqlite` as a
  binary blob (`export-db-binary` / `import-db-binary`). This is the only
  user-visible backup path.

## 3. What a Service Worker must precache for offline

| Precache item | Why |
|---|---|
| App shell HTML + `js/db-worker.js` + `db-worker-bundle.js` | App + DB engine are required to boot offline |
| JS bundles, CSS, fonts, asset hashes (`/static/...`) | App shell |
| `@sqlite.org/sqlite-wasm` `.wasm` + VFS glue | sqlite-wasm must load offline |
| `/db.sqlite` in OPFS | **User graph data — NOT reachable by SW** (OPFS is opaque to fetch/Cache API) |

Caching strategy: **precache + stale-while-revalidate** for the shell/wasm; navigation
fallback to cached `index.html`. **Critical gap:** the SW Cache API cannot read/write
OPFS, so the *graph* is already offline-capable by virtue of OPFS but is invisible to
the SW. The SW only has to guarantee the *code engine* loads offline; OPFS holds data.

## 4. Quota & eviction risks

- OPFS counts against the **origin's storage quota** (`navigator.storage.estimate()`).
  Non-persistent origins can be evicted under storage pressure, especially on
  **Safari/iOS** where "Remove All Website Data" and low-disk pressure wipe OPFS.
- `navigator.storage.persist()` (already requested) grants best-effort protection but
  **can be denied** (notably iOS Safari), leaving OPFS evictable.
- iOS Safari is the weakest link: aggressive background tab suspension + opaque-origin
  limits; large graphs may hit per-origin caps. Single `/db.sqlite` grows with graph
  size — no sharding.
- No quota-exceeded handling/alerting is wired for OPFS writes today.

## 5. Recommendation for a standalone PWA storage layer

- **Keep the existing OPFS + sqlite-wasm backend** — it is already local-first and
  offline by design; do not reintroduce IndexedDB for the graph.
- **Add a Service Worker** purely to precache the app shell + `sqlite-wasm` `.wasm`
  so the engine boots with no network. Treat OPFS data as already-offline.
- **Guard against eviction:** ensure `navigator.storage.persist()` is prompted on
  first run (done), show a quota warning via `navigator.storage.estimate()`, and keep
  the binary **Export/Import** as the user backup escape hatch.
- Optionally surface an **idb/dexie** key-value store only for small settings/UI state
  (today in localStorage) — not for the graph. **File System Access API** is
  desktop-only and unnecessary; OPFS already covers the file-style need cross-browser.
- **No need** for a separate IndexedDB graph store; sqlite-wasm/OPFS supersedes it.

## Current state vs. needed

| Concern | Today | Needed for offline PWA |
|---|---|---|
| Graph store | OPFS + sqlite-wasm (offline-OK) | Keep as-is |
| App shell offline | None (no SW) | Precache shell + `.wasm` via SW |
| Manifest / installable | None | Add `manifest.webmanifest` + SW |
| Eviction protection | `storage.persist()` requested | Also add quota UI + export backup |
| Settings store | localStorage | Optional idb/dexie; not critical |

## Sources read

- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db/browser.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/persist_db/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/storage.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/db_core.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/db_worker.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/platform.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/worker/platform/browser.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/src/main/frontend/common/file/opfs.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/package.json
- https://raw.githubusercontent.com/logseq/logseq/master/shadow-cljs.edn
