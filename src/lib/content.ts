import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;
export type Interest = CollectionEntry<'interests'>;
export type Publication = CollectionEntry<'publications'>;

/** Projects that get a page: public and minimal, in display order. */
export async function listedProjects(): Promise<Project[]> {
  return (await getCollection('projects', (p) => p.data.visibility !== 'hidden')).sort((a, b) => a.data.order - b.data.order);
}

export async function listedInterests(): Promise<Interest[]> {
  return (await getCollection('interests')).sort((a, b) => a.data.order - b.data.order);
}

export async function listedPublications(): Promise<Publication[]> {
  return (await getCollection('publications', (p) => p.data.visibility !== 'hidden')).sort(
    (a, b) =>
      Number(b.data.role === 'first author') - Number(a.data.role === 'first author') ||
      (b.data.date ?? '').localeCompare(a.data.date ?? ''),
  );
}

export const interestIds = (p: Project) => p.data.interests.map((i) => i.id);

/** "Under review, Journal of …" from a publication's status and venue. */
export function statusLine(p: Publication['data']): string {
  const status = p.status.charAt(0).toUpperCase() + p.status.slice(1);
  return [status, p.venue].filter(Boolean).join(', ');
}
