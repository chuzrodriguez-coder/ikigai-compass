import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      usersTable: { findFirst: vi.fn() },
      ikigaiHypothesesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      growthPlansTable: { findFirst: vi.fn(), findMany: vi.fn() },
      discoverySessionsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      obstaclesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      userPreferencesTable: { findFirst: vi.fn() },
      milestonesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      taskActionsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      habitsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      checkInsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      coachingSessionsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      coachingMessagesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      progressSnapshotsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      remindersTable: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      id: 1,
      clerkId: "user_1",
      email: "a@b.com",
      displayName: null,
      timezone: null,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  getAuth: vi.fn(),
}));

vi.mock("pino-http", () => ({
  default: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../openaiClient", () => ({
  getOpenAIClient: vi.fn(() => null),
  isAIAvailable: vi.fn(() => false),
}));

vi.mock("../middlewares/clerkProxyMiddleware", () => ({
  CLERK_PROXY_PATH: "/__clerk",
  clerkProxyMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";

const makeUser = (id: number, clerkId: string) => ({
  id,
  clerkId,
  email: `${clerkId}@test.com`,
  displayName: null as string | null,
  timezone: null as string | null,
  onboardingCompleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

async function createTestApp() {
  const { default: router } = await import("../routes");
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("requireAuth middleware — real production middleware behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no Clerk session is present", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
    const app = await createTestApp();
    const res = await request(app).get("/api/hypotheses");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when Clerk userId is undefined", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: undefined } as unknown as ReturnType<typeof getAuth>);
    const app = await createTestApp();
    const res = await request(app).get("/api/growth/plans");
    expect(res.status).toBe(401);
  });

  it("allows access when Clerk userId is present and user is created on first visit", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_new", sessionClaims: { email: "new@test.com" } } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(undefined);
    vi.mocked(db.query.ikigaiHypothesesTable.findMany).mockResolvedValue([]);
    const app = await createTestApp();
    const res = await request(app).get("/api/hypotheses");
    expect(res.status).toBe(200);
  });

  it("allows access when Clerk userId is present and user already exists in DB", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_existing" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(42, "user_existing"));
    vi.mocked(db.query.discoverySessionsTable.findMany).mockResolvedValue([]);
    const app = await createTestApp();
    const res = await request(app).get("/api/discovery/sessions");
    expect(res.status).toBe(200);
  });
});

describe("Cross-user authorization denial via real route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/hypotheses/:id returns 404 when hypothesis belongs to different user (DB-scoped query)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_attacker" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(99, "user_attacker"));
    vi.mocked(db.query.ikigaiHypothesesTable.findFirst).mockResolvedValue(undefined);
    const app = await createTestApp();
    const res = await request(app).get("/api/hypotheses/1");
    expect(res.status).toBe(404);
  });

  it("GET /api/growth/plans/:id returns 404 when plan belongs to different user (DB-scoped query)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_attacker" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(99, "user_attacker"));
    vi.mocked(db.query.growthPlansTable.findFirst).mockResolvedValue(undefined);
    const app = await createTestApp();
    const res = await request(app).get("/api/growth/plans/1");
    expect(res.status).toBe(404);
  });

  it("GET /api/obstacles returns empty list for user with no obstacles (DB scoped to userId)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_other" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(77, "user_other"));
    vi.mocked(db.query.obstaclesTable.findMany).mockResolvedValue([]);
    const app = await createTestApp();
    const res = await request(app).get("/api/obstacles");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe("Unauthenticated access to all protected domains returns 401", () => {
  beforeEach(() => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
  });

  const protectedRoutes = [
    "/api/hypotheses",
    "/api/growth/plans",
    "/api/obstacles",
    "/api/checkins",
    "/api/coaching/sessions",
    "/api/discovery/sessions",
    "/api/dashboard/summary",
  ];

  for (const route of protectedRoutes) {
    it(`GET ${route} returns 401 without authentication`, async () => {
      const app = await createTestApp();
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    });
  }
});

describe("High-risk resource family — auth regression (coaching, growth, hypotheses)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/coaching/sessions/:id returns 404 for session belonging to another user (DB-scoped query)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_attacker" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(99, "user_attacker"));
    vi.mocked(db.query.coachingSessionsTable.findFirst).mockResolvedValue(undefined);
    const app = await createTestApp();
    const res = await request(app).get("/api/coaching/sessions/1");
    expect(res.status).toBe(404);
  });

  it("GET /api/growth/plans/:id returns 404 when plan belongs to different user (ownership enforced)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_attacker" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(99, "user_attacker"));
    vi.mocked(db.query.growthPlansTable.findFirst).mockResolvedValue(undefined);
    const app = await createTestApp();
    const res = await request(app).get("/api/growth/plans/1");
    expect(res.status).toBe(404);
  });

  it("GET /api/hypotheses/:id returns 404 when hypothesis belongs to different user (DB-scoped)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_attacker" } as unknown as ReturnType<typeof getAuth>);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue(makeUser(99, "user_attacker"));
    vi.mocked(db.query.ikigaiHypothesesTable.findFirst).mockResolvedValue(undefined);
    const app = await createTestApp();
    const res = await request(app).get("/api/hypotheses/1");
    expect(res.status).toBe(404);
  });

  it("POST without auth returns 401 on mutation routes (growth plan create)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
    const app = await createTestApp();
    const res = await request(app)
      .post("/api/growth/plans")
      .send({ title: "My Plan", longTermDirection: "Growth" });
    expect(res.status).toBe(401);
  });

  it("POST without auth returns 401 on mutation routes (hypothesis create)", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
    const app = await createTestApp();
    const res = await request(app)
      .post("/api/hypotheses")
      .send({ title: "My Hypothesis", summary: "Test" });
    expect(res.status).toBe(401);
  });
});
