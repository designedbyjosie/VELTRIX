export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Record") => new HttpError(404, "not_found", `${what} not found.`);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const forbidden = (message = "You don't have access to this.") => new HttpError(403, "forbidden", message);
export const unauthorized = (message = "Sign in to continue.") => new HttpError(401, "unauthorized", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);
