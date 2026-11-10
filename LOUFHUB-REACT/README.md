# LOUFHUB — React-only edition

LOUFHUB is a React + TypeScript + Vite entertainment discovery frontend. This edition contains **no Python backend**, no FastAPI service, and no Python installation requirement.

## Included

- Responsive entertainment dashboard and mobile navigation.
- Movie discovery using TMDB: popular, trending, top-rated, upcoming and now-playing.
- Movie search, details, genres, ratings, recommendations and listed YouTube trailers.
- Save movies to a browser-local library with localStorage.
- iTunes song search with playable 30-second audio previews and Apple Music links.
- Local audio/video playback for files selected from your device, with download links for those same files.
- Football scoreboards for major European leagues with manual and once-per-minute refresh.
- TMDB watch-provider links to licensed movie services by region.

## Requirements

- Node.js 20 or newer
- npm

## Run on Windows

Open PowerShell in the extracted `LOUFHUB-REACT` folder:

```powershell
npm install
```

Create or edit `.env` and set either a TMDB v4 read access token or v3 API key:

```env
VITE_TMDB_ACCESS_TOKEN=YOUR_TMDB_V4_READ_ACCESS_TOKEN
# Or use: VITE_TMDB_API_KEY=YOUR_TMDB_V3_API_KEY
```

Then start React:

```powershell
npm run dev
```

Open http://localhost:5173

## Netlify deployment

This is now a root-level Vite project. In Netlify use:

- Base directory: leave blank
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: leave blank (not used)

Add the environment variable `VITE_TMDB_API_KEY` in Netlify's site environment variables, then trigger a new deploy.

## Important API-key note

This frontend calls TMDB directly from the browser. A `VITE_` environment variable is included in the public JavaScript bundle, so the TMDB v3 API key is visible to visitors. Use a key intended for browser/client use, review TMDB's current terms and usage limits, and monitor/restrict it where your provider account allows. Do not put private service tokens, passwords, or Applitools secrets in `VITE_` variables.

TMDB supplies movie metadata, trailers, and regional watch-provider listings—not full movie files or streaming rights. iTunes previews are short excerpts; open Apple Music for licensed full tracks. The local player only uses files you select and keeps them in your browser session. Football scores are fetched from ESPN scoreboards, whose availability and coverage are subject to ESPN's service.

## Current limitations

- No Python or Node backend is included.
- No secure registration/login, cloud profiles, or shared database.
- Saved movies remain in the same browser and device.
- Full-track playback and downloads from music stores are not provided.
- Full-movie playback and movie downloads are not provided; use the licensed provider links shown for each title.

## Project structure

```text
LOUFHUB-REACT/
├── public/
├── src/
│   ├── services/
│   │   └── api.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```
