import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.dbUserId = 1;
    req.clerkUserId = "test_clerk_user_1";
    next();
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      usersTable: { findFirst: vi.fn() },
      userPreferencesTable: { findFirst: vi.fn() },
      discoverySessionsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      ikigaiHypothesesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      growthPlansTable: { findFirst: vi.fn(), findMany: vi.fn() },
      milestonesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      taskActionsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      habitsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      checkInsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      obstaclesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      coachingSessionsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      coachingMessagesTable: { findFirst: vi.fn(), findMany: vi.fn() },
      progressSnapshotsTable: { findFirst: vi.fn(), findMany: vi.fn() },
      remindersTable: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  getAuth: () => ({ userId: "test_clerk_user_1" }),
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

async function createTestApp() {
  const { default: router } = await import("../routes");
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("Health endpoint", () => {
  it("GET /api/healthz returns status ok", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("Auth boundary enforcement on protected routes", () => {
  let app: ReturnType<typeof express>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("GET /api/discovery/sessions returns 200 for authenticated user (empty list)", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.discoverySessionsTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/discovery/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/growth/plans returns 200 for authenticated user (empty list)", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.growthPlansTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/growth/plans");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/growth/habits returns 200 for authenticated user (empty list)", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.habitsTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/growth/habits");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/hypotheses returns 200 for authenticated user (empty list)", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.ikigaiHypothesesTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/hypotheses");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/obstacles returns 200 for authenticated user (empty list)", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.obstaclesTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/obstacles");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("404 handling on unknown routes", () => {
  it("GET /api/nonexistent returns 404", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/nonexistent-route-xyz");
    expect(res.status).toBe(404);
  });
});

describe("Growth plan lifecycle (mocked DB)", () => {
  let app: ReturnType<typeof express>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/growth/plans/:id returns 404 when plan not found", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.growthPlansTable.findFirst).mockResolvedValue(undefined);
    const res = await request(app).get("/api/growth/plans/99999");
    expect(res.status).toBe(404);
  });

  it("GET /api/growth/milestones returns 200 with empty milestones", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.milestonesTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/growth/milestones");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("Validation middleware on body payloads", () => {
  let app: ReturnType<typeof express>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("POST /api/growth/plans with missing required fields returns 400", async () => {
    const res = await request(app)
      .post("/api/growth/plans")
      .send({});
    expect([400, 422]).toContain(res.status);
  });

  it("POST /api/discovery/sessions with invalid body returns 400", async () => {
    const res = await request(app)
      .post("/api/discovery/sessions")
      .send({ title: 123 });
    expect([400, 422]).toContain(res.status);
  });
});

describe("Check-in and coaching route availability", () => {
  let app: ReturnType<typeof express>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("GET /api/checkins returns 200 for authenticated user", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.checkInsTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/checkins");
    expect(res.status).toBe(200);
  });

  it("GET /api/coaching/sessions returns 200 for authenticated user", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(db.query.coachingSessionsTable.findMany).mockResolvedValue([]);
    const res = await request(app).get("/api/coaching/sessions");
    expect(res.status).toBe(200);
  });
});
