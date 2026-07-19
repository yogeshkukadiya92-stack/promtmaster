# Production Audit

Audit date: 2026-07-19
Target: Railway `intentos-ai-builder` / `intentos` with MongoDB

## Blockers

| Finding | Evidence | Risk | Fix |
|---|---|---|---|
| Four production clients default to `http://localhost:8787` | `src/lib/activation.js`, `growth.js`, `launch.js`, `operations.js` | Live activation, lifecycle, rollout, SLA, and recovery controls call the visitor's computer instead of Railway | Use a same-origin default and retain `VITE_API_URL` only as an explicit override |
| No Railway worker service is visible | Railway currently reports the web service and MongoDB only | Approved agent jobs can remain queued without execution | Add a separately supervised `npm run worker` Railway service or intentionally disable cloud execution |

## High

| Finding | Evidence | Risk | Fix |
|---|---|---|---|
| Static marketplace fixtures are labelled as live capabilities | `src/lib/marketplace.js`, `src/App.jsx` | Fake creators, ratings, installs, and sales can be mistaken for production data | Gate curated fixtures behind an explicit development flag and handle an empty catalog |
| Checkout creates a local “Stripe test” purchase when Stripe is absent | `src/App.jsx` | Paid content can be unlocked without a verified payment | Remove fallback purchase creation; require a Checkout URL and webhook-backed entitlement |
| Agent execution silently falls back to a simulated run after a cloud failure | `src/App.jsx` | Users can mistake a local simulation for an executed job | Require authentication/cloud persistence for production agent runs and surface failure |
| Publishing, moderation, reviews, reports, and earnings state is browser-local | `src/lib/publishing.js`, `community.js`, `commerce.js` | Data is device-scoped, unaudited, and unavailable to other users/admins | Add marketplace collections, role checks, and APIs before representing these surfaces as live |
| Production has no OpenAI, Resend, or Stripe provider enabled | `/api/health` | Core AI, email delivery, and payment flows use fallback/unavailable states | Add provider credentials manually when those features are launched |

## Medium

| Finding | Evidence | Risk | Fix |
|---|---|---|---|
| Home recents, inspector content, agent mission, and test input contain example data | `src/App.jsx` | A clean production user sees content they did not create | Replace examples with empty states and placeholders |
| Help, inspector configuration, and payout controls are dead | `src/App.jsx` | UI promises actions that do nothing | Wire Help and export; disable payout onboarding until Stripe Connect exists |
| Private-device auth is not durable account identity | `src/lib/auth.js`, `server/session-token.mjs` | Clearing storage creates a new identity; suspension is device-token scoped | Add email/OTP or SSO identity before multi-device launch |

## Low

- The production bundle contains a chunk above 500 kB; split large secondary views after critical wiring is complete.
- The app supports both Supabase and MongoDB repositories, increasing maintenance surface; retain only deliberately supported modes before a larger launch.
