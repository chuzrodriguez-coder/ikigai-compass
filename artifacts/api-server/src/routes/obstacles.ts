import { Router } from "express";
import { db } from "@workspace/db";
import { obstaclesTable, growthPlansTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getParamId } from "../lib/param";
import { CreateObstacleBody, UpdateObstacleBody } from "@workspace/api-zod";
import { generateObstacleHelp } from "../lib/ai/obstacle-help";
import { z } from "zod";

const router = Router();

const ObstacleHelpBody = z.object({
  context: z.string().optional(),
});

router.get("/obstacles", requireAuth, async (req, res) => {
  const obstacles = await db.query.obstaclesTable.findMany({
    where: eq(obstaclesTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(obstacles);
});

router.post("/obstacles", requireAuth, validateBody(CreateObstacleBody), async (req, res) => {
  const { planId, title, description, category } = req.body as {
    planId?: number;
    title: string;
    description?: string;
    category?: string;
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

  const [obstacle] = await db
    .insert(obstaclesTable)
    .values({
      userId: req.dbUserId!,
      planId: planId ?? null,
      title,
      description,
      category,
    })
    .returning();
  res.status(201).json(obstacle);
});

router.post("/obstacles/:id/help", requireAuth, validateBody(ObstacleHelpBody), async (req, res) => {
  const id = getParamId(req);
  const { context } = req.body as { context?: string };

  const obstacle = await db.query.obstaclesTable.findFirst({
    where: and(
      eq(obstaclesTable.id, id),
      eq(obstaclesTable.userId, req.dbUserId!)
    ),
  });

  if (!obstacle) {
    res.status(404).json({ error: "Obstacle not found" });
    return;
  }

  const { help, isAiGenerated } = await generateObstacleHelp(
    req.dbUserId ?? null,
    obstacle.title,
    obstacle.description,
    context
  );

  res.json({ ...help, isAiGenerated });
});

router.put("/obstacles/:id", requireAuth, validateBody(UpdateObstacleBody), async (req, res) => {
  const id = getParamId(req);
  const body = req.body as {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
  };
  const updates: Partial<typeof obstaclesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.status !== undefined) {
    updates.status = body.status as typeof obstaclesTable.$inferInsert["status"];
    if (body.status === "resolved") {
      updates.resolvedAt = new Date();
    }
  }
  const [obstacle] = await db
    .update(obstaclesTable)
    .set(updates)
    .where(
      and(
        eq(obstaclesTable.id, id),
        eq(obstaclesTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!obstacle) {
    res.status(404).json({ error: "Obstacle not found" });
    return;
  }
  res.json(obstacle);
});

export default router;
