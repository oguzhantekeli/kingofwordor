# King of Wordor — Inventory, Competitive UI Review & Improvement Log

**Date:** 2026-10-06 · **Branch:** `rewrite/vite-capacitor` (local only — see §7)
**Method:** I screenshotted the real app on a phone viewport (412×892, the Galaxy M31 class it was tested on), pulled competitors' own App Store screenshots through Apple's iTunes Lookup API, researched retention mechanics from primary sources, then rebuilt and re-screenshotted every screen. Every number below was produced by a command in this session.

---

## 1. What the app looked like before this session

```
$ node shoot.mjs        # headless Chromium, 412x892 @2x, real dev server
console errors: none
01-home.png  02-play.png  03-typing.png  04-after-submit.png  05-results.png
```

Defects found **by looking**, not by reading code:

| # | Screen | Defect |
|---|---|---|
| 1 | Play | **The prompt misstated the rule.** "A PLANT THAT STARTS WITH D — 3923 words will do it": 3923 is every D-word, and the category is only a bonus, so `dog` is accepted. |
| 2 | Play | **A typo stole your prompt.** Any rejection advanced to a new prompt — and made typing junk a free skip. |
| 3 | Play | ~550 px of empty black between the input and the keyboard; the hero floated in a void. |
| 4 | Play | No battlefield at all on the screen where players spend ~95% of their time. |
| 5 | Play | `⌫` and `⏎` rendered as tiny fallback glyphs (verified missing from the font — §4). |
| 6 | Home | Stars drawn *inside* the title letters; the moon was a beige rectangle. |
| 7 | Home | Two of three modes said "SIGN IN TO UNLOCK" — **neither existed**. Signing in could not unlock them. |
| 8 | Results | Zero score painted in the success green; no records, no progress, nothing to come back for. |
| 9 | All | Scores like `17.32` — every competitor shows integers. |

---

## 2. Competitor UI comparison (their own store screenshots)

```
$ curl -s "https://itunes.apple.com/lookup?id=$ID&country=us" | node -e "...screenshotUrls..."
stop: 3 screenshots   wordblitz: 3   wordscapes: 3   worddomination: 3   nyt: 3
```

| Pattern seen in competitors | Where | Adopted |
|---|---|---|
| **One huge letter as the hero** | Stop shows a single giant "A" | ✅ 64×64 letter tile; condition beside it |
| **The current word as big tiles** | Word Blitz "BEAR" pill; Wordscapes "BRAIN" | ✅ typed letters render as pixel tiles |
| **Floating score popups** | Word Domination "+20" | ✅ "+142" rises from the hero |
| **Integer scores** | Word Blitz 2024; Word Domination 115 | ✅ points ×10, rounded per word |
| **Rich, living background** | Wordscapes scenery; Word Blitz gradient | ✅ animated pixel battlefield |
| **Hints / boosters with counts** | Stop lightbulb ×2; Word Domination boosters | ⚠️ Skip exists (costs 3 s); a booster store is not built (§6) |
| **Currency visible** | Stop coins | ❌ not built — needs the store decision (§8) |

---

## 3. Research basis for the retention changes

| Claim | Source (fetched this session) |
|---|---|
| Puzzle games retain ~31.85% D1, 12.18% D7, 5.35% D30; D1 = first session, D7 = habit, D30 = progression and live ops | GameAnalytics 2025 benchmarks (via secondary reports) |
| Streak mechanics measured **+14% D7 retention**; Weekend Amulet: **+4%** returning a week later, **−5%** streak loss | Duolingo's own blog post on streaks |
| "Juice": small feedback details turn a flat game into an engaging one | Jonasson & Purho, *Juice it or lose it* (2012) |
| Counterpoint: juice must not obstruct play | Game Developer, "Indies, resist the urge to 'juice it or lose it'" |

That counterpoint shaped the design: every panel over the battlefield is opaque, popups were moved twice until they covered nothing the player reads (§5.4), and `prefers-reduced-motion` renders one still frame.

---

## 4. THE INVENTORY

Status legend: ✅ improved this session · 🆕 new this session · ➖ unchanged · 🗑 removed

### 4.1 Assets — all generated from source, nothing binary committed

| Asset | Bytes | Status | What changed / evidence | Further improvement |
|---|---|---|---|---|
| `dict/en.kowd` | 1,345,134 | ➖ | 110,248 words, SCOWL ≤70 + WordNet categories | Per-language builds (ES, FR, IT, NL…) via the same pipeline |
| `sprites/knight-*.png` ×4 | ~3.4 KB each | ➖ | 4 houses × 4 animations | A "victory" pose; armour tiers unlocked by rank |
| `sprites/realm-*.png` ×4 | ~930 each | 🆕 | Foot soldiers in the player's house colours: walk/attack/block/fall | Archers and banner-bearers for variety |
| `sprites/horde.png` | 958 | 🆕 | Horned helms, ash-red rags; a generic dark host | A boss unit for the daily siege |
| `sprites/fire.png` | 503 | 🆕 | 6-frame flame from seeded noise | Burning-banner variant |
| `sfx/hit.opus` | 748 | ➖ | key press | Pitch-vary per key so fast typing doesn't drone |
| `sfx/correct.opus` | 3,287 | ➖ | accepted word | Escalate pitch with the streak |
| `sfx/wrong.opus` | 2,183 | ➖ | rejected word | — |
| `sfx/warning.opus` | 1,239 | ✅ | **Shipped since build 1 but never played** (`grep` found 0 call sites). Now: one sting at 10 s, then each of the last 5 | — |
| `sfx/charge.opus` | 6,032 | ➖ | round start | — |
| `music/theme.opus` | 162,901 | ➖ | 22 s loop, D dorian | A tenser variant for the last 10 s |
| `fonts/*.woff2` ×3 | 48,220 total | ➖ | Silkscreen + Outfit, bundled (SIL OFL) | Silkscreen lacks `⌫ ⏎ −` (verified); avoid those glyphs in copy |
| `icons/*` | 11,388 | ➖ | favicon + apple-touch | Adaptive icon with the battlefield silhouette |

Byte-reproducibility, verified:

```
$ sha256sum public/sprites/*.png > a.txt && node tools/build-sprites.mjs && sha256sum -c a.txt
files byte-identical: 10
$ node tools/verify-assets.mjs
all 20 assets verified
```

The missing-glyph finding, from the font file itself:

```
$ python glyphs.py   # fontTools on public/fonts/silkscreen-400.woff2
  BACKSPACE ⌫    U+232B  MISSING -> falls back to another font
  RETURN ⏎       U+23CE  MISSING -> falls back to another font
  MINUS −        U+2212  MISSING -> falls back to another font
  TIMES ×        U+00D7  PRESENT
```

I had written `−3s` (U+2212) into the new Skip label; this check caught it before it shipped. It is now ASCII `-3s`.

### 4.2 UI components

| Component | Status | What changed | Further improvement |
|---|---|---|---|
| **Battlefield** (`src/ui/battlefield/`) | 🆕 | Canvas pixel-art battle: two hosts fighting, burning keep, field fires, embers, dust, smoke, ash, blood moon, drifting wisps, parallax ridges. **Reacts to play**: a scored word drops a Horde soldier, a miss costs a Realm one, a streak raises the intensity. | Weather (rain at night); a siege engine for the daily |
| **Knight** | ➖ | Now anchored *in* the battle line on every screen | Equipment skins as rank rewards |
| **Keyboard** | ✅ | Pixel-SVG `⌫`/`⏎` (glyphs were missing); raised keys with a pressed state | Optional haptic per key; swipe-to-delete |
| **useCountdown** | ➖ | Deadline-based clock | — |
| **Rampart** | 🗑 | Replaced by the Battlefield; **0 importers** after the redesign, so removed rather than left as dead code | — |

### 4.3 Screens

| Screen | Status | What changed | Further improvement |
|---|---|---|---|
| **Home** | ✅ | Battlefield hero; rank + XP bar; **Daily Siege card first** with streak flame and countdown to the next; honest "Coming soon" on Duel; Ladder entry; difficulty open to guests (§8) | A "today's best word" tease |
| **Play** | ✅ | Hero letter tile; rule vs. **bonus** separated; word as tiles; popups from the hero; streak badge; Skip (−3 s); quit moved to the HUD; one fixed row of played chips | Combo meter (needs your call, §8) |
| **Results** | ✅ | Count-up score; NEW BEST / PROMOTED / streak banners; XP + rank bar; best word, rarest word, best streak; spoiler-free share grid 🟩🟥⬛; "Again" replays the *same* mode | Rematch-the-same-seed challenge link |
| **Ladder** | 🆕 | Day / Week / Month / Year tabs; highlights your row; honest states for not-deployed, loading, error, empty | Friends filter; house standings |
| **Profile** | ✅ | **Delete now really deletes** (was local-only); **sign-out ends the server session** (was local-only) | Stats page (rounds, words, best word) |
| **delete-account.html** | 🆕 | The web deletion page Play requires, usable without the app | Host it (§7) |
| Countdown, Settings, Credits | ➖ | — | Battlefield behind the countdown |

### 4.4 Game systems (`src/core/`, pure TypeScript, no React)

| System | Status | What changed | Tests |
|---|---|---|---|
| **Scoring** | ✅ | Integer points: `round(base × rarity × tier × category × 10)` per word. Formula unchanged; only the unit. | sum-equals-total |
| **Round** | ✅ | **A rejection keeps the prompt.** New `skip()` advances it, logged as an event | RULE ×4, REPLAY |
| **Daily Siege** | 🆕 | Same seed for everyone per local date (FNV-1a), one attempt, siege #N | 17 progress tests |
| **Streak** | 🆕 | Consecutive days; one missed day resets but keeps the best; exact across month/year/leap boundaries | ✅ |
| **Rank ladder** | 🆕 | 9 ranks, Peasant → **King of Wordor**; XP = points + 10, doubled for the daily | ✅ |
| **verify.ts** | 🆕 | Server-side replay; a forged score is replaced and flagged | 13 anti-cheat tests |
| **Languages** | 🆕 2026-10-07 | 7 languages (`lang.ts`): per-language alphabet, accent folding, Turkish casing; dictionary format 2 (`.kowd` carries its language, everyday tier and band scale; read as bytes + binary search, no strings); prompt bands scaled to each language's everyday pool | 60 language tests, golden English test |

### 4.5 Backend (`supabase/`) — new, tested on real PostgreSQL 18.3 (PGlite)

| Piece | What it does | Evidence |
|---|---|---|
| `profiles`, `rounds` + RLS | **Clients can never write a score**; players read only their own rounds | "a signed-in player CANNOT insert a round" ✓ |
| One daily per player per day | Enforced by a unique index, not the client | `rounds_one_daily` ✓ |
| `leaderboard(period, anchor)` | Day / week / month / year. Exposes only rank, name, house, score, sieges, `is_me` — never ids | 7 ladder tests ✓ |
| `delete_my_account()` | Cascades auth user → profile → rounds | ✓ |
| `functions/submit-round` | Thin HTTP wrapper around `verifyRound()` | ⚠️ not run locally (§7) |

```
$ npx vitest run supabase
      Tests  17 passed (17)
```

### 4.6 Platform

| Module | Status | Note |
|---|---|---|
| `audio.ts` | ✅ | `warning` now used — all 5 SFX have a call site |
| `supabase.ts` | ✅ | `submitRound`, `fetchLeaderboard`, `deleteAccount`, `signOutEverywhere` |
| `haptics`, `storage`, `splash`, `android-config` | ➖ | — |

---

## 5. Bugs found and fixed this session

### 5.1 Battlefield duels could freeze forever
A newcomer arriving on guard while the survivor was also on guard meant neither ever attacked. Guarded by a test that runs 5 simulated minutes:

```
✓ NO DUEL EVER STALLS: every duel keeps producing falls over 5 minutes
```

### 5.2 A scored word took seconds to drop a soldier
Measured across 300 seeds in realistic play (a word every 2.5 s):

| | p50 | p90 | p99 | same frame |
|---|---|---|---|---|
| first version | 1.40 s | 3.73 s | 4.50 s | — |
| final | **0.00 s** | **0.77 s** | **1.17 s** | **87%** |

Two causes: survivors swung at newcomers still walking in, and reinforcements walked from the screen edge (~12 s for the far duel). Locked in as a test.

### 5.3 Rendering spikes — and a wrong hypothesis, corrected
At 4× CPU throttle, drawing cost p50 1.3 ms but **p95 25 ms**. Caching the static sky in offscreen layers fixed it: **p95 0.8 ms**. Remaining periodic spikes looked like GC; I made the hot path allocation-free, and **the spikes did not move — the GC hypothesis was wrong.** Forcing a per-frame flush then dropped spikes over 8 ms **from 17 to 1** in 2000 frames: an artifact of a benchmark loop that never yields. The real app, measured directly:

```
TEST 2 (real app, rAF frame gaps over 10 s @4x): {"frames":602,"p50":"16.7","p99":"16.8","worst":"16.8","longTasks":0}
```

### 5.4 Popups that covered what the player reads
Three placements, verified by screenshot each time: over the rule card (hid the bonus badge) → inside the word box (hid the next word being typed) → **rising from the hero into the sky** (covers nothing).

### 5.5 The knight jumped mid-round
Played-word chips wrapping to a second row shrank the stage. Now one fixed-height row, and the battle line is anchored to the knight's actual feet.

### 5.6 Account deletion did not delete
The dialog promised deletion of "your account and everything stored with it"; the button called only `forget()` (local). Now it calls the server, and **keeps local data if the server call fails**, so a player never loses progress while keeping their server data.

---

## 6. What is NOT done

- **In-game store / boosters / currency** — needs product decisions (§8).
- **AdMob wiring** — plugin installed; needs real ad unit IDs.
- **Ranked Duel** — shown honestly as "Coming soon".
- **Edge Function not executed locally** — no Deno or Supabase CLI here. Its logic (`verifyRound`) is tested, and a contract test proves the client's real payload verifies to the identical score, but the HTTP wrapper itself has never run.
- **Schema not deployed** to your project (verified: `GET /rest/v1/profiles` → 404 "Could not find the table").
- **Countdown, Settings, Credits** not restyled.

---

## 7. Verification, end to end

```
1/7 lint              (clean)
2/7 typecheck         ok
3/7 tests             Test Files 15 passed · Tests 137 passed
                      Lines 99.36% · Branches 92.89% · Functions 100%
4/7 sprites           files byte-identical: 10
5/7 assets            all 20 assets verified
6/7 build             dist/index.html · dist/delete-account.html · built in 232ms
7/7 audit             found 0 vulnerabilities
```

---

## 8. Decisions I made that you should review

1. **Difficulty is open to guests.** The Oct 2 build deliberately locked guests to Knight. I reversed it: D1 retention is the first session, and a first-time player had no gentle Squire option. Difficulty needs no server. Easy to re-lock.
2. **The prompt survives a wrong word; Skip costs 3 s.** A rule change — previously any rejection advanced.
3. **Integer points (×10).** The formula is unchanged. Bests stored by the Oct 2 builds are **migrated** (17.32 → 173), so no player gets a false "new best" — covered by a migration test.
4. **The ladders rank the Daily Siege**, with week/month/year as sums. Solo scores across difficulties aren't comparable.

Added 2026-10-07, with the languages:

5. **One setting for menus and words.** Picking Türkçe plays Turkish words in a Turkish interface; there is no "English menus, Turkish words". First launch follows the phone's language; existing installs stay English.
6. **Accents are folded, letters in their own right are kept** — the convention of Termo, Wordle ES and Sutom: *canción* = *cancion*, but *año* ≠ *ano*, and Turkish *ı* ≠ *i*. The keyboards carry Ñ, Æ Ø Å and the Turkish letters, no accent keys.
7. **Outside English every valid word is accepted at every difficulty.** English Squire still rejects SCOWL's obscure tiers; no other language has that split, so there the frequency tiers (from Tatoeba) only shape scoring and prompt difficulty.
8. **Records are per language; rank is not.** Best score, the daily (one per language per day) and the ladder are per language; XP, rank and the day streak count every language.
9. **Portuguese and Turkish lists are trimmed**, by measurement: Portuguese keeps every form of each lemma seen in use (99.86% of real word uses accepted), Turkish keeps lemmas, seen forms and the 1000 most-used suffixes (98.82%). Turkish names, which its dictionary stores in lowercase, are removed when people only ever write them capitalised: 261 lemmas, including about ten real words mostly seen inside names (*gaga*, *terazi*, *tuval*).
