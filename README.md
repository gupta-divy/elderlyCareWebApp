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
| Priya Sharma | Child | Family dashboard, tasks, documents, settings |
| Amit Sharma | Child | Same shared child workflow |
| Ramesh Sharma | Parent | Large buttons, tasks, emergency |
| Sunita Sharma | Parent | Large buttons, tasks, emergency |

Tap the mode badge in the header to switch between linked Parent and Child profiles.

## Features (Current)

- **Parent Mode:** Home with photo upload, daily task completion with proof, emergency flow
- **Child Mode:** Family dashboard, shared task planning, document vault, emergency routine editor
- **Family model:** Multiple children can access multiple parent profiles inside one family workspace
- **Persistence:** All state in `localStorage` under the key `eldercare-connect-state`
- **PWA:** Installable via browser, with a service worker from `vite-plugin-pwa`

## Deploy

```bash
npm run build
npx vercel
```

Or expose local dev with ngrok: `ngrok http 5173`
