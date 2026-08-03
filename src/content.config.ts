import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Season entries are generated from `source.md` by `scripts/split-source.mjs`.
 * Never edit `src/content/seasons/*.md` by hand — edit `source.md` instead.
 */
const seasons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/seasons' }),
  schema: z.object({
    title: z.string(),
    range: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    order: z.number(),
    sortKey: z.number(),
    entryCount: z.number(),
    patchCount: z.number(),
    citedRefs: z.array(z.number()),
  }),
});

export const collections = { seasons };
