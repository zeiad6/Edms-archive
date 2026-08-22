import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export function proxy(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  // Session gate: the `edms_uid` cookie must carry a valid HMAC signature —
  // an unsigned or tampered cookie is treated exactly like a missing one.
  // There is deliberately NO auto-login here: sessions are created only by
  // the explicit action on the login page. Without this, a cookie-less visit
  // would silently sign the visitor in as admin, which breaks logout (the
  // next request re-creates the cookie), switch-user (a stale session is
  // never replaced), and the login screen itself (it never appears).
  const uid = raw ? verifySession(raw) : null;
  const isValidId = !!uid && /^[1-9]\d*$/.test(uid);
  if (!isValidId) {
    // /login must stay reachable so the identity picker can render.
    // With a valid cookie, the login page itself redirects to "/".
    if (request.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.next();
    }
    // Every other route requires a session → send the visitor to the picker.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.svg|.*\\.svg|.*\\.png|.*\\.ico).*)",
};
