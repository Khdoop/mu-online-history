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
  return match ? `Season ${match[1]}` : title;
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
