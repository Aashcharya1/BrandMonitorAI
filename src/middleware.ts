import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

  // Simple redirect logic for OAuth users based on token data
  // Note: We DO NOT run middleware on /login to avoid unwanted redirects on first visit
  if (token && (token as any).isOAuthUser && token.email) {
      // If user needs password setup and is not on oauth-register page, redirect there
      if ((token as any).needsPasswordSetup && pathname !== '/oauth-register') {
        const registerUrl = new URL('/oauth-register', req.url);
        registerUrl.searchParams.set('email', token.email as string);
        registerUrl.searchParams.set('name', (token as any).name || '');
        return NextResponse.redirect(registerUrl);
      }
      
      // If user doesn't need password setup and is on auth pages, redirect to main app
      if (!(token as any).needsPasswordSetup && (pathname === '/login' || pathname === '/oauth-register' || pathname === '/set-password')) {
        return NextResponse.redirect(new URL('http://localhost:9002/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Allow access to public pages
        if (pathname === '/login' || pathname === '/register' || pathname === '/set-password' || pathname === '/oauth-register') {
          return true;
        }
        
        // For other pages, allow access (AuthContext will handle authentication)
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    // Do not run on root; only handle helper pages
    '/set-password',
    '/oauth-register',
  ],
};
