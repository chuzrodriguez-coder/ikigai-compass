# Ikigai Compass — Testing Guide

## Test Coverage

### Unit Tests (Vitest)

Located in `artifacts/api-server/src/__tests__/`.

Run with:
```bash
pnpm --filter @workspace/api-server test
```

#### momentum.test.ts

Tests for `calculateMomentumScore()` and `getWeekStart()` from `lib/momentum.ts`.

| Test | Description |
|---|---|
| Baseline score | Returns 50 with no input |
| High energy | Score > 50 when energyLevel = 5 |
| Low energy | Score < 50 when energyLevel = 1 |
| Actions bonus | +10 when both planned and actual actions provided |
| Blockers penalty | -5 when blockers text exceeds 10 characters |
| Score cap | Never exceeds 100 |
| Score floor | Never goes below 0 |
| Missing energy | No adjustment when energyLevel is omitted |
| Week start format | Returns YYYY-MM-DD string |
| Week start Monday | Returns Monday for any weekday |
| Week start given Monday | Same date returned for a Monday input |
| Week start given Sunday | Previous Monday returned |

#### param.test.ts

Tests for `getParamId()` from `lib/param.ts`.

| Test | Description |
|---|---|
| Valid numeric string | Parses "42" → 42 |
| Array param | Parses first element |
| Non-numeric | Throws 400 error |
| Zero | Throws (ID must be positive) |
| Negative | Throws |
| Empty string | Throws |
| Custom param name | Reads `req.params[name]` |

### End-to-End Tests (Playwright via Testing Skill)

E2E tests are run against the live dev server using Playwright.

Key user journeys tested:

1. **Landing page** — Shows heading, signup CTA, and demo button.
2. **Demo mode** — Guest user can navigate all 4 discovery steps and see preview result without signing in.
3. **Authentication** — Sign in / sign up flows via Clerk.
4. **Discovery flow** — Create, edit, and save a discovery session.
5. **Hypothesis generation** — Trigger AI synthesis and view results.
6. **Growth plan** — Create a plan, add milestones and actions.
7. **Coach** — Start and continue a coaching conversation.
8. **Check-in** — Submit a weekly check-in with all fields.

## Running Tests

### Unit tests
```bash
pnpm --filter @workspace/api-server test
```

### TypeScript checks (both packages)
```bash
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/ikigai-compass typecheck
```

### API health check
```bash
curl "$REPLIT_DEV_DOMAIN/api/healthz"
```
