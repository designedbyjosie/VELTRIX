import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect for signed-out visitors. This only checks that a session cookie is
 * present; the session itself is verified server-side in the app layout and in
 * every API route.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("vx_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
