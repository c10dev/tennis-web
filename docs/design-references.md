# Design references and art direction (M6)

> **요약 (한국어)**
> - 현재 UI는 어두운 남색 패널, 노란 강조색 하나, 시스템 폰트, 기본 도형 마네킹이라서 "프로토타입"처럼 보인다. 보상 화면은 아직 M5 형태다(소수점 `+1%`, 결정적 포인트 리플레이 없음).
> - 레퍼런스(마블 스냅의 동시 공개, 발라트로의 카운트업, 클래시 로얄의 트로피 로드, 슬레이 더 스파이어의 의도 아이콘, 테니스 중계 스코어 버그)를 화면과 순간별로 정리하고, 가져올 것과 버릴 것을 적었다.
> - **아트 디렉션 3안:** A "Night Session"(지금 모습을 다듬은 야간 중계풍, 가장 저렴), B "Rally Pop"(밝은 툰 3D, 스티커 카드, 탄력 있는 모션), C "Tactics Board"(코치 작전판, 분필 화살표).
> - **추천: B "Rally Pop", 단계적으로.** 캐주얼 1–2분 루프, 텔 가독성, 보상 타격감에 가장 잘 맞고, 기본 도형 선수가 의도된 스타일로 보이게 된다.
> - **어느 안이든 바로 고칠 것:** 지금의 카드 색은 적색약 시뮬레이션에서 수비(파랑)와 카운터(보라)가 거의 같은 색이 된다(ΔE 2). 카운터를 청록으로 바꾸고 카드마다 아이콘을 붙인다.
> - 무드보드(원본 제작, 복사 이미지 없음): https://claude.ai/artifact/5JXJgMPvWaqprB7rzURTef (비공개, 사본은 `docs/design/style-tiles.html`)

Research gathered 2026-10-13 for M6 (ADR-017, GDD §13–§14). Builds on `docs/m3-assets-and-references.md` (audio, rig,
venue textures, Barlow Condensed, broadcast cameras), which this document does not repeat. No code was changed.
References are inspiration only: links, never copied images. Every font, icon set and asset pack below had its
license checked on a live page or a repo LICENSE file on 2026-10-13; "(unverified)" marks claims from search results
only. License classes follow the m3 doc (CC0 / MIT·OFL·CC-BY / no-redistribution / avoid).

## Starting point (screenshots of the dev build, 2026-10-13)
- **Title / ladder home:** centred yellow "TennisSim", system font, one gold button. The home shows rank `#45` in
  gold, a blue-to-gold progress bar, "Next opponent · #44 · Baseliner · level 12.9" and Play. Nothing yet about the
  opponent's habit (stream ② adds the scouting line) or the game plan (stream ①).
- **Decision point:** a dark bottom panel over the 3D view: "You v Nilin Torton", a gold `MATCH POINT` chip, "Your
  serve · 6-4", then three outlined cards (1 Attack / 2 Defend / 3 Counter) in red, blue and purple text with a
  thin strength bar. No opponent history, tell or icons yet.
- **Reveal:** two chips ("You · Attack" v "Defend · Nilin Torton") and green "You read it!" while the serve cam shows
  a red capsule player from behind against flat navy stands.
- **Result:** "You won 7-4", three equal tiles (+24 points, #45 → #42, 6 pts to #41), "Training from this match"
  with `+1%` on empty bars, Play again. Correct data, no hierarchy, no motion, nothing named.
- **Replay page / rally clips:** clay court, white lines, dark green stepped stands, umpire chair as grey boxes,
  capsule players with a paddle racket, small yellow-green ball with a blob shadow; score bug top-left (navy rows,
  gold points cell); dev controls on top.
- **Code facts that shape the options:** colours live in `ui/src/style.css` `:root` (`--bug-bg`, `--bug-accent`
  `#f2c94c`, `--text`, `--muted`, `--panel-bg`) and `renderer/src/tuning/scene.ts` `COLOURS`; every mesh is
  `MeshLambertMaterial`; lights are Hemisphere + Ambient + one Directional; no tone mapping, no post-processing.
  Barlow Condensed was accepted in M3 but is not wired in yet (body font is `system-ui`). Player A's red shirt
  (`0xd8433b`) sits close to the clay court (`0xc4673f`).

## 1. References by screen and moment

### 1.1 Ladder home (rank, progress, next opponent + scouting, game plan, Play)
| Reference | Take | Don't take |
|---|---|---|
| [Clash Royale Trophy Road](https://supercell.com/en/games/clashroyale/blog/release-notes/new-update-feature-enter-the-trophy-road) | One road with rewards along it; *gates* you cannot fall back past. Put a gate tick on the ladder bar so progress never visibly drops | Season resets (they undo the growth feeling); chest timers |
| [Tennis Clash, GameAnalytics case study](https://www.gameanalytics.com/blog/how-tennis-clash-scored-a-golden-set) | Same format as ours (first to seven points); one-tap Play, no tour picking | Coin bets, ads to double winnings, event tickets |
| [Retro Bowl review, MobileSyrup](https://mobilesyrup.com/2020/09/27/retro-bowl-football-game-review/) | Validates "sim plays, you act at the big moments"; a lean hub between games | Morale, owner meetings, contracts |
| [Slay the Spire intent icons](https://slaythespire.wiki.gg/wiki/Awakened_One) (unverified) | The scouting line as one icon + a short phrase ("attacks on big points"), the same icon reused at the decision point | Several stacked intents |

### 1.2 Decision point (banner, opponent read, three cards on 1/2/3)
| Reference | Take | Don't take |
|---|---|---|
| Slay the Spire intent icons (above) | **The tell as one icon over the opponent**, with a `?` or dimmed edge to say "about 70%". Players learn one icon language for habit, history and tell | Numbers on the icon (our tell has no magnitude) |
| [Golf Clash UX review, Game Developer](https://www.gamedeveloper.com/design/ux-review-golfclash-s-swing-to-success-) | Show the opponent's last choices while you wait ("putting you in your opponent's shoes"); grade words (Perfect / Great) over numbers | Chest slots with 2–8 h timers, gem skips |
| [Marvel Snap, Wikipedia](https://en.wikipedia.org/wiki/Marvel_Snap) + [Brode, GDC 2023](https://gdcvault.com/play/1029024/Designing-MARVEL-SNAP) (listing only) | Stakes shown as a label: Snap doubles the cube on the last turn. Our `MATCH POINT` banner is that label; a set/match point could say "×2 ladder points" if the reward ever scales | The cube economy and retreat |
| [Hearthstone rewards track](https://hearthstone.blizzard.com/en-us/news/23534414) | Cards feel like physical objects: lift on hover, settle on pick | Mana, text-heavy cards |
| [Tennis broadcast "MATCH POINT" callouts](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/) | Callouts fire from data and never cover the score | A full-screen takeover; the banner is one line |

### 1.3 Simultaneous reveal ("You read it!")
| Reference | Take | Don't take |
|---|---|---|
| [Marvel Snap's simultaneous turns, Game Developer](https://www.gamedeveloper.com/game-platforms/designers-don-t-sleep-on-marvel-snap-s-simultaneous-turns), [who reveals first, PCGamesN](https://www.pcgamesn.com/marvel-snap/who-reveals-first) | Face-down placement, a beat of suspense, then the flip. The closest analogue to our reveal | Snap's priority order (one side reveals first). We have one card each and pure rock-paper-scissors: **flip both at the same instant**, or the order hints at the result |
| [Nijman's Nuclear Throne breakdown, infovore](https://infovore.org/?p=5275) | When the cards clash: a 10–20 ms freeze, a one-frame white flash, a 6 px kick on the winning card | Constant screenshake; keep the rally clips calm |
| [Juice it or lose it](https://www.youtube.com/watch?v=Fy0aCDmgnxg), [The Art of Screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U) (talks, not re-watched) | Tween, squash, sound and shake added one layer at a time | Juice on every point; save it for the 3–5 big points |

### 1.4 Rally clips and the score bug (broadcast)
| Reference | Take | Don't take |
|---|---|---|
| [SVG, Designing the Modern Scorebug (2026)](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/) | Reading order first: points, then server, then names. The bug can expand for a few seconds and return | A loud bug; "the game stays the star" |
| [ATP Media × Deltatre package](https://www.advanced-television.com/2023/05/09/atp-media-deltatre-serve-up-new-broadcast-graphics/) | A stat slides out *of* the bug instead of a separate panel | Its soft neumorphic shadows: they lose contrast at small DOM sizes |
| [SMT US Open case study](https://smt.com/case-study/us-open-tennis/) | Stats expand from the bug without hiding play; bold, high-contrast blocks | 3D venue flyovers |
| [Rothenberg on Wimbledon name rules](https://www.benrothenberg.com/p/wimbledon-scores-scoreboard-names-graphics-tennis-names-what-d-fokina-is-on-screen-at-wimbledon) | One documented name rule; narrow the type before truncating (Barlow Condensed) | Mid-word cuts, ad-hoc hyphenation |
| [UTS match rules](https://www.uts.live/match-rules/), [Girraphic UTS graphics](https://girraphic.com/work/ultimate-tennis-showdown/), [UTS × Deltatre](https://www.svgeurope.org/blog/headlines/ultimate-tennis-showdown-enhances-graphics-for-2021-2022-series-with-deltatre/?print=1) | Short-format tennis *with cards*: card states fed from data, a card pip per player, a separate "Sudden Death" bumper, player bumpers and a match summary card | The 15-second shot clock and quarter structure |
| [Mario Tennis Aces, Super Mario Wiki](https://www.mariowiki.com/Mario_Tennis_Aces) | Trail colour per shot type (topspin, slice, lob) as a readable signal | Zone Speed, energy gauge, racket breaks |
| [Tennis Manager 2023 review, GM Games](https://gmgames.org/?p=17515) | Even its fans watch only big matches; show clips only at big points | Four cameras, speed controls, 3D analysis |

### 1.5 Result and rewards
| Reference | Take | Don't take |
|---|---|---|
| [Balatro design study, Blake Crosley](https://blakecrosley.com/guides/design/balatro) (a reconstruction, not the developer's numbers) | Feedback layered in order: object → counter roll → screen effect → particles → sound. Shake scales with the size of the gain. Rising pitch per tick | CRT scanlines, casino feel |
| [Duolingo streak milestone redesign](https://blog.duolingo.com/streak-milestone-design-animation) | Their first celebration was "not quite celebratory enough, energy-wise"; timing was iterated on rough passes. That is our playtest note | Streak guilt and push notifications |
| [Uma Musume career mode, wiki](https://umamusu.wiki/Game:Career_Mode) | Fixed stat table at the bottom; gains depend on how the race went. Tie the size of the celebration to the drama of the win | Stat-up animation specifics (not verified) |
| [Hearthstone rewards track](https://hearthstone.blizzard.com/en-us/news/23534414) | Blizzard said the first track "missed the mark" with filler steps. Every step names something: "passed R. Okafor" | A 50-level track |
| Clash Royale Trophy Road (above) | Gate lock animation when a rank is crossed | Chest unlock timers |

### 1.6 Continuous growth
- [OpenFront.io](https://openfront.io/) ([source, AGPL-3.0; assets CC BY-SA 4.0](https://github.com/openfrontio/OpenFrontIO)): the brief's
  reference for "always growing a little". Take the idea that a number you own ticks up visibly and often. Its code
  and assets are copyleft: **do not copy anything** (the research found nothing documented about its HUD).
- The result screen is where growth happens for us: rating integers stepping up one at a time with a tick, the ladder
  bar filling across a gate, and names sliding past. The ladder home then shows the new state at rest.

### 1.7 What to simplify away (Football Manager, Tennis Manager)
- A game-plan screen with many sliders → three named presets (aggressive / balanced / defensive), already in ADR-017.
- Percentages and analysis charts → whole numbers and one scouting line.
- Several cameras and speed controls → one automatic broadcast camera, clips at big points only.
- Press conferences, morale, contracts, finances → the ladder and the next goal.
- Dense tables as the main screen → one hero number per screen (rank on home, the score banner at decisions, the
  ladder points on the result).

## 2. Broadcast graphics: rules for reading at a glance
1. In a tiebreak-only match the **points cell is the score**: make it the biggest, highest-contrast cell and keep
   the accent colour for it alone.
2. The score is never covered: callouts, stats and card pips slide out beside or under the bug.
3. Tabular numerals everywhere digits change (`font-variant-numeric: tabular-nums`; Barlow has `tnum`).
4. One solid fill per row, no gradients or soft shadows behind numbers.
5. Narrow the type before truncating; surname only, never cut mid-word.
6. Callouts come from event tags (`BIG_POINTS`), so they are never late.
7. Keep graphics inside a ~5% safe margin ([EBU R 95](https://tech.ebu.ch/publications/r095), unverified), which also
   clears phone notches.
8. Wipes: 200–400 ms in, exit faster than entry (our convention; no published figure found).
9. From UTS: a card pip per player row (spent / available) and a one-off state for 6-6 in the tiebreak instead of
   flashing MATCH POINT on every point.

No source documented the actual colours or fonts of the Slam bugs; nothing here claims them.

## 3. Stylised 3D that runs in the browser (Three.js 0.186.1)
Every addon below exists in `node_modules/three/examples/jsm` (checked). None needs a new dependency.

| Technique | API / file | Effect | Cost | Risk |
|---|---|---|---|---|
| Toon shading | `MeshToonMaterial` + 3-step `DataTexture` gradient map ([example](https://threejs.org/examples/webgl_materials_toon.html)) | Cel bands | Same draws as Lambert | No `flatShading` on toon; facet with `toNonIndexed()` |
| Faceted low-poly | `flatShading: true` on Lambert | Facets | Free | Keep the ball smooth |
| Ink outlines | Inverted hull (`side: BackSide`, scaled copy) or `effects/OutlineEffect.js` | Cartoon outline | +1 draw per outlined mesh | OutlineEffect replaces `renderer.render`, awkward with a composer |
| Glow outline | `postprocessing/OutlinePass.js` | Highlight one object | Several targets + blur | Too heavy for phones except as a rare highlight |
| Tone mapping | `renderer.toneMapping = AgXToneMapping / NeutralToneMapping / ACESFilmicToneMapping` | Filmic roll-off | Free | Retune every light; desaturates |
| Planar shadow | `objects/ShadowMesh.js` | Crisp shadow on the flat court | +1 draw per caster | Flat ground only (fine for tennis) |
| Depth haze | `scene.fog` + gradient background | Separates stands from court | Free | — |
| Ball trail | `lines/Line2.js` + `LineMaterial`, or fading sprites | Readable flight | ~1 draw | Update resolution on resize |
| Colour grade | `postprocessing/LUTPass.js` + `LUTCubeLoader` | Per-surface grade | 1 full-screen pass | Phone fill rate; needs `OutputPass` last |

**Ball readability:** unlit ball (`MeshBasicMaterial`, `toneMapped = false`); a thin dark back-face outline; at least
6–8 px on screen at the main camera (real size is 2–3 px on a phone); blob shadow always under it and a bounce mark;
a 0.15–0.25 s tapering trail tinted by shot type; reserve yellow-green for the ball alone (no kits, boards or UI
accents in that hue near the court); a translucent net; a 1.3× scale pop for two frames at contact, no motion blur.

**Surface palettes** (contrast against ball `#d7f04a`): hard court `#3470b8` (≈4.0:1), clay `#b8552e` (≈3.8:1),
grass `#2f7a45` (≈4.1:1); lines slightly off-white. Clay and grass sit near the ball's hue, so the ball separates by
lightness and its outline there. Per-surface kits: no red/orange shirts on clay, no green on grass.

**Asset packs** (for a later rig or props; licences on the live pages): [Quaternius](https://quaternius.com/faq.html)
"All models are under the CC0 License"; [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) CC0 1.0
(chunky proportions that suit direction B); [Kenney](https://www.kenney.nl/assets/minigolf-kit) CC0 (props only; no
3D sports pack). [Synty](https://syntystore.com/pages/one-time-purchase-licence) forbids sharing source files outside
the team and says nothing about web builds, where every player downloads the models: **avoid unless Synty confirms**.
No CC0 3D tennis assets exist (confirms the m3 finding).

## 4. Type, icons, colour and motion

### Fonts (all SIL OFL 1.1; `OFL.txt` checked in [google/fonts](https://github.com/google/fonts/tree/main/ofl))
| Font | Role | Note |
|---|---|---|
| Barlow Condensed 600/700 | Score bug, banners, numbers (all options) | Accepted in M3; `tnum` |
| Barlow 400/500 | Body (A) | Same family, same metrics |
| Lilita One 400 | Display (B): banners, card names, big numbers | One weight, chunky, game-like; Latin only |
| Nunito 600/800 | Body (B) | Rounded, matches Lilita |
| Archivo (variable `wdth` 62–125) | Display and body (C) | Wide for headings, narrow for numbers from one file |
| JetBrains Mono 500 | Data and tells (C) | |
| [Pretendard](https://github.com/orioncactus/pretendard) | Korean fallback for any option | OFL 1.1 (LICENSE checked); none of the Latin faces have Hangul |

Self-host woff2 via `@font-face` like the M3 decision (no `@fontsource` dependency); subset Pretendard if used.

### Icons
| Set | License (repo file checked) | Use |
|---|---|---|
| [Lucide](https://lucide.dev/license) | ISC | Card icons: `zap` (Attack), `shield` (Defend), `rotate-ccw` (Counter); `eye` (tell), `trophy`, `chevrons-up` (all exist) |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | MIT | Has `ball-tennis`, `target-arrow` |
| [Phosphor](https://github.com/phosphor-icons/core), [Iconoir](https://github.com/iconoir-icons/iconoir) | MIT | Alternatives with filled weights (B's sticker style) |
| [Material Symbols](https://github.com/google/material-design-icons) | Apache-2.0 | Keep the NOTICE |
| [game-icons.net](https://game-icons.net/about.html) | CC BY 3.0 (a few CC0) | Credit each author; only if a card needs a more "game" glyph |

Copy single SVGs into `ui/` (no npm dependency), keeping the licence text alongside.

### Colour checks (WCAG 2 contrast; [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html))
Computed with a scratch script using the WCAG formula. The current UI passes AA everywhere (text 14.1, muted 6.2,
button 11.6, card colours 6.4–7.4).

**Card colours under colour-vision deficiency** (smallest CIE76 ΔE between the three cards after Machado et al. 2009
simulation; above ~20 reads as different):

| Trio (Attack / Defend / Counter) | Normal | Protan | Deutan | Tritan |
|---|---|---|---|---|
| Today `#ff8a6b` / `#6aa8ff` / `#c9a0ff` | 29 | **2** | 13 | 45 |
| Red / blue / amber `#FF7A45` / `#4AA3FF` / `#F2D04A` | 55 | 36 | 19 | 47 |
| **Proposed** `#FF7A45` / `#4AA3FF` / `#3FD3B0` (teal) | 78 | 38 | 53 | 18 |

Today, Defend and Counter are the same colour to a protanope. Teal wins for the common deficiencies (protan, deutan)
and does not collide with the gold used for points and MATCH POINT (amber would). Colour is never the only cue:
every card gets an icon and keeps its key, which WCAG 1.4.1 requires anyway. Also, the reveal's green "You read it!"
and red "lost" are the same pair the deutan check flags (ΔE 4): use the accent and a word, not green vs red.

Per-option text/background pairs (all pass AA 4.5:1 unless marked large):

| Pair | A Night Session | B Rally Pop | C Tactics Board |
|---|---|---|---|
| Text on base | `#F3F6FB`/`#0A1220` 17.3 | white/`#123A8C` 10.4; ink `#15171E`/white 17.9 | `#F1F4EC`/`#0F3B2E` 11.2 |
| Muted | `#93A1B8`/`#121C2E` 6.5 | `#BFD0F2`/`#123A8C` 6.7; `#5A6172`/white 6.2 | `#A9C2B4`/`#0F3B2E` 6.6 |
| Accent button | ink/`#F2C94C` 11.8 | ink/`#D6F53A` 14.5; ink/`#FFC21A` 11.1 | `#0F3B2E`/`#E4F53F` 10.3 |
| Attack | `#FF7A45` 6.6 | text `#C23A1C` on white 5.4 | `#FF8A50` 5.3 |
| Defend | `#4AA3FF` 6.5 | text `#1565C8` on white 5.6 (white on fill `#1F7AE0` 4.3, large only) | `#7CC4FF` 6.6 |
| Counter | `#3FD3B0` 9.1 | text `#0B7F6A` on white 4.9 | `#5FE0C0` 7.7 |

### Motion
Tokens from Material 3 ([source](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-motion.scss)):
short 50–200 ms, medium 250–400 ms, long 450–600 ms; standard `cubic-bezier(0.2, 0, 0, 1)`, emphasized decelerate
`cubic-bezier(0.05, 0.7, 0.1, 1)`, emphasized accelerate `cubic-bezier(0.3, 0, 0.8, 0.15)`. Overshoot for B:
`cubic-bezier(0.34, 1.56, 0.64, 1)` ([easings.net](https://easings.net/) "back out").

| Moment | What moves | Timing (proposed unless cited) |
|---|---|---|
| Decision opens | Banner wipes in, cards deal up with a stagger | 240 ms, 50–70 ms stagger |
| Hover / key 1-2-3 | Card lifts `translateY(-12px) scale(1.05)`; selected `-24px scale(1.08)` | 150 ms ease-out |
| Reveal | Both cards face-down, hold with the crowd ducked, flip together, verdict pops | Hold 450–650 ms, flip 250–300 ms, verdict +150 ms |
| Clash | Freeze, one white frame, winner kicks 6 px, short shake | 10–20 ms freeze ([Nijman](https://infovore.org/?p=5275)), shake decays in ~150 ms |
| Result | Tiles rise in sequence; ladder points count up; names slide past; ratings step +1 with a tick; gate locks | Tiles 120 ms apart; count-up 0.9–1.2 s ease-out; names 120 ms apart; rising pitch per tick |
| Score bug | Expand/collapse a stat | 240 ms in, 180 ms out |

Rules: one orchestrated moment per screen; nothing blocks input for more than ~1.5 s (tap or Enter skips to the end
state); `prefers-reduced-motion` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion),
[WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)) turns flips, shakes and
count-ups into cuts and shows final numbers directly.

## 5. Art-direction options
All three keep the broadcast grammar (score bug, MATCH POINT callout, camera cuts) and the proposed card trio.
Mocks of the decision point, reveal and result in each style: [moodboard](https://claude.ai/artifact/5JXJgMPvWaqprB7rzURTef).

### A. Night Session: the broadcast package, done properly
- **Mood:** a floodlit evening session on TV. Calm, credible, sporty.
- **Palette:** ink `#0A1220`, panel `#121C2E`, panel-2 `#1A2740`, rule `#2A3A57`, text `#F3F6FB`, muted `#93A1B8`,
  gold `#F2C94C` (points, MATCH POINT, CTA), ball `#D9F24B`, Attack `#FF7A45`, Defend `#4AA3FF`, Counter `#3FD3B0`.
- **Type:** Barlow Condensed 600/700 + Barlow 400/500.
- **3D:** current meshes; tone mapping on (AgX or Neutral), darker stands with fog, lit court, unlit ball with trail,
  LED boards in the card colours.
- **Motion:** broadcast wipes, standard easing, no overshoot.
- **Risks:** it reads as today's game polished, and the playtest said the result screen did not land. Capsule
  players look unfinished inside a realistic broadcast frame, which pushes toward the costly rig (TD-012).
- **Cost:** lowest. `:root` tokens in `ui/src/style.css`, self-hosted fonts, `COLOURS` in
  `renderer/src/tuning/scene.ts`, a tone-mapping line in the stage. CSS-only plus colour tuning.

### B. Rally Pop: toy-like tennis with sticker cards (recommended)
- **Mood:** a sunny club court in a toy box. Bright, chunky, friendly, fast.
- **Palette:** court blue `#123A8C` (UI base), court-2 `#1B4DB3`, paper `#FFFFFF` (cards, tiles), ink `#15171E`
  (outlines, text on paper), ink-muted `#5A6172`, optic `#D6F53A` (Play, "You read it!", "up" arrows), gold `#FFC21A`
  (ladder points, rank-ups), Attack `#F2552C` / text `#C23A1C`, Defend `#1F7AE0` / text `#1565C8`, Counter
  `#14A88A` / text `#0B7F6A`.
- **Type:** Lilita One (display) + Nunito 600/800 (body); Barlow Condensed stays in the score bug so the broadcast
  layer still reads as TV; Pretendard for Korean.
- **3D:** `MeshToonMaterial` with a 3-band gradient; inverted-hull ink outlines on players, net and ball only;
  chunkier rig proportions (bigger head and racket on the existing capsule rig, or KayKit-like CC0 bodies later);
  daylight; oversized unlit optic ball with outline and white trail; per-surface kits.
- **Motion:** springy. Cards deal in with overshoot, reveal hold 650 ms then a simultaneous flip, the verdict pops with
  a stroke and drop shadow, count-ups with rising pitch, overtaken names slide past, gate lock on rank-up.
- **Risks:** most work of the three; can tip into childish if the copy is jokey (keep copy plain and sporty);
  outlines cost +1 draw per outlined mesh; Lilita One is Latin-only (Pretendard Black fallback looks different);
  it departs from the M3 rig default (Mesh2Motion realistic body), which needs revisiting.
- **Cost:** medium. UI: tokens, fonts, icons, motion in `ui/src/quick/*.css` and `ui/src/style.css`. Renderer:
  material factory swap in `renderer/src/scene/{court,venue,rig,ball}.ts` and `COLOURS`, outline helper, trail.
  No new dependencies, no post-processing pass.

### C. Tactics Board: the coach's whiteboard
- **Mood:** a chalkboard in the locker room before the big point. Clever, analytical, quiet.
- **Palette:** board `#0F3B2E`, board-2 `#164A3A`, chalk `#F1F4EC`, chalk-muted `#A9C2B4`, ball `#E4F53F`
  (accent), Attack `#FF8A50`, Defend `#7CC4FF`, Counter `#5FE0C0`.
- **Type:** Archivo variable (125 wide for headings, 62–70 narrow for numbers) + JetBrains Mono for stats and tells.
- **3D:** flat-shaded low-poly, muted surround; at a decision point the camera goes top-down and the tell is drawn
  as a chalk arrow on the court (`Line2`).
- **Motion:** lines draw on (`stroke-dashoffset`, 500 ms), linear flips, little bounce, tally-mark count-ups.
- **Risks:** strongest for reading tells, weakest at exactly the moments the playtest called flat (reveal, rewards).
  Feels like a manager, which the brief wants to simplify away. Needs a new camera mode for the overlay.
- **Cost:** medium-low for UI; the tactical camera and arrows touch `renderer/src/broadcast` (director) and
  stream ①'s decision-point clip work.

## 6. Recommendation: B "Rally Pop", in phases
| Test from the brief | Why B |
|---|---|
| Casual | Looks like a game you play for two minutes, not a manager you study (A reads as TV, C as homework) |
| Readable tells | Big icon + colour + key on every card, a colour-blind-safe trio, history as chunky pips, one "eye" icon for the tell. C is as readable but colder |
| Rewards that land | It is built for juice: gold for points, optic for "up", springy count-ups and overtakes. This answers the playtest note directly |
| 1–2 minute loop | One banner, three cards, one verdict; nothing to read twice |
| Build cost | Medium, and it turns the capsule players into a style instead of a placeholder, so it can defer the realistic rig (TD-012) rather than require it |

**Phases** (no conflict with the three M6 streams if phase 1 waits for their merges; their CSS files are
`ui/src/quick/{quick-match,quick-scout,quick-result}.css`):
0. **Now, any direction:** the teal Counter, card icons, no green-vs-red verdict, reduced-motion. A small change
   but it touches stream ①'s `quick-match.css`: send it to that stream rather than editing it here.
1. **After M6 merges (UI):** `:root` tokens (keep `--bug-bg`/`--bug-accent` names, add `--paper`, `--ink`, `--optic`,
   `--gold`, `--atk`, `--def`, `--ctr`), self-hosted Lilita One / Nunito / Barlow Condensed, Lucide SVGs, motion tokens.
2. **Renderer:** toon material factory + 3-band gradient, outlines on players/net/ball, unlit ball with trail and
   outline, daylight and fog, per-surface kits. Measure draw calls before and after on a phone profile.
3. **Rig (TD-012):** decide between scaling the capsule rig into chunkier proportions and a CC0 chunky body (KayKit,
   Quaternius); the M3 default (Mesh2Motion realistic) fits A better than B.

If the team prefers to stay close to today's look, A is the fallback; take B's reveal and result motion into A,
since those are what the playtest asked for.

## 7. Open questions
- Should the result scale with stakes (a "×2" for wins decided at match point), as Snap does with the cube? A game
  design call for ADR-017, not an art one.
- Korean UI: if the game ships in Korean, B's display face needs a Hangul partner (Pretendard Black, or a rounded
  Korean OFL face; not yet checked).
- Sound is half of juice (rising-pitch ticks, the clash hit); the M3 audio plan has no UI sounds yet.
