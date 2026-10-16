# M3 assets, tools and references

Research for the rest of M3 (GDD §8, §10), gathered 2026-10-13. Every license below was checked on a live page, a
repo LICENSE file or a model card, not from memory, unless a line says otherwise. Nothing here is installed or
committed as an asset yet. The defaults at the end were accepted on 2026-10-13.

**Status:** M3 closed (ADR-009) with synthesised sound, the browser's `speechSynthesis` for the umpire and a procedural
`MannequinRig`. This document is now the asset plan for the follow-ups: TD-016 (samples and a pre-rendered call set)
and TD-012 (skinned GLTF rig).

## License classes
- **CC0 / public domain:** commit freely, no attribution.
- **MIT / OFL / CC-BY:** commit freely, keep the notice or credit.
- **"Use in a product, no redistribution of raw files"** (Mixamo, Sonniss, Pixabay): fine inside a shipped build;
  raw files in a *public* repo count as redistribution. The repo has no remote today; keep these out of git anyway.
- **Avoid:** non-commercial (BBC Sound Effects), all-rights-reserved, CC-BY-SA voice models, unclear provenance.

## 1. Audio (GDD §8.4) — in progress

### Samples (all CC0, verified on each Freesound page)
| Use | Asset | Notes |
|---|---|---|
| Racket hit | [kletton97/710041](https://freesound.org/people/kletton97/sounds/710041/) | Clean single hit, 1 s WAV |
| Hard hit / serve | [gprosser/412863](https://freesound.org/people/gprosser/sounds/412863/), [itsadrizzit/439340](https://freesound.org/people/itsadrizzit/sounds/439340/) | Second is 67 s of serves to cut |
| Slice | [jamesdrake89/662268](https://freesound.org/people/jamesdrake89/sounds/662268/) | |
| Bounce (hard) | [amsaenz03/788264](https://freesound.org/people/amsaenz03/sounds/788264/) | 96 kHz WAV |
| Net cord | [amsaenz03/788265](https://freesound.org/people/amsaenz03/sounds/788265/) | |
| Clay rally | [itsadrizzit/479289](https://freesound.org/people/itsadrizzit/sounds/479289/) | Cut clay bounces and slides |
| Applause | [craigsmith/438391](https://freesound.org/people/craigsmith/sounds/438391/) "Large Crowd Applauds Tennis" | |
| Big cheer | [AlaskaRobotics/221567](https://freesound.org/people/AlaskaRobotics/sounds/221567/), [jessepash/139973](https://freesound.org/people/jessepash/sounds/139973/) | |
| Crowd bed | [FunWithSound/381373](https://freesound.org/people/FunWithSound/sounds/381373/), [huubjeroen/114052](https://freesound.org/people/huubjeroen/sounds/114052/) | Second is 5 min of real match ambience |
| Footsteps | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) (CC0) | `footstep_grass/concrete` OGGs, 6–12 KB |

Freesound originals are WAV; transcode to OGG/Opus at 64–96 kbps with the local `ffmpeg`.
Avoid: BBC Sound Effects (RemArc, non-commercial), Sonniss GDC bundle and Pixabay (no raw-file redistribution).

### Umpire calls
No CC0 recording of tennis calls exists (Kenney's Voiceover Pack has numbers and "game over" only). Options:

| Option | Pros | Cons |
|---|---|---|
| **A. Offline TTS clips with local Piper** (installed: `~/.local/bin/piper`) | Consistent voice, plays through Web Audio, seekable, no runtime dep | Clips are an asset pipeline; ~40 phrases |
| B. Browser `SpeechSynthesis` | Zero assets | Voice differs per browser, `getVoices()` can be empty, cannot be routed through Web Audio or seeked |
| C. ElevenLabs MCP | Best quality | Free plan forbids commercial use ([help centre](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform)); paid plan and API key needed |
| D. "Fault" / "Out" only | Smallest | Drops score calls from §8.4 |

Piper voice licenses (model cards on `huggingface.co/rhasspy/piper-voices` and the dataset links they point to):
- `en_GB-cori-medium` — **public domain** (LibriVox). British female. Usable. Tried locally: "Fifteen love" is
  1.3 s, 8 KB as Opus 48 kbps; "Game, set and match, Flint" 2.6 s, 16 KB; "Fault" 0.7 s, 4.5 KB. About 40 clips
  come to roughly 300 KB. Check Safari's Ogg Opus decoding and keep an MP3 fallback if it fails.
- `en_GB-jenny_dioco-medium` — dataset license allows commercial use; pre-generated clips need no credit (runtime
  synthesis in the app would).
- `en_GB-northern_english_male-medium` — CC-BY-SA 4.0. Avoid (share-alike on outputs is unclear).
- `en_GB-alan-medium` — Mycroft "All Rights Reserved". **Avoid.**

Vocabulary (ITF Duties & Procedures for Officials, 2018, section G; call the server's score first, "Deuce" never
"Forty all"): Fault, Out, Let, Foot fault, Not up, Correction; Love / Fifteen / Thirty / Forty / All, Deuce,
Advantage X, Game X, Tie-break, Game and first set X, Game set and match X; Time, Quiet please. Names are fictional
and generated, so split clips into phrase parts ("Advantage" + name) or synthesize every name at build time.

### Generated samples: agent-audio and Stable Audio 3 (2026-10-16, supersedes the Freesound default for TD-016)
The user chose [agent-audio](https://github.com/AIEGOBOT/agent-audio) (MIT; commit `9b679ed` read on 2026-10-16)
to generate the ball and crowd samples and the result stingers; the work order is `docs/sound/manifest.json`.
It runs Stable Audio 3 Medium from `stabilityai/stable-audio-3-optimized` (pinned revision `da6edc5`, not gated
on Hugging Face: no token needed). Terms read from the repo's `LICENSE.md` and `LICENSE_GEMMA.md`:
- **Stability AI Community License** (updated 2024-07-05). Outputs: "You own any outputs generated from the Models
  … to the extent permitted by applicable law" (§IV.c.iii), and outputs are excluded from "Derivative Works".
- **Commercial use** (§III) is free below US$1M annual revenue but requires registering at
  https://stability.ai/community-license, as the Toss release may count as commercial; the user registered on 2026-10-16.
- **Attribution** (§IV.a): a NOTICE file with "This Stability AI Model is licensed under the Stability AI Community
  License, Copyright © Stability AI Ltd. All Rights Reserved" and a prominent "Powered by Stability AI" apply to
  distributing the model or derivatives "or a product or service that uses any portion of them". Shipping only
  outputs is arguably outside this, but the wording is ambiguous, so the default is to comply: `ui/public/audio/
  NOTICE.txt` and the line in the docs; an in-app credit is open.
- **Restrictions** (§IV.b): follow the law and Stability's AUP; outputs must not be used to train another
  foundation generative model.
- **T5Gemma** text encoder under the Gemma Terms of Use: "Google claims no rights in Outputs you generate using
  Gemma"; the Gemma Prohibited Use Policy applies.

### Procedural option
A hit can be synthesized instead of sampled: a 6–10 ms noise burst band-passed around 1.5–3 kHz plus a 30–60 ms
resonant body; gain by `speedKmh`, a duller filter on clay and softer on grass. No tennis-specific paper found;
tune by ear. Good as a fallback when a sample is missing.

### Patterns
- [A Tale of Two Clocks](https://web.dev/articles/audio-scheduling): a ~25 ms timer schedules ~100 ms ahead against
  the audio clock; on seek or rate change, stop scheduled sources.
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices):
  one `AudioContext` resumed on a gesture; pool decoded `AudioBuffer`s, not source nodes.
- [Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay):
  `navigator.getAutoplayPolicy('audiocontext')` decides whether to show a "click for sound" control.
- `playbackRate` resamples (pitch follows speed). Proposal: pitched at 0.5–2×, mute effects at 0.25×/4× and while
  scrubbing, keep the crowd bed. Jitter rate ±5 % and gain ±2 dB from a seeded RNG so playback stays repeatable.

**Default:** CC0 Freesound samples for hits, bounces and crowd; umpire calls as Piper clips in `en_GB-cori`;
procedural hit as fallback only.

## 2. Player rig and animation (GDD §10 M3, TD-012) — not started

### Rigs and clips
| Asset | License | Size | Notes |
|---|---|---|---|
| [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) human base + addon animations | **CC0** art (`LICENSE-CC0.MD`), MIT code | 5.6 MB (87 clips) + 5.3 MB (75 clips), ~13.7k tris, 66 joints | Inspected. UE-mannequin bone names (`pelvis`, `upperarm_l`, `hand_r`). Quaternius-derived clips. No decoders needed |
| Mesh2Motion `human-mocap-animations.glb` | Repo says CC0, but source may be CMU | 2 MB, 16 clips | Unclear provenance. Avoid until checked |
| [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) + [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | **CC0** | 120+ clips, ~13k-tri bodies | Same rig family as Mesh2Motion; realistic proportions |
| [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) + [animations](https://kaylousberg.itch.io/kaykit-character-animations) | **CC0** | 3.6 MB, ~7k tris, 161 clips | Chibi style; has a `handslot.r` bone for props |
| [Kenney Mini Characters](https://kenney.nl/assets/mini-characters) | **CC0** | ~250 KB, 7 joints | Too few joints for strokes |
| three.js `Xbot` / `Soldier` / `Michelle` | **Mixamo terms**, not MIT | | Treat like Mixamo |
| Mixamo | Use in games OK, no raw-file redistribution | | Prototype only; never commit |
| Ready Player Me | Service shut down 2026-01-31 | | Avoid |
| [CMU Mocap](http://mocap.cs.cmu.edu) | Free use, no resale even converted; not CC0 | | No tennis; has golf and baseball swings |

### Tripo (AI generation + auto-rig), evaluated 2026-10-13
- What it does: text/image → 3D model, auto-rig, retarget preset clips; GLB or FBX; `animate_in_place` option
  ([retarget API](https://developers.tripo3d.ai/en/docs/animations-retarget)).
- Presets: rig v2.5 has 11 biped clips (idle, walk, run, jump, slash, turn…). Rig v1.0 has 90+, including
  `cheer`, `clap`, `victory_celebration`, `frustrated_01/02`, `defeat_02/03`, `angry_*`, `bow`, `warm_up`, `golf`,
  `pitch_baseball`, `volleyball`. **No tennis strokes either.** Its real gain is Reaction Cam material.
- License: free-plan output stays Tripo's (Terms §5.2.1 as quoted in search results; `tripo3d.ai/terms` and the help
  page returned 403, so unverified first-hand). Paid plans grant commercial rights to output generated while
  subscribed. Plan prices seen only on aggregators ($15.90–19.90/month), unverified.
- Tooling: [tripo-mcp](https://github.com/VAST-AI-Research/tripo-mcp) is MIT but alpha and needs Blender plus Tripo's
  Blender add-on; the REST API / `tripo3d` Python SDK with an API key avoids both.
- Risks: unknown bone names (retarget map needed to mix with Mesh2Motion clips), AI meshes and 2k textures run
  several MB (decimate and shrink before commit), output differs per run (keep the chosen GLB, not the prompt).
- Fit: optional complement. One generated, rigged body with its own presets would replace Mesh2Motion entirely and
  add reactions; strokes stay procedural either way. Needs a paid plan and an API key before any asset is committed.

**Gap: no CC0 pack has tennis strokes** (serve, forehand, backhand, split-step). The nearest stand-ins are
Mesh2Motion `OverhandThrow`, `Golf_Drive`, `Strafe_left/right` and KayKit's horizontal slashes. That makes the
current approach (procedural swings in `CapsuleRig`) the stroke layer to keep, not a gap to fill with assets.

### Technique (Three.js 0.186.1, all present in `node_modules/three/examples/jsm`, no new dep)
- `three/addons/loaders/GLTFLoader.js`; `SkeletonUtils.retargetClip` (needs a `names` map — none of the CC0 rigs use
  `mixamorig:` names; staying in the Mesh2Motion/UAL family avoids retargeting entirely).
- Core `AnimationUtils.makeClipAdditive` + `AdditiveAnimationBlendMode`: layer the swing over locomotion
  ([example](https://threejs.org/examples/webgl_animation_skinning_additive_blending.html)).
- `AnimationAction.crossFadeTo / setEffectiveWeight / syncWith` for speed-blended walk/run
  ([docs](https://threejs.org/docs/pages/AnimationAction.html)).
- `three/addons/animation/CCDIKSolver.js`: aim the racket hand at `shot.from` near contact, blended in over
  ~150 ms ([docs](https://threejs.org/docs/pages/CCDIKSolver.html)).
- [Foot locking with two-bone IK](https://theorangeduck.com/page/inverse-kinematics-foot-locking): stops sliding
  when walk cycles are blended by speed.
- Keyframe names for the serve: [Kovacs & Ellenbecker, 8-stage serve model](https://pmc.ncbi.nlm.nih.gov/articles/PMC3445225/)
  (start, release, loading, cocking, acceleration, contact, deceleration, finish).
- [TopSpin 2K25 signature animations](https://news.xbox.com/en-us/2024/04/03/signature-gameplay-animations-for-topspin-2k25/):
  ~9 clips per stroke picked by ball height and approach; a small clip grid plus per-hit adjustment is enough.
- [Clavet, Motion Matching, GDC 2016](https://gdcvault.com/play/1023280/Motion-Matching-and-The-Road): background;
  we already know the future path (next `hitterPos`), which makes clip choice cheap.

**Default:** Mesh2Motion body + ~10 trimmed base clips (idle, ready, walk, run, strafe L/R, plus stand-ins), loaded
lazily outside the main bundle (TD-014); racket on `hand_r`; procedural stroke additive layer driven by the existing
`PlayerPose`; CCDIK arm near contact. Trimming clips cleanly needs `@gltf-transform/cli` (new dev dep) or Blender.

## 3. Venue, court and graphics (polish; venue already exists)
| Asset | License | Notes |
|---|---|---|
| [Poly Haven](https://polyhaven.com/license) `stadium_01`, `orlando_stadium`, `kloofendal_48d_partly_cloudy_puresky` HDRIs | **CC0** | 1k `.hdr` is 1.4–1.6 MB each |
| Poly Haven `grass_ground`, `clean_asphalt`, `cracked_red_ground` (clay candidate, not inspected) | **CC0** | 1k colour + normal + roughness ≈ 0.7–2.5 MB |
| [ambientCG](https://docs.ambientcg.com/license/) `Grass004`, `Ground107`, `Asphalt031` | **CC0** | Keep only colour, normal, roughness |
| Barlow Condensed 600/700, Oswald, Inter ([Google Fonts](https://fonts.google.com), in `google/fonts/ofl/`) | **OFL-1.1** | ~22–28 KB woff2 per weight; self-host via `@font-face` (no dep). `@fontsource/*` would be a new dep |
| [flag-icons](https://github.com/lipis/flag-icons) | **MIT** | Copy single SVGs (avg 7 KB), not the 4 MB package; players are fictional and have no nationality field yet |

No CC0 acrylic hard-court texture found; a flat colour plus the asphalt normal map is the fallback.
**Default:** keep court colours procedural, add one 1k HDRI for lighting, self-host Barlow Condensed.

## 4. Broadcast references (mostly done; for review)
- [Wimbledon camera setup, SVG Europe](https://www.svgeurope.org/?p=731) — high master shot at one end, ground-level
  side cameras.
- [Camera angles in sports games](https://www.gamedeveloper.com/design/approaching-camera-angles-in-sports-games).
- [Smart Director (arXiv 2201.04024)](https://arxiv.org/abs/2201.04024) — event-driven director scoring views by
  importance; same shape as `director.ts`.
- [Hawk-Eye explained](https://tennisnerd.net/articles/electronic-line-calling-hawk-eye-technology-explained/39915) —
  ~3.6 mm advertised accuracy; ITF tolerance ~5 mm mean / 10 mm max (search snippets only; the ITF PDF returned 404).
- [ITF Duties & Procedures for Officials 2018](https://hts.hr/wp-content/uploads/__2019/07/2018_ITF_Duties_and_Procedures_for_Officials.pdf)
  — announcements, challenges (3 per set, reset at the tie-break).

Not derivable from schema v2 (would need ADR + `schemaVersion` bump): real challenges or overturned calls, lets,
spin direction, left-handers, nationality and umpire names.

## 5. MCP servers, plugins and skills

| Tool | State | Use for M3 | Note |
|---|---|---|---|
| Playwright MCP | **Connected** (headless Chromium via `~/.claude/playwright-mcp.json`) | Screenshot checks of cameras, overlays, Hawk-Eye; the manual check TD-013 records | Already in use; no change |
| `run`, `code-review`, `simplify`, `domain-modeling` skills | Available | Run the replay page; review before each commit; ADR wording | |
| [cloudai-x/threejs-skills](https://github.com/cloudai-x/threejs-skills) | Not installed | 10 skills (animation, loaders, postprocessing…), MIT | Written for r160+; we are on r186, check before trusting |
| parallax-threejs plugin (Anthropic directory, community) | Not installed | Three.js scene-graph/GL debugging, visual regression | Bundles 4 MCP servers + a PostToolUse hook; heavy |
| Audiorective plugin (Anthropic directory, community) | Not installed | Web Audio skills | Built around its own library; we need plain Web Audio |
| [blender-mcp](https://github.com/ahujasid/blender-mcp) | Blender **not installed** | Trim clips, attach racket, fetch Poly Haven/Sketchfab | MIT; only if the rig work needs DCC edits |
| [tripo-mcp](https://github.com/VAST-AI-Research/tripo-mcp) | Not connected | Generate and rig a player body, reaction clips | Alpha; needs Blender + add-on. Paid plan required for commercial rights (see §2) |
| [ElevenLabs MCP](https://github.com/elevenlabs/elevenlabs-mcp) | Not connected | Umpire voice, SFX | Free plan is non-commercial; Piper covers this locally |
| Context7 MCP | Not connected | Up-to-date three.js docs | Local `node_modules/three` + `@types/three` already answer most questions |

Local tools already present: `ffmpeg` (transcoding), `piper` + 13 English voices, `espeak-ng`.

**Default:** add nothing. Playwright MCP, local Piper and ffmpeg cover M3. Revisit blender-mcp only if trimming the
rig in code proves too fiddly.

## Decisions (accepted 2026-10-13)
1. Umpire voice: Piper `en_GB-cori-medium` clips, built by a script, committed as OGG. *(alt: jenny_dioco)*
2. Samples: the CC0 Freesound list above, transcoded to OGG, credits listed in `ui/public/audio/CREDITS.md`.
3. Rig: Mesh2Motion CC0 body + trimmed clips, procedural strokes on top, lazy-loaded.
4. Clip trimming tool: a small Node script using three's `GLTFLoader`/`GLTFExporter` (no dep) before reaching for
   `@gltf-transform/cli`.
5. Fonts: self-hosted Barlow Condensed woff2, no `@fontsource` dep.
6. No new MCP servers or plugins for M3.
7. Tripo: not adopted for now. A pilot (one rigged body + reaction presets) needs a paid plan and an API key first.
