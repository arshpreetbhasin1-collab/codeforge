import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/session";

// Next.js 16 renamed `middleware.js` to `proxy.js` — same mechanism, new
// file/export name. See node_modules/next/dist/docs/.../file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and image optimization,
     * so auth redirects never block CSS/JS/images from loading.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
