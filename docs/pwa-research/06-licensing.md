# T-06 — Licensing & Distribution Constraints (Logseq-Web → PWA)

Logseq is licensed **AGPL-3.0** (confirmed: repo `LICENSE.md` is the verbatim GNU Affero GPL v3). A PWA derived from it inherits AGPL obligations.

## 1. AGPL-3.0 core obligations

- **Copyleft**: You may use, modify, and distribute the work (and your derivative) freely, including commercially, but any conveyed work must remain under AGPL-3.0 with all copyright/license notices preserved. Any larger work that links/combines with AGPL code is generally "covered" (§13 explicitly allows combining with GPLv3 parts).
- **Corresponding Source** (§1): all source needed to build, install, and run, including build/install scripts — i.e. your PWA wrapper, config, and modifications, not just upstream.
- **§13 — "Network use is distribution"**: *"if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network … an opportunity to receive the Corresponding Source of your version … from a network server at no charge."* This is the key AGPL clause: merely **running** a modified version as a web/PWA service triggers the source-disclosure duty that ordinary GPL would not impose.

## 2. Hosting the PWA as a web service

If the PWA is reachable over a network, §13 applies whether you "distribute" a binary or not. You must **prominently offer** every remote user a link/button to download the complete corresponding source of the exact running version, at no charge, via standard means.

- **Private single-user deployment**: AGPL makes **no private-use exception for network services**. If anyone can reach the instance (even one other person, or a public URL used only by you), §13 is triggered — you must still offer source to those who interact with it. Truly internal use by *only* you on a non-networked machine is the only case §13 doesn't reach; any network interaction does.
- Required offer: complete source + **build instructions** (how to build/install the PWA) so users can run the same version.

## 3. App Store distribution

| Channel | AGPL permitted? | Notes / obligations |
|---|---|---|
| **Apple App Store** | Yes — Apple permits AGPL. | Guideline **4.1 Copycats** (c)/(b): cannot use another developer's "icon, brand, or product name" in your app name/icon without approval; impersonation risks removal. Capacitor/Tauri wrapping does **not** change AGPL duties — the app is still a modified/combined AGPL work, so §13 source offer (or equivalent) must be honored (e.g. in-app "Source" link). Historical tension: some AGPL apps hit review friction over obfuscation/minified bundles vs. readable source; ship readable source + build scripts. AGPL apps DO exist on the App Store. |
| **Google Play** | Yes — AGPL permitted. | Play **Impersonation** policy prohibits misleading users by impersonating someone else / using their brand. Same §13 source-offer obligation; keep a visible source link. No additional copyleft restriction from Play itself. |

Wrapping in Capacitor/Tauri bundles the AGPL JS/core into a native shell — this is conveying a covered work, so the full corresponding source (web code *and* wrapper) must be offered under AGPL-3.0.

## 4. Practical compliance path (no-credit-card, private-friendly)

- **Self-host the full corresponding source on a public git repo** (e.g. GitHub, free tier, no card). This satisfies §13's "network server" offer for any visitor of your PWA: put a prominent "Source code" link in the PWA UI pointing to the repo + a `README`/build instructions.
- Keep your **PWA wrapper under AGPL-3.0** (or compatible) so the combined work stays consistent; do not relicense Logseq code.
- For a single-user private deployment, a public repo still satisfies §13 even if only you use the instance — simplest, cheapest, fully compliant.
- Avoid obfuscating/minifying in a way that defeats "corresponding source"; ship readable source and the exact build command.

## 5. Trademark — can you call your fork "Logseq"?

- Logseq's `LICENSE.md` (AGPL-3.0) and `README.md`/`CONTRIBUTING.md` contain **no explicit trademark grant or trademark policy**; the name/logo are not licensed by the AGPL (a copyright license, not a trademark license).
- Therefore the "Logseq" **name and logo remain the project's trademarks**. Under Apple Guideline 4.1(c) and Google Play Impersonation, using "Logseq" as your app/package name or logo without permission is risky and could be rejected/removed as impersonation.
- **Recommendation**: rename your fork (e.g. "MyNotes PWA" / a distinct mark), keep attribution to Logseq in source/about, and do not reuse the Logseq logo. You may state it is "based on Logseq" factually, but not present it as Logseq.

## Sources read
- https://www.gnu.org/licenses/agpl-3.0.html (§13, Corresponding Source)
- https://choosealicense.com/licenses/agpl-3.0/ (network-use-is-distribution summary)
- https://raw.githubusercontent.com/logseq/logseq/master/LICENSE.md (AGPL-3.0)
- https://raw.githubusercontent.com/logseq/logseq/master/README.md
- https://raw.githubusercontent.com/logseq/logseq/master/CONTRIBUTING.md
- https://developer.apple.com/app-store/review/guidelines/ (§4.1 Copycats, §5.2 IP)
- https://play.google.com/about/developer-content-policy/ (Impersonation)
