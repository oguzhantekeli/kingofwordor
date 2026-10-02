# King of Wordor — Technical Audit & Market Comparison (v2)

**Audit date:** 2026-09-30 · **Revision:** v3 — v2 re-ran the audit against your first answer set; v3 locks the three follow-up decisions (account type, language rollout, scoring formula)
**Commit audited:** `e3cf8e7` ("fix packs") + 8 uncommitted CSS modifications
**Method:** every claim is backed by a command and its verbatim output. Nothing is inferred or recalled.
**Repo state after audit:** unchanged except this file. A temporary test suite (`src/__audit__/`) was created, run, and deleted.

### What changed in v3

Three decisions are now locked and the affected sections are rewritten, not annotated: **personal Play account** (§9.4 — the 12-tester gate is now a committed schedule item, not a branch), **language rollout order with Turkish added** (§4.5 — every target licence-checked individually), and **the scoring formula** (§5.5 — rarity × volume × word tier, no platform factor).

### What changed in v2

Your answers resolved five of six open questions and shifted the framing from *"fix this app"* to *"specify the rebuild"*. New, fully-measured work in this revision:

- **§4 Dictionary** — a licence-verified, commercially usable, 110k-word English dictionary with modern vocabulary, replacing the ENABLE recommendation (ENABLE lacks `email`, `blog`, `selfie`, `emoji`).
- **§5 Difficulty** — a difficulty model computed from real word counts, not guesswork. Includes the four prompts your current code can generate that are literally unwinnable.
- **§6 Categories** — your fairness idea, tested against data. It works: 72 of 78 prompts support it.
- **§7 Free-text** — you pushed back and you are substantially right. My revised position, with the residual risk quantified from peer-reviewed typing studies.
- **§9–§10** — Google Play path and backend costs, verified against primary sources today.

---

## 0. DECISIONS LOCKED (from your answers)

| # | Decision | Consequence for the build |
|---|---|---|
| 1 | **Round = 60 s default, configurable** | Matches the market leader (Stop is 60 s). Round length becomes a difficulty axis (§5). |
| 2 | **No commercial licence. Free, as extended as possible** | Rules out Collins/NASPA. Rules out Google Web Trillion Word Corpus derivatives. Selects SCOWL + WordNet (§4). |
| 3 | **Phone + tablet. Google Play first, App Store if easy** | Capacitor 8 + API 36 + Play Billing. Hard launch gate at 12 testers / 14 days (§9). |
| 4 | **Low-budget backend, not free-tier, not a big investment** | Shortlist priced in §10. Recommendation: Supabase Pro, $25/mo. |
| 5 | **All assets temporary and replaceable** | §3.1–§3.5 become an asset *specification*, not a bug list. |
| 6 | **Unstaged changes can be discarded** | `git checkout -- src/` before starting. No merge cost. |
| 7 | **Difficulty settings needed** | Designed in §5, built on measured data. |
| 8 | **Free-text retained, made fair with categories** | Endorsed with conditions — see §6 and §7. |
| 9 | **Personal Play developer account** | No D-U-N-S, no business address published. Accepts the 12-tester / 14-day closed-testing gate. Adds ~3 weeks to launch (§9.4). |
| 10 | **Languages: EN → ES, FR, IT, NL → PT, DA, TR.** German deferred | Every target licence-checked (§4.5). German has no permissive option and is excluded from the rollout. |
| 11 | **Score = rarity × volume × word tier. No platform factor** | §5.5. Input-method handling deferred until real data exists (§7). |

---

## 1. Reproduction

```
$ cd /home/ramo/kingofwordor/kingofwordor
$ git log --oneline -1
e3cf8e7 fix packs
$ node -v && npm -v
v20.20.2
10.8.2
```

Every command block below was run in that directory on 2026-09-30 and its output is pasted verbatim.

---

## 2. What exists today

```
$ find src -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.css' \) -exec wc -l {} + | tail -1
  5713 total
```

React 18.3.1 on Create React App. No router, no backend, no tests. One `useReducer` context. Screens: Welcome → 3 s countdown → Board (5-minute round) → EndGame. The complete network and persistence surface:

```
$ grep -rn "fetch(\|axios\|WebSocket\|firebase\|supabase\|localStorage\|indexedDB" src --include='*.js' --include='*.jsx' | sed 's/:  */: /'
src/context/GlobalStateContext.js:32: localStorage.setItem('soundEnabled', action.payload);
src/context/GlobalStateContext.js:35: localStorage.setItem('userName', action.payload);
src/context/GlobalStateContext.js:38: localStorage.setItem('avatar', action.payload);
src/context/GlobalStateContext.js:41: localStorage.setItem('theme', action.payload);
src/context/GlobalStateContext.js:86-91: (reads the same four keys)
src/actions/dictionaryApi.js:11: const response = await fetch(`${DICTIONARY_API_BASE_URL}/${answer}`);
```

**One network call in the whole application, and the game cannot score a point without it.**

---

## 3. VERIFIED DEFECTS — read this as the rebuild specification

You are rebuilding, so these are no longer a fix list. They are the list of things that must not recur, each with the proof that they happened.

### 3.1 🔴 The only dictionary is a donation-funded API, and it is down right now

```
$ for w in sword castle realm knight banner; do curl -s -o /dev/null -w "$w http=%{http_code} total=%{time_total}s\n" "https://api.dictionaryapi.dev/api/v2/entries/en/$w"; done
sword  http=522  total=19.974263s
castle http=522  total=19.743466s
realm  http=522  total=19.964464s
knight http=522  total=19.915405s
banner http=522  total=19.618781s
```

Not a local network problem:

```
$ for u in https://api.github.com/zen https://registry.npmjs.org/-/ping https://www.google.com/generate_204; do curl -s -m 15 -o /dev/null -w "%{http_code}  %{time_total}s  $u\n" "$u"; done
200  0.205937s  https://api.github.com/zen
200  0.478915s  https://registry.npmjs.org/-/ping
204  0.192196s  https://www.google.com/generate_204
```

Persistent, not a blip — two samples ten minutes apart, plus the upstream diagnosis:

```
$ date -u; curl -s -m 25 -o /dev/null -w "http=%{http_code} total=%{time_total}s\n" ".../entries/en/castle"
Wed Sep 30 18:29:52 UTC 2026
http=522 total=19.844277s

$ curl -s -D - -o /dev/null ".../entries/en/sword" | head -5
HTTP/2 522
date: Wed, 30 Sep 2026 18:22:10 GMT
server: cloudflare
```

HTTP 522 = Cloudflare cannot reach the origin. The project site is up, which confirms the *API backend* died, and states the funding model:

```
$ curl -s https://dictionaryapi.dev/ | sed 's/<[^>]*>//g' | grep -iA2 "donat"
 Donate
 Dictionary API is—and always will be—free.
 Your donation directly helps the development of Dictionary API and keeps the server running.
```

**Traced impact:** `dictionaryApi.js:28` catches → `{valid:false}` → `useAnswerValidation.js:36` → `AnswerInput.js:159-168` awards **0 points**, resets the multiplier, plays the "wrong" sound. Every correct word is scored wrong, after a 20-second freeze. In your new **60-second** round a player would get **three attempts, all scoring zero.**

Also verified absent in that path — no timeout, no cancellation, no cache:

```
$ grep -rn "AbortController\|signal\|cache\|Map()" src/actions/dictionaryApi.js src/hooks/useAnswerValidation.js
  (no output)
```

§4 replaces this entirely.

### 3.2 🔴 A capital letter makes a correct word score zero

`rungame.js:40` compares raw input against a lowercase letter; `AnswerInput.js:65` explicitly permits `A-Z`:

```javascript
const value = e.target.value.replace(/[^a-zA-Z]/g, '');
```

Proven by executable test against the real modules:

```
$ CI=true npx react-scripts test --testPathPattern="__audit__" --watchAll=false
  A. pure rule matching
    ✓ A1 lowercase word matches "starts with s"
    ✓ A2 SAME word typed with capital S is REJECTED (1 ms)
    ✓ A3 "ends with" also case-sensitive
    ✓ A4 empty rulesData (initial state) rejects every word
```

End-to-end through the real component:

```
    C2 addPoints: [[0]] | setMultiplier: [[1]] | dictionary called: 0 times
    ✓ C2 SAME word typed with a capital letter scores 0 and kills the multiplier (36 ms)
```

Note `dictionary called: 0 times` — discarded before it is ever checked. Mobile is masked by the custom keyboard; **desktop, where your typing challenge lives, is broken.**

### 3.3 🔴 The same word farms unlimited points

```
    C3 addPoints calls for the SAME word: [[5],[5]]
    ✓ C3 an already-submitted word can be farmed again for full points (54 ms)
```

Seeded with `sword` already played, submitted twice more — all scored. Hold one valid word, hammer Enter. This alone would destroy the leaderboards in §10.

### 3.4 🟠 The `nomistake` multiplier is always one answer behind

`AnswerInput.js:144` sets the new multiplier, then line 147 scores with the **stale closure value**:

```
    C4 setMultiplier: [[2.2]] | addPoints: [[10],[10]]
    ✓ C4 nomistake multiplier is applied one answer late (stale closure) (53 ms)
```

Multiplier correctly raised to 2.2; word scores `5 × 2 = 10` instead of `5 × 2.2 = 11`. The mode's entire premise systematically under-pays.

### 3.5 🟠 Two validation rules are dead code

`useAnswerValidation.js:19` tests `answer.length < rulesData.minLength`, but `getRules()` never sets `minLength`:

```
$ grep -n "return" src/actions/rules.js
23:  return { condition, letter, wordCount };
```

`answer.length < undefined` is always `false`. Line 25's `gameType === 'targetLetter'` can never be true — the only game types are `standard`, `longest`, `nomistake` (`constants.js:7-11`).

### 3.6 🟠 The "possible words" counter shown to players is fabricated

```
$ node verify_counts.js
dictionary words analysed: 370105

TOP 8 WORST DEVIATIONS (claimed vs actual):
  ends "q": app claims 230, real dictionary has 30  -> off by 667%
  ends "j": app claims 210, real dictionary has 30  -> off by 600%
  ends "v": app claims 680, real dictionary has 141  -> off by 382%
  ends "z": app claims 1100, real dictionary has 252  -> off by 337%
  starts "x": app claims 1900, real dictionary has 507  -> off by 275%
  ends "s": app claims 260000, real dictionary has 75666  -> off by 244%
  starts "k": app claims 13000, real dictionary has 3952  -> off by 229%
  starts "y": app claims 3500, real dictionary has 1143  -> off by 206%

SUM of claimed POSSIBLE_STARTS = 788200  vs total words in dictionary = 370105
```

Internally impossible: the claimed start-letter counts sum to **more than twice the entire dictionary**. `RuleSection.js:46` renders these to the player as fact. Once §4 lands, these counts become exact and free.

### 3.7 🔴 Twelve "images" are S3 error pages — and nothing references any image anyway

```
$ file public/assets/*
public/assets/banner-bg.png:         XML 1.0 document, ASCII text
public/assets/header-banner.jpg:     XML 1.0 document, ASCII text
public/assets/input-texture.jpg:     XML 1.0 document, ASCII text
public/assets/modal-bg.jpg:          XML 1.0 document, ASCII text
public/assets/parchment-endgame.jpg: XML 1.0 document, ASCII text
public/assets/parchment-texture.jpg: XML 1.0 document, ASCII text
public/assets/scroll-bg.png:         XML 1.0 document, ASCII text
public/assets/dark-parchment.jpg:    JPEG image data, 960x681
public/assets/light-parchment.jpg:   JPEG image data, 960x681
public/assets/parchment-bg.jpg:      JPEG image data, 960x681

$ head -c 160 public/assets/header-banner.jpg
<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>AccessDenied</Code><Message>Access Denied</Message>...
```

Served in production with `Content-Type: image/jpeg`. `dark-parchment.jpg` and `light-parchment.jpg` are byte-identical (`md5 9d02a7d9...`). And the theme in your brief does not exist at all:

```
$ grep -rn "url(" src | wc -l
0
$ grep -rn "\.jpg\|\.png" src --include='*.js' --include='*.jsx'
  (no output)
```

**Zero image references across 22 stylesheets and 24 components.** All 30 images are dead weight; 711,028 bytes of them ship in `build/assets/`. You've said assets are replaceable — the point that survives is the **process failure**: a download step failed silently and the error bodies were committed. The rebuild needs an asset-integrity check in CI (`file` type + minimum size + referenced-by-something).

### 3.8 🟠 A 686-line stylesheet and the whole design-token system never load

```
$ node audit_css.js
classNames used in JSX: 97
CSS files imported: 12 of 22
NOT imported: src/components/board/board.css, src/mainstyles/reset.css,
  src/mainstyles/variables/{borders,colors,icons,layout,spacing,transitions,typography,zindex}.css
```

And `CSS_VARIABLES_GUIDE.md` is factually wrong about how they load:

```
$ grep -n "import" src/mainstyles/CSS_VARIABLES_GUIDE.md | head -2
73:Simply import the main.css file which already includes all variables:
76:@import '../../mainstyles/main.css';

$ grep -rn "@import" src --include='*.css'
  (no output — main.css contains zero @import statements)
```

Two custom properties are therefore undefined at runtime (`--radius-sm`, `--accent-gold-light`); both happen to have literal fallbacks, so nothing visibly breaks while the documented system is entirely inert. Dark mode is four CSS rules:

```
$ grep -rn "dark-theme\|light-theme" src --include='*.css'
src/components/settings/settings.css:180:body.light-theme {
src/components/settings/settings.css:188:body.dark-theme {
src/components/board/answerinput/AnswerInput.css:147:.dark-theme .answerinput input {
src/components/board/answerinput/AnswerInput.css:157:.dark-theme .answerinput input::placeholder {
```

### 3.9 🟠 Audio: 1.24 MB of uncompressed WAV for 5.15 seconds of sound

```
$ for a in src/assets/*.wav src/assets/*.flac; do b=$(basename "$a"); n=$(grep -rn "$b" src --include='*.js' --include='*.jsx' | wc -l); printf "%-14s %9s bytes  imports=%s\n" "$b" "$(stat -c%s "$a")" "$n"; done
charge.wav        191748 bytes  imports=2
hurray.wav       3315328 bytes  imports=0
pain.wav          271046 bytes  imports=1
sword.flac         54698 bytes  imports=1
sword2.wav        833872 bytes  imports=0
yay.wav           752352 bytes  imports=1

$ node wavinfo.js
charge.wav  ch=1 rate=48000 bits=16 duration=2.00s  | at 96kbps opus ≈ 23 KB
hurray.wav  ch=2 rate=44100 bits=16 duration=18.79s | at 96kbps opus ≈ 220 KB
pain.wav    ch=2 rate=44100 bits=24 duration=1.02s  | at 96kbps opus ≈ 12 KB
sword2.wav  ch=0 rate=0     bits=0  duration=Infinity   <- malformed WAV header
yay.wav     ch=2 rate=44100 bits=32 duration=2.13s  | at 96kbps opus ≈ 25 KB
```

Four effects, 5.15 s total, **1,269,844 bytes shipped**; ~60 KB as Opus (95% smaller). 4.15 MB more sits dead in the repo. The playback layer is also wrong for a typing game: `useSoundEffects` is instantiated independently by `InfoSection.js:17` and `AnswerInput.js:36` (two full sets of `Audio` objects), and `AnswerInput.js:71` fires `playHitSound()` on *every keystroke* via `pause() → currentTime=0 → play()`. A single `HTMLAudioElement` cannot overlap itself, so fast typing truncates each hit. **Rebuild with Web Audio and a decoded, pooled buffer.**

### 3.10 🟠 707 KB of source maps ship, exposing original code

```
$ ls build/static/js/*.map build/static/css/*.map | wc -l
7
$ du -cb build/static/js/*.map build/static/css/*.map | tail -1
707569	total

$ node -e "const j=JSON.parse(require('fs').readFileSync('build/static/js/main.95373dc0.js.map','utf8'));const i=j.sources.indexOf('constants.js');console.log(j.sourcesContent[i].split('\n').slice(0,5).join('\n'))"
export const GAME_STATUSES = {
  WELCOME: 'welcome',
  INGAME: 'ingame',
  ENDGAME: 'endgame',
};
```

No `.env`, so CRA's `GENERATE_SOURCEMAP` defaults to `true`. With paid power-ups coming, this hands an attacker the entire client.

### 3.11 🟠 No PWA manifest, no service worker

```
$ for x in public/manifest.json public/service-worker.js capacitor.config.ts android ios; do [ -e "$x" ] && echo "PRESENT: $x" || echo "ABSENT : $x"; done
ABSENT : public/manifest.json
ABSENT : public/service-worker.js
ABSENT : capacitor.config.ts
ABSENT : android
ABSENT : ios
$ grep -c "manifest" public/index.html
0
```

Six icons are shipped and linked, but without a manifest the game cannot be installed to a home screen. Zero offline capability.

### 3.12 🟠 58 dependency vulnerabilities; the build tool died in 2022

```
$ npm audit --omit=dev | tail -1
58 vulnerabilities (11 low, 15 moderate, 30 high, 2 critical)
$ npm audit --json | node summarise.js | head -4
critical  shell-quote  <=1.8.4
critical  websocket-driver  <=0.7.4
high      react-scripts  >=0.1.0
high      nth-check  <2.0.1

$ npm view react-scripts time --json | node -e "...print 5.0.1..."
5.0.1 published: 2022-04-12T17:33:23.210Z
latest published version: 5.1.0-next.26 at 2025-02-14T22:05:15.485Z
$ npm view react version
19.3.0
```

Most are dev-time only, but CRA cannot be patched and the project is two React majors behind. **The rebuild should start on Vite + React 19.** Also note:

```
$ grep -A2 '"engines"' package.json
  "engines": { "node": ">=24" },
$ node -v
v20.20.2
$ CI=false npx react-scripts build 2>&1 | grep -E "Compiled|Failed"
Compiled successfully.
```

The declared Node floor is unenforced and wrong for the actual environment.

### 3.13 🟡 Zero tests, and a stale analysis document

```
$ find src -name '*.test.*' -o -name '*.spec.*' -o -name '__tests__' | wc -l
0
$ npx eslint ./src --ext .js,.jsx; echo "exit: $?"
exit: 0
```

Lint is clean; all six defects above were invisible to it. All six were caught by twelve tests written in under twenty minutes that ran in 1.7 seconds.

`CODEBASE_ANALYSIS.md` (2,502 lines, untracked) describes an **older** codebase — its P0 list is already fixed:

```
$ grep -c 'require('  src/hooks/useSoundEffects.js        # P0#1 claims broken require().default
0
$ grep -c 'key={item.id}' src/components/board/answerslist/AnswersList.js   # P0#2 claims index keys
1
$ grep -c 'console.log' src/components/endgame/EndGame.js  # P0#3
0
$ grep -c 'POSSIBLE_INCLUDES' src/actions/rules.js         # P1#9 claims missing
2
```

It also misses all six live defects. **Delete it.**

---

## 4. DICTIONARY STRATEGY — free, commercial-safe, and larger than what you have

Your answer: *"No commercial licence. Make it free but as extended as possible."* That constraint eliminates more sources than it first appears, so I verified every candidate's licence directly rather than trusting summaries.

### 4.1 What is ruled out, with the proof

```
$ curl -sL https://raw.githubusercontent.com/first20hours/google-10000-english/master/LICENSE.md
Data files are derived from the *Google Web Trillion Word Corpus* ... distributed by the
[Linguistic Data Consortium] ... Educational and personal/research use of this data is permitted
under the LDC license, Norvig's MIT license for his contributions, and US fair use doctrine.
I do not recommend using this data for commercial purposes without licensing it from the
Linguistic Data Consortium.
```

That kills **google-10000-english** *and* **Norvig's `count_1w.txt`** — same corpus, same problem. Both are the default frequency lists most tutorials reach for.

```
$ curl -sL https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/README.md | grep -iA3 "licen"
### License
MIT License for code.
CC-by-sa-4.0 for content.
```

**FrequencyWords is CC-BY-SA-4.0 on the data.** Share-alike is copyleft: a word list derived from it arguably inherits the obligation to be redistributed under CC-BY-SA. Avoid it in the shipped bundle.

Collins remains barred, as before — from their own terms page:

> "You may not use the word lists for non-private or commercial purposes including, but not limited to, copying the whole or any part, reverse-engineering, decompiling, editing, disseminating, selling or using for any form of commercial gain."

### 4.2 What is in — SCOWL, and its licence explicitly permits selling

```
$ sed -n '14,28p' /usr/share/doc/hunspell-en-us/copyright
The collective work is Copyright 2000-2011 by Kevin Atkinson ...

  Permission to use, copy, modify, distribute and sell these word
  lists, the associated scripts, the output created from the scripts,
  and its documentation for any purpose is hereby granted without fee,
  provided that the above copyright notice appears in all copies and
  that both that copyright notice and this permission notice appear in
  supporting documentation.
```

"**distribute and sell** … **for any purpose** … **without fee**", requiring only that the copyright notice travels with it. That is an MIT-class grant, and it covers *"the output created from the scripts"* — i.e. your derived game dictionary.

SCOWL also ships **pre-graded size tiers**, which turn out to be the single most useful thing in this whole audit:

```
$ curl -sL -o scowl.tar.gz "https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz" && tar xzf scowl.tar.gz -C scowl
$ node scowl_tiers.js
SCOWL cumulative tiers  (english-words.N + american-words.N, a-z only, length 3-15)
tier | words added |  cumulative | raw      | gzip     | brotli   | has: email blog selfie emoji
  10 |        3943 |        3943 |    30 KB |    11 KB |     9 KB |  - - - -
  20 |        6920 |       10863 |    89 KB |    29 KB |    24 KB |  - - - -
  35 |       28151 |       39014 |   339 KB |   100 KB |    81 KB |  Y Y - -
  40 |        4670 |       43684 |   384 KB |   112 KB |    92 KB |  Y Y - -
  50 |       17494 |       61178 |   555 KB |   159 KB |   131 KB |  Y Y Y Y
  55 |        5626 |       66804 |   609 KB |   173 KB |   143 KB |  Y Y Y Y
  60 |        9737 |       76541 |   708 KB |   200 KB |   165 KB |  Y Y Y Y
  70 |       33707 |      110248 |  1044 KB |   297 KB |   247 KB |  Y Y Y Y
  80 |      126434 |      236682 |  2330 KB |   614 KB |   501 KB |  Y Y Y Y
  95 |      173210 |      409892 |  4143 KB |  1132 KB |   932 KB |  Y Y Y Y

probe words at full 95 tier:
  email IN | blog IN | selfie IN | emoji IN | sword IN | castle IN | orc IN | wizard IN | zyzzyva IN
```

**This solves the problem I flagged in v1.** ENABLE is missing `email`, `blog`, `selfie`, `emoji`; SCOWL has all four from tier 50 up. And at tier 95 SCOWL holds **409,892 words — more than the 370,105-word list I benchmarked in v1** — so "as extended as possible" costs 932 KB brotli if you want the maximum.

### 4.3 Recommended configuration

**Accept at tier ≤70 (110,248 words, 247 KB brotli).** Rationale: tier 80 adds 126k words in one jump — overwhelmingly obscure forms that make the game feel arbitrary when a player's real word is rejected while `zyzzyva` scores. Tier 70 keeps `email`/`selfie`/`emoji` and stays under a quarter of a megabyte.

Ship three artefacts, all measured:

```
$ node bundle_plan.js
accepted dictionary (SCOWL<=70): 110248 words

=== SHIPPED GAME DATA BUDGET (brotli, what the device actually downloads) ===
  word list (SCOWL<=70)         1044 KB raw ->  247 KB brotli
  difficulty tier (4 bits/word)   54 KB raw ->   32 KB brotli
  category bitmask (16 bits/wd)  215 KB raw ->   25 KB brotli
  ------------------------------------------------------------
  TOTAL                         1314 KB raw ->  304 KB brotli

  words carrying at least one category tag: 21372 (19% of the dictionary)
  current whole production build (for comparison): 3.0 MB on disk
```

**304 KB brotli buys the entire game engine's data: dictionary, difficulty grading and category tags.** That is less than half the 711 KB of broken, unreferenced images the app ships today.

Lookup performance, measured:

```
$ node dictsize.js
=== C. PLAIN JS Set IN MEMORY ===
Set build from 358612 words: 37ms | 1,000,000 lookups: 83.6ms (0.084 microseconds each)
```

**0.084 µs per lookup versus 19.8 s over the network.** Even against a healthy API at 150 ms that is ~1.8 million times faster, and it works offline — which Capacitor apps need and which Play reviewers notice.

A Bloom filter was also measured as an alternative and is **not** recommended here — it is larger than the brotli word list and incompressible:

```
target FP 1.0% -> 420 KB | gzipped 420 KB | measured FP 1.006% on 200000 random non-words
```

### 4.4 The multi-language trap you need to know about before promising language #2

Requirement #4 says English must extend to other languages without per-word API calls. The free multi-language route is Hunspell/LibreOffice dictionaries — 68 languages available:

```
$ curl -s "https://api.github.com/repos/LibreOffice/dictionaries/contents/" | node listdirs.js
  69 language dirs:
  af_ZA an_ES ar as_IN be_BY bg_BG bn_BD bo br_FR bs_BA ca ckb cs_CZ da_DK de el_GR en eo es
  et_EE fa_IR fr_FR gd_GB gl gu_IN gug he_IL hi_IN hr_HR hu_HU id is it_IT kmr_Latn kn_IN ko_KR
  lo_LA lt_LT lv_LV mn_MN mr_IN ne_NP nl_NL no oc_FR or_IN pa_IN pl_PL pt_BR pt_PT ro ru_RU
  sa_IN si_LK sk_SK sl_SI sq_AL sr sv_SE sw_TZ ta_IN te_IN th_TH tr_TR uk_UA vi zu_ZA
```

**But the licences differ per language, and at least one major language is unusable.**

```
$ curl -sL ".../dictionaries/master/de/README_de_DE_frami.txt" | grep -iA2 "GPL"
Das Wörterbuch und alle enthaltenen Wortlisten sind lizenziert unter der
GNU GPL, Version 2 oder 3.

$ curl -sL ".../dictionaries/master/es/LICENSE.md" | head -5
El proyecto y los diccionarios se distribuyen bajo un triple esquema de
licencias disjuntas: GNU GPL versión 3 o posterior, GNU LGPL versión 3 o
posterior o MPL versión 1.1 o posterior.
Puede seleccionar libremente bajo cuál de estas licencias realizará el uso.
```

- **German: GPL v2 or v3 only.** Pure copyleft, no permissive option. Bundling it in a closed-source commercial app is a real legal problem.
- **Spanish: triple-licensed GPL-3 / LGPL-3 / MPL-1.1.** You may elect **MPL 1.1**, which is file-level copyleft and workable for a commercial game.

**Action:** treat each new language as a licence review, not a copy-paste. Verify before you promise the language in a store listing.

### 4.5 Locked language rollout — chosen by market evidence, not speaker count

The instinct to "pick the most-used X languages" is the wrong selector here, and the market data says so plainly. Languages actually shipped by the four closest competitors:

```
$ node competitor_langs.js
  Stop (Fanatee)           9 langs
  Word Blitz (LOTUM)      16 langs
  Ruzzle (MAG)            13 langs
  Word Domination (MAG)    9 langs

  lang | shipped by N of 4 competitors
   DE   | #### 4        DA   | ### 3        EL   | ## 2
   EN   | #### 4        NB   | ### 3        RU   | ## 2
   ES   | #### 4        PT   | ### 3        TR   | ## 2
   FR   | #### 4        SV   | ### 3        CS HR HU PL SK | # 1
   IT   | #### 4
   NL   | #### 4
```

**Dutch appears in all four** despite roughly 24 million speakers. Danish, Norwegian and Swedish appear in three. Mandarin, Hindi and Arabic appear in none. These are ARPU decisions targeting small, wealthy, high-literacy markets that already buy word games — not speaker-count decisions. A "top 10 most spoken" list would produce almost the opposite set.

**Every target below was licence-checked individually** (LibreOffice/Hunspell dictionaries, except English):

| Wave | Language | Licence (verified) | Status |
|---|---|---|---|
| 0 | **English** | SCOWL — "distribute and sell … for any purpose" | ✅ ship first |
| 1 | **Spanish** | GPL-3 / LGPL-3 / **MPL 1.1** (elect MPL) | ✅ clean |
| 1 | **French** | **MPL 2.0** | ✅ clean |
| 1 | **Italian** | GPL-3 / LGPL / **MPL** | ✅ clean |
| 1 | **Dutch** | BSD / MIT / MPL / CC-BY | ✅ clean |
| 2 | **Portuguese (BR)** | LGPL / **MPL** | ✅ clean |
| 2 | **Danish** | LGPL / **MPL** | ✅ clean |
| 2 | **Turkish** | **MIT / MPL** | ✅ clean |
| — | **Swedish** | LGPL-3 only | ⚠️ weaker option, defer |
| — | **German** | **GPL v2 or v3 only** | ❌ **excluded from rollout** |

Verification commands:

```
$ curl -sL ".../fr_FR/dictionaries/README_dict_fr.txt" | grep -A3 "Licence"
   Licence :
     MPL : Mozilla Public License
     version 2.0  --  http://www.mozilla.org/MPL/2.0/

$ curl -sL ".../tr_TR/LICENSE"      | grep -ioE "MIT|MPL" | sort -u    ->  MIT  MPL
$ curl -sL ".../nl_NL/LICENSE.txt"  | grep -ioE "BSD|MIT|MPL|CC BY" | sort -u -> BSD  CC BY  MIT  MPL
$ curl -sL ".../es/LICENSE.md"      | head -4
El proyecto y los diccionarios se distribuyen bajo un triple esquema de
licencias disjuntas: GNU GPL versión 3 o posterior, GNU LGPL versión 3 o
posterior o MPL versión 1.1 o posterior.

$ curl -sL ".../de/README_de_DE_frami.txt" | grep -iA1 "GPL"
Das Wörterbuch und alle enthaltenen Wortlisten sind lizenziert unter der
GNU GPL, Version 2 oder 3.
```

**German is the one blocker, and it is in all four competitors' language sets.** It is excluded from the rollout above rather than shipped under GPL. When it becomes commercially worth solving, the options are: license a German word list commercially, build one from a permissively-licensed corpus, or seek written permission from the dictionary's maintainer. Do not ship the GPL list with a closed-source app.

**Per-language work after wave 0:** extract the word list from the `.dic`/`.aff` pair, apply the same 3–15 letter filter, rebuild the difficulty bands from that language's own letter distribution (§5 — the bands are language-specific; "ends with Q" is not hard in every language), and re-run the category mapping. WordNet is English-only, so categories (§6) need Open Multilingual WordNet or a hand-built list per language — check that licence too before promising categories outside English.

---

## 5. DIFFICULTY SYSTEM — designed from measured data

You asked for ideas here. The honest answer is that difficulty in this game is **not** primarily a timer setting; it is *which prompt you draw*. Measured across the everyday vocabulary a casual player actually reaches for (SCOWL ≤50) versus the pool the game would accept (SCOWL ≤70):

```
$ node difficulty.js
everyday pool (SCOWL<=50): 61178  | accepted pool (SCOWL<=70): 110248

=== THE 14 HARDEST PROMPTS THE GAME CAN CURRENTLY GENERATE ===
(e = everyday words available, a = words the game would accept)
  ends with "j"      everyday=    0  accepted=     4
  ends with "q"      everyday=    0  accepted=     0
  ends with "v"      everyday=    1  accepted=     9
  starts with "x"    everyday=   10  accepted=    62
  ends with "u"      everyday=   34  accepted=   108
  ends with "z"      everyday=   34  accepted=    58
  starts with "z"    everyday=  101  accepted=   259
  ends with "i"      everyday=  107  accepted=   365
  ends with "x"      everyday=  118  accepted=   262
  ends with "b"      everyday=  124  accepted=   209
  ends with "f"      everyday=  151  accepted=   275
  starts with "y"    everyday=  179  accepted=   296
  ends with "w"      everyday=  208  accepted=   328
  starts with "q"    everyday=  307  accepted=   537

=== THE 8 EASIEST ===
  includes "o"       everyday=24228  accepted= 48631
  includes "t"       everyday=28374  accepted= 52718
  includes "n"       everyday=28782  accepted= 52339
  includes "r"       everyday=30524  accepted= 57357
  includes "a"       everyday=30595  accepted= 59472
  includes "i"       everyday=33558  accepted= 62626
  includes "s"       everyday=34153  accepted= 60760
  includes "e"       everyday=41797  accepted= 75723
```

**`ends with "q"` has zero valid words in the entire accepted dictionary. `ends with "j"` has four. Your current code generates both.** That is not "hard", it is a guaranteed zero-score round, and `rules.js:11-12` draws every prompt with equal probability.

The spread is 0 to 41,797 — a factor of infinity. Proposed bands:

```
=== PROPOSED DIFFICULTY BANDS over all 78 (condition x letter) prompts ===
  IMPOSSIBLE  (exclude) everyday     0-25    ->  4 prompts (5%)
  HARD                  everyday    26-150   ->  6 prompts (8%)
  MEDIUM                everyday   151-800   -> 13 prompts (17%)
  EASY                  everyday   801-4000  -> 25 prompts (32%)
  TRIVIAL               everyday  4001-+     -> 30 prompts (38%)

prompts that MUST be excluded or the round is unwinnable (4):
  ends with "j" (0), ends with "q" (0), ends with "v" (1), starts with "x" (10)
```

### Recommended difficulty design

**Three player-facing tiers, each a weighted draw over these bands — not a timer change.**

| Tier | Prompt mix | Round | Accepted vocabulary | Min word length |
|---|---|---|---|---|
| **Squire** (easy) | TRIVIAL 70%, EASY 30% | 90 s | SCOWL ≤50 (61k) | 3 |
| **Knight** (default) | EASY 45%, MEDIUM 35%, TRIVIAL 20% | **60 s** | SCOWL ≤60 (77k) | 4 |
| **Warlord** (hard) | MEDIUM 50%, HARD 35%, EASY 15% | 45 s | SCOWL ≤70 (110k) | 4 |

Four design notes, each following from the data above:

1. **Never draw the 4 IMPOSSIBLE prompts.** Exclude them at generation time, in every tier.
2. **Score inversely to prompt richness, not just word length.** A word for `ends with "z"` (34 everyday options) is worth far more than one for `includes "e"` (41,797). You already have the exact counts — use them as the multiplier. This alone makes the game feel fair without any other change.
3. **The tier a *word* comes from is also a score signal.** You ship 4 bits per word (32 KB, §4.3) — reward a player who finds a tier-70 word over a tier-10 one.
4. **Difficulty should adapt, not just be chosen.** Track rolling words-per-round and shift the band weights. A static setting is a menu; an adaptive one is a game.

### 5.5 The scoring formula (locked)

Score every accepted word as the product of four factors, then sum across the round. Volume is not a separate term — it emerges from summing.

```
word_score = base(length)
           × rarity_weight(condition, letter)     // from the measured counts in §5
           × tier_weight(SCOWL tier of the word)  // from the 4-bit tier array, §4.3
           × category_bonus                       // 1.0, or ~1.5 if it matches the shown category (§6)

round_score = Σ word_score            // volume rewards itself
```

**No platform or input-method factor.** That was considered and rejected for three reasons: device and input detection is a user-agent string and therefore trivially spoofed, so cheaters would claim the bonus and honest players would absorb the penalty; a tablet with a Bluetooth keyboard defeats the classification entirely; and docking a player for their hardware reads as punishment rather than balance. Deferred — see §7.

Two properties worth noting:

- **Rarity weighting already flattens most of the typing-speed gap.** Because the score depends on *which* words you find rather than *how many* you can physically type, the 30–44% desktop throughput advantage (§7) compresses substantially without any explicit handicap.
- **Every factor is data you already ship.** Rarity comes from the §5 counts, tier from the 32 KB array, category from the 25 KB mask. No extra payload, no runtime cost beyond three multiplications.

Suggested starting weights, to be tuned against real rounds: `base = length`, `rarity_weight = clamp(log10(41797 / everyday_count), 1.0, 4.0)`, `tier_weight ∈ {1.0 … 1.6}` across SCOWL 10→70, `category_bonus = 1.5`. Server-side scoring (§10) means these can be retuned without an app update.

---

## 6. CATEGORY HINTS — your fairness idea, tested against data. It works.

You proposed: *"fair play can be achieved by showing word categories depending on the rule-condition."* I tested whether that is actually buildable from free data.

**Source: Princeton WordNet 3.0.** Licence verified from the distributed data file itself (their website is behind a Cloudflare challenge, so this is the authoritative bundled copy):

```
$ head -14 wn/dict/data.noun | sed 's/^  [0-9]* //'
This software and database is being provided to you, the LICENSEE, by
Princeton University under the following license. ...
Permission to use, copy, modify and distribute this software and
database and its documentation for any purpose and without fee or
royalty is hereby granted, provided that you agree to comply with
the following copyright notice and statements, including the disclaimer...
WordNet 3.0 Copyright 2006 by Princeton University.  All rights reserved.
```

"**for any purpose and without fee or royalty**" — commercial use permitted with attribution. WordNet's lexicographer files give 45 built-in semantic categories for free.

```
$ node categories.js
WordNet noun synsets parsed: 82115
SCOWL everyday pool: 61178

=== CATEGORY SIZES (WordNet noun category ∩ SCOWL everyday) ===
  animal              raw WordNet=  5865   everyday= 1032
  object (artifact)   raw WordNet=  8449   everyday= 4673
  body part           raw WordNet=  1398   everyday=  643
  communication       raw WordNet=  4837   everyday= 2839
  food                raw WordNet=  1726   everyday=  933
  place               raw WordNet=  2735   everyday=  621
  person              raw WordNet= 10740   everyday= 3857
  plant               raw WordNet=  4712   everyday=  680
  substance           raw WordNet=  2461   everyday=  867
  time                raw WordNet=   718   everyday=  397

=== FEASIBILITY: how many everyday CATEGORY words satisfy each prompt? ===
  prompt             animal  object (a  body part  communica       food      place     person      plant  substance       time
  starts "s"            125        673         63        328        134         76        494         78        119         37
  starts "x"              0          1          0          0          0          0          1          1          1          0
  starts "q"              6         19          4         23          8          3         17          1          4          1
  ends   "e"            151        947        138        548        196        139        426        121        219         89
  ends   "y"             58        281         24        210         57         44        183         44         20         44
  ends   "z"              0          2          1          4          2          1          5          1          2          5
  incl.  "a"            481       2383        285       1459        449        306       2009        346        432        177
  incl.  "z"             15         57          6         34         20          8         44         11         19          6

prompts (of 78) with at least one category holding >=8 everyday words: 72/78
weakest prompts for category hints: starts "x"(0 cats), ends "j"(0 cats), ends "q"(0 cats),
  ends "u"(0 cats), ends "v"(0 cats), ends "z"(0 cats), starts "z"(1 cats), starts "u"(3 cats)
```

### Verdict: your idea is sound, and the data backs it

**72 of 78 prompts support a category hint with at least 8 everyday words behind it.** And the six that fail are almost exactly the prompts §5 already says to exclude as unwinnable. The failure modes overlap — one exclusion rule fixes both problems.

The cost is 25 KB brotli (§4.3). Concrete design:

- Prompt reads **`An ANIMAL that starts with "S"`** — 125 everyday answers exist, so it is a puzzle, not a blank page.
- Pick the category *after* the letter, from the categories that actually clear the ≥8 threshold for that letter. Never show a category the player cannot satisfy.
- **Only 19% of the dictionary carries a category tag.** So category must be a *hint that scores a bonus*, never a hard filter — otherwise you reject 81% of valid English and the game feels broken. Accept any valid word; pay extra for one matching the shown category.
- Difficulty maps naturally: Squire gets a wide category (`object`, 4,673 words), Warlord gets a narrow one (`time`, 397) or none at all.

---

## 7. THE FREE-TEXT QUESTION — you are substantially right

You wrote: *"there is no example in market does not mean we should avoid it. Correct me if I am wrong."*

**You are not wrong, and my v1 framing was weaker than it should have been.** Absence from the market is evidence of *risk*, not of infeasibility — it can equally mean nobody has tried it properly. What matters is the specific mechanism that would make it fail, and whether you can address that mechanism. There is one, and your category fix targets it directly:

- **The blank-page problem.** "Any word starting with S" gives the brain nowhere to start; freezing under a timer feels bad, and players churn. This is why Stop shipped 200+ categories. **Your category hint solves exactly this**, and §6 proves it is buildable for 72/78 prompts at 25 KB.

So the design is viable. Two residual risks that categories do **not** solve, both quantified:

**Risk 1 — typing speed becomes a platform-dependent skill gate.** This matters because you plan shared leaderboards across phone and tablet. Peer-reviewed, large-sample data:

- Physical keyboard: **52 WPM** average (Dhakal et al. 2018, n = 168,960).
- Smartphone: **36.2 WPM** average; **38 WPM** for two-thumb typists (Palin et al. 2019, n = 37,370).
- Uncorrected error rate: **2.34% mobile vs 1.17% desktop**.

That is roughly a **30–44% throughput advantage** for a physical keyboard. Importantly, this *supports* your position — a 30% gap is manageable, not the 3× gap that would make free-text hopeless.

**Decision: no platform factor at launch.** Rarity weighting (§5.5) already absorbs most of the gap, because the score turns on *which* words you find rather than how fast you can type them. A platform penalty was rejected on its own merits — input detection is a spoofable user-agent string, a Bluetooth keyboard on a tablet defeats the classification, and penalising hardware reads as punishment. Segmented leaderboards remain the clean fix **if** the data later shows a real skew; the cheap way to keep that option open is to **record the input method on every submitted round from day one** without scoring on it. Then the decision can be made from your own numbers instead of from the studies above.

**Risk 2 — in a 60-second round, thinking dominates typing.** At 36 WPM a mobile player could physically type ~36 words in 60 s. Nobody will *think of* 36 words. The binding constraint is recall, not input speed. That has a direct implication: **optimising the keyboard is not where the wins are.** Category hints, prompt fairness and rarity-weighted scoring all buy far more than a faster key layout. Keep the custom keyboard for reliability and haptics, but do not treat input as the main design problem — the data says it is not.

**My revised recommendation: build the free-text design with categories.** It is your differentiator, it is defensible, and the mechanism that kills it is one you have already identified a fix for.

---

## 8. MARKET COMPARISON

Live from Apple's iTunes Lookup/Search API (US storefront), 2026-09-30:

```
$ curl -s "https://itunes.apple.com/lookup?id=687877464&country=us" | node fmt.js
Stop - Categories Word Game | dev=Fanatee | rating=4.60 | ratings=106384
  | released=2014-01-29 | updated=2026-01-19 | size=166.5MB | langs=9 [NL,EN,FR,DE,IT,PT,RU,ES,TR]
```

| App | Developer | Rating | Ratings | Size | Langs | Input |
|---|---|---|---|---|---|---|
| **Stop – Categories** | Fanatee | 4.60 | 106,384 | 167 MB | **9** | Keyboard, 5 categories, 1 letter, **60 s** |
| **Word Blitz** | LOTUM one | 4.68 | 44,746 | 94 MB | **16** | Swipe grid |
| **Ruzzle** | MAG Interactive | 4.18 | 7,881 | 471 MB | **13** | Swipe grid, 2 min |
| **Word Domination: PvP** | MAG Interactive | 4.72 | 42,705 | 337 MB | **9** | Tiles, 45+ boosters |
| **Boggle With Friends** | Zynga | 4.48 | 44,462 | 302 MB | — | Swipe grid |
| **Words With Friends** | Zynga | 4.57 | 751,870 | 390 MB | — | Tiles, async |
| **Wordscapes** | PeopleFun | 4.83 | **1,134,478** | 412 MB | — | Letter wheel |
| **Wordle! (clone)** | Lion Studios Plus | 4.58 | 842,188 | 258 MB | — | On-screen keyboard |
| **NYT Games** | New York Times | 4.80 | 293,495 | 140 MB | — | On-screen keyboard |

Verbatim from the store listings:

```
$ curl -s "https://itunes.apple.com/lookup?id=1489340645&country=us" | node desc.js
══════ Word Blitz ･ (LOTUM one GmbH) ══════
"Word Blitz is easy: Swipe to link adjacent letters. ... But don't wait too long
 – you're racing against the clock."

══════ Stop - Categories Word Game (Fanatee) ══════
"Stop starts by randomly selecting five categories and one letter. You then have
 60 seconds to think up five words—one for each category—that begin with that letter."
 "200+ captivating categories (and counting!)"
```

**Three takeaways that survive into your plan:**

1. **Your 60-second decision matches the closest commercial analogue exactly.** Stop is 60 s; the audited code is 300 s.
2. **App size is not a constraint.** 94–471 MB is the norm. Your entire game data budget is 304 KB (§4.3) — 0.3% of Word Blitz's install.
3. **Every serious competitor ships 9–16 languages, all validated locally.** None could be offline otherwise. §4.4–4.5 is how you get there, the licence status of each target, and why German is excluded.

**Theme positioning — still open:**

```
$ search "medieval word game" 6
  957031988   Languinis: Word Puzzle Game     Tilting Point LLC   r=4.64 n= 30952  238MB
  1563215345  Word Roll - Fun Word Game       PlaySimple Games    r=4.93 n= 83455  339MB
  321916506   Classic Words With Friends      Zynga Inc.          r=4.48 n= 85947  382MB
  1237172656  Word Domination: PvP Word Game  MAG Interactive     r=4.72 n= 42705  337MB
  670587290   Classic Words (solo word game)  Lulo Apps           r=4.78 n=123504   85MB
  979597990   Word Master - Classic           Luis Gualandi       r=4.85 n= 18870  108MB

$ search "word battle rpg" 3
  1237172656  Word Domination: PvP Word Game  MAG Interactive     r=4.72 n= 42705  337MB
  6762883810  Words Quest: Word battle        Anton Pavlov        r=0.00 n=     0  148MB
  1284514894  Syllablade                      Naquatic            r=4.45 n=   769  200MB
```

Searching "medieval word game" returns **no medieval-themed word game** — just relevance fallbacks. The nearest fantasy entries are tiny (Syllablade 769 ratings, Words Quest zero). **Caveat stated plainly:** this is top-6 relevance on one storefront, not an exhaustive catalogue scan. It shows the niche is not *visibly* occupied, not that nothing exists. Combined with the leaders being visually theme-neutral, the medieval identity remains your most defensible differentiator — and §3.7 shows it is currently the least implemented part of the product.

---

## 9. PLATFORM PATH — Google Play first (verified today)

Your answer: phone + tablet apps, Google Play first, App Store if easy. Every requirement below is from a primary source, checked on 2026-09-30.

### 9.1 Capacitor is current and is the right wrapper

```
$ npm view @capacitor/core version
8.5.2
$ npm view @capacitor/android time --json | node newest.js
newest publish: 8.5.3-nightly-20260930T151528.0 at 2026-09-30
```

Actively maintained — a nightly shipped today. Capacitor wraps your existing React build with no rewrite, and the same project produces the iOS target later.

### 9.2 You are already past the API-level deadline — target API 36 from day one

From `developer.android.com/google/play/requirements/target-sdk`:

> "Starting August 31, 2026: New apps and app updates must target Android 16 (API level 36) or higher to be submitted to Google Play"
> "If you need more time to update your app, you'll be able to request an extension to November 1, 2026."

Today is **2026-09-30**. That deadline has passed; the extension expires in about a month and does not apply to a new app. **Capacitor 8 is therefore mandatory** — Capacitor 7 targets API 35.

### 9.3 In-app purchases must use Play Billing

From Google Play's Payments policy (`support.google.com/googleplay/android-developer/answer/10281818`), the items requiring Play billing include:

> **Digital items:** "virtual currencies, extra lives, additional playtime, add-on items, characters, or avatars"
> **App functionality:** "ad-free version of an app or new features not available in the free version"

Your power-ups and store are squarely in scope. Current library versions:

```
$ curl -s "https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/maven-metadata.xml" | grep -oE "<version>[0-9.]+</version>" | tail -6
<version>8.1.0</version>
<version>8.2.0</version>
<version>8.2.1</version>
<version>8.3.0</version>
<version>9.0.0</version>
<version>9.1.0</version>
```

Minimum required is 8+; **9.1.0** is current. Budget 15–30% of gross to Google.

### 9.4 ⚠️ The launch gate most indies do not see coming

```
$ curl -sL "https://support.google.com/googleplay/android-developer/answer/6112435?hl=en" | sed 's/<[^>]*>//g' | grep -iA1 "registration fee"
 There is a US$25 one-time registration fee ...
 (Personal accounts only) Step 6: Meet testing requirements and device verification requirements
 Developers with personal accounts created after November 13, 2023, must meet specific
 testing requirements before they can make their app available on Google Play.
```

Following that through to the policy page:

> "At least 12 testers must be opted in to your closed test when you apply for production access, and they must have been opted in continuously for the preceding 14 days."
> "You must run a closed test before applying to publish your app to production."

Google then reviews, typically within seven days.

**You have chosen a personal account, so this gate applies. Budget a minimum of three weeks between "build is ready" and "live on Play": 14 days of continuous closed testing with 12 real opted-in testers, plus up to 7 days of review.** Recruit the 12 testers now — this is the item most likely to slip the launch date, and starting early costs nothing.

For the record, the full comparison (Google's own documentation), since it also governs what becomes public:

| | **Personal** (chosen) | Organization |
|---|---|---|
| Shown publicly on Google Play | "your legal name, your country (as per your legal address), and developer email address" | "your legal name, legal address, developer email address, and developer phone number" |
| D-U-N-S number | not required | required — "This process can take up to 30 days" |
| Also required | legal name, legal address, contact email and phone | organization name, address, **website**, contact person |
| Closed-testing gate | **12 testers, 14 continuous days** | exempt |
| Registration fee | US$25 one-time | US$25 one-time |

Personal is the right call for a first launch: no D-U-N-S wait, no business registration, and your home address is not published — only your country. The cost is the three-week testing gate, which is schedulable. Two practical consequences: your **legal name will be visible** on the store listing (not a studio name), and the 12 testers must be **12 distinct Google accounts opted in continuously** — dropping below 12 at any point restarts the 14-day clock.

### 9.5 iOS "if easy"

Capacitor produces the iOS target from the same codebase, so the marginal engineering is small. The non-engineering costs are not: Apple Developer Program is a recurring annual fee, and App Store review is stricter than Play's. **Recommendation: ship Play, learn from real retention data, then port.** Nothing in the architecture below blocks it.

---

## 10. BACKEND — priced options for "low budget, not free tier"

Multiplayer, leaderboards, IAP validation and anti-cheat all need a server. Critically, they need a **server-authoritative** one: all scoring currently happens in the browser (§2), duplicate words score freely (§3.3), and the full client source is recoverable from shipped maps (§3.10). Any leaderboard built on the current client would be forged in a day. The governing principle:

> "The game client is an input device, not an authority. It is allowed to tell the server what the player did. It is never allowed to tell the server what the player earned."

**Minimum viable protocol:** server issues the round seed (letter + category sequence) and a signed round token → client returns the word list with timestamps → server re-scores against the same dictionary and rejects impossible submission rates. Everything else is built on that.

### Priced shortlist, all verified 2026-09-30

| Option | Price | Included (verified) | Fit |
|---|---|---|---|
| **Supabase Pro** ✅ | **$25/mo** | 8 GB disk, 100,000 MAU, 100 GB storage, 250 GB egress, 500 realtime connections, 5 M messages/mo, $10/mo compute credit | Postgres + Auth + Edge Functions + Realtime in one. Leaderboards are SQL. Spend caps on by default. |
| **Cloudflare Workers Paid** | **$5/mo** | 10 M requests/mo (+$0.30/M), 30 M CPU-ms (+$0.02/M), Durable Objects on both backends | Cheapest credible scoring API. You assemble auth and storage yourself. |
| **Firebase Blaze** | pay-per-op | No flat fee | Purpose-built for games, but per-operation billing is the classic indie bill shock. Leaderboard reads are exactly the wrong shape for it. |
| **Nakama (self-host)** | Apache-2.0, $0 licence + VPS | Leaderboards, matchmaking, chat built in | Purpose-built and free, but you own Postgres, backups, monitoring and on-call. Managed "Heroic Cloud" starts around $600/mo — out of scope. |

From Supabase's own pricing page:

> Free: "500 MB database size", "50,000 monthly active users", "1 GB file storage", "5 GB egress", "200" realtime connections
> Pro (from $25/mo): "8 GB disk size per project", "100,000 monthly active users", "100 GB file storage", "250 GB egress", "500" realtime connections, "5 Million" messages, "$10/month in compute credits"

From Cloudflare's Workers pricing page:

> Workers Paid: "$5 USD per month", "10 million included per month" + "$0.30 per additional million", "30 million CPU milliseconds included per month" + "$0.02 per additional million"

### Recommendation

**Start on Supabase Pro at $25/month.** It matches your brief exactly — paid rather than free-tier, but a rounding error against a $25 Play registration fee. Daily/weekly/monthly/yearly leaderboards are four SQL views over one `rounds` table; scoring runs in an Edge Function; auth and Play receipt validation live in the same place. 100,000 MAU of headroom means you will not revisit this decision before the game succeeds. If costs ever bite, the scoring endpoint moves to Cloudflare Workers ($5/mo) without touching the data model.

**Do not start with Firebase** unless you have modelled the read volume. A leaderboard is read-heavy by nature, which is precisely where per-operation billing turns unpredictable.

---

## 11. MONETIZATION

Directional benchmarks (vendor reports, methodologies differ — treat as ranges, not facts):

- Rewarded video **$15–40 eCPM** tier-1 vs **$5–15** interstitial vs **under $2** banner (AppLovin 2025 publisher benchmarks).
- US averages: rewarded **$16.49** Android / **$19.63** iOS; interstitial **$14.08** / **$14.32**.
- Puzzle/casual ARPDAU (US) **$0.07–$0.16**; puzzle D7 retention ~4.5%.
- Players prefer rewarded to interstitial roughly **4:1**; hybrid ads+IAP reports 30–66% higher ARPDAU than single-model.

**Policy constraints are primary-sourced** (`support.google.com/googleplay/android-developer/answer/9857753`):

> "Full screen interstitial ads of all formats (video, GIF, static, etc.) that show unexpectedly, typically when the user has chosen to do something else, are not allowed."
> "Ads that appear during game play at the beginning of a level or during the beginning of a content segment are not allowed."
> "Full screen interstitial ads of all formats that are not closeable after 15 seconds are not allowed."
> "Full screen video interstitial ads that appear before an app's loading screen (splash screen) are not allowed."

And the permitted placement:

> "Opt-in full screen interstitials or full screen interstitials that do not interrupt users in their actions (for example, after the score screen in a game app) may persist more than 15 seconds."
> "This policy does not apply to rewarded ads which are explicitly opted-in by users."

**Concrete rules for your build.** A 60-second round makes ad placement *more* delicate, not less — the interruption is proportionally larger.

- Interstitial fires **only after the EndGame score screen**. Never after "Enter the Battle", never during the 3-second countdown (that would be an "ads before content segment" violation).
- Cap at roughly **one interstitial per 3 rounds**. At 60 s per round, per-round ads would mean an ad a minute.
- **Rewarded video is the primary surface**, given the 3–4× eCPM gap and the 4:1 preference: "+30 seconds", "reveal a category hint", "restore your multiplier", "reroll a hard prompt". Every one of those maps to a mechanic §5 and §6 already create.

---

## 12. ROADMAP

**Phase 0 — clean slate (hours)**

1. `git checkout -- src/` to discard the 8 unstaged CSS changes (your call, per answer 6).
2. Delete `CODEBASE_ANALYSIS.md`, `board.css`, `src/mainstyles/variables/*` (or wire them up), all 30 images, `hurray.wav`, `sword2.wav`.
3. New project on **Vite + React 19**. Retires most of the 58 advisories and the dead CRA toolchain.

**Phase 1 — a game that works offline (1–2 weeks)**

4. Build the SCOWL ≤70 dictionary + 4-bit tier array + 16-bit category mask. **304 KB brotli**, loaded once into a `Set`, 0.084 µs lookups. Ship the SCOWL and WordNet copyright notices in an in-app credits screen.
5. Rule generator with the difficulty bands from §5. **Exclude the 4 impossible prompts.** Implement the locked scoring formula from §5.5 — `base × rarity × tier × category`, no platform factor.
6. Category hints from §6 — bonus scoring, never a hard filter.
7. Case-insensitive matching; reject duplicates; multiplier read from the reducer.
7b. **Record input method (touch / physical keyboard) on every round, but do not score on it.** Near-zero cost now; it is the only way the §7 leaderboard-segmentation question can later be answered from your own data.
8. 60 s default, configurable; the three difficulty tiers.
9. Web Audio with pooled buffers; four Opus effects, ~60 KB total.
10. **Keep the test suite.** Twelve tests caught six defects in twenty minutes.
11. `GENERATE_SOURCEMAP=false`; asset-integrity check in CI (`file` type + min size + referenced).

**Phase 2 — the medieval identity (1–2 weeks, parallel)**

12. Implement the theme. CSS/SVG parallax battlefield for "warriors in the distance" — scalable, tiny, GPU-cheap; no GIFs.
13. Real dark mode (currently 4 CSS rules).
14. Fix the 15 keyboard-inaccessible controls: real `<button>` elements, no `tabIndex={-1}` on things claiming `role="button"`, remove `user-scalable=no`.

**Phase 3 — ship to Play (2–4 weeks, gated by testers)**

15. Capacitor 8, target API 36. Register the **personal** developer account ($25) — no D-U-N-S, no business address published, your legal name appears on the listing (§9.4).
16. **Recruit 12 closed testers now — this is the schedule's critical path.** 12 distinct Google accounts, opted in *continuously* for 14 days (dropping below 12 restarts the clock), then up to 7 days of review. Start before the build is finished.
17. Supabase Pro ($25/mo): auth, server-authoritative scoring, the four leaderboard windows.
18. Play Billing 9.1.0 for the store and power-ups.
19. Rewarded video first; interstitial after the score screen only, ~1 in 3 rounds.

**Phase 4 — expand**

20. **Language wave 1: Spanish, French, Italian, Dutch** (§4.5 — all MPL/BSD/MIT-clean, all shipped by every competitor). Per language: extract the word list, rebuild the difficulty bands from that language's own letter distribution, re-check whether categories are available.
21. **Language wave 2: Portuguese (BR), Danish, Turkish** — all licence-clean.
22. German stays out until a non-GPL source exists (§13.1). Swedish is LGPL-3 only — defer.
23. Real-time PvP. iOS port via the same Capacitor project.

---

## 13. REMAINING OPEN QUESTIONS

All prior questions are resolved and folded into §0. Nothing blocks Phase 0, 1 or 2. What is left is genuinely deferred, not unknown:

1. **German.** Excluded from the rollout because the free dictionary is GPL-only (§4.5), yet it is in all four competitors' language sets. Worth solving once revenue justifies it: commercial licence, permissive corpus, or written permission from the maintainer. No action needed now.
2. **Categories beyond English.** WordNet is English-only, so §6's category hints do not automatically travel. Open Multilingual WordNet is the obvious candidate but needs its own per-language licence check before any non-English category feature is promised.
3. **Whether to segment leaderboards by input method.** Deferred by decision (§7). Keep the option open at near-zero cost by recording input method on every round from day one and deciding from your own data later.
4. **Scoring weight tuning.** §5.5 gives starting values, not final ones. Because scoring runs server-side (§10), these are retunable without an app update — so this resolves itself with live rounds rather than with more analysis.

---

## APPENDIX — sources

**Primary (fetched and quoted directly):** Google Play target API requirements; Google Play Ads policy; Google Play Payments policy; Google Play Console registration & testing requirements; Supabase pricing; Cloudflare Workers pricing; Collins Scrabble Words terms; SCOWL copyright (Kevin Atkinson); Princeton WordNet 3.0 licence; dwyl/english-words LICENSE; first20hours/google-10000-english LICENSE; hermitdave/FrequencyWords README; LibreOffice dictionaries per-language licences; npm registry; Maven (Google) billing metadata; Apple iTunes Lookup & Search API.

**Peer-reviewed:** Dhakal et al., *Observations on Typing from 136 Million Keystrokes*, CHI 2018 (n=168,960). Palin et al., *How do People Type on Mobile Devices?*, MobileHCI 2019 (n=37,370).

**Secondary / directional (vendor benchmark reports, quoted as ranges):** AppLovin 2025 publisher benchmarks; RevenueLab AdMob eCPM benchmarks 2026; MAF rewarded-ad benchmarks; Sensor Tower State of Gaming 2026; Playio interstitial retention analysis.
