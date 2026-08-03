/**
 * Splits `source.md` (one huge document) into per-season markdown files plus a
 * references JSON file, both consumed by Astro content collections.
 *
 * Input shape (source.md):
 *   # **Season 0 (12.02.2001 - 17.08.2005):**
 *   optional intro prose
 *   **0.29 aka 0.29.0 (??.??.2001):**
 *   - entry text<sup><a id="citeN"></a>[[N]](#refN)</sup>
 *     - nested note
 *   ...
 *   # **REFERENCES:**
 *   1. <a id="refN"></a>[^](#citeN) https://...
 *   - optional note bullet belonging to the previous reference
 *
 * Output:
 *   src/content/seasons/<slug>.md   frontmatter + cleaned body
 *   src/data/references.json        [{ id, url, notes[] }]
 *
 * The transform is deterministic and idempotent: running it twice produces
 * identical output, so it is safe to call from `dev` and `build`.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'source.md');
const SEASONS_DIR = join(ROOT, 'src/content/seasons');
const DATA_DIR = join(ROOT, 'src/data');

const SEASON_HEADING = /^#\s+\*\*(.+?)\*\*\s*$/;
const PATCH_HEADING = /^\*\*(.+?)\*\*\s*$/;
const REFERENCE_ENTRY = /^(\d+)\.\s+<a id="ref\d+"><\/a>\[\^\]\(#cite\d+\)\s*(.*)$/;
const REFERENCE_NOTE = /^-\s+(.*)$/;
// A citation run is one or more `<a id="citeN"></a>[[N]](#refN)` anchors wrapped
// in `<sup>` tags. The wrappers are matched loosely on purpose: source.md has a
// few entries with a doubled opening `<sup><sup>` or a missing closing `</sup>`.
const CITATION_BLOCK =
  /(?:<sup>)*((?:\s*<a id="cite\d+"><\/a>\[\[\d+\]\]\(#ref\d+\),?)+)\s*(?:<\/sup>)*/g;
const CITATION_ID = /\[\[(\d+)\]\]/g;

/** Season heading text -> structured metadata. */
function parseSeasonHeading(raw) {
  // e.g. "Season 16 Part 1-2 (06.10.2020 - 27.10.2020):" or "eX700 (17.11.2011 - 29.03.2012):"
  const match = raw.match(/^(.*?)\s*\(([^)]*)\)\s*:?\s*$/);
  const title = (match ? match[1] : raw.replace(/:\s*$/, '')).trim();
  const range = match ? match[2].trim() : '';
  const [start = '', end = ''] = range.split(/\s*[-–]\s*/);

  return {
    title,
    range,
    startDate: start.trim(),
    endDate: end.trim(),
    sortKey: dateSortKey(start),
  };
}

/**
 * Turns a `DD.MM.YYYY` date (with `??` wildcards) into a sortable number.
 * Unknown day/month components fall back to the earliest possible value so a
 * partially known date still lands inside the right year.
 */
function dateSortKey(value) {
  const parts = String(value).trim().split('.');
  if (parts.length !== 3) return Number.MAX_SAFE_INTEGER;
  const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(year)) return Number.MAX_SAFE_INTEGER;
  return year * 10000 + (Number.isNaN(month) ? 1 : month) * 100 + (Number.isNaN(day) ? 1 : day);
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Rewrites the inline `<sup><a id="citeN">…` markup into a compact custom tag
 * that the Astro layer renders as an interactive citation chip.
 */
function rewriteCitations(line) {
  return line.replace(CITATION_BLOCK, (_full, inner) => {
    const ids = [...inner.matchAll(CITATION_ID)].map((m) => m[1]);
    if (ids.length === 0) return '';
    return `<mu-cite data-refs="${ids.join(',')}"></mu-cite>`;
  });
}

/** Collects every reference id cited anywhere in a season body. */
function collectCitedRefs(lines) {
  const ids = new Set();
  for (const line of lines) {
    for (const match of line.matchAll(/data-refs="([\d,]+)"/g)) {
      for (const id of match[1].split(',')) ids.add(Number.parseInt(id, 10));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Counts top-level `- ` bullets, i.e. the actual changelog entries. */
function countEntries(lines) {
  return lines.filter((line) => /^-\s+\S/.test(line)).length;
}

function parseReferences(lines) {
  const references = [];
  let current = null;

  for (const line of lines) {
    const entry = line.match(REFERENCE_ENTRY);
    if (entry) {
      const rest = entry[2].trim();
      const url = rest.match(/https?:\/\/\S+/)?.[0] ?? '';
      current = {
        id: Number.parseInt(entry[1], 10),
        url,
        // Text that is not the bare URL (rare, but present on a few entries).
        label: rest.replace(url, '').trim(),
        notes: [],
      };
      references.push(current);
      continue;
    }

    const note = line.match(REFERENCE_NOTE);
    if (note && current) {
      current.notes.push(note[1].trim());
    }
  }

  return references;
}

/**
 * Splits the body of one season into blocks: a patch (bold heading + bullets)
 * or a lead-in prose block that appears before the first patch heading.
 */
function splitSeasonBody(lines) {
  const blocks = [];
  let current = { heading: null, lines: [] };

  for (const line of lines) {
    const heading = line.match(PATCH_HEADING);
    if (heading) {
      if (current.heading !== null || current.lines.some((l) => l.trim())) blocks.push(current);
      current = { heading: heading[1].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.heading !== null || current.lines.some((l) => l.trim())) blocks.push(current);

  return blocks;
}

/** Rebuilds a season body as markdown with `##` patch headings. */
function renderSeasonBody(blocks) {
  const out = [];

  for (const block of blocks) {
    const body = block.lines.join('\n').replace(/^\n+|\n+$/g, '');
    if (block.heading) {
      out.push(`## ${block.heading.replace(/:\s*$/, '')}`);
    }
    if (body) out.push(body);
  }

  return `${out.join('\n\n')}\n`;
}

function yamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const raw = await readFile(SOURCE, 'utf8');
  const lines = raw.split(/\r?\n/);

  const seasons = [];
  let currentSeason = null;
  let referenceLines = null;

  for (const line of lines) {
    const heading = line.match(SEASON_HEADING);

    if (heading) {
      const text = heading[1].trim();
      if (/^REFERENCES/i.test(text)) {
        currentSeason = null;
        referenceLines = [];
        continue;
      }
      currentSeason = { ...parseSeasonHeading(text), lines: [] };
      seasons.push(currentSeason);
      continue;
    }

    if (referenceLines) {
      referenceLines.push(line);
    } else if (currentSeason) {
      currentSeason.lines.push(rewriteCitations(line));
    }
  }

  if (seasons.length === 0) throw new Error('No season headings found in source.md');

  const references = parseReferences(referenceLines ?? []);

  await rm(SEASONS_DIR, { recursive: true, force: true });
  await mkdir(SEASONS_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const seen = new Map();

  for (const [index, season] of seasons.entries()) {
    // Guard against two seasons slugifying to the same file name.
    const base = slugify(season.title);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const slug = count === 1 ? base : `${base}-${count}`;

    const blocks = splitSeasonBody(season.lines);
    const body = renderSeasonBody(blocks);
    const patches = blocks.filter((block) => block.heading).map((block) => block.heading);

    const frontmatter = [
      '---',
      `title: ${yamlString(season.title)}`,
      `range: ${yamlString(season.range)}`,
      `startDate: ${yamlString(season.startDate)}`,
      `endDate: ${yamlString(season.endDate)}`,
      `order: ${index}`,
      `sortKey: ${season.sortKey}`,
      `entryCount: ${countEntries(season.lines)}`,
      `patchCount: ${patches.length}`,
      `citedRefs: [${collectCitedRefs(season.lines).join(', ')}]`,
      '---',
      '',
    ].join('\n');

    await writeFile(join(SEASONS_DIR, `${slug}.md`), frontmatter + body, 'utf8');
  }

  await writeFile(
    join(DATA_DIR, 'references.json'),
    `${JSON.stringify(references, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `Generated ${seasons.length} season files and ${references.length} references from source.md`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
