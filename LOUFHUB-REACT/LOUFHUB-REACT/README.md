# LOUFHUB — React-only edition

LOUFHUB is a React + TypeScript + Vite entertainment discovery frontend. This edition contains **no Python backend**, no FastAPI service, and no Python installation requirement.

## Included

- Responsive entertainment dashboard and mobile navigation.
- Movie discovery using TMDB: popular, trending, top-rated, upcoming and now-playing.
- Movie search, details, genres, ratings, recommendations and listed YouTube trailers.
- Save movies to a browser-local library with localStorage.
- Music discovery sample page (not playable audio).
- Football sample fixtures (not live scores).

## Requirements

- Node.js 20 or newer
- npm

## Run on Windows

Open PowerShell in the extracted `LOUFHUB-REACT` folder:

```powershell
npm install
Copy-Item .env.example .env
```

Open `.env` and set your TMDB v3 API key:

```env
VITE_TMDB_API_KEY=YOUR_TMDB_V3_API_KEY
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

TMDB supplies movie metadata and trailer references, not full movie files or streaming rights. Music examples do not play audio. Football rows are sample fixtures until a sports data provider is integrated. Full playback and downloads require authorization from the rights holders or licensed providers.

## Current limitations

- No Python or Node backend is included.
- No secure registration/login, cloud profiles, or shared database.
- Saved movies remain in the same browser and device.
- Music playback and live football data are not connected.

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


## Embedded movie trailers

Movie details now play TMDB-listed YouTube trailers in an embedded player inside the LOUFHUB movie details window. This keeps visitors on the LOUFHUB page; the video itself is served by YouTube's embedded player. TMDB provides catalogue metadata and trailer references, not full movie video files or streaming rights. Full-movie playback requires a licensed streaming provider or video files/streams that you own or are authorized to distribute.

## API credential safety

Do not commit API credentials. A React-only app cannot keep a TMDB bearer token secret because browser code and requests are visible to visitors. The project uses the TMDB v3 API key via `VITE_TMDB_API_KEY` for the client-side demo. If you exposed a TMDB v4 Read Access Token publicly or in a chat, revoke/rotate it in your TMDB account and do not put the replacement bearer token in this frontend.
