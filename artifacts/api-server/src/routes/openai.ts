import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getOpenAIClient, isAIAvailable } from "../openaiClient";
import { getParamId } from "../lib/param";
import { CreateOpenaiConversationBody, SendOpenaiMessageBody } from "@workspace/api-zod";

const router = Router();

router.get("/openai/conversations", requireAuth, async (req, res) => {
  const convs = await db.query.conversations.findMany({
    where: eq(conversations.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(convs);
});

router.post("/openai/conversations", requireAuth, validateBody(CreateOpenaiConversationBody), async (req, res) => {
  const { title } = req.body as { title: string };
  const [conv] = await db
    .insert(conversations)
    .values({ userId: req.dbUserId!, title })
    .returning();
  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, req.dbUserId!)),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db.query.messages.findMany({
    where: eq(messages.conversationId, id),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, req.dbUserId!)),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).send();
});

router.get("/openai/conversations/:id/messages", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, req.dbUserId!)),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db.query.messages.findMany({
    where: eq(messages.conversationId, id),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", requireAuth, validateBody(SendOpenaiMessageBody), async (req, res) => {
  const id = getParamId(req);
  const { content } = req.body as { content: string };

  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, req.dbUserId!)),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({ conversationId: id, role: "user", content });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!isAIAvailable()) {
    const fallback = "AI coaching is currently unavailable. Please try again later.";
    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fallback });
    res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, id),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const systemMessage = {
    role: "system" as const,
    content: `You are an Ikigai coach - wise, warm, and deeply supportive. You help people explore the meaningful intersection of what they love, what they are good at, what the world needs, and what can sustain them. You ask thoughtful questions, reflect back what you hear, and help people discover their own answers. You are not prescriptive. You are not a productivity tool. You are a guide to purpose and meaning. Keep responses concise (2-4 paragraphs) unless the user asks for more detail.`,
  };

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, ...chatMessages],
      stream: true,
      max_completion_tokens: 1000,
    });

    let assistantContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        assistantContent += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: assistantContent,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

export default router;
