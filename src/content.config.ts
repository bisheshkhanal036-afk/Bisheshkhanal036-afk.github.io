import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Data-integrity rules (see CLAUDE.md):
 * - Every number or claim carries a `source`. Allowed forms:
 *     "cv.pdf p.N"            the CV in content/source/cv.pdf
 *     "brief YYYY-MM-DD"      facts Bishesh stated in the site brief or a later message
 *     "crossref:<doi>"        a stored record in src/data/crossref/
 *     "PLACEHOLDER"           unknown; renders a badge and fails `npm run check`
 * - Free text that still needs Bishesh's sign-off contains "TODO: confirm".
 */
const source = z.string().min(1);

const fact = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  /** "current results" etc. Shown next to the value. */
  qualifier: z.string().optional(),
  source,
});

const link = z.object({
  label: z.string(),
  href: z.url(),
  source,
});

const visibility = z.enum(['public', 'minimal', 'hidden']);

/** One person in an author list. `me` marks Bishesh. */
const author = z.object({
  name: z.string(),
  me: z.boolean().default(false),
  note: z.string().optional(), // "joint first author", "corresponding author"
});

// Profile: name, contact and summary. One entry, id "me".
const profile = defineCollection({
  loader: file('src/content/profile.json'),
  schema: z.object({
    name: z.string(),
    email: z.email(),
    location: z.string(),
    summary: z.string(),
    links: z.array(link),
    source,
  }),
});

// CV sections. One JSON file per section.
const cv = defineCollection({
  loader: glob({ base: './src/content/cv', pattern: '*.json' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    entries: z.array(
      z.object({
        period: z.string().optional(),
        title: z.string(),
        org: z.string().optional(),
        place: z.string().optional(),
        detail: z.string().optional(),
        items: z.array(z.string()).default([]),
        links: z.array(link).default([]),
        source,
      }),
    ),
  }),
});

const publications = defineCollection({
  loader: glob({ base: './src/content/publications', pattern: '*.json' }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['article', 'preprint', 'conference abstract', 'letter']),
    // "published" is deliberately absent. Use only what Bishesh has stated.
    status: z.enum(['preprint', 'under review', 'in preparation', 'accepted', 'PLACEHOLDER']),
    /** Shown instead of an author list (Bishesh, 2026-10-11: "no need for author lists"). */
    role: z.enum(['first author', 'co-author']),
    /** Only for items with a Crossref record; used for verification and JSON-LD, not displayed. */
    authors: z.array(author).default([]),
    venue: z.string().optional(),
    date: z.string().optional(), // ISO date or YYYY-MM
    doi: z.string().optional(), // must have a stored Crossref record
    links: z.array(link).default([]),
    project: reference('projects').optional(),
    visibility,
    notes: z.string().optional(), // internal, never rendered
    source,
  }),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    status: z.string(),
    role: z.string().optional(),
    summary: z.string(),
    period: z.string(),
    stack: z.array(z.string()).default([]),
    facts: z.array(fact).default([]),
    interests: z.array(reference('interests')).default([]),
    figure: z
      .object({
        component: z.string(),
        number: z.number(),
        title: z.string(),
        caption: z.string(),
        data: z.string(),
        dataStatus: z.enum(['observed', 'simulated', 'schematic']),
      })
      .optional(),
    links: z.array(link).default([]),
    visibility,
    featured: z.boolean().default(false),
    order: z.number(),
    source,
  }),
});

const interests = defineCollection({
  loader: file('src/content/interests.json'),
  schema: z.object({
    label: z.string(),
    exploring: z.boolean().default(false),
    order: z.number(),
    source,
  }),
});

export const collections = { profile, cv, publications, projects, interests };
