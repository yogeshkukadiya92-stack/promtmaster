# Backend Integration

## Runtime modes

IntentOS now exposes a server API and keeps a safe browser fallback:

- `OPENAI_API_KEY` absent: `/api/health` reports `local-fallback`; browser generation uses the local structured generator.
- `OPENAI_API_KEY` present: `/api/generate` uses the OpenAI Responses API with a strict JSON Schema.
- Supabase credentials absent: assets persist in versioned browser storage.
- Supabase credentials present: the server verifies the Bearer token with Supabase Auth before cloud reads, writes, or deletes.
- `MONGODB_URI`, `AUTH_SECRET`, and `VITE_AUTH_MODE=mongodb` present: private-device users and all workspace records persist in MongoDB.
- `ADMIN_ACCESS_KEY` present with MongoDB: the protected Auth & Data Control panel is enabled.

## Local configuration

1. Copy `.env.example` to `.env`.
2. Add server-only credentials. Never add the `VITE_` prefix to secrets.
3. Add the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values for browser authentication. Never use the service-role key in a `VITE_` variable.
4. Start the API with `npm run api`.
5. Start the dashboard with `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort`.

For MongoDB production, use separate random values for `AUTH_SECRET` (32+ characters) and `ADMIN_ACCESS_KEY` (24+ characters). Both are server-only and must never use a `VITE_` prefix.

## API contracts

### `GET /api/health`

Returns provider readiness without exposing credentials.

### `POST /api/generate`

Request:

```json
{
  "intent": "Create a launch campaign for a sustainable skincare brand",
  "mode": "agent"
}
```

Modes: `auto`, `prompt`, `skill`, `agent`.

Success: HTTP `201` with `{ "asset": ... }`.  
Provider missing: HTTP `503` with `PROVIDER_UNAVAILABLE`.  
Invalid intent: HTTP `400`.

When a valid Supabase access token is supplied as `Authorization: Bearer <token>`, the generated asset is also saved to the verified user's cloud library.

### `GET /api/assets`

Requires a valid Supabase Bearer token. Returns the authenticated user's latest 100 assets.

### `DELETE /api/assets/:id`

Requires a valid Supabase Bearer token. Deletes only an asset owned by the verified user.

### Admin auth and data control

- `POST /api/admin/session`: exchanges the server-managed access key for an eight-hour signed admin token. Failed attempts are rate-limited per IP.
- `GET /api/admin/overview`: returns protected user status, activity, asset counts, analytics event counts, and backup counts.
- `PATCH /api/admin/users/:id`: renames a workspace or suspends/reactivates its current device session while retaining saved data.
- `POST /api/admin/users/:id/backups`: creates a checksum-backed MongoDB snapshot, capped at 8 MB.
- `GET /api/admin/users/:id/export`: downloads the user's scoped records as JSON and writes an admin audit event.

Admin access keys are never persisted in browser storage. Only the short-lived signed token is kept in `sessionStorage` and is cleared when the panel is locked or the server returns `401`.

## Database migration

Apply `supabase/migrations/001_assets.sql` through the Supabase migration workflow. The table uses:

- UUID primary keys
- `timestamptz`
- constrained asset types and intent lengths
- JSONB structured content
- composite indexes for owner/type/recent queries
- RLS policies for authenticated users only

The service-role key remains server-only. The server does not accept a user id from a browser header; it verifies the Supabase access token and uses the verified subject as `user_id`.
