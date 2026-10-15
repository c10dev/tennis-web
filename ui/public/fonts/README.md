# Fonts (SIL OFL 1.1, ADR-020)

From [google/fonts](https://github.com/google/fonts) `ofl/` at commit 8b0a1d0 (2026-10-13), except Pretendard (below), each with its OFL.txt here.

| File | Source | Processing |
|---|---|---|
| `lilita-one-400.woff2` | `lilitaone/LilitaOne-Regular.ttf` | WOFF2 conversion only (its OFL reserves the name "Lilita", so it is not subset or renamed) |
| `nunito-600.woff2`, `nunito-800.woff2` | `nunito/Nunito[wght].ttf` | Static instances at wght 600 and 800, Latin subset |
| `barlow-condensed-600.woff2`, `barlow-condensed-700.woff2` | `barlowcondensed/BarlowCondensed-{SemiBold,Bold}.ttf` | Latin subset |

| `pretendard-600.subset.woff2`, `pretendard-800.subset.woff2` | npm `pretendard@1.3.9` `dist/web/static/woff2-subset/Pretendard-{SemiBold,ExtraBold}.subset.woff2` (ADR-022) | None: the author's own subset (2,780 Hangul syllables, KS X 1001 and more), renamed files only; its OFL reserves the name "Pretendard", so it is not subset again |

Latin subset: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
U+2000-206F, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD (fontTools `pyftsubset`, all layout features kept).
