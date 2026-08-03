import { type CollectionEntry, getCollection } from 'astro:content';
import referencesData from '@/data/references.json';

export type Season = CollectionEntry<'seasons'>;

export interface Reference {
  id: number;
  url: string;
  label: string;
  notes: string[];
}

export const references = referencesData as Reference[];

const referenceById = new Map(references.map((reference) => [reference.id, reference]));

export function getReference(id: number): Reference | undefined {
  return referenceById.get(id);
}

/** All seasons in chronological order (the order they appear in source.md). */
export async function getSeasons(): Promise<Season[]> {
  const seasons = await getCollection('seasons');
  return seasons.sort((a, b) => a.data.order - b.data.order);
}

/**
 * Groups seasons under a shared banner, e.g. `Season 16 Part 1-1` and
 * `Season 16 Part 2-2` both belong to the `Season 16` era. Standalone releases
 * such as `eX700` form a group of their own.
 */
export interface SeasonGroup {
  key: string;
  label: string;
  seasons: Season[];
}

export function groupSeasonKey(title: string): string {
  const match = title.match(/^Season\s+([\dX]+)/i);
  if (match) return `Season ${match[1]}`;

  // eX700/eX701/eX702 are three peer releases in source.md, occupying the slot
  // where a Season 7 would have been. They are grouped under the eX700 name
  // because that is what Webzen and the community call the generation as a
  // whole — 701 and 702 built directly on it.
  if (/^eX\d/i.test(title)) return 'eX700';

  return title;
}

/**
 * Era a release belongs to.
 *
 * An alias of `groupSeasonKey`: the index grouping, the season page's sibling
 * sidebar and the `/seasons/era/*` routes must all agree on what an era is, or
 * headings end up linking to pages that were never built. Kept as a named export
 * so era-specific call sites read clearly at their use site.
 */
export const seasonEraKey = groupSeasonKey;

/** `Season 15` -> `season-15`, for the era overview route. */
export function seasonEraSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function groupSeasons(seasons: Season[]): SeasonGroup[] {
  const groups = new Map<string, SeasonGroup>();

  for (const season of seasons) {
    const key = groupSeasonKey(season.data.title);
    const group = groups.get(key);
    if (group) {
      group.seasons.push(season);
    } else {
      groups.set(key, { key, label: key, seasons: [season] });
    }
  }

  return [...groups.values()];
}

/** True for the release that is still running — `…` as its end date in source.md. */
export function isOngoing(season: Season): boolean {
  return season.data.endDate.trim() === '…';
}

/**
 * Year span an era covers, as a display string: `2001` for a single year,
 * `2001—05` for a range. Derived from the releases themselves, so it stays
 * correct when the source document gains or loses parts.
 */
export function groupYears(group: SeasonGroup): string {
  const years = group.seasons.map(startYear).filter((year): year is number => year !== null);
  if (years.length === 0) return '';

  const first = Math.min(...years);
  const last = Math.max(...endYears(group), ...years);
  if (first === last) return String(first);

  // Two-digit tail unless the century turns, where it would read ambiguously.
  const tail = Math.floor(first / 100) === Math.floor(last / 100) ? String(last).slice(2) : last;
  return `${first}—${tail}`;
}

/** End years of a group's releases, ignoring the ongoing `…` and unparseable dates. */
function endYears(group: SeasonGroup): number[] {
  return group.seasons
    .map((season) => Number.parseInt(season.data.endDate.split('.')[2] ?? '', 10))
    .filter((year) => !Number.isNaN(year));
}

/** Total changelog entries across an era's releases. */
export function groupEntryCount(group: SeasonGroup): number {
  return group.seasons.reduce((sum, season) => sum + season.data.entryCount, 0);
}

/** `12.02.2001` -> `12 Feb 2001`, preserving `??` wildcards from the source. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value: string): string {
  const parts = value.trim().split('.');
  if (parts.length !== 3) return value.trim();

  const [day, month, year] = parts;
  const monthIndex = Number.parseInt(month ?? '', 10) - 1;
  const monthLabel = MONTHS[monthIndex] ?? month;
  const dayLabel = day === '??' ? '' : `${Number.parseInt(day ?? '', 10) || day} `;

  return `${dayLabel}${monthLabel} ${year}`.trim();
}

export function formatRange(season: Season): string {
  const start = formatDate(season.data.startDate);
  const end = season.data.endDate === '…' ? 'present' : formatDate(season.data.endDate);
  return end ? `${start} — ${end}` : start;
}

/** Extracts the year of a season's start date, or null if unknown. */
export function startYear(season: Season): number | null {
  const year = Number.parseInt(season.data.startDate.split('.')[2] ?? '', 10);
  return Number.isNaN(year) ? null : year;
}

/** Rough label for the host of an archived URL, used in the reference list. */
export function sourceLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname.endsWith('web.archive.org')) {
      const original = pathname.match(/https?:\/\/([^/]+)/);
      return original ? `${original[1].replace(/^www\./, '')} (archived)` : 'web.archive.org';
    }
    return hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}
