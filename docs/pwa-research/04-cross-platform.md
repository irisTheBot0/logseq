# T-04 — Cross-platform install & native bridges

How to make **Logseq Web** run natively across desktop + mobile. Options scored for a notes app that already ships `android/` (Capacitor) and Electron desktop builds.

## What a notes app actually needs from the platform
Local file/graph access, share-in (clipping URLs/text), local notifications/reminders, app lifecycle (background sync, backup), auth (WebAuthn), fullscreen/distraction-free mode, and durable storage that isn't evicted. The pure web platform covers part of this but unevenly:

| Web API | Desktop Chrome | Firefox | Safari (macOS) | iOS Safari | Notes for a notes app |
|---|---|---|---|---|---|
| File System Access | ✅ (Chrome/Edge) | ❌ | ❌ | ❌ | Direct folder access; desktop-Chrome-only. iOS has no equivalent. |
| Web Share / Share Target | ✅ | ⚠️ limited | ✅ | ✅ | Clipping from other apps; critical on mobile. |
| Notifications | ✅ | ✅ | ✅ | ✅ (16.4+) | Local reminders possible. |
| Web Push | ✅ | ✅ | ✅ (16.4+) | ✅ (16.4+) | Pre-16.4 iOS: no push at all. |
| Background Sync | ✅ | ❌ | ⚠️ | ❌ | Sync/backup can't run reliably on iOS. |
| WebAuthn | ✅ | ✅ | ✅ | ✅ | Passkeys for graph encryption/login. |
| Fullscreen | ✅ | ✅ | ✅ | ⚠️ (limited) | Distraction-free mode. |
| Persistent Storage | ✅ | ✅ | ✅ | ⚠️ | iOS can evict; see below. |

**iOS Safari PWA limits:** no Web Push before 16.4; service workers don't run in background (no true offline sync); pre-iOS 16 storage could be evicted after ~7 days of non-use (relaxed in 16); Settings-stored data is sandboxed per-app; add-to-homescreen is the only "install."

## Option comparison

| Option | Platforms | Native API access | App Store eligibility | Effort | Fit for notes PWA |
|---|---|---|---|---|---|
| **1. Pure browser PWA** | All (install via A2HS) | Web APIs only (see matrix) | No (web only; iOS no store path) | Low | Medium — zero native bridge; weak on iOS storage/background |
| **2. TWA / PWABuilder / Bubblewrap** | Android (Play Store) | Web APIs + Android TWA shell | ✅ Google Play only | Low | Medium — easiest Android store, but Android-only |
| **3. Capacitor** | Android + iOS (+ web) | Full native bridge via plugins | ✅ Play + App Store | Medium (Logseq already has it) | **High** — Logseq already ships `android/` + `ios/` Capacitor |
| **4. Tauri** | Win/Mac/Linux + iOS/Android (mobile beta) | Native via Rust; webview | ✅ all stores | High (rewrite shell) | Medium — great desktop, but duplicates Logseq's Electron/Capacitor |
| **5. Electron** | Win/Mac/Linux | Full (Node) | ✅ desktop stores | Low (Logseq already uses it) | Desktop-only — no mobile |

## Logseq's actual assets (verified in repo)
- `capacitor.config.ts` targets **both** `android` and `ios` (`appId: com.logseq.app`, `webDir: static/mobile`), with `@capacitor/app`, `filesystem`, `share`, `status-bar`, `splash-screen`, `keyboard`, `safe-area`, `clipboard`, `network`, `device`, `camera`, `dialog`, `haptics`, `action-sheet`, plus `@aparajita/capacitor-secure-storage`.
- `package.json` ships `@capacitor/android`/`@capacitor/ios` ^8, Vite, and release scripts `sync-android-release`, `sync-ios-release`, `android:dev`, `ios:dev`. So Capacitor iOS/Android builds are real and maintained.
- Desktop is Electron (`release-electron`, `dev-electron-app`).

## Plugins a notes app needs (Capacitor already provides most)
Filesystem (graph files), App (lifecycle/back-button), Share (clip web content), LocalNotifications/secure-storage (reminders/encryption), Network (sync status), and ideally a background-runner for sync — Capacitor community plugins cover these; a small native module can fill gaps (e.g. periodic backup).

## Recommendation
**Keep the existing split — do not add Tauri or rewrite Electron:**
- **Desktop (Win/Mac/Linux):** keep **Electron** (already shipping, full native access). Optionally evaluate Tauri later as a slim alternative, but it's beta-mobile and redundant now.
- **Mobile (Android + iOS):** extend the **existing Capacitor** app. It already wraps `static/mobile` for both stores — this is the lowest-friction true-cross-platform path and reuses Logseq's current code, CI scripts, and plugin set.
- **Web/PWA tier:** ship the **pure browser PWA** (manifest + SW) for zero-install use and as the source artifact Capacitor wraps; accept iOS storage/background limits, and use Capacitor-native fallbacks where the web API is missing.
- **Avoid TWA/PWABuilder** as the primary mobile path — Capacitor already gives store eligibility *and* native bridges for less effort. Use PWABuilder only if a separate lightweight Android-only listing is wanted.

**Net:** Electron (desktop) + Capacitor (mobile) + browser PWA (web) = full Win/Mac/Linux/Android/iOS coverage with the least new code, because Logseq already owns all three.

## Sources read
- https://raw.githubusercontent.com/logseq/logseq/master/capacitor.config.ts
- https://raw.githubusercontent.com/logseq/logseq/master/package.json
- https://api.github.com/repos/logseq/logseq/contents/android
- https://api.github.com/repos/logseq/logseq/contents/ios
- https://v2.tauri.app/start/ (Tauri platforms, bundle size, mobile beta)
- https://developer.chrome.com/docs/android/trusted-web-activity/overview (TWA/Bubblewrap, Chrome 72+, Play Store)
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Installable_PWAs (install/iOS/Safari, store packaging)
