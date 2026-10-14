"use client";

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: FieldError[] = [],
  ) {
    super(message);
  }
  fieldError(path: string) {
    return this.fields.find((f) => f.path === path)?.message;
  }
}

/** Same-origin JSON fetch with consistent error handling. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; fields?: FieldError[] } } | null)?.error;
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) window.location.href = "/login";
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status}).`, err?.fields ?? []);
  }
  return data as T;
}
