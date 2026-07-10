# ElderCare Connect - Web Prototype

Responsive PWA prototype for families caring for elderly parents in Tier 2/3 Indian cities.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- localStorage persistence
- vite-plugin-pwa

## Quick start

```bash
cd eldercare-connect
npm install
npm run dev
```

Open `http://localhost:5173` and use Chrome DevTools device mode at `375px` width.

## Demo family

| Profile | Role | Use for |
|---------|------|---------|
| Anika Rao | Child | Family dashboard, tasks, documents, settings |
| Dev Rao | Child | Same shared child workflow |
| Mohan Rao | Parent | Large buttons, tasks, emergency |
| Leela Rao | Parent | Large buttons, tasks, emergency |

Tap the mode badge in the header to switch between linked Parent and Child profiles.

## Features (Current)

- **Parent Mode:** Home with photo upload, daily task completion with proof, emergency flow
- **Child Mode:** Family dashboard, shared task planning, document vault, emergency routine editor
- **Family model:** Multiple children can access multiple parent profiles inside one family workspace
- **Persistence:** All state in `localStorage` under the key `eldercare-connect-state`
- **PWA:** Installable via browser, with a service worker from `vite-plugin-pwa`

## Deploy to Vercel

This prototype is a browser-based React/Vite app. Do not configure it as a native app or APK.

1. Push the repository to GitHub:

```bash
git add .
git commit -m "Prepare ElderCare prototype for Vercel"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

2. Import the repository into Vercel:

- Open Vercel and choose Add New Project.
- Select the GitHub repository.
- Keep the framework preset as Vite.
- Use the build settings below.

3. Vercel build settings:

| Setting | Value |
|---------|-------|
| Framework preset | Vite |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |

4. Environment variables:

No environment variables are required for the demo deployment.

Optional browser storage keys:

| Variable | Default |
|----------|---------|
| `VITE_ELDERCARE_STORAGE_KEY` | `eldercare-connect-state` |
| `VITE_ELDERCARE_PHOTO_STORAGE_KEY` | `eldercare-connect-family-vault` |

These values are not secrets. Do not put real medical, identity, or phone-number data into frontend environment variables.

5. Redeploy after changes:

```bash
npm install
npm run build
git add .
git commit -m "Update ElderCare prototype"
git push
```

Vercel automatically redeploys after the push. For a manual redeploy, open the project in Vercel, go to Deployments, and choose Redeploy on the latest deployment.

The included `vercel.json` rewrites client-side routes to `index.html` so refreshing `/parent`, `/child/tasks`, and other React Router pages works in production.
