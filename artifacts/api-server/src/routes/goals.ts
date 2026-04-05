import { Router } from "express";
import { db } from "@workspace/db";
import { goalsTable, opportunityPathsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getParamId } from "../lib/param";
import { z } from "zod";

const CreateGoalBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  timeframe: z.string().optional(),
  targetDate: z.string().optional(),
  planId: z.number().int().positive().optional(),
  hypothesisId: z.number().int().positive().optional(),
});

const UpdateGoalBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  timeframe: z.string().optional(),
  targetDate: z.string().optional(),
  status: z.enum(["active", "completed", "paused", "cancelled"]).optional(),
});

const CreateOpportunityPathBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  domain: z.string().optional(),
  potentialImpact: z.string().optional(),
  effortEstimate: z.string().optional(),
  hypothesisId: z.number().int().positive().optional(),
});

const UpdateOpportunityPathBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  potentialImpact: z.string().optional(),
  effortEstimate: z.string().optional(),
  status: z.enum(["exploring", "pursuing", "paused", "abandoned"]).optional(),
});

const router = Router();

router.get("/goals", requireAuth, async (req, res) => {
  const goals = await db.query.goalsTable.findMany({
    where: eq(goalsTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(goals);
});

router.post("/goals", requireAuth, validateBody(CreateGoalBody), async (req, res) => {
  const { title, description, category, timeframe, targetDate, planId, hypothesisId } =
    req.body as {
      title: string;
      description?: string;
      category?: string;
      timeframe?: string;
      targetDate?: string;
      planId?: number;
      hypothesisId?: number;
    };
  const [goal] = await db
    .insert(goalsTable)
    .values({
      userId: req.dbUserId!,
      title,
      description,
      category: category ?? "personal",
      timeframe: timeframe ?? "quarterly",
      targetDate: targetDate ?? null,
      planId: planId ?? null,
      hypothesisId: hypothesisId ?? null,
    })
    .returning();
  res.status(201).json(goal);
});

router.get("/goals/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const goal = await db.query.goalsTable.findFirst({
    where: and(eq(goalsTable.id, id), eq(goalsTable.userId, req.dbUserId!)),
  });
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(goal);
});

router.put("/goals/:id", requireAuth, validateBody(UpdateGoalBody), async (req, res) => {
  const id = getParamId(req);
  const body = req.body as {
    title?: string;
    description?: string;
    category?: string;
    timeframe?: string;
    targetDate?: string;
    status?: string;
  };
  const updates: Partial<typeof goalsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.timeframe !== undefined) updates.timeframe = body.timeframe;
  if (body.targetDate !== undefined) updates.targetDate = body.targetDate;
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "completed") updates.completedAt = new Date();
  }
  const [goal] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.dbUserId!)))
    .returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(goal);
});

router.delete("/goals/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.goalsTable.findFirst({
    where: and(eq(goalsTable.id, id), eq(goalsTable.userId, req.dbUserId!)),
  });
  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  await db.delete(goalsTable).where(eq(goalsTable.id, id));
  res.status(204).send();
});

router.get("/opportunity-paths", requireAuth, async (req, res) => {
  const paths = await db.query.opportunityPathsTable.findMany({
    where: eq(opportunityPathsTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(paths);
});

router.post("/opportunity-paths", requireAuth, validateBody(CreateOpportunityPathBody), async (req, res) => {
  const { title, description, domain, potentialImpact, effortEstimate, hypothesisId } =
    req.body as {
      title: string;
      description?: string;
      domain?: string;
      potentialImpact?: string;
      effortEstimate?: string;
      hypothesisId?: number;
    };
  const [path] = await db
    .insert(opportunityPathsTable)
    .values({
      userId: req.dbUserId!,
      title,
      description,
      domain,
      potentialImpact,
      effortEstimate,
      hypothesisId: hypothesisId ?? null,
    })
    .returning();
  res.status(201).json(path);
});

router.get("/opportunity-paths/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const path = await db.query.opportunityPathsTable.findFirst({
    where: and(
      eq(opportunityPathsTable.id, id),
      eq(opportunityPathsTable.userId, req.dbUserId!)
    ),
  });
  if (!path) {
    res.status(404).json({ error: "Opportunity path not found" });
    return;
  }
  res.json(path);
});

router.put("/opportunity-paths/:id", requireAuth, validateBody(UpdateOpportunityPathBody), async (req, res) => {
  const id = getParamId(req);
  const body = req.body as {
    title?: string;
    description?: string;
    domain?: string;
    potentialImpact?: string;
    effortEstimate?: string;
    status?: string;
  };
  const updates: Partial<typeof opportunityPathsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.domain !== undefined) updates.domain = body.domain;
  if (body.potentialImpact !== undefined) updates.potentialImpact = body.potentialImpact;
  if (body.effortEstimate !== undefined) updates.effortEstimate = body.effortEstimate;
  if (body.status !== undefined) updates.status = body.status;
  const [path] = await db
    .update(opportunityPathsTable)
    .set(updates)
    .where(
      and(
        eq(opportunityPathsTable.id, id),
        eq(opportunityPathsTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!path) {
    res.status(404).json({ error: "Opportunity path not found" });
    return;
  }
  res.json(path);
});

router.delete("/opportunity-paths/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.opportunityPathsTable.findFirst({
    where: and(
      eq(opportunityPathsTable.id, id),
      eq(opportunityPathsTable.userId, req.dbUserId!)
    ),
  });
  if (!existing) {
    res.status(404).json({ error: "Opportunity path not found" });
    return;
  }
  await db.delete(opportunityPathsTable).where(eq(opportunityPathsTable.id, id));
  res.status(204).send();
});

export default router;
