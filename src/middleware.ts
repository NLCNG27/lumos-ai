import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define protected routes that require auth
const publicRoutes = [
  "/sign-in*",
  "/sign-up*",
  "/",
  "/api/webhooks(.*)"
];

const isPublicRoute = (path: string) => {
  return publicRoutes.find(route => 
    path.match(new RegExp(`^${route.replace(/\*/g, ".*")}$`))
  );
};

export default clerkMiddleware({
  publicRoutes: publicRoutes,
  beforeAuth: (req) => {
    return;
  },
  afterAuth: (auth, req) => {
    const { userId } = auth;
    const path = req.nextUrl.pathname;
    
    // If the route is public, or the user is authenticated, allow access
    if (isPublicRoute(path) || userId) {
      return NextResponse.next();
    }
    
    // Otherwise, redirect to sign-in
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};