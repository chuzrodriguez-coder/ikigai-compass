import { Router } from "express";
import { db } from "@workspace/db";
import { insightCardsTable, themesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getParamId } from "../lib/param";
import { z } from "zod";
import { extractThemesFromText } from "../lib/ai/extract-themes";
import { generateInsightCards } from "../lib/ai/generate-insights";
import { isAIAvailable } from "../openaiClient";

const CreateInsightBody = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sessionId: z.number().int().positive().optional(),
  hypothesisId: z.number().int().positive().optional(),
});

const UpdateInsightBody = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isFavorited: z.boolean().optional(),
});

const CreateThemeBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

const UpdateThemeBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  isArchived: z.boolean().optional(),
});

const router = Router();

router.get("/insights", requireAuth, async (req, res) => {
  const insights = await db.query.insightCardsTable.findMany({
    where: eq(insightCardsTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(insights);
});

router.post("/insights", requireAuth, validateBody(CreateInsightBody), async (req, res) => {
  const { title, content, category, tags, sessionId, hypothesisId } = req.body as {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    sessionId?: number;
    hypothesisId?: number;
  };
  const [insight] = await db
    .insert(insightCardsTable)
    .values({
      userId: req.dbUserId!,
      title,
      content,
      category: category ?? "insight",
      tags: tags ?? [],
      sessionId: sessionId ?? null,
      hypothesisId: hypothesisId ?? null,
    })
    .returning();
  res.status(201).json(insight);
});

router.get("/insights/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const insight = await db.query.insightCardsTable.findFirst({
    where: and(eq(insightCardsTable.id, id), eq(insightCardsTable.userId, req.dbUserId!)),
  });
  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }
  res.json(insight);
});

router.put("/insights/:id", requireAuth, validateBody(UpdateInsightBody), async (req, res) => {
  const id = getParamId(req);
  const body = req.body as {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    isFavorited?: boolean;
  };
  const updates: Partial<typeof insightCardsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.category !== undefined) updates.category = body.category;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.isFavorited !== undefined) updates.isFavorited = body.isFavorited;
  const [insight] = await db
    .update(insightCardsTable)
    .set(updates)
    .where(and(eq(insightCardsTable.id, id), eq(insightCardsTable.userId, req.dbUserId!)))
    .returning();
  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }
  res.json(insight);
});

router.delete("/insights/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.insightCardsTable.findFirst({
    where: and(eq(insightCardsTable.id, id), eq(insightCardsTable.userId, req.dbUserId!)),
  });
  if (!existing) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }
  await db.delete(insightCardsTable).where(eq(insightCardsTable.id, id));
  res.status(204).send();
});

router.get("/themes", requireAuth, async (req, res) => {
  const themes = await db.query.themesTable.findMany({
    where: eq(themesTable.userId, req.dbUserId!),
    orderBy: (t, { asc }) => [asc(t.name)],
  });
  res.json(themes);
});

router.post("/themes", requireAuth, validateBody(CreateThemeBody), async (req, res) => {
  const { name, description, color } = req.body as {
    name: string;
    description?: string;
    color?: string;
  };
  const [theme] = await db
    .insert(themesTable)
    .values({
      userId: req.dbUserId!,
      name,
      description,
      color: color ?? "#6366f1",
    })
    .returning();
  res.status(201).json(theme);
});

router.put("/themes/:id", requireAuth, validateBody(UpdateThemeBody), async (req, res) => {
  const id = getParamId(req);
  const body = req.body as {
    name?: string;
    description?: string;
    color?: string;
    isArchived?: boolean;
  };
  const updates: Partial<typeof themesTable.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.color !== undefined) updates.color = body.color;
  if (body.isArchived !== undefined) updates.isArchived = body.isArchived;
  const [theme] = await db
    .update(themesTable)
    .set(updates)
    .where(and(eq(themesTable.id, id), eq(themesTable.userId, req.dbUserId!)))
    .returning();
  if (!theme) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }
  res.json(theme);
});

router.delete("/themes/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.themesTable.findFirst({
    where: and(eq(themesTable.id, id), eq(themesTable.userId, req.dbUserId!)),
  });
  if (!existing) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }
  await db.delete(themesTable).where(eq(themesTable.id, id));
  res.status(204).send();
});

const ExtractThemesBody = z.object({
  text: z.string().min(10),
});

router.post("/ai/extract-themes", requireAuth, validateBody(ExtractThemesBody), async (req, res) => {
  const { text } = req.body as { text: string };
  if (!isAIAvailable()) {
    res.json({
      themes: [{ name: "Your Exploration", description: "Begin your theme discovery.", evidence: [] }],
      aiAvailable: false,
    });
    return;
  }
  const themes = await extractThemesFromText(req.dbUserId!, text);
  res.json({ themes, aiAvailable: true });
});

const GenerateInsightsBody = z.object({
  context: z.string().min(10),
  count: z.number().int().min(1).max(10).optional(),
});

router.post("/ai/generate-insights", requireAuth, validateBody(GenerateInsightsBody), async (req, res) => {
  const { context, count } = req.body as { context: string; count?: number };
  if (!isAIAvailable()) {
    res.json({
      insights: [{ title: "Your Journey", content: "Keep exploring your purpose.", category: "insight", tags: [] }],
      aiAvailable: false,
    });
    return;
  }
  const insights = await generateInsightCards(req.dbUserId!, context, count ?? 3);
  res.json({ insights, aiAvailable: true });
});

export default router;
