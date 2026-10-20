import { useEffect, useState } from "react";

/** localStorage wrapped so private windows or blocked storage never break the UI. */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial));
  useEffect(() => {
    save(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
