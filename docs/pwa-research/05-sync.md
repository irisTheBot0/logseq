# T-05 — Sync & Multi-Device for a Standalone Logseq Web PWA

## 1. Official Logseq Sync
Logseq offers a **hosted, paid Sync** service. It runs on the same `deps/db-sync` engine that ships in the repo (Cloudflare Worker + D1). Characteristics:
- **Status:** Live, paid (part of Logseq's subscription). The in-repo server code is actively maintained (`deps/db-sync`, merged PR #12459 added a "Sync server URL" setting for custom/self-hosted servers).
- **Hosted/paid:** Yes — cloud-hosted by Logseq on Cloudflare; requires a paid plan.
- **E2E encryption:** Logseq markets Sync as end-to-end encrypted (clients encrypt before upload; server authenticates via AWS **Cognito** JWT bearer tokens, not decrypting). The protocol transmits tx *diffs*, gzipped snapshots, and uses checksum-based reconciliation. The server cannot read plaintext if E2E holds, but it does issue/validate auth tokens. Treat as "claimed E2E; auth mediated by Cognito."
- **Documented where:** `deps/db-sync/README.md` (engine), `logseq/logseq#12459` (custom server URL), and `logseq.com` pricing. The docs site (`docs.logseq.com`) is an SPA with no crawlable Sync page — details live in code/PRs.

## 2. Self-hostable Sync — Vetting
| Project | Org | Stars | Last commit | License | Official? | Verdict |
|---|---|---|---|---|---|---|
| `deps/db-sync` (node adapter) | logseq/logseq | (in repo) | 2026-07+ | AGPL-3.0 | **Official** | ✅ Active, canonical self-host target |
| `yshalsager/logseq-selfhost` | yshalsager | 57 | 2026-07-11 | AGPL-3.0 | Community (wraps official) | ✅ Active, legit — Docker images packaging `deps/db-sync` + web PWA |
| `charliie-dev/Logseq-Git-Sync-101` | charliie-dev | 1357 | 2026-06-10 | MIT | Community (git-based) | ✅ Popular for file-graph, **not DB-graph** |
| `pihalf/gitseq` | pihalf | 1 | 2026-07-02 | MIT | Community | ⚠️ Tiny, file-graph only |
| `kadaliao/logseq-github-auto-sync` | kadaliao | 0 | 2026-07-06 | None | Community | ⚠️ Abandoned/unknown, no license |
| `Logseq-Sync/.github` etc. | several | 0 | — | None | Unknown mirrors | ⚠️ **Flagged: abandoned/unknown, no license — do not use** |

**Note:** For the **DB-graph** Web PWA, only the `deps/db-sync` protocol (and `logseq-selfhost` wrapper) is relevant. Git-based tools target the legacy file-based graph and won't sync a DB graph.

## 3. How would a PWA sync across devices?
Options, in order of fit:
- **Official Sync API (custom server URL):** PR #12459 lets the client point at any `DB_SYNC_BASE_URL`. A PWA built from the `master` DB web app can authenticate against a self-hosted `deps/db-sync` node adapter → real-time multi-device sync over WebSocket/HTTP. This is the **intended** path.
- **Self-hosted server:** Run `deps/db-sync` node adapter (Cognito JWT auth, or swap auth) behind your own domain. `yshalsager/logseq-selfhost` ships Docker images doing exactly this.
- **Manual export/import:** DB graphs export to EDN/zip; clumsy for continuous multi-device use.
- **WebDAV / file sync (Syncthing, etc.):** Designed for file graphs, **not** DB graphs. A DB graph is a single SQLite/DataScript store — file-level sync risks corruption/conflicts. Not recommended.
- **CRDT (Yjs):** **Mismatch** — Logseq DB graphs use **DataScript** (a Datalog in-memory DB), and `deps/db-sync` syncs via an **append-only tx diff / operation-log** protocol with checksum reconciliation, not a CRDT. Yjs would require replacing the storage layer; there is no maintained Yjs adapter for Logseq. Avoid.

## 4. Comparison Table
| Sync option | Type | E2E encryption | Self-hostable | Effort | Maturity |
|---|---|---|---|---|---|
| Official Logseq Sync | Hosted cloud | Claimed E2E (Cognito auth) | No (paid SaaS) | Low | High (official) |
| `deps/db-sync` node adapter | Self-host server | Claimed E2E (client-encrypted tx) | **Yes** | Medium (Node/Cognito) | High (official engine) |
| `yshalsager/logseq-selfhost` | Self-host Docker | Same as above | **Yes** | Low–Med (compose) | Medium (community, active) |
| Git-based (Git-Sync-101) | File sync | Via git/age | Yes | Low–Med | High (file-graph only) |
| WebDAV/Syncthing | File sync | Transport-only | Yes | Low | Medium (file-graph only) |
| Yjs/CRDT | CRDT | n/a | Yes (theoretical) | **Very High** | **None (mismatch)** |
| Manual export | Manual | n/a | n/a | High (manual) | Low |

## 5. Recommendation (minimal, no credit card, private)
1. **Self-host `yshalsager/logseq-selfhost`** (Docker `logseq-selfhost-sync` + `logseq-selfhost-web`). It packages the official `deps/db-sync` and the DB web PWA in one AGPL-3.0 monorepo, actively maintained (pushed 2026-07-11), no payment required.
2. Run the **node adapter** on a small VM/VPS (or even a home server). The client PWA reads the "Sync server URL" setting (PR #12459) — point it at your instance.
3. For **auth without AWS Cognito**, review/replace the JWT issuer in `deps/db-sync` (community forks sometimes swap Cognito for a simpler token). This is the main setup hurdle; the data stays E2E-encrypted either way.
4. **Avoid** file-sync (WebDAV/Syncthing) and Yjs for DB graphs — wrong model, corruption risk.
5. If you cannot run a server at all, fall back to **manual EDN export** between devices (private but not live).

**Bottom line:** The cleanest no-credit-card, private setup is a self-hosted `deps/db-sync` instance (via `logseq-selfhost`) reached by the DB web PWA's custom-sync-URL feature — official engine, community packaging, E2E-encrypted tx, zero SaaS cost.

## Sources read
- https://github.com/logseq/logseq (repo metadata, AGPL-3.0, master/DB-graph)
- https://raw.githubusercontent.com/logseq/logseq/master/deps/db-sync/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/deps/db-sync/src/logseq/db_sync/worker/auth.cljs
- https://raw.githubusercontent.com/logseq/logseq/master/deps/db-sync/src/logseq/db_sync/worker/handler/sync.cljs
- https://github.com/logseq/logseq/pull/12459 (Custom Sync Server URL, merged 2026-04-13)
- https://raw.githubusercontent.com/yshalsager/logseq-selfhost/master/README.md
- https://raw.githubusercontent.com/yshalsager/logseq-selfhost/master/images/sync/README.md
- https://api.github.com/repos/yshalsager/logseq-selfhost (57★, AGPL-3.0, pushed 2026-07-11)
- GitHub search: `logseq sync`, `logseq server`, `logseq git sync` (repo metadata for vetting)
- https://docs.logseq.com/ and https://logseq.com/ (SPA shells; content in code/PRs)
