# Ikigai Compass — Workspace

## Overview

**Ikigai Compass** is a full-stack guided self-discovery and life-direction coaching web app.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Clerk (CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, VITE_CLERK_PUBLISHABLE_KEY)
- **AI**: OpenAI via Replit AI Integrations (AI_INTEGRATIONS_OPENAI_BASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY) — model: gpt-4o
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend build**: Vite + React 19 + Tailwind CSS + shadcn/ui
- **State management**: TanStack Query (React Query)

## Structure

```text
├── artifacts/
│   ├── api-server/         # Express 5 API server (port from $PORT, routed via /api)
│   └── ikigai-compass/     # React + Vite SPA (port from $PORT, routed via /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks (from OpenAPI)
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Application Features

### User Flow
1. **Landing page** → Clerk sign-up/sign-in
2. **Discovery Flow** — 10-step guided questionnaire (discover.tsx)
3. **AI Synthesis** — GPT-4o generates 3 Ikigai hypotheses from answers
4. **Hypotheses** — Accept one as your active Ikigai direction
5. **Growth Plan** — 90-day plan with milestones, weekly actions, daily habits
6. **AI Coach** — SSE-streamed coaching chat sessions (multiple types)
7. **Check-In** — Weekly/monthly accountability with momentum score
8. **Obstacles** — Log and resolve blockers
9. **Reflections** — Private journal with AI summaries
10. **Dashboard** — Momentum chart, recent activity, quick stats

### Frontend Pages (artifacts/ikigai-compass/src/pages/)
- `dashboard.tsx` — Main dashboard with recharts momentum chart
- `discover.tsx` — 10-step discovery questionnaire
- `hypotheses.tsx` — List all Ikigai hypotheses
- `hypothesis-detail.tsx` — Full hypothesis detail with resonance slider
- `plan.tsx` — View active growth plan
- `plan-new.tsx` — Create a new growth plan
- `coach.tsx` — List coaching sessions
- `coach-session.tsx` — SSE-streaming chat coach session
- `checkin.tsx` — Accountability check-in with momentum result
- `obstacles.tsx` — Log and manage obstacles
- `reflections.tsx` — Private reflection journal
- `settings.tsx` — User profile & preferences
- `demo.tsx` — Guest/demo mode: 4-step local-state discovery flow with sign-up CTA (no auth required)

### Backend Routes (artifacts/api-server/src/routes/)
All routes mounted at `/api`:
- `/health` — Health check
- `/users` — User profile (requireAuth middleware auto-creates DB user on first login)
- `/discovery` — Discovery sessions (CRUD, complete, answers)
- `/hypotheses` — Ikigai hypotheses (synthesize via AI, accept, delete)
- `/growth` — Growth plans, milestones, actions, habits
- `/checkins` — Check-in records
- `/coaching` — Coaching sessions and messages
- `/obstacles` — Obstacle tracking
- `/dashboard` — Summary, momentum history, recent activity
- `/openai` — Conversations (SSE streaming)

### Database Schema (lib/db/src/schema/)
Tables: users, userPreferences, discoverySessions, reflectionEntries, ikigaiHypotheses, growthPlans, milestones, taskActions, habits, checkIns, progressSnapshots, coachingSessions, coachingMessages, obstacles, conversations, messages

### AI Integration
- `artifacts/api-server/src/lib/ai/synthesize.ts` — uses gpt-4o to generate 3 hypotheses
- `artifacts/api-server/src/lib/ai/openaiClient.ts` — OpenAI client setup
- Coach SSE streaming: `/api/openai/conversations/:id/messages` POST → SSE stream

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- When api-client-react changes, rebuild declarations: `cd lib/api-client-react && pnpm tsc -p tsconfig.json`
- API codegen: `pnpm --filter @workspace/api-spec run codegen`

## Key Configuration

- API base URL: Frontend makes relative `/api/*` requests; platform proxy routes them to API server
- Clerk proxy: `VITE_CLERK_PROXY_URL` set for frontend Clerk routing
- No emojis anywhere in the UI
- Model: `gpt-4o` (supports both `temperature` and `max_completion_tokens`)

## Security

- **CORS**: Allowlist from `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` env vars
- **IDOR prevention**: `verifyPlanOwnership()` in growth.ts; all resource queries scoped to `req.dbUserId`
- **Input validation**: `validateBody(Schema)` middleware on all mutation routes using generated Zod schemas
- **Param safety**: `getParamId(req)` validates numeric route params, throws 400 on invalid input
- **AI logging**: All AI calls logged to `ai_interaction_logs` (tokens, latency, success/failure)

## Testing

- **Unit tests**: Vitest in `artifacts/api-server/src/__tests__/` — 19 tests covering momentum scoring and param validation
- **Run unit tests**: `pnpm --filter @workspace/api-server test`
- **E2E tests**: Playwright via testing skill; covers landing page, demo mode, discovery flow
- **See docs/testing.md** for full test plan

## Documentation

- `docs/user-guide.md` — End-user guide
- `docs/technical.md` — Architecture, schema, security, env vars
- `docs/testing.md` — Test coverage and how to run tests

## GitHub Repository

- **URL**: https://github.com/chuzrodriguez-coder/ikigai-compass
- **Default branch**: `main`
- The remote `origin` is configured in this project to point to the repository above.
- To push future changes, use Replit's Version Control panel (which uses the connected GitHub OAuth account), or run `git push origin main` from the shell with a GitHub Personal Access Token.

## Deploy-to-GitHub Sync Gate

Every production deployment automatically syncs all source files to GitHub before building. This is wired via `scripts/deploy-build.sh`, which is called as the production build command for the API server artifact.

**How it works:**
1. `scripts/deploy-build.sh` runs first: calls `node scripts/pre-deploy-github-sync.mjs` then the normal API build
2. `scripts/pre-deploy-github-sync.mjs` fetches the current GitHub tree, compares local git blob SHAs (via `git ls-files --stage`), uploads only changed files, and always commits a new snapshot to `main`
3. If sync fails, the build exits non-zero and the deploy is blocked

**Required secret:**
- `GITHUB_PERSONAL_ACCESS_TOKEN` — a GitHub Personal Access Token (classic) with `repo` scope
- Create one at: https://github.com/settings/tokens/new (select the `repo` checkbox, 40-char token starting with `ghp_`)
- The script also accepts `GITHUB_TOKEN` as a fallback name
- Without this secret, production deploys will fail with a clear error message

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/db run push` — push schema to DB
- `pnpm --filter @workspace/api-server test` — run Vitest unit tests
