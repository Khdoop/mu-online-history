# MU Online History

A static, fully-cited timeline of MU Online — every version, season and notable patch from the
2001 closed alpha through to the current season.

78 releases · ~1,000 changelog entries · 435 cited sources.

## Credits

**All of the historical research in this project comes from
[AlighieriDemiurgs/MuHistory](https://github.com/AlighieriDemiurgs/MuHistory).**

Every date, patch note, correction and citation in `source.md` was gathered, verified and
cross-referenced by the maintainer of that repository — including the archival work of tracking
down long-dead Korean patch pages through the Wayback Machine. Full credit for the content belongs
to them.

This repository contributes only the presentation layer: a build script that splits their document
into per-season pages, and an Astro site that renders it. It is an independent project and is not
affiliated with or endorsed by the MuHistory maintainer.

If you are here for the history itself, go to the source repository — it is the canonical, actively
maintained version. Corrections to the *history* belong there, not here.

At the time of writing, MuHistory publishes no explicit license. The content is reproduced here in
good faith with attribution; if the maintainer wants it changed or removed, open an issue and it
will be actioned.

## How it works

`source.md` is the **single source of truth**. It is one long research document with this shape:

```markdown
# **Season 0 (12.02.2001 - 17.08.2005):**

**0.34 aka 0.34.0 (03.08.2001):**

- Introduction of 3<sup>rd</sup> character: Fairy Elf (FE).<sup><a id="cite5"></a>[[5]](#ref5)</sup>
  - A nested clarification note.

# **REFERENCES:**
1. <a id="ref1"></a>[^](#cite1) https://web.archive.org/…
```

`scripts/split-source.mjs` runs before every `dev` and `build` and turns that into:

| Output | Contents |
| --- | --- |
| `src/content/seasons/*.md` | one file per season, frontmatter + `##` patch headings |
| `src/data/references.json` | `[{ id, url, label, notes[] }]` |

The inline `<sup><a id="citeN">…` markup is rewritten to `<mu-cite data-refs="5,42">`, which
`src/components/Citations.astro` hydrates into links pointing at `/references#ref-N`.

**Both outputs are generated and git-ignored.** Never edit `src/content/seasons/` or
`src/data/references.json` by hand — they are overwritten on every build.

`source.md` itself is vendored upstream content (see [Credits](#credits)). Corrections to the
*history* go to [MuHistory](https://github.com/AlighieriDemiurgs/MuHistory); locally, `source.md`
changes only when re-syncing with a newer upstream version.

## Commands

| Command | Description |
| --- | --- |
| `npm install` | install dependencies |
| `npm run dev` | regenerate content, then start the dev server on `localhost:4321` |
| `npm run build` | regenerate content, then build to `dist/` |
| `npm run preview` | serve the built output locally |
| `npm run prepare:content` | run the splitter on its own |
| `npm run check` | Astro + TypeScript diagnostics |
| `npm run lint` | Biome lint + format check |
| `npm run lint:fix` | Biome lint + format, writing fixes |

## Stack

- **Astro 7** — static output, content collections, zero framework runtime
- **Tailwind CSS 4** — via `@tailwindcss/vite`, theme tokens in `src/styles/global.css`
- **Biome 2** — lint + format
- **TypeScript 6** — deliberately not 7, see below

> **Do not upgrade to TypeScript 7.** TS 7 is the native compiler and does not yet expose the
> programmatic API that `astro check` depends on, so `npm run check` fails outright with it.
> Track [withastro/roadmap#1321](https://github.com/withastro/roadmap/discussions/1321) and bump
> once `@astrojs/check` supports it.

`.astro` files have `noUnusedVariables` / `noUnusedImports` / `noNonNullAssertion` disabled in
`biome.json`, because Biome parses Astro frontmatter but not the template that consumes it.

## Deployment

Deployed to **Vercel** as a static site — config in [`vercel.json`](vercel.json). Node version is
pinned by `.nvmrc` and `engines` in `package.json`.

Nothing else is needed on the host: `npm run build` regenerates the content from `source.md` before
building, so the git-ignored generated files are recreated on every deploy. The output is fully
static (83 prerendered pages, ~1.4 MB) — no SSR, no serverless functions, no image optimization.

Before going live, set `site` in `astro.config.mjs` to the real deployed URL. It drives canonical
links and Open Graph tags.

> Vercel's Hobby tier is free but **non-commercial only**. If this site ever carries ads or
> sponsorships, that tier no longer covers it.

## Pages

- `/` — hero stats and the era-grouped timeline
- `/seasons` — filterable index of every release
- `/seasons/<slug>` — one season, with a patch table of contents and prev/next navigation
- `/references` — all 435 sources, filterable, each listing the seasons that cite it
- `/about` — sourcing methodology

## Disclaimer

Historical content by [AlighieriDemiurgs/MuHistory](https://github.com/AlighieriDemiurgs/MuHistory)
— see [Credits](#credits).

Community research project, not affiliated with or endorsed by Webzen Inc. MU Online and related
names are trademarks of their respective owners.
