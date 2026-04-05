import { Router } from "express";
import { db } from "@workspace/db";
import {
  growthPlansTable,
  milestonesTable,
  taskActionsTable,
  habitsTable,
  checkInsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getParamId } from "../lib/param";
import { validateBody } from "../middlewares/validate";
import {
  CreateGrowthPlanBody,
  UpdateGrowthPlanBody,
  CreateMilestoneBody,
  UpdateMilestoneBody,
  CreateTaskActionBody,
  UpdateTaskActionBody,
  CreateHabitBody,
  UpdateHabitBody,
} from "@workspace/api-zod";

import { generatePeriodSummary } from "../lib/ai/summary-generation";

const router = Router();

async function verifyPlanOwnership(planId: number, userId: number): Promise<boolean> {
  const plan = await db.query.growthPlansTable.findFirst({
    where: and(eq(growthPlansTable.id, planId), eq(growthPlansTable.userId, userId)),
  });
  return !!plan;
}

router.get("/growth/plans", requireAuth, async (req, res) => {
  const plans = await db.query.growthPlansTable.findMany({
    where: eq(growthPlansTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(plans);
});

router.post("/growth/plans", requireAuth, validateBody(CreateGrowthPlanBody), async (req, res) => {
  const { hypothesisId, title, longTermDirection, ninetyDaySummary, startDate, targetEndDate } =
    req.body as {
      hypothesisId?: number;
      title: string;
      longTermDirection?: string;
      ninetyDaySummary?: string;
      startDate?: string;
      targetEndDate?: string;
    };
  const [plan] = await db
    .insert(growthPlansTable)
    .values({
      userId: req.dbUserId!,
      hypothesisId: hypothesisId ?? null,
      title,
      longTermDirection: longTermDirection ?? "",
      ninetyDaySummary,
      startDate,
      targetEndDate,
    })
    .returning();
  res.status(201).json(plan);
});

router.get("/growth/plans/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const plan = await db.query.growthPlansTable.findFirst({
    where: and(
      eq(growthPlansTable.id, id),
      eq(growthPlansTable.userId, req.dbUserId!)
    ),
  });
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const milestones = await db.query.milestonesTable.findMany({
    where: eq(milestonesTable.planId, id),
    orderBy: (t, { asc }) => [asc(t.targetDate)],
  });
  const actions = await db.query.taskActionsTable.findMany({
    where: eq(taskActionsTable.planId, id),
    orderBy: (t, { asc }) => [asc(t.weekOf)],
  });
  const habits = await db.query.habitsTable.findMany({
    where: eq(habitsTable.planId, id),
  });
  res.json({ ...plan, milestones, actions, habits });
});

router.put("/growth/plans/:id", requireAuth, validateBody(UpdateGrowthPlanBody), async (req, res) => {
  const id = getParamId(req);
  const updates: Partial<typeof growthPlansTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  const fields = ["title", "longTermDirection", "ninetyDaySummary", "status", "targetEndDate"] as const;
  for (const f of fields) {
    if ((req.body as Record<string, unknown>)[f] !== undefined) {
      (updates as Record<string, unknown>)[f] = (req.body as Record<string, unknown>)[f];
    }
  }
  const [plan] = await db
    .update(growthPlansTable)
    .set(updates)
    .where(
      and(
        eq(growthPlansTable.id, id),
        eq(growthPlansTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(plan);
});

router.get("/growth/milestones", requireAuth, async (req, res) => {
  const planIdParam = req.query.planId as string | undefined;

  if (!planIdParam) {
    const plans = await db.query.growthPlansTable.findMany({
      where: eq(growthPlansTable.userId, req.dbUserId!),
    });
    const planIds = plans.map((p) => p.id);
    if (planIds.length === 0) {
      res.json([]);
      return;
    }
    const milestones = await db.query.milestonesTable.findMany({
      where: inArray(milestonesTable.planId, planIds),
      orderBy: (t, { asc }) => [asc(t.targetDate)],
    });
    res.json(milestones);
    return;
  }

  const planId = parseInt(planIdParam, 10);
  const owned = await verifyPlanOwnership(planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const milestones = await db.query.milestonesTable.findMany({
    where: eq(milestonesTable.planId, planId),
    orderBy: (t, { asc }) => [asc(t.targetDate)],
  });
  res.json(milestones);
});

router.post("/growth/milestones", requireAuth, validateBody(CreateMilestoneBody), async (req, res) => {
  const { planId, title, description, targetDate, horizon } = req.body as {
    planId: number;
    title: string;
    description?: string;
    targetDate?: string;
    horizon?: string;
  };
  const owned = await verifyPlanOwnership(planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [milestone] = await db
    .insert(milestonesTable)
    .values({ planId, title, description, targetDate, horizon })
    .returning();
  res.status(201).json(milestone);
});

router.put("/growth/milestones/:id", requireAuth, validateBody(UpdateMilestoneBody), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.milestonesTable.findFirst({
    where: eq(milestonesTable.id, id),
  });
  if (!existing) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }
  const owned = await verifyPlanOwnership(existing.planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const updates: Partial<typeof milestonesTable.$inferInsert> = {};
  const fields = ["title", "description", "targetDate", "status", "horizon"] as const;
  for (const f of fields) {
    if ((req.body as Record<string, unknown>)[f] !== undefined) {
      (updates as Record<string, unknown>)[f] = (req.body as Record<string, unknown>)[f];
    }
  }
  const [milestone] = await db
    .update(milestonesTable)
    .set(updates)
    .where(eq(milestonesTable.id, id))
    .returning();
  if (!milestone) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }
  res.json(milestone);
});

router.delete("/growth/milestones/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.milestonesTable.findFirst({
    where: eq(milestonesTable.id, id),
  });
  if (!existing) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }
  const owned = await verifyPlanOwnership(existing.planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(milestonesTable).where(eq(milestonesTable.id, id));
  res.status(204).send();
});

router.get("/growth/actions", requireAuth, async (req, res) => {
  const planIdParam = req.query.planId as string | undefined;

  if (!planIdParam) {
    const plans = await db.query.growthPlansTable.findMany({
      where: eq(growthPlansTable.userId, req.dbUserId!),
    });
    const planIds = plans.map((p) => p.id);
    if (planIds.length === 0) {
      res.json([]);
      return;
    }
    const actions = await db.query.taskActionsTable.findMany({
      where: inArray(taskActionsTable.planId, planIds),
      orderBy: (t, { asc }) => [asc(t.weekOf)],
    });
    res.json(actions);
    return;
  }

  const planId = parseInt(planIdParam, 10);
  const owned = await verifyPlanOwnership(planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const actions = await db.query.taskActionsTable.findMany({
    where: eq(taskActionsTable.planId, planId),
    orderBy: (t, { asc }) => [asc(t.weekOf)],
  });
  res.json(actions);
});

router.post("/growth/actions", requireAuth, validateBody(CreateTaskActionBody), async (req, res) => {
  const { planId, title, description, weekOf, milestoneId } = req.body as {
    planId: number;
    title: string;
    description?: string;
    weekOf?: string;
    milestoneId?: number;
  };
  const owned = await verifyPlanOwnership(planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [action] = await db
    .insert(taskActionsTable)
    .values({ planId, title, description, weekOf, milestoneId: milestoneId ?? null })
    .returning();
  res.status(201).json(action);
});

router.put("/growth/actions/:id", requireAuth, validateBody(UpdateTaskActionBody), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.taskActionsTable.findFirst({
    where: eq(taskActionsTable.id, id),
  });
  if (!existing) {
    res.status(404).json({ error: "Action not found" });
    return;
  }
  const owned = await verifyPlanOwnership(existing.planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const updates: Partial<typeof taskActionsTable.$inferInsert> = {};
  const fields = ["title", "description", "weekOf", "status"] as const;
  for (const f of fields) {
    if ((req.body as Record<string, unknown>)[f] !== undefined) {
      (updates as Record<string, unknown>)[f] = (req.body as Record<string, unknown>)[f];
    }
  }
  if (updates.status === "completed" && existing.status !== "completed") {
    updates.completedAt = new Date();
  } else if (updates.status !== undefined && updates.status !== "completed") {
    updates.completedAt = null;
  }
  const [action] = await db
    .update(taskActionsTable)
    .set(updates)
    .where(eq(taskActionsTable.id, id))
    .returning();
  if (!action) {
    res.status(404).json({ error: "Action not found" });
    return;
  }
  res.json(action);
});

router.delete("/growth/actions/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.taskActionsTable.findFirst({
    where: eq(taskActionsTable.id, id),
  });
  if (!existing) {
    res.status(404).json({ error: "Action not found" });
    return;
  }
  const owned = await verifyPlanOwnership(existing.planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(taskActionsTable).where(eq(taskActionsTable.id, id));
  res.status(204).send();
});

router.get("/growth/habits", requireAuth, async (req, res) => {
  const plans = await db.query.growthPlansTable.findMany({
    where: eq(growthPlansTable.userId, req.dbUserId!),
  });
  const planIds = plans.map((p) => p.id);
  if (planIds.length === 0) {
    res.json([]);
    return;
  }
  const habits = await db.query.habitsTable.findMany({
    where: inArray(habitsTable.planId, planIds),
  });
  res.json(habits);
});

router.post("/growth/habits", requireAuth, validateBody(CreateHabitBody), async (req, res) => {
  const { planId, title, description, frequency } = req.body as {
    planId: number;
    title: string;
    description?: string;
    frequency?: string;
  };
  const owned = await verifyPlanOwnership(planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [habit] = await db
    .insert(habitsTable)
    .values({ planId, title, description, frequency })
    .returning();
  res.status(201).json(habit);
});

router.put("/growth/habits/:id", requireAuth, validateBody(UpdateHabitBody), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.habitsTable.findFirst({
    where: eq(habitsTable.id, id),
  });
  if (!existing) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  const owned = await verifyPlanOwnership(existing.planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const updates: Partial<typeof habitsTable.$inferInsert> = {};
  const fields = ["title", "description", "frequency", "isActive"] as const;
  for (const f of fields) {
    if ((req.body as Record<string, unknown>)[f] !== undefined) {
      (updates as Record<string, unknown>)[f] = (req.body as Record<string, unknown>)[f];
    }
  }
  const [habit] = await db
    .update(habitsTable)
    .set(updates)
    .where(eq(habitsTable.id, id))
    .returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  res.json(habit);
});

router.delete("/growth/habits/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.habitsTable.findFirst({
    where: eq(habitsTable.id, id),
  });
  if (!existing) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  const owned = await verifyPlanOwnership(existing.planId, req.dbUserId!);
  if (!owned) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(habitsTable).where(eq(habitsTable.id, id));
  res.status(204).send();
});

router.get("/growth/plans/:id/summary", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const periodDays = parseInt((req.query.days as string) ?? "30", 10) || 30;

  const plan = await db.query.growthPlansTable.findFirst({
    where: and(
      eq(growthPlansTable.id, id),
      eq(growthPlansTable.userId, req.dbUserId!)
    ),
  });

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [actions, milestones, checkins] = await Promise.all([
    db.query.taskActionsTable.findMany({
      where: eq(taskActionsTable.planId, id),
    }),
    db.query.milestonesTable.findMany({
      where: eq(milestonesTable.planId, id),
    }),
    db.query.checkInsTable.findMany({
      where: and(
        eq(checkInsTable.userId, req.dbUserId!),
        eq(checkInsTable.planId, id),
        gte(checkInsTable.createdAt, since)
      ),
    }),
  ]);

  const completedActions = actions.filter((a) => a.status === "completed").length;
  const completedMilestones = milestones.filter((m) => m.status === "completed").length;
  const recentReflections = checkins
    .flatMap((c) => [c.actualActions, c.nextSteps])
    .filter((r): r is string => typeof r === "string" && r.length > 0)
    .slice(0, 5);

  const { summary, isAiGenerated } = await generatePeriodSummary(req.dbUserId ?? null, {
    planTitle: plan.title,
    completedActions,
    totalActions: actions.length,
    completedMilestones,
    totalMilestones: milestones.length,
    checkinsCount: checkins.length,
    recentReflections,
    periodDays,
  });

  res.json({ ...summary, isAiGenerated, planId: id, periodDays });
});

export default router;
