# YSOM frontend

The YSOM frontend uses Next.js 16 App Router, React 19, TypeScript, Tailwind
CSS 4, and Lucide icons. It provides account registration, sign-in, session
restoration, sign-out, and a protected dashboard backed by the NestJS API.

## Requirements

- Node.js
- npm

## Development

Start the API and configure its local MySQL database first; see the repository
root [README](../README.md) for database setup. From this directory:

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>.

## Verification

```powershell
npm run lint
npm run build
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is not at
`http://127.0.0.1:4000/api/v1`.

## Current limitations

Service cards in the dashboard are explicitly marked as not connected. Email
verification, password recovery, MFA, and telecom integrations are not yet
available.
