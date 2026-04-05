import { Router } from "express";
import { db } from "@workspace/db";
import {
  checkInsTable,
  progressSnapshotsTable,
  growthPlansTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getParamId } from "../lib/param";
import { calculateMomentumScore, getWeekStart, detectStagnation } from "../lib/momentum";
import { CreateCheckInBody } from "@workspace/api-zod";

const router = Router();

async function getUserTimezone(userId: number): Promise<string> {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });
  return user?.timezone ?? "UTC";
}

router.get("/checkins", requireAuth, async (req, res) => {
  const checkIns = await db.query.checkInsTable.findMany({
    where: eq(checkInsTable.userId, req.dbUserId!),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  res.json(checkIns);
});

router.post("/checkins", requireAuth, validateBody(CreateCheckInBody), async (req, res) => {
  const {
    planId,
    period,
    plannedActions,
    actualActions,
    blockers,
    energyLevel,
    satisfactionLevel,
    nextSteps,
  } = req.body as {
    planId?: number;
    period?: string;
    plannedActions?: string;
    actualActions?: string;
    blockers?: string;
    energyLevel?: number;
    satisfactionLevel?: number;
    nextSteps?: string;
  };

  if (planId !== undefined && planId !== null) {
    const plan = await db.query.growthPlansTable.findFirst({
      where: eq(growthPlansTable.id, planId),
    });
    if (!plan || plan.userId !== req.dbUserId!) {
      res.status(403).json({ error: "Plan not found or access denied" });
      return;
    }
  }

  const momentumScore = calculateMomentumScore({
    plannedActions,
    actualActions,
    energyLevel,
    satisfactionLevel,
    blockers,
  });

  const [checkIn] = await db
    .insert(checkInsTable)
    .values({
      userId: req.dbUserId!,
      planId: planId ?? null,
      period: period ?? "weekly",
      plannedActions,
      actualActions,
      blockers,
      energyLevel,
      satisfactionLevel,
      nextSteps,
      momentumScore,
    })
    .returning();

  const userTimezone = await getUserTimezone(req.dbUserId!);
  const weekStart = getWeekStart(new Date(), userTimezone);

  await db.insert(progressSnapshotsTable).values({
    userId: req.dbUserId!,
    planId: planId ?? null,
    week: weekStart,
    momentumScore,
    actionsCompleted: 0,
    actionsTotal: 0,
    energyAvg: energyLevel ?? null,
    satisfactionAvg: satisfactionLevel ?? null,
  });

  res.status(201).json(checkIn);
});

router.get("/checkins/stagnation/:planId", requireAuth, async (req, res) => {
  const planId = getParamId(req, "planId");
  const plan = await db.query.growthPlansTable.findFirst({
    where: eq(growthPlansTable.id, planId),
  });
  if (!plan || plan.userId !== req.dbUserId!) {
    res.status(403).json({ error: "Plan not found or access denied" });
    return;
  }

  const [latest] = await db
    .select()
    .from(checkInsTable)
    .where(eq(checkInsTable.planId, planId))
    .orderBy(desc(checkInsTable.createdAt))
    .limit(1);

  const result = detectStagnation(
    latest?.createdAt ?? null,
    "weekly",
    new Date()
  );

  res.json({ planId, ...result });
});

router.get("/checkins/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const checkIn = await db.query.checkInsTable.findFirst({
    where: eq(checkInsTable.id, id),
  });
  if (!checkIn || checkIn.userId !== req.dbUserId!) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  res.json(checkIn);
});

export default router;
