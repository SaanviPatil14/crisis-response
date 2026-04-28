# CityGuard Crisis Response Platform

CityGuard is a multi-surface emergency response demo built with Next.js 16, React 19, Supabase, Google Maps, Twilio, and Google Gemini. It simulates how IoT alerts move from a field sensor to transit staff and then into a municipal command center with live status updates.

## What This App Includes

- `/`: landing page linking to the three product surfaces
- `/simulator`: IoT incident generator that inserts live alerts into Supabase
- `/staff`: officer-facing dashboard with Supabase Auth, geofenced alert filtering, dispatch actions, and AI medic chat
- `/command`: command center view with live incident queue, map tracking, routing, timeline, and notes
- `/api/sms`: server route that sends dispatch SMS messages through Twilio
- `/api/medic`: server route that sends officer questions to Google Gemini and returns first-aid guidance

## Core Workflow

1. An operator creates an incident in the simulator.
2. The incident is written to the `incidents` table in Supabase.
3. Nearby staff see the alert in the staff app.
4. A staff member confirms a critical alert as `CODE_BLUE`, which also triggers SMS dispatch.
5. The command center shows the case on a live map and tracks lifecycle timestamps until resolution.

## Tech Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase for auth, data storage, and realtime subscriptions
- `@vis.gl/react-google-maps` for live map rendering
- Twilio for SMS notifications
- Google Gemini for field medic assistance

## Prerequisites

- Node.js 20+
- npm
- A Supabase project
- A Google Maps browser API key
- A Twilio account and phone number
- A Gemini API key

## Environment Variables

Create `.env.local` with values like these:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+10000000000
YOUR_PERSONAL_PHONE_NUMBER=+10000000001
GEMINI_API_KEY=your-gemini-api-key
```

Notes:

- `NEXT_PUBLIC_*` values are bundled into the browser during build time.
- Twilio and Gemini values are server-side secrets and should stay private.
- `.env*` is already ignored by git in this repo.

## Supabase Requirements

The UI expects a table named `incidents` with realtime enabled. Based on the current code, the app reads or writes these fields:

- `id`
- `type`
- `label`
- `sublabel`
- `severity`
- `status`
- `created_at`
- `confirmed_at`
- `dispatched_at`
- `ambulance_arrived_at`
- `resolved_at`
- `officer_email`
- `staff_lat`
- `staff_lng`
- `notes`

You will also need Supabase Auth enabled for email/password login on the staff app.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/simulator`
- `http://localhost:3000/staff`
- `http://localhost:3000/command`

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Deployment

This project is configured with `output: "standalone"` in [next.config.mjs](/C:/Users/HARMEET/crisis-response/next.config.mjs), which fits container deployment well.

For Google Cloud Run, use:

- [DEPLOY_CLOUD_RUN.md](/C:/Users/HARMEET/crisis-response/DEPLOY_CLOUD_RUN.md)
- [cloudrun.build.env.yaml.example](/C:/Users/HARMEET/crisis-response/cloudrun.build.env.yaml.example)

Important deployment split:

- Build-time public env vars: Supabase URL, Supabase anon key, Google Maps key
- Runtime private env vars: Twilio credentials, destination phone number, Gemini key

## Project Structure

```text
src/
  app/
    api/
      medic/route.js
      sms/route.js
    command/page.jsx
    simulator/page.jsx
    staff/page.jsx
    page.jsx
  components/
    Footer.jsx
  supabaseClient.js
```

## Current Implementation Notes

- The app relies heavily on Supabase realtime subscriptions for cross-screen sync.
- The staff dashboard filters alerts to a 5 km radius when GPS coordinates are available.
- The command center uses Google Maps routing for active medical incidents.
- TypeScript build errors are currently ignored in [next.config.mjs](/C:/Users/HARMEET/crisis-response/next.config.mjs), but most of the codebase is JavaScript today.

## Demo Checklist

1. Sign in or register on `/staff`.
2. Open `/simulator` and create an alert.
3. Confirm a critical alert from `/staff`.
4. Watch the command view update in `/command`.
5. Resolve the incident from staff or command center.
