import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSafeRelativePath } from "@/lib/auth/redirect";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. Called from proxy.ts
 * (Next.js 16 renamed `middleware.js` to `proxy.js` — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    const destination = request.nextUrl.pathname + request.nextUrl.search;
    if (isSafeRelativePath(destination)) {
      redirectUrl.searchParams.set("next", destination);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // An already-authenticated visitor hitting the login/signup pages should
  // land back in the app, never be shown the form again — see AUTHENTICATED
  // ROOT: "Do NOT redirect authenticated users back to login."
  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.includes(request.nextUrl.pathname);
  if (isAuthOnlyRoute && user) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

const PROTECTED_ROUTE_PREFIXES = [
  "/home",
  "/learn",
  "/practice",
  "/skill-graph",
  "/review",
  "/projects",
  "/interviews",
  "/progress",
  "/profile",
  "/onboarding",
];

const AUTH_ONLY_ROUTES = ["/login", "/signup"];
