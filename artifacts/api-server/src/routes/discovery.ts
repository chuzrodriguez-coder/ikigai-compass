import { Router } from "express";
import { db } from "@workspace/db";
import {
  discoverySessionsTable,
  reflectionEntriesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getParamId } from "../lib/param";
import { validateBody } from "../middlewares/validate";
import {
  CreateDiscoverySessionBody,
  UpdateDiscoverySessionBody,
  CreateReflectionBody,
  UpdateReflectionBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/discovery/sessions", requireAuth, async (req, res) => {
  const sessions = await db.query.discoverySessionsTable.findMany({
    where: eq(discoverySessionsTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(sessions);
});

router.post("/discovery/sessions", requireAuth, validateBody(CreateDiscoverySessionBody), async (req, res) => {
  const { mode } = req.body as { mode?: string };
  const totalSteps = mode === "quick" ? 5 : 10;

  const existing = await db.query.discoverySessionsTable.findFirst({
    where: and(
      eq(discoverySessionsTable.userId, req.dbUserId!),
      eq(discoverySessionsTable.status, "in_progress")
    ),
  });

  if (existing) {
    res.status(201).json(existing);
    return;
  }

  const [session] = await db
    .insert(discoverySessionsTable)
    .values({
      userId: req.dbUserId!,
      totalSteps,
      answers: {},
      themes: [],
    })
    .returning();
  res.status(201).json(session);
});

router.get("/discovery/sessions/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const session = await db.query.discoverySessionsTable.findFirst({
    where: and(
      eq(discoverySessionsTable.id, id),
      eq(discoverySessionsTable.userId, req.dbUserId!)
    ),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ ...session, answers: session.answers ?? {}, themes: session.themes ?? [] });
});

router.put("/discovery/sessions/:id", requireAuth, validateBody(UpdateDiscoverySessionBody), async (req, res) => {
  const id = getParamId(req);
  const { currentStep, answers } = req.body as { currentStep?: number; answers?: unknown };
  const updates: Partial<typeof discoverySessionsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (currentStep !== undefined) updates.currentStep = currentStep;
  if (answers !== undefined) updates.answers = answers as Record<string, unknown>;

  const [session] = await db
    .update(discoverySessionsTable)
    .set(updates)
    .where(
      and(
        eq(discoverySessionsTable.id, id),
        eq(discoverySessionsTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.post("/discovery/sessions/:id/complete", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const [session] = await db
    .update(discoverySessionsTable)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(discoverySessionsTable.id, id),
        eq(discoverySessionsTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.get("/discovery/reflections", requireAuth, async (req, res) => {
  const reflections = await db.query.reflectionEntriesTable.findMany({
    where: eq(reflectionEntriesTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(reflections);
});

router.post("/discovery/reflections", requireAuth, validateBody(CreateReflectionBody), async (req, res) => {
  const { sessionId, prompt, content } = req.body as {
    sessionId?: number;
    prompt: string;
    content: string;
  };
  const [entry] = await db
    .insert(reflectionEntriesTable)
    .values({
      userId: req.dbUserId!,
      sessionId: sessionId ?? null,
      prompt,
      content,
      themes: [],
    })
    .returning();
  res.status(201).json(entry);
});

router.get("/discovery/reflections/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const entry = await db.query.reflectionEntriesTable.findFirst({
    where: and(
      eq(reflectionEntriesTable.id, id),
      eq(reflectionEntriesTable.userId, req.dbUserId!)
    ),
  });
  if (!entry) {
    res.status(404).json({ error: "Reflection not found" });
    return;
  }
  res.json(entry);
});

router.put("/discovery/reflections/:id", requireAuth, validateBody(UpdateReflectionBody), async (req, res) => {
  const id = getParamId(req);
  const { content } = req.body as { content: string };
  const [entry] = await db
    .update(reflectionEntriesTable)
    .set({ content, updatedAt: new Date() })
    .where(
      and(
        eq(reflectionEntriesTable.id, id),
        eq(reflectionEntriesTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!entry) {
    res.status(404).json({ error: "Reflection not found" });
    return;
  }
  res.json(entry);
});

export default router;
