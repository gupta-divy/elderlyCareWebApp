# Setu

Setu is a shared React + Vite app for families caring for elderly parents. The same React codebase now runs as:

- Web/PWA
- Android through Capacitor
- iOS through Capacitor

The app is not rewritten in React Native, Flutter, Kotlin, Swift, or Ionic UI components. Supabase remains the backend for authentication, family onboarding, shared notes, tasks, calendar events, and document storage.

## Stack

- React 19 + TypeScript + Vite
- React Router
- Tailwind CSS v4
- Supabase Auth, Postgres, Storage, and RLS
- Capacitor Android and iOS native shells
- vite-plugin-pwa for the web version

## Environment Variables

Create `.env.local` with Vite-prefixed browser values:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Never put the Supabase service-role key in this frontend app.

Optional local configuration:

| Variable | Default |
| --- | --- |
| `VITE_ELDERCARE_STORAGE_KEY` | `eldercare-connect-state` |
| `VITE_FEATURE_DOCUMENTS` | `false` |
| `VITE_FEATURE_SHARED_NOTES` | `true` |
| `VITE_FEATURE_CALENDAR` | `true` |
| `VITE_FEATURE_REMOTE_SUPPORT` | `false` |

Feature flags accept values such as `true`, `false`, `1`, `0`, `enabled`, or `disabled`. Disabled features are hidden from navigation and guarded from direct route access, while their code remains in the repo for later enablement.

## Web Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Production web build:

```bash
npm run build
npm run preview
```

## Windows Setup

Windows can build the React app, sync Capacitor assets, run Android, and open Android Studio.

Install:

- Node.js LTS
- Android Studio
- Android SDK Platform and Build Tools
- JDK version required by the installed Android Gradle Plugin

Confirm Android tooling is available through Android Studio or environment variables such as `ANDROID_HOME`.

## Android Commands

Build and sync all native platforms:

```bash
npm run cap:sync
```

Build and sync Android only:

```bash
npm run cap:sync:android
```

Open Android Studio:

```bash
npm run cap:open:android
```

Run Android on a connected emulator or device:

```bash
npm run cap:run:android
```

## macOS and Xcode Setup

iOS native builds require macOS with:

- Xcode
- Xcode Command Line Tools
- An Apple Developer account for physical devices or distribution

Windows can generate and sync the iOS project files, but building, running, signing, and archiving iOS must happen on macOS.

## iOS Commands

Build and sync iOS:

```bash
npm run cap:sync:ios
```

Open Xcode:

```bash
npm run cap:open:ios
```

Run the app from Xcode on an iOS simulator or device after sync. Production signing and App Store publishing are intentionally not configured yet.

## Workflow After React Changes

1. Make React, CSS, service, or Supabase client changes under `src/`.
2. Run `npm run build`.
3. Run `npm run cap:sync` to copy the latest `dist` output into Android and iOS.
4. Open or run the native platform you need.

For Android-only changes, `npm run cap:sync:android` is faster. For iOS-only changes, use `npm run cap:sync:ios` on macOS.

## Supabase Auth Configuration

In the Supabase dashboard:

1. Go to Authentication -> Providers -> Email.
2. Enable Email/Password signups.
3. For local web development, set Site URL to `http://localhost:5173`.
4. Add redirect URLs:
   - `http://localhost:5173/*`
   - your deployed Vite app URL, for example `https://your-app.vercel.app/*`
5. For native deep links, reserve the `setu://` URL scheme. Add native callback URLs when OAuth or passwordless flows are introduced.

Supabase Row Level Security remains independent from UI visibility. Feature flags only control client navigation and route access.

## Database Migration

Apply the migrations under `supabase/migrations/` with Supabase CLI:

```bash
supabase db push
```

Or paste the SQL into the Supabase SQL editor for the project.

The migrations cover family onboarding, RLS hardening, tasks, calendar events, shared notes, and documents.

## Preserved Features

These features use the shared React web code across Web, Android, and iOS:

- Supabase authentication
- Family onboarding
- Demo parent and child modes
- Parent UI
- Child UI
- Tasks
- Calendar events when `VITE_FEATURE_CALENDAR=true`
- Shared Notes when `VITE_FEATURE_SHARED_NOTES=true`
- Documents module code and services, guarded by `VITE_FEATURE_DOCUMENTS`
- Storage logic and feature-specific services
- Hidden remote support infrastructure, guarded by `VITE_FEATURE_REMOTE_SUPPORT`

## Native Capability Status

Prepared abstractions exist for:

- Notifications
- Camera
- File Picker
- File Sharing
- Permissions
- Deep Links

Implemented now:

- Capacitor Android and iOS shells
- Android hardware back-button handling through `@capacitor/app`
- Native deep-link URL scheme metadata for `setu://`
- Keyboard resize handling through `@capacitor/keyboard`
- Safe-area CSS for notches, home indicator, cutouts, and gesture navigation

Future native plugins or native work will be needed for:

- Push notifications
- Native camera capture
- Native file picker
- Native file sharing beyond Web Share support
- Production signing
- Google Play publishing
- App Store publishing

## Browser-only Differences on Mobile

Some existing browser APIs may behave differently inside Android and iOS WebViews:

- Camera access currently uses `navigator.mediaDevices.getUserMedia`; native Camera plugin integration is not implemented yet.
- Web Share support depends on the OS WebView.
- Browser notifications are not a replacement for native push notifications.
- Clipboard, geolocation, and tel links depend on device permissions and OS policy.
- PWA install behavior only applies to the web version, not the Capacitor shells.

## Build and Checks

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
npm run test
npm run cap:sync
```

On Windows PowerShell, use `npm.cmd` or `npx.cmd` if script execution blocks `npm` or `npx`.
