# YSOM — Your SIM Online Manager

YSOM is an early-stage application for managing supported SIM-related services
through authorized provider integrations. The project is being built
incrementally; planned service areas are not evidence of live functionality.

## Current project state

- `frontend/` contains the Next.js sign-in, registration, and authenticated
  dashboard experience.
- `backend/` contains a NestJS API using Prisma and MySQL. It stores password
  hashes and revocable server-side sessions.
- The database schema creates the `ysom` database through Prisma migrations.
- SIM, messaging, calling, and mobile-money integrations are not connected.
- Email verification, password reset, multi-factor authentication, and role
  management are not implemented yet.

## Local setup

Requirements: Node.js 22.12 or newer in the 22.x line (or 24+), npm, and a
local MySQL-compatible server.
The database service must be running and reachable at `127.0.0.1:3306`.

1. Create the application database and a separate Prisma migration shadow
   database. Create a scoped local user for both; never use a production
   database for development. For a local MySQL/MariaDB server, replace the
   placeholder with a unique local password and run:

   ```sql
   CREATE DATABASE ysom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE ysom_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'ysom_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_RANDOM_LOCAL_PASSWORD';
   GRANT ALL PRIVILEGES ON ysom.* TO 'ysom_app'@'127.0.0.1';
   GRANT ALL PRIVILEGES ON ysom_shadow.* TO 'ysom_app'@'127.0.0.1';
   ```

2. Copy `backend/.env.example` to `backend/.env` and set the same local
   credentials in `DATABASE_URL` and `SHADOW_DATABASE_URL`. Encode reserved
   URL characters in credentials. Do not commit `backend/.env`.
3. Install, migrate, and start the API:

   ```powershell
   cd backend
   npm install
   npm run db:migrate -- --name initial-auth
   npm run start:dev
   ```

4. In another terminal, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open <http://127.0.0.1:3000>, create an account with a password of at least
   12 characters, and continue to the dashboard.

The frontend uses `http://127.0.0.1:4000/api/v1` by default. Set
`NEXT_PUBLIC_API_URL` in `frontend/.env.local` to use another API address, and
set `FRONTEND_ORIGIN` in `backend/.env` to the exact browser origin.

## Verification

```powershell
# In frontend/
npm run lint
npm run build

# In backend/
npm run build
npm test
```

The backend integration test requires the API to be running and uses a unique
temporary test account, which it deletes when finished.

## Account security notes

- Passwords are hashed with Node.js scrypt, never stored as plaintext.
- The API issues a random, HTTP-only, same-site cookie; only its SHA-256 digest
  is stored in MySQL. Sessions expire after seven days and can be revoked by
  signing out.
- Registration and login are rate-limited; state-changing requests require the
  configured frontend origin.
- Use HTTPS in production so session cookies are marked secure, and configure
  database credentials and allowed origins using a secrets manager.
- Email addresses are not verified in this initial version; use this
  authentication flow only for development until verification and recovery
  flows are implemented.

## Next implementation priorities

1. Add email verification and password recovery.
2. Add authorization roles and account/session management.
3. Add verified provider integrations after credentials and permissions are
   available.

Do not use this application to initiate telecom or financial operations.