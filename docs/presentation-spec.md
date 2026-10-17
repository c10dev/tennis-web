# Presentation spec: camera, flow and editing, layout, sound

The current rules for what the quick match shows and plays. This file is the single source of truth for presentation;
`docs/decisions.md` keeps the history (why and when), `GDD.md` §8 the original M3 broadcast vision, and
`docs/3d-redesign.md` the design study behind ADR-024.

**How to change it.** Edit this file first (a rule, its numbers, its reason), then the code and its tests, and add a
one-line note under the ADR that motivates the change. A rule marked **Proposed** is not built yet; one marked
**Open** waits for a decision or a device measurement. Code comments may cite rules by id (C1, E3, L4, S2…).

Scope: the quick match on the web and in the Apps in Toss build (portrait phones first). The season mode and the dev
replay page follow the camera rules by default; anything else about them is out of scope here.

---

## 1. Camera

### C1. One camera: the fixed TV view (since 2026-10-17)
The quick match, its result-screen replay and the replay page use **one camera, the Main (TV) camera, all match**:
high behind the near baseline, panning gently with the ball. No cuts in live play, at decision stops or in replays.
Director style `tv` (`renderer/src/broadcast/director.ts`), the default in `ui/src/replay/model.ts`.

*Why:* the first device test found the multi-camera game direction (ADR-024) mechanical: cuts without context or
transitions. A steady view first; shots come back only as rules in this file.

### C2. The Main camera's framing
Values in `renderer/src/tuning/camera.ts` (`CAMERA`), pose in `camera/mainCam.ts`, field of view in `camera/framing.ts`.

| | Wide screen (aspect ≥ 1.4) | Phone stage (aspect ≤ 0.82) |
|---|---|---|
| Height | 13 m | 22 m |
| Behind the near baseline | 18 m | 23 m |
| Looks at (z into the near half) | 3.2 m | 5.5 m |
| Field of view | 30° vertical, at least 46° across | 27° across, fitted to the aspect |

- Between the two aspects every value moves smoothly (`portraitShare`).
- The ball is drawn 1.3× on an upright phone (`BALL_LOOK.portraitScale`) so the far ball stays about 4–5 px.
- The camera never moves by cuts. It only **pans**: the aim follows 35% of the ball's x (at most 1.8 m), and the body
  follows 40% of that. The pan eases with a 0.6 s time constant and starts where it wants to be after a load.

### C3. Decision stop
While the cards are up, the camera stays on the Main view. The frame shows the next point's start: both players at
their serve and return spots, the ball out of play, and the opponent in the stance their tell names (`hold` with
`camera: 'main'`, `ready.tell`). The players walk there on the timeline before the hold (E8 C) and ease to the
engine's real start after it.

### C4. Shots not in use (need a spec change to return)
These shots stay in the code and can be reached in dev only (`?cams=game` for ADR-024's chase camera, close-ups and
impact slow motion; `?cams=broadcast` for the M3 TV director's serve, reaction, side and Hawk-Eye cuts):

- Serve, Reaction, Side, Hawk-Eye
- Chase
- Tell close-up
- Impact slow motion and hit-stop

Candidates to bring back first, each needing an editing rule in §2: a replay angle for the decisive point, and the
impact moment.

---

## 2. Match flow and editing grammar

### F1. The flow (as built)
1. **Ladder home**: pick a game plan, then Play.
2. **Points without cards** play on the plan, in the hybrid edit (E8 C, ADR-030): before the first decision as
   units behind wipes, from the point before it on as one continuous picture. Each point ends with a ticker line: the
   score, who won and how, a pip per point.
3. **A decision stop** comes once either player has 5 points, and at set or match points. There are at most 5 a match.
   The stop shows:
   - a banner naming the moment ("매치 포인트", "5-5 동점", "승부처");
   - the score;
   - the opponent read: scouting, their cards so far, the tell, the rival line;
   - three cards, dealt 60 ms apart.
4. **The pick**: the card lifts for 0.15 s. Both cards then lie face down for 0.5 s, flip together in 0.28 s, and the
   verdict pops 0.15 s later. This is `QUICK_PACE.reveal`, 1.08 s in all.
5. **The decision point** plays live from its serve, then an outcome line with the score stays up while the walk back
   to the next point plays.
6. **The result**: the decisive point replayed (3D, or a play-by-play in fast mode), then the headline, the points
   counting up, the players passed, the ratings that rose and the next goal. A tap skips to the end.
7. **Leaving**: the leave button (L5), or Android back, asks "기권할까요?"; conceding is a loss at the score so far.

Fast mode has no 3D. The same flow runs as the ticker and panels only.

### E0. What was wrong (the "teleporting", fixed by E8 C on 2026-10-17)
The match's timeline is continuous: after each point the players walk 2.5 s to the next point's start
(`PLAYBACK.pointGapSec`, `playback/movement.ts`). The quick match does not play the timeline, though. It plays one
**window** per point (`clipFor` in `game/src/quick/pace.ts`) and jumps the clock to the next window
(`broadcast.playWindow`).

- A point without cards shows only its last contact plus 0.7 s.
- A decision point shows only its last 3 contacts (at most its last 8 s).
- The walk back, the serve and the start of every rally are skipped.

With one fixed camera, each skip is a **jump cut**: the same framing, a different moment. Players and the ball appear
in new places with no motion between, which reads as teleporting. Nothing on screen says time was skipped, and nothing
says why this moment matters. The fixed TV view did not cause this; it made it plain.

Measured over 40 ladder matches: 13.0 points a match, 3.8 decisions, a mean point of 7.4 s (plus a 1 s toss). The
screen times below leave out thinking time.

| Pace | Screen time per match |
|---|---|
| TV pace (3× clips, mannequin) | 26.5 s |
| Game pace (1× windows, today) | 50.1 s |

### E1–E7. The grammar (built 2026-10-17, ADR-030; E5 the same day)
- **E1. Time is never skipped silently.** Within a shot, match time only moves forward, continuously. Time may be
  compressed (E3) or skipped behind a marked transition (E6), never by a plain jump with the same framing.
- **E2. A point starts at its start.** A shown point opens on the serve: the toss, or at least the ball in the server's
  hand. It never opens mid-rally. This holds for the units behind wipes too (E8's table said "others last shot" for
  B; C opens them on the serve instead).
- **E3. Dead time is sped through, not cut.** The walk back between points plays at about 5× with a small "▶▶" chip.
  Speed changes ramp over 0.25 s, never in steps.
- **E4. Live play at 1× when it matters.** Decision points and the point before them play at 1×. Earlier points
  without cards may run at up to 2×, ramping down before the last contact so the ending lands at 1×.
- **E5. Context before content.** **Built (TD-075 closed).** Every stop and every point that matters gets one line of why:
  - a lower-third before the point ("브레이크 포인트", "3연속 실점", "매치 포인트");
  - a one-line result after it ("상대 포핸드 위너").
  - Captions come from the events. They never cover the court's near half, the score bug, the panel or the Toss band.
  - *As built* (`game/src/views/quick-captions.ts`, `ui/src/quick/caption.ts`, tuning `QUICK_PACE.caption`):
    - **A point matters** when it is, in this order: a match point, a set point, a break point (each "위기" when it
      is the opponent's), the end of a run of 3 or more points won or lost ("3연속 실점"), or a decision point, which
      otherwise carries the stop's moment ("승부처", "5-5 동점"). The tiebreak tag alone does not count.
    - **The result line** follows only a point that had a lower-third: who ended it and with what (the play-by-play's
      ending, "상대 포핸드 위너").
    - **Timing, in match time** (the broadcast's frames, so the edit never waits): the lower-third from the point's
      toss until 1.5 s after its serve; the result line from the point's end through the walk back. Once up, either
      stays at least 2 s of screen time unless the next replaces it.
    - **Not shown:** under a wipe (the band carries the score); no new caption at a decision stop or its reveal (the
      banner says why), where the last result line runs out its 2 s; in fast mode (no stage).
    - The renderer's own English lower-third (`.ov-lower`) is hidden in the quick match.
- **E6. Every cut is motivated and marked.** The only cuts allowed:
  - into and out of the result replay, with a wipe and a REPLAY chip;
  - to skip many points at once, behind a 0.4–0.6 s wipe that carries the score change.
  - A wipe never starts mid-rally.
- **E7. Rhythm budget.** A match is 60–100 s on screen, under 2 minutes with thinking time (ADR-014's 1–2 minutes).

### E8. Fixing the teleporting: options
| | A. Continuous with speed ramps | B. One unit per point, wiped | C. Hybrid (**chosen, built**) |
|---|---|---|---|
| What plays | The whole timeline from the first serve: every walk back at 5×, points without cards at 2×, decision points at 1× | Each point from its serve to its end (decisions ≤ 8 s, others last shot), a 0.5 s wipe between points carrying the score | Continuous (A) from the point before the first decision onwards; the opening points before it as B units, wiped |
| Teleporting | None | None (every jump is a marked transition) | None |
| Context | Captions (E5) over a continuous picture | Captions on each wipe | Both |
| Screen time | ≈ 86 s | ≈ 60 s | ≈ 70–75 s (estimate) |
| Feels like | Watching the match fast-forwarded | A highlights reel | A broadcast that joins live for the crunch |

The screen times are estimates from the 40-match sample.

**Chosen: C** (the user, 2026-10-17; built as ADR-030). Measured over 2,000 matches: **78 s** median on screen.

As built:
| Stretch | What plays | Speed |
|---|---|---|
| Opening units (before the first decision, but the last) | Serve to end, a 0.5 s wipe carrying the score before each but the first | 2× until 0.7 s before the last contact, then 1× |
| The point before the first decision | Serve to end, after a wipe | 1× |
| Every walk back after it | The players walk to the next start, ▶▶ chip | 5× |
| Points without cards after it | Serve to end | As the units |
| The point before a stop, the decision point | Serve to end | 1× (a decision point past 8 s runs its start at 2×) |
| Into a stop | The walk to the next point's ready spots, then the hold (C3) | 5× |
| Out of a stop | The players ease 0.5 s from the ready spots to the engine's start | 1× |

Speed changes ramp over 0.25 s (E3). Code: `game/src/quick/spans.ts`, `ui/src/quick/{points,wipe}.ts`,
`Broadcast.playSpans`; e2e `quick-continuity.spec.ts` fails on any jump of match time not under a wipe.

Why C:
- The crunch reads as one continuous piece of tennis: the walk to the line, the serve, the rally at 1×.
- The early points stay short, behind a clear "time passed" transition.
- It meets E1–E7 and keeps the match under 2 minutes.

**Build notes:** the decision stop (C3) still pauses the clock at the next point's start, so a continuous stretch ends
at every stop and starts again after the reveal. `clipFor` and `pointSeconds` (pace.ts) stay for the report's TV and
game pace rows only.

---

## 3. Layout

### L1. Targets
- **Phone portrait** (`max-width: 640px`, `ui/src/quick/phone.css`, imported last): the Toss build's only layout.
- **Desktop**: the web build's layout.
- The Toss build locks portrait (`Screen.setOrientation`).

### L2. Safe areas and the Toss band
- **Safe-area tokens.** `--safe-top/right/bottom/left` start as CSS `env(safe-area-inset-*)`. In Toss, `SafeArea`
  overwrites them on every change (`lib/safe-area.ts`).
- **The Toss buttons.** Toss draws its more and X buttons over the page, top right. X sits at
  (`right + 10`, `top + 5` on iOS / `top + 10` on Android) from the insets.
  - Nothing of ours may overlap them; overlapping can fail the Toss review.
  - `--nav-reserve` (104 px, Toss build only) keeps that corner empty across.
- **Open (TD-052):** on iOS our header overlaps at the top.
  - Likely cause: our header starts at `safe-top + 8 px`, the same band as Toss's buttons.
  - The Toss build logs `[safe-area]` (Toss values, env() values, viewport) to the web debug tools' Log tab.
  - Proposed rule once the values are read: nothing of ours starts above `safe-top + 48 px` in the Toss build. The
    whole top band belongs to Toss, not just the corner.

### L3. Quick match regions (phone)
| Region | Where | Rule |
|---|---|---|
| Stage (3D) | Top 60dvh | Canvas `#view`; overlays sit on it, never on the panel |
| Panel | Bottom, `safe-bottom + 10 px` up, 10 px gutters | Always fills the area under the stage. A short reveal is centred; a tall decision panel may rise over the stage's lower edge. Max height 100dvh − safe-top − 24 px, scrolls past that |
| Score bug | Top left, `safe-top + 8`, `safe-left + 8` | 14 px type; names ellipsised at 108 px |
| Leave button | Under the score bug, `safe-top + 64` (fast mode: `+ 8`), left 8 | ≥ 44 px tall; opens the concede question |
| Sound switch | Top right, `safe-top + 8`, `right + nav-reserve + 8` | Icon only on a phone, label kept for screen readers; ≥ 44 px |
| Wipe (E6) | Over the whole screen, under the panel and the leave button | A court-blue band with optic edges carrying the score; 0.25 s on, 0.25 s off |
| ▶▶ chip (E3) | `safe-top + 60`, `safe-right + 12` | Shown while a walk back plays at 5×. It ignores `--nav-reserve`: at +60 it sits under the Toss band and the sound switch (recheck with L2's iOS values) |
| Broadcast overlays | On the stage's lower edge: serve speed (right, +8 px), rally count (right, +64 px) | Never under the panel or over the score bug. The renderer's lower-third is hidden: the caption takes its place |
| Caption (E5) | On the stage's lower edge, left: `safe-left + 8`, 8 px up from the stage's bottom, ≤ 55vw. Desktop: top left, `safe-top + 132`, under the leave button | Under the near baseline (≈ 70% down the stage); never over the panel, the score bug or the Toss band; e2e `mobile.spec.ts` checks the box |
| Dialogs | Centred, inside the safe area | Dim the screen; focus on the safe choice |

**Stacking order** (higher is on top):

| Layer | z-index |
|---|---|
| Dialog | 50 |
| Sound switch | 40 |
| Decisive replay caption | 31 |
| Decisive replay | 30 |
| Leave button | 6 |
| Panel | 5 |
| Wipe layer, ▶▶ chip | 4 |
| Caption | 3 |
| Overlays | (none set) |
| Canvas | (none set) |

### L4. Ladder, result, start form (phone)
- **Ladder.**
  - One column, padded by the safe area.
  - The header clears Toss's corner (`nav-reserve`).
  - The rank card first, then the opponent card: scouting, plan tip, plan buttons, Play, fast mode.
  - Recent matches come last.
- **Result.**
  - One column.
  - The three gain tiles stay side by side at 22 px.
  - Rating rows are one column.
  - The decisive replay is full screen with a caption above the home bar.

### L5. Touch and reading rules
- Touch targets are at least 44 px.
- **Hover is never needed.** Lifts and fills apply only under `@media (hover: hover)`, and information never lives in a
  tooltip alone.
- Korean wraps by words (`word-break: keep-all` where lines wrap).
- Hangul uses Pretendard, fetched only on Korean pages.
- Skip hints name the input the device has ("탭해서 건너뛰기" on a touch screen).
- Every screen has a way out:
  - **match**: the leave button (L3);
  - **result**: Play again and the ladder button;
  - **ladder**: Toss's X, and Android back with a question.

### L6. Desktop
- The panel is centred, at most 780 px wide, 24 px up from the bottom.
- The 3D fills the window.
- The sound switch sits top right; the leave button sits under the score bug.

---

## 4. Sound cues

### S1. Session
There is one audio session, `ui/src/audio/session.ts` over `lib/sound.ts`.

- **Opening.** The audio opens on the first tap or key press anywhere (autoplay rules). The samples start loading then,
  never with the first screen.
- **Switch and setting.** One switch, `#sound-toggle`, on every quick screen. On by default. The setting is kept under
  `tennis-sound` in local storage and, in Toss, in the Toss storage.
- **Background.** A hidden page suspends the audio at once; a return resumes it if sound is on. A resume the browser
  refuses (iOS) is retried on the next tap.
- **Debug state.** `body[data-audio]` (running / suspended / off) and `body[data-audio-samples]`.

### S2. Buses
`AUDIO.volume`: master 0.8, sfx 0.9, crowd 0.6, umpire 0.9, ui 0.7.

### S3. Screen cues (ADR-029; `renderer/src/audio/uiCues.ts`, tuning `AUDIO.ui`)
| When | Cue | Sound |
|---|---|---|
| Cards dealt | `deal` ×3 | Blips 120 ms after the deal, then 60 ms apart, each 3 semitones up |
| Card picked | `pick` | A rising blip; any deal blip not yet played is cancelled |
| Cards face down | `hold` | A low hum; the crowd ducks to 25% for 0.5 s |
| Cards flip | `flip` | A swish |
| Verdict | `clash` | A thump, then a chord: climbs on a read, holds on the same card, falls on a misread |
| Points count up | `tick` | Climbing up to an octave over the count (down a fifth for a loss); ticks closer than 45 ms dropped |
| A rating rose | `rise` | Two rising notes per rating |
| Next goal locks | `stamp` | A low stamp; a skip plays the stamp alone |
| Result headline | `sting` | The `sting-win` / `sting-lose` sample, or three stand-in notes until it has loaded |

### S4. Match sounds (`cues.ts`, `samples.ts`, tuning `AUDIO.samples`)
- **Hits.**
  - Serves and overheads take the heavy hit; slices, drops and lobs the slice; the rest the flat hit.
  - Rate ±6% with ball speed, ±3% jitter from the cue's time.
- **Bounces.** Hard and clay samples; grass reuses the hard bounce at 0.85 rate and 0.75 gain.
- **Net.** The net sample.
- **Crowd.**
  - Small applause below intensity 0.5, big from 0.5, a cheer on top from 0.8.
  - The crowd bed loops in matches only (`setBed`) and hands over from noise to the sample over 1.5 s.
- **Umpire calls.** `speechSynthesis` `en-GB`, dropped above 2× playback.
- **Fallback.** Every sample falls back to synthesis if it is missing or fails to decode.

### S5. Rules
- **Muting.** Nothing plays while muted; a duck still applies, so it never sticks.
- **Clip windows.** Match sounds play only for the clip window being shown (`cuesBetween`).
- **Proposed, with E3:** while dead time is sped through, no ball or umpire sounds; the crowd bed stays.

---

## 5. Open items
| Item | Rule | Where it stands |
|---|---|---|
| Teleporting between points | E8 | Built (C, ADR-030); to check on a device: the walk into the hold and the release (TD-076) |
| Context captions | E5 | Built (TD-075 closed); to read on a device |
| iOS header overlap | L2 | Waiting for the `[safe-area]` log values from a device |
| Phone frame times, quality tiers | — | TD-059, on a device |
| Ogg Opus on iOS | S4 | TD-070, on a device |
| Shots to bring back (replay angle, impact) | C4 | E8 is built; open for a decision |
