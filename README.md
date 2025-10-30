# BrandMonitorAI – Authentication and UI Flow

This Next.js 15 (App Router, TypeScript) app provides email/password (custom JWT) and OAuth (Google/GitHub) login, MongoDB persistence (with in‑memory fallback), and a sidebar UI that shows the user’s avatar, name and email.

## Tech Stack
- Next.js 15 + React + TypeScript
- NextAuth.js (Google/GitHub) + custom JWT for email/password
- MongoDB (Mongoose) with development fallback to in‑memory users

## Key Paths
```
src/
  app/
    login/page.tsx                 # Login (email/password + OAuth)
    register/page.tsx              # Registration (normal + OAuth completion)
    api/auth/
      [...nextauth]/route.ts       # NextAuth providers + callbacks
      login/route.ts               # POST email/password login (JWT)
      register/route.ts            # POST email/password registration (JWT)
      oauth-register/route.ts      # POST finish OAuth registration
      oauth-callback/route.ts      # GET post‑OAuth router
      verify/route.ts              # POST verify access token → { id, email, name }
  components/layout/AppLayout.tsx  # Global shell + sidebar + guard
  context/AuthContext.tsx          # Client auth state + login/register/logout
  middleware.ts                    # Minimal middleware (no root)
```

## Auth Flows
### Email/Password (JWT)
1. `/login` → `POST /api/auth/login` → tokens saved → redirect `http://localhost:9002/`.
2. On reload, `POST /api/auth/verify` returns `{ id, email, name }` so the UI shows the DB name.

### OAuth (Google/GitHub)
1. Click provider → NextAuth signs in.
2. If new email, a temp user is created with `needsPasswordSetup: true`.
3. `GET /api/auth/oauth-callback`:
   - `needsPasswordSetup` → `/register?email=...&name=...&oauth=true`
   - else → `http://localhost:9002/`
4. On `/register?oauth=true` the user sets a password (POST `/api/auth/oauth-register`), then the page calls `login(email, password)` and navigates to `http://localhost:9002/`.

## Redirect Rules
- Unauthed access to protected pages (not `/`, `/login`, `/register`, `/oauth-register`) → `/login`.
- Guards never push from `/`, `/login`, `/register`, `/oauth-register` to avoid bouncing during hydration.

## Name Display
- Sidebar prefers `user.name` from DB; if absent, it title‑cases the email local‑part (e.g., `john.doe` → `John Doe`).

## Local Development
1. Install deps: `npm install`
2. `.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/brandmonitorai
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```
3. Run dev: `npm run dev` (port 9002)

## Troubleshooting
- Spinner on `/` after OAuth completion → hard refresh; guards allow hydration.
- Back to `/login` after OAuth → ensure password set on `/register?oauth=true`.
- Sidebar shows email local‑part → ensure `name` stored in DB; `/api/auth/verify` supplies it to the client.

## Notes
- Hybrid auth: custom JWT (email/password) + NextAuth (OAuth).
- Minimal middleware: only helper routes, never root, to avoid redirect loops.
- UX: email/password and OAuth show consistent name/avatar.
