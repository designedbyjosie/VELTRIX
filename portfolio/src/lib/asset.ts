/** Resolves a file in public/ against the deployed base, so assets work from any static host. */
export function asset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
