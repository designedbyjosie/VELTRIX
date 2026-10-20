import { useEffect, useState } from "react";

/** Tiny hash router: keeps the site deployable as static files with no server rewrites. */
export function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, "");
  return raw.startsWith("/") ? raw : "/";
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const target = `#${path}`;
  if (opts.replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute(): string[] {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);
  return path.split("/").filter(Boolean);
}

export function href(path: string) {
  return `#${path}`;
}
