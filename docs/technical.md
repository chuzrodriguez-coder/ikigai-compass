# Ikigai Compass — Technical Documentation

## Diagrams

Architecture, user journey, domain model, AI interaction flow, and accountability loop are documented as Mermaid diagrams in [`docs/diagrams/`](./diagrams/):

- [System Architecture](./diagrams/system-architecture.md)
- [User Journey](./diagrams/user-journey.md)
- [Domain Model (ER)](./diagrams/domain-model.md)
- [AI Interaction Sequence](./diagrams/ai-interaction-sequence.md)
- [Accountability Loop](./diagrams/accountability-loop.md)

## Architecture Overview

```
Browser
  └─ React+Vite (port 21974, path: /)
       └─ /api/* proxied to Express (port 8080)

Express API Server (port 8080)
  ├─ Clerk JWT authentication middleware
  ├─ CORS (allowlist: REPLIT_DEV_DOMAIN, REPLIT_DOMAINS)
  ├─ Zod request body validation
  ├─ Drizzle ORM → PostgreSQL
  └─ OpenAI gpt-4o (via AI Integrations proxy)
```

## Project Structure

```
/
├── artifacts/
│   ├── ikigai-compass/        # React+Vite frontend
│   │   └── src/
│   │       ├── pages/         # Route-level page components
│   │       ├── components/    # Shared UI components
│   │       └── App.tsx        # Router, Clerk provider
│   └── api-server/            # Express 5 backend
│       └── src/
│           ├── routes/        # Route handlers (discovery, hypotheses, growth, etc.)
│           ├── lib/           # Shared utilities (momentum, param, ai/)
│           └── middlewares/   # requireAuth, validate
├── lib/
│   ├── db/                    # Drizzle schema, migrations, db client
│   ├── api-zod/               # Generated Zod schemas from OpenAPI spec
│   └── api-client-react/      # Generated React Query hooks from OpenAPI spec
└── docs/                      # This documentation
```

## Key Libraries

| Purpose | Library |
|---|---|
| Frontend framework | React 18 + Vite |
| Routing (frontend) | wouter |
| Authentication | Clerk (`@clerk/react`, `@clerk/express`) |
| Server framework | Express 5 |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| AI | OpenAI gpt-4o via Replit AI Integrations proxy |
| Request validation | Zod (auto-generated schemas via orval) |
| State/data fetching | TanStack React Query |
| UI components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS |
| Unit testing | Vitest |

## Authentication Flow

1. User signs in via Clerk (hosted sign-in or embedded component).
2. Clerk issues a JWT stored in the browser session.
3. Frontend sends `Authorization: Bearer <token>` on every API call (via React Query `fetchWithAuth` wrapper).
4. `requireAuth` middleware on the API server:
   - Validates the Clerk JWT using `@clerk/express`.
   - Looks up or creates the user record in `usersTable` using `clerkId`.
   - Attaches `req.dbUserId` for downstream route handlers.

## Database Schema (key tables)

| Table | Purpose |
|---|---|
| `users` | Clerk-synced user records |
| `user_preferences` | Per-user settings (timezone, notifications) |
| `discovery_sessions` | Ikigai discovery questionnaire answers |
| `reflections` | Journal entries linked to sessions |
| `hypotheses` | AI-generated Ikigai direction candidates |
| `growth_plans` | 90-day plans linked to a hypothesis |
| `milestones` | 3–4 major goals within a plan |
| `task_actions` | Concrete steps under each milestone |
| `habits` | Recurring practices |
| `check_ins` | Weekly accountability check-ins |
| `progress_snapshots` | Weekly momentum snapshots |
| `obstacles` | Logged blockers |
| `conversations` | AI coaching conversation threads |
| `conversation_messages` | Individual messages per conversation |
| `ai_interaction_logs` | Token/latency/success logging per AI call |
| `prompt_template_versions` | Versioned prompt templates |

## Security Model

- **Authentication**: All non-public routes require valid Clerk JWT.
- **Authorization (IDOR prevention)**: Every resource is scoped to `req.dbUserId`. The `verifyPlanOwnership()` helper checks `growthPlansTable.userId` before allowing mutations on plan-owned resources (milestones, actions, habits).
- **Input validation**: All mutation routes run `validateBody(Schema)` before the handler. The schema is generated from the OpenAPI spec via orval.
- **CORS**: Origin allowlist derived from `REPLIT_DEV_DOMAIN` and `REPLIT_DOMAINS` environment variables.
- **Parameter injection**: `getParamId(req)` parses and validates numeric route parameters, throwing `400` on non-numeric or non-positive values.

## AI Integration

AI synthesis is triggered by explicit user action (not automatically). Three AI operations exist:

1. **Hypothesis synthesis** (`POST /api/synthesis/hypotheses`) — Takes discovery session answers, runs them through a structured prompt, returns 3–5 Ikigai direction candidates.
2. **Growth plan synthesis** (`POST /api/synthesis/plan`) — Takes a chosen hypothesis and user context, returns a structured 90-day plan scaffold.
3. **Coaching conversation** (`POST /api/openai/message`) — Stateful chat with gpt-4o, system prompt includes the user's hypothesis and plan context.

All AI calls are logged to `ai_interaction_logs` (tokens, latency, success/failure, model, prompt version).

## Momentum Score

The momentum score (0–100) is calculated per check-in:

- Base: 50
- `+8` per point above 3 on energy level (scale 1–5)
- `-8` per point below 3 on energy level
- `+8` per point above 3 on satisfaction level (scale 1–5)
- `+10` if both `plannedActions` and `actualActions` are provided
- `-5` if `blockers` text exceeds 10 characters

Score is clamped between 0 and 100.

See `artifacts/api-server/src/lib/momentum.ts`.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `VITE_CLERK_PROXY_URL` | Clerk proxy URL for Replit |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI proxy base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI proxy key |
| `REPLIT_DEV_DOMAIN` | Replit dev domain for CORS |
| `REPLIT_DOMAINS` | Replit production domain for CORS |
