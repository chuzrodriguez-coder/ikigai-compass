import { Router } from "express";
import { db } from "@workspace/db";
import {
  ikigaiHypothesesTable,
  discoverySessionsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getParamId } from "../lib/param";
import { synthesizeHypotheses, synthesizeFallbackHypotheses } from "../lib/ai/synthesize";
import { isAIAvailable } from "../openaiClient";
import { validateBody } from "../middlewares/validate";
import { CreateHypothesisBody, UpdateHypothesisBody, SynthesizeHypothesesBody } from "@workspace/api-zod";

const router = Router();

router.get("/hypotheses", requireAuth, async (req, res) => {
  const hypotheses = await db.query.ikigaiHypothesesTable.findMany({
    where: eq(ikigaiHypothesesTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(hypotheses);
});

router.post("/hypotheses", requireAuth, validateBody(CreateHypothesisBody), async (req, res) => {
  const {
    sessionId,
    title,
    summary,
    detailedExplanation,
    uncertaintyLevel,
    resonanceScore,
    themes,
  } = req.body;
  const [hyp] = await db
    .insert(ikigaiHypothesesTable)
    .values({
      userId: req.dbUserId!,
      sessionId: sessionId ?? null,
      title,
      summary,
      detailedExplanation,
      uncertaintyLevel: uncertaintyLevel ?? "medium",
      resonanceScore,
      themes: themes ?? [],
      supportingEvidence: [],
      suggestedExperiments: [],
      alternativeInterpretations: [],
      isAiGenerated: false,
    })
    .returning();
  res.status(201).json(hyp);
});

router.get("/hypotheses/compare", requireAuth, async (req, res) => {
  const ids = req.query.ids;
  if (!ids) {
    res.status(400).json({ error: "ids query parameter required (comma-separated)" });
    return;
  }
  const idList = String(ids)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  if (idList.length < 2) {
    res.status(400).json({ error: "At least 2 hypothesis IDs required to compare" });
    return;
  }
  const filtered = await db.query.ikigaiHypothesesTable.findMany({
    where: and(
      eq(ikigaiHypothesesTable.userId, req.dbUserId!),
      inArray(ikigaiHypothesesTable.id, idList)
    ),
  });
  if (filtered.length !== idList.length) {
    res.status(404).json({ error: "One or more hypotheses not found" });
    return;
  }
  const comparison = filtered.map((h) => ({
    id: h.id,
    version: h.version,
    title: h.title,
    summary: h.summary,
    uncertaintyLevel: h.uncertaintyLevel,
    resonanceScore: h.resonanceScore,
    status: h.status,
    isAiGenerated: h.isAiGenerated,
    themes: h.themes,
    createdAt: h.createdAt,
  }));
  res.json({ count: comparison.length, hypotheses: comparison });
});

router.post("/hypotheses/synthesize", requireAuth, validateBody(SynthesizeHypothesesBody), async (req, res) => {
  const { sessionId } = req.body;
  const session = await db.query.discoverySessionsTable.findFirst({
    where: and(
      eq(discoverySessionsTable.id, sessionId),
      eq(discoverySessionsTable.userId, req.dbUserId!)
    ),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const answers = session.answers as Record<string, unknown>;

  if (!isAIAvailable()) {
    const fallbacks = await synthesizeFallbackHypotheses(req.dbUserId!, sessionId, answers);
    res.json({ hypotheses: fallbacks, aiAvailable: false });
    return;
  }

  try {
    const hypotheses = await synthesizeHypotheses(req.dbUserId!, sessionId, answers);
    res.json({ hypotheses, aiAvailable: true });
  } catch {
    const fallbacks = await synthesizeFallbackHypotheses(req.dbUserId!, sessionId, answers);
    res.json({ hypotheses: fallbacks, aiAvailable: false, error: "AI synthesis encountered an error; showing estimated hypotheses." });
  }
});

router.get("/hypotheses/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const hyp = await db.query.ikigaiHypothesesTable.findFirst({
    where: and(
      eq(ikigaiHypothesesTable.id, id),
      eq(ikigaiHypothesesTable.userId, req.dbUserId!)
    ),
  });
  if (!hyp) {
    res.status(404).json({ error: "Hypothesis not found" });
    return;
  }
  res.json(hyp);
});

router.put("/hypotheses/:id", requireAuth, validateBody(UpdateHypothesisBody), async (req, res) => {
  const id = getParamId(req);
  const updates: Partial<typeof ikigaiHypothesesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  const fields = [
    "title",
    "summary",
    "detailedExplanation",
    "uncertaintyLevel",
    "resonanceScore",
    "themes",
    "status",
  ] as const;
  for (const f of fields) {
    if (req.body[f] !== undefined) (updates as Record<string, unknown>)[f] = req.body[f];
  }

  const [hyp] = await db
    .update(ikigaiHypothesesTable)
    .set(updates)
    .where(
      and(
        eq(ikigaiHypothesesTable.id, id),
        eq(ikigaiHypothesesTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!hyp) {
    res.status(404).json({ error: "Hypothesis not found" });
    return;
  }
  res.json(hyp);
});

router.delete("/hypotheses/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  await db
    .delete(ikigaiHypothesesTable)
    .where(
      and(
        eq(ikigaiHypothesesTable.id, id),
        eq(ikigaiHypothesesTable.userId, req.dbUserId!)
      )
    );
  res.status(204).send();
});

router.post("/hypotheses/:id/accept", requireAuth, async (req, res) => {
  const id = getParamId(req);
  await db
    .update(ikigaiHypothesesTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(ikigaiHypothesesTable.userId, req.dbUserId!));

  const [hyp] = await db
    .update(ikigaiHypothesesTable)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(ikigaiHypothesesTable.id, id),
        eq(ikigaiHypothesesTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!hyp) {
    res.status(404).json({ error: "Hypothesis not found" });
    return;
  }
  res.json(hyp);
});

export default router;
