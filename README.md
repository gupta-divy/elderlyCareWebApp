# ElderCare Connect - Web Prototype

Responsive React + Vite + React Router prototype for families caring for elderly parents.

## Stack

- React 19 + TypeScript + Vite
- React Router
- Tailwind CSS v4
- Supabase Auth and Postgres RPC onboarding
- localStorage persistence for the existing prototype task/document/demo data
- vite-plugin-pwa

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment variables

Create `.env.local` with the Supabase browser values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

The Vite config exposes `NEXT_PUBLIC_` variables through `envPrefix`. Do not put a Supabase service-role key in this app.

Optional local storage keys:

| Variable | Default |
|---------|---------|
| `VITE_ELDERCARE_STORAGE_KEY` | `eldercare-connect-state` |

## Supabase Auth configuration

In the Supabase dashboard:

1. Go to Authentication -> Providers -> Email.
2. Enable Email/Password signups.
3. For local development, set Site URL to `http://localhost:5173`.
4. Add redirect URLs:
   - `http://localhost:5173/*`
   - your deployed Vite app URL, for example `https://your-app.vercel.app/*`
5. Email confirmation may be enabled or disabled:
   - Disabled: signup returns a session and family onboarding runs immediately.
   - Enabled: signup creates the Auth user without a session; the app asks the user to confirm email, then sign in and finish family setup.

## Database migration

Run the SQL migration in:

```text
supabase/migrations/20260713000100_auth_family_onboarding.sql
```

You can apply it with Supabase CLI:

```bash
supabase db push
```

Or paste the migration into the Supabase SQL editor for the project.

The migration creates:

- `profiles`: app profile source of truth for full name, role, email, WhatsApp number, and `whatsapp_verified = false`.
- `families`: family workspace records with unique readable codes like `FAM-7K4P9Q`.
- `family_members`: source of truth for family membership, separate from `profiles`.
- RLS policies so users only read their own profile, same-family profiles, their families, and memberships for families they belong to.
- Authenticated RPC functions:
  - `create_family_and_profile`
  - `join_family_and_create_profile`

Because this is a client-side Vite app, sensitive multi-table onboarding is handled by authenticated Postgres RPC functions instead of browser-side sequential inserts. The functions use `auth.uid()`, do not accept arbitrary user IDs, generate family codes in PostgreSQL, and are idempotent where practical.

## Auth routes

- `/login`: email/password sign in.
- `/signup`: create account and complete family onboarding.
- `/supabase-test`: temporary Supabase connection check.
- `/account-test`: development-only protected account panel with session/profile/family details and logout.

Existing authenticated home routes are preserved:

- Parent users land on `/parent`.
- Child users land on `/child`.

## Create-family testing

1. Start the app with `npm run dev`.
2. Visit `http://localhost:5173/signup`.
3. Select `Create a New Family`.
4. Enter full name, role, email, WhatsApp number, password, and confirm password.
5. Submit the form.
6. If email confirmation is disabled, the app creates the profile, family, and membership, then displays the generated Family ID.
7. Keep the Family ID for join-family testing.

## Join-family testing

1. Log out from the header account menu or `/account-test`.
2. Visit `/signup`.
3. Select `Join a Family`.
4. Enter a Family ID such as `FAM-7K4P9Q`; the app uppercases and trims it.
5. Create the child or parent account.
6. If the code exists, the RPC creates the profile and membership.
7. If the code does not exist, the app shows a friendly Family ID error.

## Login/logout testing

1. Visit `/login`.
2. Sign in with an existing Supabase email/password account.
3. Confirm parent accounts land on `/parent` and child accounts land on `/child`.
4. Refresh the browser and confirm the session persists.
5. Visit `/parent` or `/child` while logged out and confirm redirect to `/login`.
6. Use Logout and confirm protected content is no longer accessible.

## WhatsApp numbers

Signup uses a country selector plus local number field and normalizes to E.164 before storage, for example:

- `+919876543210`
- `+16175551234`
- `+447700900123`

WhatsApp numbers are profile information only. The app does not send OTPs, call Twilio, use the WhatsApp API, or verify phone ownership. New profiles store `whatsapp_verified = false`.

## Build and checks

```bash
cmd /c npx.cmd tsc -p tsconfig.app.json --noEmit
npm run build
```

On Windows PowerShell, `npm.cmd` may be needed if script execution blocks `npm`.

## Prototype notes

- This is not a Next.js app; there are no Next.js route handlers, middleware, server actions, or service-role credentials.
- Supabase Auth manages credentials. Passwords are never stored in app tables or localStorage.
- The existing task/document/demo screens still use local prototype storage.
- Supabase profile role determines the default parent/child landing route.
- If Auth signup succeeds but onboarding fails, the signed-in user is sent back to `/signup` to retry family setup safely.

## Deploy to Vercel

Use the Vite framework preset.

| Setting | Value |
|---------|-------|
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |

The included `vercel.json` rewrites client-side routes to `index.html` so refreshing `/login`, `/signup`, `/parent`, `/child/tasks`, and other React Router pages works in production.
