# LOUF AI — Cloud AI + Admin Console (No Ollama)

LOUF AI is a React/Vite frontend with a Node.js/Express backend and MySQL persistence. Chat calls OpenAI or DeepSeek directly from the server, so Ollama is not required. API keys never go to the browser.

## Features in this package
- Register/sign in with password hashing and HttpOnly sessions
- OpenAI and DeepSeek chat provider selection
- Saved conversations and message history in MySQL
- User profile editing with picture upload, bio, phone, location and website fields
- Rename and delete saved chats; successful sign-in opens the profile page
- Bootstrap administrator and server-enforced admin-only API routes
- Admin dashboard metrics, user role management, account deletion, AI directives, provider status, feature flags and activity log
- Automatic database table creation / basic migration at server startup

## Requirements
- Node.js 20+ recommended
- MySQL or MariaDB running locally (XAMPP is fine)
- Internet connection and a valid API key for the provider you want to use

## 1. Configure environment
1. Copy `.env.example` to `.env` in the `LOUF_AI` project root (the same folder as `server.js`).
2. Set `DB_USER`, `DB_PASSWORD`, and `DB_NAME` to match MySQL. The default database name is `louf`. In phpMyAdmin, import `database/schema.sql` once to create the database and tables; startup also creates any missing tables. `ADMIN_PASSWORD` is blank by default, so administrator bootstrapping is skipped until you set a unique password of at least 8 characters.
3. Replace `OPENAI_API_KEY=replace_with_a_new_openai_key` with a real key from your OpenAI platform dashboard. You can leave the DeepSeek key as a placeholder if you do not use DeepSeek. Placeholder values are intentionally detected and rejected. Create a new key if a previous one was shared or exposed. The backend now prints the exact `.env` path it loaded and a safe configured/missing status at startup; it never prints the secret itself. The project-root `.env` is authoritative for the API key, so a stale Windows environment placeholder will not mask the value in this file.
4. Set `AI_PROVIDER=openai` or `AI_PROVIDER=deepseek` for the default provider.
5. Set `ADMIN_PASSWORD` to a new strong password. The administrator is bootstrapped as username `umux`, email `umuhireobedfaustin1@gmail.com`, display name `umux`.
6. Keep `.env private. Never paste API keys into frontend code or commit `.env`.

**Security note:** API credentials and an admin password were exposed in a chat message. Revoke/rotate the exposed API keys and use a new administrator password before testing. This package intentionally does not include the exposed secret values.

## 2. Install dependencies
You can double-click `INSTALL_DEPENDENCIES.bat`, or open a terminal in the `LOUF_AI` project folder:

```bash
npm install
npm --prefix client install
```

## 3. Start
Start MySQL in XAMPP, then double-click `START_LOUF_AI.bat` or from the project folder run:

```bash
npm run dev
```

Open `http://localhost:5173`. The API server runs at `http://localhost:3000`; Vite proxies `/api` to it. Leave the terminal open while using the app.

If port 5173 or 3000 is occupied, stop the other server first. Check `http://localhost:3000/api/health` for database and selected-provider status.

## Admin sign-in
- Username: `umux`
- Email: `umuhireobedfaustin1@gmail.com` (email can also be used in the username field)
- Password: the value you set for `ADMIN_PASSWORD` in `.env`

The admin account is created/updated during backend startup when `ADMIN_PASSWORD` is configured. Changing this variable and restarting resets the bootstrap admin password, so keep the env file private.

## Main API routes
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `POST /api/auth/logout`
- `POST /api/chat` (body: `{ "message": "...", "conversationId": null, "provider": "openai" }`)
- `GET /api/conversations`
- `PATCH /api/conversations/:id` (rename a saved chat)
- `DELETE /api/conversations/:id` (delete a saved chat)
- `GET /api/conversations/:id/messages`
- Admin APIs under `/api/admin/*`

## Notes and limitations
- The app does not require Ollama or any local model.
- Full generative AI requires a valid provider key, account access, quota/billing and internet connectivity. If a provider key is missing or rejected, the UI displays an error rather than pretending a generated answer was returned.
- Provider selection in the chat is per request. The admin provider page reports key status; the server's default is changed by editing `AI_PROVIDER` in `.env` and restarting Node.
- The feature flag page stores switches in MySQL; some flags are administrative records and must be wired to a feature before they change its behavior.
- This is an improved development MVP, not a security-audited production deployment. Before public hosting, add rate limiting, CSRF protection, password reset/email verification, stronger admin MFA, HTTPS, monitoring, backups, and tests.

## Fix: `Unknown column 'provider' in 'field list'`
This happens when your MySQL `conversations` table was created by an older version. `CREATE TABLE IF NOT EXISTS` does not add columns to an existing table. This package now checks for `conversations.provider` at startup and adds it if missing. Back up your database, replace the old project files with this package, install dependencies if needed, and restart the backend. Alternatively, run `database/fix_conversations_provider.sql` in phpMyAdmin while the correct database is selected. If that column already exists, do not run the SQL a second time.


## Persistent `Unknown column 'provider'` fix
The provider field may be used by either `conversations` or `messages`, depending on the backend code version. This version checks both tables at startup and adds the missing column to each. It also adds missing profile fields to older `users` tables. Confirm the backend is using the database named in `.env`, then restart the backend. If the error persists, inspect the full SQL query in the server log: the table named by that query is the one requiring migration. Back up the database before applying schema changes.


## Troubleshooting: repeated missing OpenAI API key message
1. Open the `.env` file in the same folder as `server.js` (not `client/.env` and not `.env.example`).
2. Replace the placeholder line with `OPENAI_API_KEY=your_real_key_value` using the real key privately on your own computer. Do not include angle brackets and do not send the key to anyone.
3. Make sure `AI_PROVIDER=openai` if you selected OpenAI in the chat dropdown.
4. Close all terminals running old LOUF AI servers. From this folder, run `START_LOUF_AI.bat`.
5. Read the startup lines: `Environment file: ... (found)` and `OpenAI key: configured`. If they say missing/placeholder, the `.env` line is still not a real key or the wrong project folder was started.
6. Open `http://localhost:3000/api/health`. It reports `openaiConfigured` and `envFilePath` without revealing the API key.

A code change cannot create a valid provider key. The key must be created in your provider account and kept server-side. OpenAI's guidance says never expose keys in browser/frontend code. See [OpenAI key safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety).


## Fix: `http://localhost:5173/` returns HTTP 404

1. Stop old LOUF AI terminals with Ctrl+C. Close any other Vite development server using port 5173.
2. Open the `LOUF_AI` folder that contains `server.js`, `package.json`, and `START_LOUF_AI.bat`.
3. Run `START_LOUF_AI.bat` and keep both opened terminal windows running.
4. Confirm the frontend terminal prints a Vite `Local: http://127.0.0.1:5173/` or `http://localhost:5173/` address. Open that exact address.
5. If Vite says port 5173 is already in use, close the other process occupying that port, then restart. This package uses `strictPort` so it won't silently switch to 5174.
6. If the frontend terminal reports a dependency error, run `npm install` in the project root and `npm --prefix client install`, then start again.
7. If the page still returns 404, check the browser URL is `http://localhost:5173/` (not port 3000) and share the frontend terminal output. The backend's port 3000 is for `/api/*` endpoints, not the web UI.
