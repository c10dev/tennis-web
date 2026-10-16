# Sound generation log

Generation run for the work order in [`manifest.json`](manifest.json) (see [`README.md`](README.md)). Machine-readable
record: [`generated.json`](generated.json).

## Setup
- Date: 2026-10-16. Host: MacBook Pro, Apple M1 Max, 32 GB, macOS 27.2.
- agent-audio `9b679ed` (https://github.com/AIEGOBOT/agent-audio), MLX backend (mlx 0.32.4, `Device(gpu, 0)`), runtime
  Stability-AI/stable-audio-3 `779434a`, model `stabilityai/stable-audio-3-optimized` revision `da6edc5` (not gated;
  no Hugging Face token used). CFG 1.0 (the agent-audio default); negative prompts are not supported.
- Call per take: `uv run --frozen agent-audio generate "<prompt>" --seconds <generateSec> --out <wav>`.
- Post-processing: ffmpeg 9.0.2 (libopus, native AAC) plus a small numpy script for trims, fades, loop and gain.
- WAV masters (raw takes, processed 48 kHz masters) and rejected takes are kept on the Mac outside git.

## Seeds
None recorded. agent-audio does not pass `--seed`; the runtime picks a random seed per take and only keeps its log
on failure, so takes cannot be reproduced exactly. Regenerating a sound means new takes.

## Timing
Each "generation time" is wall-clock for one CLI call: process start, model load from a warm disk cache, inference
and WAV write. The first take of the session (`hit-flat` 1) took 4.46 s; the rest 2.9-3.8 s. 43 takes in total, none
failed.

## Prompts
| id | prompt | generateSec |
|---|---|---|
| `hit-flat` | Single tennis ball struck hard by a tightly strung racket, crisp hollow 'pock' with a sharp transient and a short felt-and-strings body, close and dry outdoor court, isolated one-shot, no voice, no music, no crowd, no reverb tail | 2 |
| `hit-heavy` | Powerful tennis serve impact, racket strings snapping through a tennis ball, loud explosive 'thwack' with a deep body and a bright string crack, close and dry, isolated one-shot, no grunt, no voice, no music, no crowd | 2 |
| `hit-slice` | Soft brushed tennis slice shot, racket strings grazing under a tennis ball, muted papery 'thup' with less snap and a quick decay, close and dry, isolated one-shot, no voice, no music, no crowd | 2 |
| `bounce-hard` | Tennis ball bouncing once on a hard acrylic court, short bright rubbery 'tok' on concrete, close and dry outdoor, isolated one-shot, no voice, no music, no crowd, no second bounce | 2 |
| `bounce-clay` | Tennis ball bouncing once on a red clay court, dull soft thud with a faint gritty crunch of loose clay, close and dry outdoor, isolated one-shot, no voice, no music, no crowd, no second bounce | 2 |
| `net` | Tennis ball hitting the woven net of a tennis court, soft muffled thump into taut mesh with a brief rattle of the net cord and a tiny rustle, close and dry outdoor, isolated one-shot, no voice, no music, no crowd | 2 |
| `applause-small` | Polite applause from a medium tennis stadium crowd after a point, steady clapping that rises quickly and dies away, outdoor stadium, no cheering, no whistles, no intelligible speech, no announcer, no music | 4 |
| `applause-big` | Loud enthusiastic applause from a large tennis stadium crowd after a great rally, dense fast clapping with an excited swell, outdoor stadium, no chanting, no whistles, no intelligible speech, no announcer, no music | 5 |
| `cheer` | Large tennis stadium crowd erupting into a joyful roar and cheer at match point, bright excited voices without words, outdoor stadium, no intelligible speech, no chanting, no announcer, no music | 4 |
| `crowd-bed` | Ambience of a tennis stadium between points, low steady murmur of a large seated outdoor crowd, soft distant rustle and shuffling, calm and even with no sudden reactions, no applause, no intelligible speech, no announcer, no music, stable continuous bed suitable for looping | 10 |
| `sting-win` | Short bright victory jingle for a casual sports mobile game, upbeat rising three-note brass and marimba flourish ending on a major chord, punchy and cheerful, 1.5 seconds, no vocals | 3 |
| `sting-lose` | Short gentle defeat jingle for a casual sports mobile game, soft descending two-note marimba and muted horn phrase ending on a mellow minor chord, light and not sad, 1.5 seconds, no vocals | 3 |

## Kept takes

| id | kept take / candidates | generation time per take (s) | final length (s) | level | ogg / m4a bytes (kbps) | budget | note |
|---|---|---|---|---|---|---|---|
| `hit-flat` | 4 / 4 | 4.46, 3.22, 3.07, 3.0 | 0.35 | peak -1.0 dBFS | 2047 (48) / 3231 (48) | 5000 |  |
| `hit-heavy` | 3 / 4 | 3.82, 3.27, 3.12, 3.08 | 0.4 | peak -1.0 dBFS | 2285 (48) / 3555 (48) | 5000 |  |
| `hit-slice` | 4 / 4 | 3.14, 3.0, 3.03, 3.13 | 0.35 | peak -1.0 dBFS | 1688 (48) / 3334 (48) | 5000 |  |
| `bounce-hard` | 2 / 4 | 3.04, 2.89, 2.99, 3.05 | 0.3 | peak -1.0 dBFS | 1763 (48) / 2991 (48) | 4000 |  |
| `bounce-clay` | 2 / 4 | 3.14, 3.18, 3.07, 3.02 | 0.35 | peak -1.0 dBFS | 1967 (48) / 3213 (48) | 4000 |  |
| `net` | 2 / 3 | 2.98, 3.03, 3.0 | 0.6 | peak -1.0 dBFS | 2781 (48) / 4820 (48) | 5000 |  |
| `applause-small` | 2 / 3 | 3.14, 3.06, 3.15 | 2.5 | -18.2 LUFS, TP -1.4 dBTP | 10970 (32) / 11539 (32) | 13000 | peak limiter used, up to about 6.8 dB of reduction |
| `applause-big` | 2 / 3 | 3.15, 3.16, 3.17 | 3.5 | -18.1 LUFS, TP -1.5 dBTP | 15269 (32) / 15895 (32) | 17000 | peak limiter used, up to about 0.9 dB of reduction |
| `cheer` | 1 / 3 | 3.19, 3.05, 3.1 | 2.5 | -18.0 LUFS, TP -2.3 dBTP | 10418 (32) / 11656 (32) | 13000 |  |
| `crowd-bed` | 1 / 3 | 3.61, 3.55, 3.51 | 7.1 | -24.1 LUFS, TP -1.4 dBTP | 25985 (32) / 27202 (28) | 30000 | peak limiter used, up to about 10.3 dB of reduction |
| `sting-win` | 4 / 4 | 3.49, 3.42, 3.42, 3.44 | 1.5 | -16.0 LUFS, TP -3.2 dBTP | 10957 (44) / 10518 (48) | 11000 |  |
| `sting-lose` | 4 / 4 | 3.35, 3.31, 3.37, 3.41 | 1.5 | -16.0 LUFS, TP -3.8 dBTP | 9709 (48) / 10339 (48) | 11000 |  |

Total for the folder (both formats, without NOTICE.txt): **204132 bytes** of the 250000 budget.

## How takes were chosen
`hit-flat` take 4 was chosen by the user after listening. The other picks were made from objective checks, not by
ear, and should get a listening pass:
- One-shots: a single transient in the raw take (takes with a second hit were dropped: `hit-slice` 1 and 3,
  `bounce-hard` 3, `bounce-clay` 1, `net` 1 with a second impact inside its 0.6 s window), then the cleanest tail.
- Crowd: steady short-term loudness, no dropouts, least peak limiting needed to reach the target.
- `crowd-bed`: steadiest take (1.35 dB short-term spread) with the smallest loop-seam step.
- Stingers: earliest natural end. All stinger takes ring past 1.5 s (natural ends 2.0-2.7 s), so each is cut at
  1.5 s with the 200 ms fade-out the manifest asks for; check that the final chord has landed before the fade.

## Deviations from the manifest
- One-shot trim: removing leading audio below -45 dB left the hit 7-18 ms in, because of low pre-roll. The trim
  then starts 3 ms before the first sample within 12 dB of the peak, so every hit lands within 5 ms (no fade-in).
- Crowd and stinger loudness: reaching the LUFS target under -1 dBTP needed a peak limiter (ffmpeg `alimiter` at
  -1.5 dBFS, 2 ms attack, 60 ms release) on `applause-small` (about 6.8 dB), `applause-big` (about 0.9 dB) and
  `crowd-bed` (about 10.3 dB on its occasional peaks). Levels land within 0.2 LU of target.
- Bitrate: when a file overshot its byte budget the bitrate was stepped down 4 kbps at a time: `crowd-bed.m4a`
  28 kbps (manifest 32) and `sting-win.ogg` 44 kbps (manifest 48). Everything else uses the manifest bitrate.
- Resampling uses ffmpeg's swresample (this ffmpeg build has no soxr).
- No sound was regenerated; the takes above are from the first round. Processing was rerun twice after the trim
  and limiter changes.

## Checks
- `ui/tests/sound-assets.test.ts`: 4 passed (only manifest ids, both formats, per-file and folder budgets, NOTICE).
- The whole `ui` Vitest project: 44 passed.

## License (Stable Audio 3 Medium)
Read from the model repository's `LICENSE.md` at the pinned revision: Stability AI Community License Agreement,
last updated 2024-07-05. The T5Gemma text encoder is under the Gemma Terms of Use. Not legal advice.
- **Outputs:** "As between You and Stability AI, You own any outputs generated from the Models" to the extent the
  law allows (§IV.c.iii). Outputs are excluded from "Derivative Works" (§V).
- **Commercial use (§III):** allowed royalty-free for individuals and organisations under US$1M annual revenue
  (counting affiliates), but anyone using the Stability AI Materials for a Commercial Purpose must register at
  https://stability.ai/community-license; the user registered on 2026-10-16 (see `docs/m3-assets-and-references.md`).
  Above US$1M the licence terminates and an enterprise licence is needed.
- **Attribution (§IV.a):** when distributing the Materials or a Derivative Work, "or a product or service that uses
  any portion of them": ship a copy of the agreement, keep the notice "This Stability AI Model is licensed under
  the Stability AI Community License, Copyright © Stability AI Ltd. All Rights Reserved" in a Notice file, and
  prominently display "Powered by Stability AI" on a related website, UI, blog post, about page or product
  documentation. Whether shipping only outputs triggers this is ambiguous; the project complies anyway with
  `ui/public/audio/NOTICE.txt` (both phrases, checked by the test). An in-app or store-page "Powered by Stability
  AI" credit and a copy of the agreement are still open.
- **Restrictions (§IV.b):** follow applicable law and Stability's Acceptable Use Policy; do not use outputs to
  create or improve another foundational generative AI model.
- **Gemma:** Google claims no rights in outputs; the Gemma Prohibited Use Policy applies.
