# Quick-match sound assets

Generated sound samples for the quick match (TD-016), made with
[agent-audio](https://github.com/AIEGOBOT/agent-audio) (Stable Audio 3 Medium) on the MacBook's MLX backend.
`manifest.json` is the work order: one entry per sound with its prompt, generation length, kept length, loudness
and trim rules, format bitrate and byte budget, as approved by the user on 2026-10-16.

## Where the files go
- Final files: `ui/public/audio/<id>.ogg` (Opus, primary) and `ui/public/audio/<id>.m4a` (AAC, fallback), mono,
  48 kHz, named by the manifest `id` (for example `hit-flat.ogg`, `crowd-bed.m4a`). Nothing else in that folder
  except `NOTICE.txt`.
- The game fetches them lazily on the first tap that turns sound on, from `BASE_URL + 'audio/'`; until they decode
  (or if one fails) the synthesised sound plays instead, so a missing file is never fatal.
- WAV masters and rejected takes stay off git.
- After generation, `docs/sound/generated.json` records the kept take per sound, final durations and byte sizes,
  and the agent-audio commit, backend, model revision, host and date.

## Budget
At most 250 KB for the whole folder (both formats), so about 125 KB per format; each sound's `budgetBytes` caps one
file. A Vitest test sums the folder.

## License
Stable Audio 3 is under the Stability AI Community License (T5Gemma under the Gemma Terms of Use). Outputs belong to
whoever generates them; commercial use needs a free registration at stability.ai/community-license below US$1M
annual revenue. Details and the attribution decision are in `docs/m3-assets-and-references.md`.
