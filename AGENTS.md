# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this project is

A static Astro site presenting a cited, patch-by-patch timeline of MU Online (2001 → present).
78 releases, ~1,000 changelog entries, 435 sources.

**The historical content is not ours.** `source.md` is the README of
[AlighieriDemiurgs/MuHistory](https://github.com/AlighieriDemiurgs/MuHistory), reproduced with
attribution. This repository contributes the presentation layer only.

Practical consequence: **do not rewrite, reword, "clean up" or correct the history in `source.md`.**
Treat it as vendored upstream content. Parser changes accommodate its quirks; they do not edit it.
Corrections to the history belong upstream. The only acceptable local edits are re-syncing with a
newer upstream version.

## The one rule that matters

**`source.md` is the single source of truth. Everything under `src/content/seasons/`,
`src/data/references.json` and `src/data/search-index.json` is generated and git-ignored.**

Never edit generated files. If you edit one, your change is silently destroyed the next time anyone
builds.

Note this rule is about *direction of data flow*, not ownership: content flows
`source.md` → generated files → site, so the generated files are never a place to change anything.
It does not license editing `source.md` either — see the credits note above. A factual correction
to the history goes **upstream** to MuHistory; locally, `source.md` only changes when re-syncing
with a newer upstream version.

## Architecture

```
source.md                      research document (hand-maintained, 2,100+ lines)
  └─ scripts/split-source.mjs  runs on every dev/build — writes all three outputs
       ├─ src/content/seasons/*.md     one file per season    (generated, ignored)
       ├─ src/data/references.json     [{id,url,label,notes}] (generated, ignored)
       └─ src/data/search-index.json   one record per bullet  (generated, ignored)

src/content.config.ts    Zod schema for the seasons collection
src/lib/seasons.ts       season loading, grouping, date formatting, source labels
src/components/          Header, Citations (custom element that hydrates citations)
src/layouts/             BaseLayout
src/pages/               index, seasons/, seasons/[...id], references, about
src/styles/global.css    Tailwind 4 theme tokens + .season-prose markdown styles
```

### source.md format

The splitter depends on this structure. Changing it means changing the parser.

```markdown
# **Season 0 (12.02.2001 - 17.08.2005):**       ← season heading (h1, bold, dates in parens)

optional intro prose

**0.34 aka 0.34.0 (03.08.2001):**               ← patch heading (bold line, becomes h2)

- Entry text.<sup><a id="cite5"></a>[[5]](#ref5)</sup>
  - Nested clarification note.

# **REFERENCES:**                                ← terminates season parsing
1. <a id="ref1"></a>[^](#cite1) https://…
- optional note bullet attached to the reference above
```

Quirks the parser already handles — do not "fix" them in `source.md` unless the history itself is
wrong:

- doubled opening tags (`<sup><sup>`) and missing closing `</sup>` on a few entries
- `??` wildcards in dates (`??.05.2001`, `??.??.2001`)
- `…` as the end date of the current, ongoing season
- inline `<sup>` used for ordinals (`3<sup>rd</sup>`) — unrelated to citations, must survive

### Citations

`scripts/split-source.mjs` rewrites citation markup into `<mu-cite data-refs="5,42"></mu-cite>`.
`src/components/Citations.astro` defines a `mu-cite` custom element that turns those into links to
`/references#ref-N`.

`Citations.astro` takes a `refIds` prop and inlines **only** the cited subset of reference URLs.
Passing the full list adds ~70KB to every page — keep passing `season.data.citedRefs`.

## Commands

```bash
npm install
npm run dev            # regenerate content + dev server on :4321
npm run build          # regenerate content + static build to dist/
npm run prepare:content  # run the splitter alone
npm run check          # astro check — must be 0 errors
npm run lint           # biome check — must be clean
npm run lint:fix       # biome check --write
```

Before calling work done, both `npm run check` and `npm run lint` must pass, and `npm run build`
must complete.

## Conventions

- **Astro components only.** No React/Vue/Svelte. The only client JS is two small inline scripts
  (citation hydration, list filtering). Keep it that way unless there's a real need.
- **Tailwind 4**, configured in CSS via `@theme` in `src/styles/global.css` — there is no
  `tailwind.config.js`. Add design tokens there, not as arbitrary values scattered in markup.
- **Markdown body styling** lives in the `.season-prose` component layer, not in per-page classes.
- **Biome** formats and lints. In `biome.json`, `.astro` files have `noUnusedVariables`,
  `noUnusedImports` and `noNonNullAssertion` turned off — Biome parses Astro frontmatter but not
  the template that uses those variables, so they are false positives. Do not "clean up" variables
  in `.astro` frontmatter on Biome's say-so; check the template first.
- Path alias `@/*` → `src/*`.
- **TypeScript is pinned to 6.x on purpose.** TS 7 (the native compiler) does not yet expose the
  programmatic API `astro check` needs, so `npm run check` fails outright on it. Do not bump to 7
  until `@astrojs/check` declares support.

## Gotchas

- `astro.config.mjs` disables smart punctuation via
  `processor: satteri({ features: { smartPunctuation: false } })` (the Astro 7 replacement for the
  old `markdown.smartypants` flag). Season bodies contain raw inline HTML that smart-quote
  transformation mangles. Leave it off.
- Season slugs come from the title (`Season 16 Part 1-2` → `season-16-part-1-2`). The splitter
  de-duplicates colliding slugs with a numeric suffix.
- Season ordering is by the `order` frontmatter field (source document order), not by date —
  several seasons share or overlap dates.
- Reference 130 is present in the source but cited by no entry. That is a property of the research
  document, not a parser bug.
