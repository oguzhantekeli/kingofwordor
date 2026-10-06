# King of Wordor — Implementation Plan (from scratch)

**Date:** 2026-09-30 · **Companion to:** `MARKET_AND_TECHNICAL_AUDIT.md` (v3)
**Scope:** greenfield mobile app. The existing CRA codebase is ignored entirely, per your instruction.
**Method:** every version, constraint and measurement below was verified by running a command on this machine today. The stack was **actually scaffolded, installed, built and given an Android platform** before being recommended. Commands and verbatim outputs are inline.
**Honesty note:** §13 lists exactly what I could *not* verify locally and why.
**Revision:** v4 (2026-10-06) — **Phases 0–2 built; Phase 3 backend built and tested locally, not yet deployed.** The 2026-10-06 work (battlefield, retention systems, backend, every screen) is documented in `INVENTORY.md`; §16–§17 below are rewritten to match. v3 (2026-10-01): Phases 0 and 1 built and verified. See §15 for exactly what exists, §16 for what is left, and §17 for your action items. v2 locked your answers of 2026-09-30: web deferred, TypeScript confirmed, **assets produced by me** (§5, capability proven), no ad/store accounts yet (§6, lead times verified), **accounts required with Google Sign-In** (§4.4, integration path verified).

---

## 1. THE STACK

Every version below is what `npm` actually resolved during a real install today, not a recommendation from memory.

| Layer | Choice | Version (installed) | Why this one |
|---|---|---|---|
| **Build** | Vite | `8.3.1` | Replaces the dead CRA. 158 ms production build (§3.4). |
| **UI** | React + React DOM | `19.3.0` | Current major. CRA pinned you two majors back. |
| **Language** | TypeScript | `6.0.3` | The scoring formula, dictionary binary layout and rule engine are exactly the code where type errors are expensive. |
| **Lint** | oxlint | `1.86.0` | Ships in the official Vite template now; Rust-based, no config needed to start. |
| **State** | Zustand | `5.0.15` | The audited app's whole-context-object re-render problem (`GlobalStateContext.js:161`) is structural in Context. Zustand subscribes per-slice. ~1 KB. |
| **Native shell** | Capacitor | `8.5.2` | Only path to Play with `targetSdk 36` from your web codebase. Verified: generates 36 out of the box (§3.5). |
| **Ads** | `@capacitor-community/admob` | `8.1.0` | Includes UMP `4.0.0` for GDPR consent — mandatory in the EU. |
| **IAP** | `@capgo/native-purchases` | `8.8.1` | **Compiles against Play Billing `9.1.0`** (§2.3) — meets Google's "Billing Library 8+" rule. MPL-2.0, no SaaS fee. |
| **Backend** | `@supabase/supabase-js` | `2.117.2` | $25/mo Pro, verified in the audit. Postgres + Auth + Edge Functions. |
| **Auth** | `@capgo/capacitor-social-login` | `8.5.11` | Native Google Sign-In returning an `idToken` that feeds Supabase directly (§4.4). The commonly-recommended `@codetrix-studio/capacitor-google-auth` is **stale** — last published 2024-05-01, peer `@capacitor/core ^6.0.0`. |
| **i18n** | i18next + react-i18next | `26.4.2` / `17.0.15` | Needed from day one — retrofitting i18n is the expensive way (audited app has 0 infrastructure, 16+ hard-coded strings). |
| **Tests** | Vitest + Testing Library | `5.0.3` / `16.3.3` | Same API as the 12 audit tests that caught all six live defects. |
| **Audio** | Web Audio API (no library) | — | `HTMLAudioElement` cannot overlap with itself; that is the exact bug in the audited app (`useSoundEffects.js:51-53`). |

Official Capacitor plugins, all on v8, all published within the last 8 months:

```
@capacitor/app@8.1.1   @capacitor/haptics@8.0.2   @capacitor/keyboard@8.0.5
@capacitor/preferences@8.0.1   @capacitor/share@8.0.2
@capacitor/splash-screen@8.0.2   @capacitor/status-bar@8.0.3
```

### 1.1 Deliberate exclusions

- **No web/PWA build at launch.** Deferred per your answer. Vite still emits a deployable `dist/`, so adding a manifest + service worker later is additive, not a rewrite. This removes PWA work from Phase 0.
- **No Firebase Auth** (`@capacitor-firebase/authentication@8.5.2` is well-maintained) — it would bolt a second backend SDK alongside Supabase for a job Supabase already does.
- **No Play Games Services sign-in.** It is the "gamey" option, but plugin support is immature (`capacitor-play-games-services` last published 2023-07-04; `@modbender/capacitor-play-games` is `0.5.0`), it is Android-only, and it would still need a bridge to Supabase identity. Revisit post-launch for achievements.
- **No CSS framework.** The medieval theme is bespoke; Tailwind or MUI would be fought, not used.
- **No Redux.** Zustand covers this scale.
- **No RevenueCat** (`@revenuecat/purchases-capacitor@13.6.1` is well-maintained and MIT) — it is a SaaS with a fee above its free tier, and `@capgo/native-purchases` talks to Play Billing 9.1.0 directly for free. Revisit only if iOS + Android receipt reconciliation becomes painful.
- **No Firebase.** Leaderboards are read-heavy; per-operation billing is the wrong shape (audit §10).

---

## 2. VERIFIED CONSTRAINTS

### 2.1 Runtime floors — your current machine does not meet them

```
$ npm view @capacitor/cli engines --json
{"node":">=22.0.0"}
$ npm view vite engines --json
{"node":"^20.19.0||>=22.12.0"}
$ npm view vitest engines --json
{"node":"^22.12.0||^24.0.0||>=26.0.0"}
$ node -v
v20.20.2
```

**Node 20.20.2 fails both Capacitor CLI (needs ≥22) and Vitest (needs ≥22.12).** Node 24.18.1 is already installed via nvm and was used for all proofs below:

```
$ nvm ls
       v16.20.2      v20.12.0    ->  v20.20.2
       v22.22.0      v23.11.0        v24.18.1
default -> 22.22.0
```

**Action: pin `24.18.1` in `.nvmrc` and in CI.** Note this is the opposite mistake from the audited app, which declared `"node": ">=24"` while building on 20.

### 2.2 Android toolchain — what Capacitor 8 generates

```
$ cat android/variables.gradle
ext {
    minSdkVersion = 24
    compileSdkVersion = 36
    targetSdkVersion = 36
    androidxActivityVersion = '1.11.0'
    ...
}
$ grep distributionUrl android/gradle/wrapper/gradle-wrapper.properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-all.zip
$ grep "com.android.tools.build" android/build.gradle
        classpath 'com.android.tools.build:gradle:8.13.0'
```

**`targetSdkVersion = 36` with zero configuration** — this is exactly what Google Play now requires ("New apps and app updates must target Android 16 (API level 36) or higher", effective 2026-08-31, already past). `minSdk 24` = Android 7.0, covering effectively the whole active install base.

Java version comes from the AdMob plugin, which is stricter than the shell:

```
$ tar xzf admob.tgz -O package/android/build.gradle | grep -E "JavaVersion|compileSdk|minSdk|targetSdk|kotlin_version"
    ext.kotlin_version = ... : '2.2.20'
    compileSdk = ... : 36
        minSdkVersion ... : 24
        targetSdkVersion ... : 36
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
        jvmTarget = JavaVersion.VERSION_21
```

**Required: JDK 21.** Not present on this machine:

```
$ java -version
zsh: command not found: java
$ echo "ANDROID_HOME=${ANDROID_HOME:-unset}"
ANDROID_HOME=unset
```

### 2.3 In-app purchases meet Google's billing rule

```
$ npm view @capgo/native-purchases --json | node -e "...print name/version/license/peerDeps..."
  @capgo/native-purchases
     version=8.8.1  published=2026-09-22  license=MPL-2.0
     peerDeps={"@capacitor/core":">=8.0.0"}

$ tar xzf pkg.tgz -O package/android/build.gradle | grep -iE "billing"
    def billing_version = "9.1.0"
    implementation "com.android.billingclient:billing:$billing_version"
```

Play Billing **9.1.0** — current, and above Google's mandatory minimum of 8.

### 2.4 Ads plugin includes the consent SDK

```
$ tar xzf admob.tgz -O package/android/build.gradle | grep -E "playServicesAds|userMessaging"
    playServicesAdsVersion = ... : '25.4.+'
    userMessagingPlatformVersion = ... : '4.0.0'
```

UMP 4.0.0 is the Google consent framework. **Do not skip it** — serving personalised ads in the EEA/UK without a CMP is a policy violation, not just a best practice.

---

## 3. PROOF THE STACK WORKS — end to end, today

Not a recommendation. This was actually run.

### 3.1 Scaffold

```
$ nvm use 24.18.1 && node -v && npm -v
v24.18.1
11.16.0
$ npm create vite@latest kow -- --template react-ts --yes
$ cat kow/package.json
{
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "lint": "oxlint", "preview": "vite preview" },
  "dependencies": { "react": "^19.2.8", "react-dom": "^19.2.8" },
  "devDependencies": {
    "@types/node": "^24.13.3", "@vitejs/plugin-react": "^6.1.1",
    "oxlint": "^1.81.0", "typescript": "~6.0.2", "vite": "^8.3.0"
  }
}
```

### 3.2 Install the full production stack

```
$ npm i zustand i18next react-i18next @supabase/supabase-js
$ npm i -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
$ npm i @capacitor/core @capacitor/app @capacitor/haptics @capacitor/preferences \
        @capacitor/keyboard @capacitor/status-bar @capacitor/splash-screen @capacitor/share
$ npm i -D @capacitor/cli @capacitor/android
$ npm i @capacitor-community/admob @capgo/native-purchases

$ npm ls --depth=0
kow@0.0.0 /tmp/claude-1000/stacktest/kow
├── @capacitor-community/admob@8.1.0      ├── @supabase/supabase-js@2.117.2
├── @capacitor/android@8.5.2              ├── @testing-library/jest-dom@7.0.1
├── @capacitor/app@8.1.1                  ├── @testing-library/react@16.3.3
├── @capacitor/cli@8.5.2                  ├── @testing-library/user-event@14.6.7
├── @capacitor/core@8.5.2                 ├── @vitejs/plugin-react@6.1.1
├── @capacitor/haptics@8.0.2              ├── @vitest/coverage-v8@5.0.3
├── @capacitor/keyboard@8.0.5             ├── i18next@26.4.2
├── @capacitor/preferences@8.0.1          ├── jsdom@30.1.1
├── @capacitor/share@8.0.2                ├── oxlint@1.86.0
├── @capacitor/splash-screen@8.0.2        ├── react@19.3.0
├── @capacitor/status-bar@8.0.3           ├── react-dom@19.3.0
├── @capgo/native-purchases@8.8.1         ├── react-i18next@17.0.15
                                          ├── typescript@6.0.3
                                          ├── vite@8.3.1
                                          ├── vitest@5.0.3
                                          └── zustand@5.0.15
```

**Zero peer-dependency conflicts. No `--legacy-peer-deps`, no `--force`.**

### 3.3 Security — the headline comparison

```
$ npm audit --omit=dev
found 0 vulnerabilities

$ npm audit
3 moderate severity vulnerabilities
$ npm audit --json | node summarise.js
  moderate  @capacitor/cli  8.5.0 - 9.0.0-alpha.7  ["xcode"]
  moderate  uuid            <11.1.1                ["uuid: Missing buffer bounds check in v3/v5/v6"]
  moderate  xcode           >=0.9.2                ["uuid"]
```

| | Current CRA app | New stack |
|---|---|---|
| Production vulnerabilities | **58** (2 critical, 30 high) | **0** |
| Dev-only | included in the 58 | 3 moderate |

The three remaining trace to `@capacitor/cli → xcode → uuid` — **iOS tooling only**, never shipped to a device, and irrelevant until you do the iOS port.

### 3.4 Production build

```
$ npm run build
✓ 20 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-D64VDMd1.css    4.10 kB │ gzip:  1.47 kB
dist/assets/index-BRDr3nmD.js   222.52 kB │ gzip: 69.27 kB
✓ built in 158ms

$ for f in dist/assets/*.{js,css}; do ...raw/gzip/brotli...; done
  dist/assets/index-BRDr3nmD.js    raw= 222523  gzip= 68370  brotli= 58992
  dist/assets/index-D64VDMd1.css   raw=   4105  gzip=  1489  brotli=  1258
```

**158 ms**, and that 69 kB gzip is the *empty template* with React 19 — roughly the same as the audited app's 56 kB for a whole game, i.e. the framework baseline, before tree-shaking your real code.

### 3.5 Android platform

```
$ npx cap init "King of Wordor" com.kingofwordor.game --web-dir dist
[success] capacitor.config.ts created!
$ npx cap add android
       @capacitor/splash-screen@8.0.2
       @capacitor/status-bar@8.0.3
       @capgo/native-purchases@8.8.1
✔ update android in 57.51ms
✔ Syncing Gradle in 348.76μs
[success] android platform added!

$ grep -E "namespace|applicationId|versionCode" android/app/build.gradle
    namespace = "com.kingofwordor.game"
        applicationId "com.kingofwordor.game"
        versionCode 1
```

All plugins auto-linked into the Gradle project.

---

## 4. THE DICTIONARY ENGINE — built and benchmarked, not theorised

This is the single highest-risk piece (the audited app's only real failure was outsourcing it), so it was built for real.

### 4.1 Binary format

One file, `en.kowd`. Header, then three parallel sections indexed by the same word ordinal:

```
offset 0   : "KOWD" magic + u32 version + u32 wordCount + u32 textLength   (16 bytes)
offset 16  : tier nibbles      — 4 bits per word  (SCOWL 10/20/35/40/50/55/60/70)
           : category masks    — u16 per word     (10 WordNet categories as bit flags)
           : word text         — newline-joined, sorted, UTF-8
```

### 4.2 Build it

```
$ node build_dict.mjs
words        : 110248
packed blob  : 1345134 bytes (1314 KB)
brotli       : 311416 bytes (304 KB)  <- what the device downloads
categorised  : 21372 words

$ ls -l dictout/
-rw-r--r-- 1 ramo ramo 1345134 Sep 30 23:20 en.kowd
-rw-r--r-- 1 ramo ramo  311416 Sep 30 23:20 en.kowd.br
```

### 4.3 Runtime benchmark — load, memory, correctness, speed

```
$ node bench_dict.mjs
magic         : KOWD | words in header: 110248 | parsed: 110248 ✓ match
read+header   : 0.8 ms
utf8 + split  : 13.3 ms
Map index     : 16.5 ms
TOTAL to ready: 30.5 ms
heap used     : 8.9 MB

lookup round-trip:
  sword     {"tier":20,"cats":["object"]}
  castle    {"tier":20,"cats":["object"]}
  knight    {"tier":20,"cats":["person","object"]}
  dragon    {"tier":20,"cats":["animal","person"]}
  email     {"tier":35,"cats":["communication"]}
  selfie    {"tier":50,"cats":[]}
  emoji     {"tier":50,"cats":[]}
  zyzzyva   null
  asdfgh    null

1,000,000 lookups: 67.3 ms  (0.067 µs each), hits=1000000
```

Every design claim in the audit is now demonstrated:

- **30.5 ms** from raw bytes to a fully queryable dictionary — one frame and a half, once, at boot.
- **8.9 MB** heap. Trivial for any device running Android 7+.
- **0.067 µs** per lookup, versus the audited app's **19.8 s** network call.
- Metadata round-trips: `knight` → tier 20, `["person","object"]`; `dragon` → `["animal","person"]`. **The scoring formula and category hints both work off this one file.**
- `zyzzyva` is correctly **absent** — it is SCOWL tier 80, above the cutoff. This validates the tier-70 choice: obscure Scrabble-bait is excluded while `email`/`selfie`/`emoji` are in.

### 4.4 Shipping decision — no JS decompression needed

```
$ node -e "brotliDecompressSync(304KB) ..."
brotli decompress 304 KB -> 1314 KB : 7.8 ms
```

You do not need to pay even that 7.8 ms:

- **In the Capacitor app**, `en.kowd` is a local bundled asset. 1.3 MB inside an APK is nothing (competitors install at 94–471 MB). Ship it raw.
- **On the web**, serve `en.kowd` with `Content-Encoding: br`. The browser decompresses natively; JS cost is zero and the wire cost is 304 KB.

### 4.5 Licence obligations — one screen, no fees

All sources are free for commercial use, verified in the audit. The only obligation is attribution:

- **SCOWL** (Kevin Atkinson) — "provided that the above copyright notice appears in all copies"
- **WordNet 3.0** (Princeton) — "provided that you agree to comply with the following copyright notice"

**Build an in-app Credits screen in Phase 1, not later.** Both notices go there verbatim. Total licence cost: $0.

### 4.6 Authentication — accounts required, Google Sign-In (verified path)

Your answer: accounts required, Google Play linked "or whatever the correct initial easy way is". The correct easy way is **Supabase Auth + native Google Sign-In**, not Play Games Services.

The integration hinges on one method, confirmed present in the installed SDK:

```
$ grep -n "signInWithIdToken" node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts
1038:    signInWithIdToken(credentials: SignInWithIdTokenCredentials): Promise<AuthTokenResponse>;

$ grep -A6 "SignInWithIdTokenCredentials = {" node_modules/@supabase/auth-js/dist/module/lib/types.d.ts
export type SignInWithIdTokenCredentials = {
    /** Provider name or OIDC `iss` value ... Supported names: `google`, `apple`, `azure`, `facebook`, `kakao`. */
    provider: 'google' | 'apple' | 'azure' | 'facebook' | 'kakao' | `custom:${string}` | (string & {});
    /** OIDC ID token issued by the specified provider. */
    token: string;
```

And the plugin produces exactly that token:

```
$ tar xzf social.tgz -O package/dist/esm/social-login.d.ts | grep -n "idToken"
47:        idToken?: string;
$ tar xzf social.tgz -O package/dist/esm/definitions.d.ts | grep -n "idToken"
450:         * - `idToken`: JWT containing user identity information (email, name, user ID)
```

Flow: native Google sheet → `idToken` → `supabase.auth.signInWithIdToken({ provider: 'google', token })` → Supabase session → leaderboard writes are authenticated server-side. No browser redirect, no Firebase, no second identity store.

Verified that adding it does not disturb the rest of the stack:

```
$ npm install @capgo/capacitor-social-login
├── @capgo/capacitor-social-login@8.5.11
├── @supabase/supabase-js@2.117.2
$ npm run build
✓ built in 133ms
$ npm audit --omit=dev
found 0 vulnerabilities
$ npx cap sync android
✔ update android in 62.14ms
[info] Sync finished in 0.159s
```

**Still zero production vulnerabilities with auth, ads and IAP all installed.**

One product note: requiring an account before the first round costs conversion. Recommended compromise — **let the first round be played signed-out, then require sign-in to submit to the leaderboard.** The player has already experienced the game at the moment you ask.

---

## 5. ASSET PRODUCTION — I make them, and here is the proof I can

You answered "You" to who produces art and audio. Before promising that, I verified what this machine can actually do. The local toolchain is bare:

```
$ for t in ffmpeg opusenc sox lame convert magick inkscape; do ...; done
  ffmpeg     absent      sox        absent      convert    absent
  opusenc    absent      lame       absent      magick     absent
  inkscape   absent
```

But the npm route works, and I proved it end to end.

### 5.1 Audio — synthesise, then encode to Opus

```
$ npm install ffmpeg-static
$ ./node_modules/ffmpeg-static/ffmpeg -version | head -1
ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/
$ ./node_modules/ffmpeg-static/ffmpeg -encoders | grep -iE "libopus|\baac\b"
 A....D aac                  AAC (Advanced Audio Coding)
 A....D libopus              libopus Opus (codec opus)
```

A real sword-hit effect, synthesised with numpy (noise burst + decaying envelope + downward sweep) and encoded:

```
$ python3 synth_sword.py
  synthesised sword.wav: 8640 samples, 0.18 s
$ ffmpeg -i sword.wav -c:a libopus -b:a 64k -ac 1 sword.opus
$ ls -l sword.wav sword.opus
    sword.opus         1914 bytes
    sword.wav         17324 bytes
$ ffmpeg -i sword.opus 2>&1 | grep -E "Duration|Stream"
      Duration: 00:00:00.19, start: 0.000000, bitrate: 82 kb/s
      Stream #0:0: Audio: opus, 48000 Hz, mono, fltp
```

**1,914 bytes for a usable sword hit.** The current app's `sword.flac` is 54,698 bytes — a 96% reduction, and the whole four-effect set lands near 8–10 KB rather than 1.24 MB.

### 5.2 Visuals — hand-authored SVG, rasterised where needed

The parallax battlefield, UI frames, banners and icons are **hand-written SVG** — which is what Phase 2 wants anyway (scalable, tiny, GPU-cheap, no GIFs). For the places Android needs raster (launcher icons, splash, store listing), SVG→PNG is proven:

```
$ npm install @resvg/resvg-js
$ node -e "const {Resvg}=require('@resvg/resvg-js'); ... render 64x64 ... "
  resvg-js     rendered SVG -> PNG, 790 bytes
$ file test-icon.png
test-icon.png: PNG image data, 64 x 64, 8-bit/color RGBA, non-interlaced
```

(`sharp@0.35.5` installed but threw on `require` in this environment — resvg covers rasterisation, so it is not needed.)

### 5.3 What I will deliver, and what I will not

**Will deliver:** the full SVG theme system (parallax battlefield layers, parchment/banner frames, buttons, the on-screen keyboard, iconography), all UI animation as CSS/SVG, the complete SFX set synthesised and Opus-encoded, launcher icons and splash at every required density, and a deterministic `tools/build-assets.mjs` so every asset regenerates from source in CI.

**Will not deliver:** photoreal or painterly illustration, licensed music, or voice. The style will be **geometric/heraldic vector** — flat medieval shapes, limited palette, strong silhouettes. That is a genuine aesthetic and it suits a word game, but it is not the painted-fantasy look of a AAA store listing. If you want that later, commission a marketing artist for store screenshots only; the in-game art can stay vector.

**One thing I cannot judge from here:** whether the look is *right*. I will build one screen fully themed in Phase 2 as a vertical slice, and you approve or redirect before I do the other five.

---

## 6. ACCOUNTS — status and lead times

Verified lead times. These are not engineering tasks, and they gate Phase 4.

| Account | Cost | Lead time (verified) | Start by |
|---|---|---|---|
| **Google Play Console** (personal) | **$25** one-time | ✅ **created 2026-10-01, awaiting verification.** Production access still needs **12 testers × 14 continuous days + up to 7 days review** | **now** |
| **AdMob** | Free | "The verification process typically takes up to 24 hours, but in rare cases, can take up to 2 weeks" | Phase 3 |
| **Supabase** | $25/mo | Immediate | Phase 3 |
| Google Cloud OAuth client | Free | Immediate | Phase 3 (needed for Sign-In) |

From Google's AdMob documentation, the prerequisites are a verified Google Account, residency in an eligible country, and payment details — "your name, account type (individual or organization), and your payment address" — entered before the account can be "approved to serve ads".

**Sequencing that matters:** the Play account is created and verifying. The 12 testers are now the single longest lead time left — recruit them while the remaining code is written. The testers are the longest lead time in the entire project and cost nothing to line up early. AdMob's rare-case two weeks is the second-longest; start it at Phase 3, not Phase 4.

---

## 7. ARCHITECTURE

```
┌─ presentation ──────────────────────────────────────────────┐
│  React 19 components · i18next · CSS modules                │
│  Screens: Welcome → Countdown → Round → Results → Credits   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Zustand slices (per-slice subscriptions)
┌──────────────────────┴──────────────────────────────────────┐
│  game core — PURE TYPESCRIPT, NO REACT, 100% UNIT TESTED    │
│  · rules.ts      prompt generation + difficulty bands       │
│  · scoring.ts    base × rarity × tier × category            │
│  · round.ts      round state machine, dedupe, timer clock   │
│  · dictionary.ts en.kowd loader, lookup, tier, categories   │
└──────────────────────┬──────────────────────────────────────┘
                       │ platform adapters (interfaces, swappable)
┌──────────────────────┴──────────────────────────────────────┐
│  audio(WebAudio) · storage(Preferences) · ads(AdMob)        │
│  iap(native-purchases) · haptics · net(Supabase)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│  Supabase — auth, SERVER-AUTHORITATIVE scoring, leaderboards│
└─────────────────────────────────────────────────────────────┘
```

**The rule that prevents every defect found in the audit:** the game core is pure TypeScript with no React import and no platform import. It is fully testable without a DOM. Every audited defect — case sensitivity, duplicate scoring, the stale-closure multiplier, dead validation branches — lived in code tangled with React state. Untangled, they are unit-testable in milliseconds.

### 7.1 Timer

Do **not** chain `setTimeout` (the audited app's approach — measured 0.23% drift, and browsers throttle background tabs hard). Store `roundEndsAt = performance.now() + duration`, derive remaining time in a `requestAnimationFrame` loop, and reconcile against `Date.now()` on `visibilitychange`. The server re-derives duration from its own timestamps anyway (§7.2), so client drift can never affect a leaderboard.

### 7.2 Anti-cheat — non-negotiable before any leaderboard

The client is an input device, never an authority:

1. Client requests a round → server returns `{ roundId, seed, signedToken, startedAt }`.
2. Client derives prompts **from the seed** (same deterministic generator both sides).
3. Client submits `{ roundId, token, words[], clientTimestamps[] }`.
4. Server regenerates the prompts from the seed, re-validates every word against its own copy of the dictionary, **recomputes the score**, and rejects impossible submission rates.
5. Only the server-computed score reaches the leaderboard.

This also means the scoring weights live server-side and are **tunable without an app update** — which matters because §5.5 of the audit gives starting weights, not final ones.

### 7.3 Project structure

```
src/
  core/           rules.ts scoring.ts round.ts dictionary.ts types.ts   ← pure, no React
  core/__tests__/ one spec per core module
  store/          gameStore.ts settingsStore.ts
  platform/       audio.ts storage.ts ads.ts iap.ts haptics.ts net.ts
  ui/             screens/ components/ theme/
  i18n/           en.json  (es.json fr.json it.json nl.json … later)
public/dict/      en.kowd
tools/            build-dict.mjs   ← SCOWL + WordNet → en.kowd, runs in CI
```

---

## 8. DELIVERY PHASES

Acceptance criteria are written so each one is checkable by a command, not by opinion.

### Phase 0 — foundation (1–2 days)

1. `nvm use 24.18.1`, commit `.nvmrc`. Scaffold Vite + React 19 + TS exactly as §3.1–3.2.
2. `tools/build-dict.mjs` producing `en.kowd`; commit the tool, generate the artifact in CI.
3. Vitest + Testing Library configured; oxlint in CI.
4. GitHub Actions: lint → typecheck → test → build → `npm audit --omit=dev`. **Add an Android CI job now** (JDK 21 + SDK 36 + `assembleDebug`) so the one unverified item in §13 is closed on day one rather than in Phase 4.
5. `tools/build-assets.mjs` skeleton (`ffmpeg-static` + `@resvg/resvg-js`) so assets are generated, not committed as binaries.

No PWA manifest or service worker — web is deferred (§1.1).

**Done when:** `npm run build` succeeds, `npm audit --omit=dev` reports 0, `en.kowd` regenerates byte-identically, and an Android debug APK builds in CI.

### Phase 1 — the game, offline, fully tested (1.5–2 weeks)

5. `core/dictionary.ts` — load `en.kowd`, expose `has()`, `tierOf()`, `categoriesOf()`. Target: ready in <50 ms (measured 30.5 ms).
6. `core/rules.ts` — difficulty bands from audit §5. **Exclude `ends with j/q/v` and `starts with x`** (0, 0, 1 and 10 everyday words). Prompts derive from a seed.
7. `core/scoring.ts` — `base(length) × rarity × tier × category`, no platform factor (audit §5.5).
8. `core/round.ts` — 60 s default; case-insensitive; duplicate rejection; deadline-based clock.
9. Category hints (audit §6) — **bonus scoring, never a hard filter** (only 19% of the dictionary is tagged).
10. Web Audio with a decoded, pooled buffer. Four Opus effects, ~60 KB total.
11. i18next wired with `en.json`. **Zero hard-coded UI strings** — enforce with a lint rule.
12. Credits screen with the SCOWL and WordNet notices.
13. **Register the Play Console account ($25) and start recruiting the 12 testers.** Not an engineering task, but it is the critical path (§6) and it starts here, not in Phase 4.
14. Measure dictionary load on a real low-end Android device (§13.4).

**Done when:** core is ≥90% covered; the game is playable start to finish with the network disabled; a test asserts that no excluded prompt can be generated in 100,000 draws; the Play account exists and tester recruitment has begun.

### Phase 2 — the medieval identity (1–2 weeks, parallel) — assets by me

15. **Vertical slice first:** one screen fully themed, for your approval, before the other five. The style is geometric/heraldic vector (§5.3) and you should see it before I commit to it everywhere.
16. Design tokens actually imported (the audited app's were not).
17. SVG parallax battlefield for "warriors in the distance" — no GIFs.
18. Full SFX set: synthesised, Opus-encoded, ~8–10 KB total (§5.1).
19. Launcher icons and splash at all densities via `@resvg/resvg-js` (§5.2).
20. Real dark mode.
21. Accessibility: real `<button>` elements, correct tab order, no `user-scalable=no`.
22. **CI asset-integrity check**: every asset must pass a `file` type check, a minimum size, and be referenced somewhere. This is what would have caught 12 S3 error pages committed as `.jpg`.

**Done when:** you have approved the vertical slice; every asset regenerates from source via `tools/build-assets.mjs`; the asset check fails the build if a placeholder or error page is committed.

### Phase 3 — backend and identity (1 week, parallel with 2)

23. Supabase Pro. Schema: `profiles`, `rounds`, `scores`, four leaderboard views. Row-level security on every table.
24. Edge Function for server-authoritative scoring (§7.2), sharing the seed generator and dictionary with the client.
25. **Google Sign-In via `@capgo/capacitor-social-login` → `signInWithIdToken` (§4.6).** Accounts are required to post a score; the first round is playable signed-out so the ask lands after the player has seen the game.
26. Google Cloud OAuth client + **create the AdMob account now** — its verification is "typically up to 24 hours, but in rare cases, can take up to 2 weeks" (§6).
27. **Record input method on every round without scoring on it** (audit §7).

**Done when:** a forged client score is rejected by an integration test, and a real Google account can sign in and appear on a leaderboard.

### Phase 4 — ship to Play (2–4 weeks, gated by testers)

28. `npx cap add android`; verify `targetSdkVersion = 36`.
29. AdMob + UMP consent. Interstitial **only after the results screen**, ~1 in 3 rounds; rewarded video primary.
30. `@capgo/native-purchases` with Play Billing 9.1.0; **validate receipts server-side**, never trust the client.
31. Closed-testing track live; the 14-day clock (started in Phase 1) completes; apply for production access.

**The testers are the critical path, not the code** — which is why they start in Phase 1. If recruitment begins here instead, add three weeks.

### Phase 5 — expand

27. Language wave 1: **ES, FR, IT, NL** (all MPL/BSD/MIT-clean). Per language: extract the word list, **rebuild the difficulty bands from that language's own letter distribution** — "ends with Q" is not hard everywhere.
28. Wave 2: **PT-BR, DA, TR**.
29. German stays out (GPL-only). Swedish deferred (LGPL-3 only).
30. Real-time PvP; iOS port from the same Capacitor project.

---

## 9. TESTING

| Layer | Tool | Target |
|---|---|---|
| Core game logic | Vitest, no DOM | **≥90%** — this is where all six audited defects lived |
| Components | Vitest + Testing Library + jsdom | Key flows |
| Data integrity | Vitest | `en.kowd` round-trip; no excluded prompt in 100k draws; scoring monotonicity |
| Server scoring | Integration | Forged scores rejected |
| Device | Manual + Play closed track | Real hardware |

Regression tests carried over from the audit — each maps to a real, proven defect:

```
✓ uppercase input scores identically to lowercase      (audit §3.2)
✓ a duplicate word scores zero on resubmission         (audit §3.3)
✓ multiplier applies on the same answer that earns it  (audit §3.4)
✓ no impossible prompt in 100,000 generations          (audit §5)
✓ dictionary metadata round-trips for a known sample   (§4.3 above)
```

---

## 10. CI PIPELINE

```
lint (oxlint) → typecheck (tsc -b) → test (vitest --coverage)
  → build-dict (tools/build-dict.mjs, assert byte-identical)
  → asset-integrity (file type + min size + referenced)
  → build (vite)
  → audit (npm audit --omit=dev, fail on any)
  → [main only] cap sync android → assembleRelease
```

`GENERATE_SOURCEMAP` has no CRA equivalent here; set `build.sourcemap: false` in `vite.config.ts` for production. The audited app shipped 707 KB of maps exposing its original source.

---

## 11. COSTS

| Item | Cost |
|---|---|
| Google Play registration (personal, to create) | **$25** one-time |
| Supabase Pro | **$25**/month |
| Dictionary + category licences | **$0** (SCOWL, WordNet — attribution only) |
| All 8 rollout languages | **$0** |
| AdMob account (to create) | $0 (revenue share: 15–30% to Google) |
| Art and audio production | **$0** — produced in-repo (§5) |
| **Total to launch** | **$25 + $25/month** |

---

## 12. RISK REGISTER

| Risk | Severity | Mitigation |
|---|---|---|
| **12-tester gate slips launch** | **High** | Recruit during Phase 1. Longest lead time in the project and it costs nothing to start. |
| No JDK 21 / Android SDK on the dev machine | High | Android CI job in **Phase 0**, not Phase 4. |
| AdMob verification hits the rare 2-week case | Medium | Create the account in Phase 3, not Phase 4. |
| Required accounts hurt first-session conversion | Medium | First round playable signed-out; sign-in gate only on leaderboard submission (§4.6). |
| Vector art style is not what you pictured | Medium | Vertical slice approved before the remaining screens (§8, Phase 2 item 15). |
| Category data covers only 19% of words | Medium | Already handled: bonus, never a filter. |
| Scoring weights feel wrong in play | Medium | Server-side, tunable without an app update. |
| Free-text proves too hard for casual players | Medium | Categories + difficulty bands + adaptive weighting. Instrument session length from day one. |
| Non-English categories | Medium | WordNet is English-only. Do not promise categories in wave-1 languages until Open Multilingual WordNet is licence-checked. |
| AdMob fill rate low at launch | Low | Expected for a new app; do not model revenue on day-1 eCPM. |

---

## 13. WHAT I COULD **NOT** VERIFY LOCALLY

Stated explicitly so nothing here is mistaken for a tested claim:

1. **The Android build was never compiled.** `npx cap add android` succeeded and the Gradle project is correct, but there is no JDK and no Android SDK on this machine (`java: command not found`, `ANDROID_HOME=unset`). `assembleDebug` has not been run. **Verify this first in Phase 4 — or better, in CI during Phase 0.**
2. **AdMob and IAP runtime behaviour.** Versions, Play Billing 9.1.0 and UMP 4.0.0 are confirmed from the published packages' Gradle files. Actual ad serving and purchase flows need a device and real AdMob/Play Console accounts.
3. **Anything iOS.** Not scaffolded, not built. Also **no web/PWA build** — deferred by decision, so no manifest or service worker was tested.
4. **Real-device dictionary performance.** The 30.5 ms / 8.9 MB figures are Node 24 on this machine. Both should be similar on mobile V8, but a low-end Android device will be slower. **Measure on a real device in Phase 1.**
5. **Supabase behaviour under load.** Pricing and limits are quoted from their pricing page; no project was provisioned.
6. **Brotli `Content-Encoding` on the web target.** §4.4's recommendation avoids the question for the Capacitor app entirely, and web is deferred, so this is moot for now.
7. **The Google Sign-In round trip.** `signInWithIdToken` is confirmed in the installed SDK typings and the plugin is confirmed to return an `idToken`, and the two fit — but no real OAuth client exists yet, so the live handshake is untested.
8. **The asset pipeline at full scale.** One SFX and one icon were produced end to end (§5.1, §5.2). The complete themed set has not been built, and **whether the vector style looks right is a judgement I cannot make from here** — hence the vertical slice.

---

## 15. WHAT IS BUILT — verified on 2026-10-01

The old CRA app was removed from the working tree. **It is untouched in git history** and recoverable at any time:

```
$ git log --oneline -1
e3cf8e7 fix packs
$ git checkout e3cf8e7 -- src public package.json     # full recovery, if ever needed
```

### 15.1 Verification pipeline, run end to end

```
$ npx oxlint src tools
  (no output - clean)

$ npx tsc -b --force
  (no output - zero errors, strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)

$ npx vitest run --coverage
 Test Files  8 passed (8)
      Tests  65 passed (65)
Statements   : 98.53% ( 269/273 )
Branches     : 89.42% ( 93/104 )
Functions    : 100% ( 47/47 )
Lines        : 99.13% ( 230/232 )

$ node tools/verify-assets.mjs
all 9 assets verified

$ npm run build
dist/index.html                   1.31 kB │ gzip:  0.62 kB
dist/assets/index-CwcqsBAP.css    9.56 kB │ gzip:  2.67 kB
dist/assets/index-BVztNq5C.js   304.61 kB │ gzip: 97.10 kB
✓ built in 440ms

$ npm audit --omit=dev
found 0 vulnerabilities

$ find dist -name '*.map' | wc -l
0
```

**Zero production vulnerabilities, against 58 (2 critical, 30 high) on the old stack.**

### 15.2 The dictionary is reproducible from source

```
$ node tools/build-dict.mjs
building en.kowd
  downloading https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz
  downloading https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz
  words        110248
  categorised  21372 (19%)
  blob         1345134 bytes (1314 KB)
  brotli       311416 bytes (304 KB)
  sha256       c9f23a3639e3ec809b3910a0fdb90b793cfa4d938facef6c8f75bfa9deac773e
```

Nothing binary is committed; CI rebuilds it and asserts the hash is unchanged.

### 15.3 Assets are generated, never downloaded by hand

```
$ node tools/build-assets.mjs
  sfx  hit         748 bytes
  sfx  correct    3287 bytes
  sfx  wrong      2183 bytes
  sfx  warning    1239 bytes
  sfx  charge     6032 bytes
  sfx  TOTAL     13489 bytes
  icon public/icons/favicon-32.png       1545 bytes (32px)
  icon public/icons/apple-touch-icon.png    8768 bytes (180px)
  icon resources/icon.png               49593 bytes (1024px)
  icon resources/icon-foreground.png    20804 bytes (432px)
  icon resources/splash.png            161780 bytes (2732px)
```

**13.5 KB of audio**, against 1.24 MB of uncompressed WAV in the old app — and the SFX are synthesised from maths, so they regenerate identically.

The integrity gate proves each file is what its extension claims:

```
$ node tools/verify-assets.mjs
  ok  /dict/en.kowd                      1345134 bytes
  ok  /icons/apple-touch-icon.png           8768 bytes
  ok  /icons/favicon-32.png                 1545 bytes
  ok  /icons/favicon.svg                    1075 bytes
  ok  /sfx/charge.opus                      6032 bytes
  ok  /sfx/correct.opus                     3287 bytes
  ok  /sfx/hit.opus                          748 bytes
  ok  /sfx/warning.opus                     1239 bytes
  ok  /sfx/wrong.opus                       2183 bytes
  --- audio content hashes (stable across rebuilds):
  pcm charge.opus      f16a15ed5a1e7a20  67200 samples*2
  pcm hit.opus         1ca1ad8adb6006ff  8640 samples*2
all 9 assets verified
```

It works: during development it **failed the build** on four icons that were generated but never referenced, and they were moved to `resources/` (native-only, not served). That is exactly the class of defect that let 12 S3 error pages ship as `.jpg` in the old app.

Note on reproducibility: PNG and the dictionary are byte-identical across rebuilds; Opus is not, because the Ogg container embeds a random bitstream serial. Diagnosed rather than assumed —

```
$ cmp -l run_a.opus run_b.opus | wc -l
24            # of 748 bytes: the 4-byte serial at offset 14, plus page CRCs
$ ffmpeg -i run_a.opus -f s16le - | sha256sum
1ca1ad8adb6006ffb464bf552a0684788287102cffc3eb02e48f862c8255a58f
$ ffmpeg -i run_b.opus -f s16le - | sha256sum
1ca1ad8adb6006ffb464bf552a0684788287102cffc3eb02e48f862c8255a58f
```

The decoded audio is identical, so the gate hashes **decoded PCM**, not the container. `-serial_offset` was tried first and does not pin the serial absolutely.

### 15.4 Every audited defect has a regression test

```
$ npx vitest run
 ✓ REGRESSION (audit §3.2): uppercase input matches identically
 ✓ REGRESSION (audit §3.2): uppercase scores identically to lowercase
 ✓ REGRESSION (audit §3.3): a duplicate word scores zero on resubmission
 ✓ duplicate detection is case-insensitive
 ✓ ACCEPTANCE: squire never generates an impossible prompt in 100,000 draws
 ✓ ACCEPTANCE: knight never generates an impossible prompt in 100,000 draws
 ✓ ACCEPTANCE: warlord never generates an impossible prompt in 100,000 draws
 ✓ identifies the unwinnable prompts the old app generated freely
 ✓ rejects a malformed blob instead of silently failing every word
 ✓ REGRESSION: a duplicate word is rejected in the real UI
 ✓ REGRESSION: uppercase typing still scores
 ✓ boots, loads the dictionary, plays a round and reports a score
```

The last one drives the real React app: boots, loads the shipped dictionary, picks a difficulty, plays five valid words found live in the dictionary, asserts the rendered score matches the engine, gives up, and reads the results screen.

**That integration test caught a genuine shipping bug.** `App.tsx` did not import the i18n setup — only `main.tsx` did — so anything rendering `<App/>` got an uninitialised i18next and the UI displayed raw keys:

```
IMMEDIATE TEXT: "loading.dictionary"
AFTER LOAD TEXT: "app.titleapp.taglinewelcome.difficulty…"
```

After moving the import into `App.tsx`:

```
IMMEDIATE TEXT: "Mustering the lexicon…"
AFTER LOAD TEXT: "King of WordorFight for the words of the realm…"
```

(An earlier attempt added `initImmediate: false`. `tsc -b --force` then proved that option does not exist in i18next v26's `InitOptions` — it was never the fix, and it was removed.)

### 15.5 The production build serves correctly over real HTTP

```
$ python3 -m http.server 4711   # serving dist/
  200   text/html                  /index.html
  200   application/octet-stream   /dict/en.kowd
  200   audio/ogg                  /sfx/hit.opus
  200   image/svg+xml              /icons/favicon.svg

  sha256 served: c9f23a3639e3ec809b3910a0fdb90b79
  sha256 source: c9f23a3639e3ec809b3910a0fdb90b79
  magic: KOWD | words: 110248
```

### 15.6 The Android project builds its payload

```
$ npx cap add android
[success] android platform added!
$ grep -E "SdkVersion" android/variables.gradle
    minSdkVersion = 24
    compileSdkVersion = 36
    targetSdkVersion = 36

$ npx cap sync android
[info] Sync finished in 0.402s
$ ls android/app/src/main/assets/public/dict/
-rw-r--r-- 1 ramo ramo 1345134 en.kowd
$ ls android/app/src/main/assets/public/sfx/
charge.opus  correct.opus  hit.opus  warning.opus  wrong.opus
```

`targetSdkVersion = 36` with no configuration — the current Google Play requirement. The dictionary and all audio are bundled into the APK payload, so the game validates words with no network at all.

### 15.7 Source inventory

```
$ find src tools .github -type f | wc -l
49
$ find src tools -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.mjs' \) -exec wc -l {} + | tail -1
  2915 total
```

- `src/core/` — pure TypeScript engine, no React import: `types`, `rng` (deterministic, server-portable), `dictionary`, `rules`, `scoring`, `round`, `load`
- `src/store/` — Zustand slices (`gameStore`, `settingsStore`, the latter persisted)
- `src/platform/` — `audio` (Web Audio, pooled buffers), `haptics`, `storage` (Preferences/localStorage, fully guarded)
- `src/ui/` — `Battlefield` (SVG parallax), `Keyboard` (real `<button>`s), `Timer` (deadline-based), 5 screens, design tokens actually imported
- `tools/` — `build-dict`, `build-assets`, `verify-assets`
- `.github/workflows/ci.yml` — web job + Android job (JDK 21, SDK 36, `assembleDebug`)

---

## 16. STATUS — 2026-10-07

### Built and verified

| Phase | Item | Evidence |
|---|---|---|
| 0–1 | Engine, dictionary, rules, scoring, i18n, audio, CI | 137 tests, coverage 99.36% lines |
| 2 | Pixel battlefield (warriors, fire, embers, dust, smoke), redesigned Home/Play/Results | screenshots + `INVENTORY.md` §4 |
| — | Daily Siege, day streaks, 9-rank ladder to *King of Wordor* | 17 progress tests |
| 3 | Server-side replay verification (anti-cheat) | 13 tests |
| 3 | Schema, RLS, day/week/month/year leaderboards, account deletion | 17 tests on real PostgreSQL 18.3 (PGlite) |
| 3 | Client→server contract: a round played in the real store verifies to the identical score | 2 tests |
| 3 | Ladder screen; real account deletion; real sign-out | 3 UI tests |
| — | Web account-deletion page (Play User Data policy) | loads HTTP 200, no errors |
| 4 | Debug APK assembled and run on a Galaxy M31 (Oct 2) | commit `f79f346` |
| 4 | **Seven languages** (2026-10-07): English, Spanish, French, Dutch, Portuguese (BR), Danish, Turkish — menus and words switch together in Settings; first launch follows the phone's language | 245 tests |
| 4 | Word lists from LibreOffice Hunspell dictionaries, expanded by `tools/hunspell.mjs` | 3000/3000 sampled forms per language accepted by real Hunspell 1.7 (WebAssembly) |
| 4 | Portuguese and Turkish expand to 2.2M / 4.5M forms; shipped ~0.96M / ~0.71M | held-out Tatoeba text: 99.86% / 98.82% of word uses accepted |
| 4 | English unchanged by the multi-language engine | golden test: 25 prompts × 12 seeds, every score, all 78 prompt stats |
| 4 | Turkish letters Ğ ğ Ş ş İ ı drawn into the pixel font ("Silkscreen TR") | glyph-coverage gate in `tools/verify-assets.mjs`: 123/123 characters |

### Not built, or built but not run

1. **Edge Function `submit-round` has never executed** — no Deno or Supabase CLI on this machine. Its logic is tested; the HTTP wrapper is not.
2. **Schema not deployed** — verified against your project: `GET /rest/v1/profiles` → `404 PGRST205 "Could not find the table 'public.profiles'"`.
3. **In-game store, boosters, currency** — needs product decisions.
4. **AdMob wiring** — plugin installed (Google's sample App ID is injected by `tools/android-config.mjs`); no real ad units.
5. **Ranked Duel** — shown in-app as "Coming soon".
6. **Italian** — its only LibreOffice word list is GPL-3 (current and legacy), so it is out, like German.
7. **Category bonuses outside English** — WordNet is English-only; the other six languages play without them.
8. **Dutch/Danish compounds** are accepted when the dictionary lists them or Tatoeba shows them in use (3,221 Dutch, 795 Danish); others are not generated.

---

## 17. YOUR ACTION ITEMS

### Correction to the previous list
v3 listed "Create a Supabase project" and "Create a Google Cloud OAuth client" as yours to do. **Both already exist.** A `.env` created on 2026-10-02 holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_GOOGLE_WEB_CLIENT_ID`; my earlier status check missed the file. Verified against the live project with the public anon key (read-only):

```
GET /auth/v1/settings   ->  enabled providers: google, email
GET /rest/v1/profiles   ->  404 "Could not find the table 'public.profiles'"
```

So the project and Google sign-in are set up; the schema is not deployed.

### Open items, in the order they block work

| # | Action | Blocks | How |
|---|---|---|---|
| 1 | ~~Push the branch~~ | — | Done: `rewrite/vite-capacitor` is on GitHub. CI runs on PRs to `master`, so open one when you want a CI run. |
| 2 | **12 testers / 14 days**, or convert to an organization account | Production launch | Unchanged — still the longest lead time. |
| 3 | **Deploy the schema** | Ladders, posting scores | Supabase dashboard → SQL Editor → paste `supabase/migrations/20261006000000_init.sql` → Run. Or `npx supabase link` + `npx supabase db push`. |
| 4 | **Deploy the Edge Function** | Posting scores | `npx supabase functions deploy submit-round`, then set the secret `DICT_URL` to a template, e.g. `https://<host>/dict/{lang}.kowd`, serving all seven `public/dict/*.kowd` **from the same build as the app** (the server replays rounds against those exact files). |
| 5 | **Host `delete-account.html`** and put its URL in Play Console | Play's User Data policy | Any static host serving `dist/`. Add its URL to the OAuth client's redirect list. |
| 6 | **Set `VITE_DEVELOPER_NAME` and `VITE_SUPPORT_EMAIL`** in `.env` | The deletion page must name the developer as on the store listing | Your Play listing shows your legal name (personal account). |
| 7 | **Android OAuth client (SHA-1)** | Native Google sign-in on device | Unknown whether it exists — please confirm. |
| 8 | **Create an AdMob account**, then ad unit IDs | Ads | Verification "typically up to 24 hours, but in rare cases, can take up to 2 weeks". |
| 9 | **Generate and back up a release keystore** | Any release build | Lose it and you can never update the listing. |
| 10 | **Review the four decisions** in `INVENTORY.md` §8 | — | Especially: difficulty is now open to guests (reverses an Oct 2 decision). |
| 11 | **Italian: keep it out, or build it differently** | Italian players | Its LibreOffice list is GPL-3. Options: leave it out (as German); build a smaller list from Tatoeba Italian (CC BY, ~988k sentences — lower coverage than Hunspell); or license a list. |
| 12 | **MPL source availability** for the generated word lists | Play release (not testing) | Credits link the upstream files at the pinned commit. MPL 2.0 §3.2 also asks that the Source Code Form of distributed Covered Software be obtainable; the simple route is to publish `tools/hunspell.mjs`, `tools/build-dict.mjs`, `tools/dict-sources.mjs`, `tools/kowd.mjs` and `tools/freq/` (e.g. a small public repo) and add its URL to Credits. |

---

## 18. REMAINING DECISIONS

All five prior questions are answered and folded into the plan. What remains needs a decision from you at a specific moment, not now:

1. **Approve the art vertical slice (Phase 2).** One fully themed screen in geometric/heraldic vector before I build the other five. This is the only judgement call in the asset work that I cannot make for you.
2. **Do you have 12 people?** The gate needs 12 *distinct Google accounts* opted in continuously for 14 days. If that is hard to assemble, say so in Phase 1 — it is the difference between launching on time and losing three weeks, and there are legitimate ways to plan around it.
3. **Play Console identity.** A personal account publishes your **legal name** on the listing. Confirm you are comfortable with that before registering, because changing it later means a new account.
4. **Store listing art.** §5.3 delivers in-game vector art but not painted marketing illustration. Screenshots can be straight captures of the game, which is normal and fine — flag it if you want something more produced for the listing.
