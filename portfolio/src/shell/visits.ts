import { load, save } from "../lib/storage";

/** The archive's "library card": which worlds this visitor has opened. Purely local. */
const KEY = "fw.visited";

export function markVisited(slug: string) {
  const list = load<string[]>(KEY, []);
  if (!list.includes(slug)) save(KEY, [...list, slug]);
}

export function visited(): string[] {
  return load<string[]>(KEY, []);
}

export function clearVisits() {
  save(KEY, []);
}
