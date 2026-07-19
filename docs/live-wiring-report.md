# IntentOS live wiring report

Date: 2026-07-19

## Scope

Production-readiness pass across the React/Vite client, Express API, MongoDB repository, agent worker, GitHub source, and Railway runtime.

## Live-now matrix

| Area | State | Evidence |
|---|---|---|
| Short-intent creation | Live | Production build generates and saves a capability; browser QA passed. |
| MongoDB persistence | Live | Railway MongoDB is linked through `MONGODB_URI`; device sessions and admin control are enabled. |
| Admin auth/data control | Live | Protected admin session, user status controls, exports, and snapshots are backed by MongoDB. |
| Agent API | Live after this release | MongoDB now implements durable runs, decisions, retries, schedules, memories, tool evidence, and operations telemetry. |
| Agent worker | Live after worker service rollout | Worker selects MongoDB first, maintains heartbeats, claims approved jobs, and records verification evidence. |
| Marketplace catalog | Honest empty state | Production no longer publishes curated fixtures as real listings. Only approved listings appear. |
| Payments | Disabled until configured | Checkout and payout actions no longer simulate success when Stripe is absent. |
| OpenAI generation | Optional | Deterministic local creation remains available; provider-backed generation needs `OPENAI_API_KEY`. |
| Email delivery | Optional | Manual links remain available; transactional delivery needs Resend configuration. |

## Demo behavior removed

- Production API helpers no longer point to `localhost:8787` by default.
- Fake marketplace ratings, installs, creators, and paid checkout success are not presented as live data.
- Failed cloud agent creation, approval, cancellation, and retry do not fall back to simulated runs.
- Hard-coded recent work, generated result, outline, mission, and test content were removed from empty states.
- Help, inspector export, and recent-item open actions are wired.

## Verification

- `npm run check`: passed.
- Vite production build: passed.
- Server syntax checks: passed.
- Browser QA: Help navigation, short-intent generation, production marketplace empty state passed.
- Browser console warnings/errors during tested flows: 0.

## Provider configuration still optional

The application can launch with MongoDB/auth/admin only. To activate the remaining provider-dependent features, configure:

- OpenAI: `OPENAI_API_KEY`, optionally `OPENAI_MODEL` and `OPENAI_AGENT_MODEL`.
- Resend: `RESEND_API_KEY`, `INVITE_EMAIL_FROM`, and the existing `APP_URL`.
- Stripe: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

These are external account credentials and cannot be fabricated by the application.
