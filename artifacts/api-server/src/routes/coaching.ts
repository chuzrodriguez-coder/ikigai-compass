import { Router } from "express";
import { db } from "@workspace/db";
import {
  coachingSessionsTable,
  coachingMessagesTable,
  conversations,
  messages,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getParamId } from "../lib/param";
import { CreateCoachingSessionBody } from "@workspace/api-zod";
import { streamCoachResponse } from "../lib/ai/coach";
import { z } from "zod";

const router = Router();

const UpdateCoachingSessionBody = z.object({
  status: z.enum(["active", "completed", "archived"]).optional(),
});

const SendCoachingMessageBody = z.object({
  content: z.string().min(1),
});

router.get("/coaching/sessions", requireAuth, async (req, res) => {
  const sessions = await db.query.coachingSessionsTable.findMany({
    where: eq(coachingSessionsTable.userId, req.dbUserId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(sessions);
});

router.post("/coaching/sessions", requireAuth, validateBody(CreateCoachingSessionBody), async (req, res) => {
  const { type, title } = req.body as { type?: string; title?: string };
  const sessionTitle = title ?? "Coaching Session";

  const [conv] = await db
    .insert(conversations)
    .values({ userId: req.dbUserId!, title: sessionTitle })
    .returning();

  const [session] = await db
    .insert(coachingSessionsTable)
    .values({
      userId: req.dbUserId!,
      type: type ?? "general",
      title: sessionTitle,
      openaiConversationId: conv.id,
    })
    .returning();

  res.status(201).json({ ...session, conversationId: conv.id });
});

router.get("/coaching/sessions/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const session = await db.query.coachingSessionsTable.findFirst({
    where: and(
      eq(coachingSessionsTable.id, id),
      eq(coachingSessionsTable.userId, req.dbUserId!)
    ),
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const sessionMessages = await db.query.coachingMessagesTable.findMany({
    where: eq(coachingMessagesTable.sessionId, id),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  res.json({ ...session, messages: sessionMessages });
});

router.post(
  "/coaching/sessions/:id/messages",
  requireAuth,
  validateBody(SendCoachingMessageBody),
  async (req, res) => {
    const id = getParamId(req);
    const { content } = req.body as { content: string };

    const session = await db.query.coachingSessionsTable.findFirst({
      where: and(
        eq(coachingSessionsTable.id, id),
        eq(coachingSessionsTable.userId, req.dbUserId!)
      ),
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await db.insert(coachingMessagesTable).values({
      sessionId: id,
      role: "user",
      content,
    });

    if (session.openaiConversationId) {
      await db.insert(messages).values({
        conversationId: session.openaiConversationId,
        role: "user",
        content,
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const history = await db.query.coachingMessagesTable.findMany({
      where: eq(coachingMessagesTable.sessionId, id),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    await streamCoachResponse(chatMessages, req.dbUserId ?? null, {
      onChunk: (delta) => {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      },
      onDone: async (fullContent) => {
        await db.insert(coachingMessagesTable).values({
          sessionId: id,
          role: "assistant",
          content: fullContent,
        });

        if (session.openaiConversationId) {
          await db.insert(messages).values({
            conversationId: session.openaiConversationId,
            role: "assistant",
            content: fullContent,
          });
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      },
      onError: async (errMsg) => {
        const fallback = "I'm having trouble connecting right now. Please try again.";
        await db.insert(coachingMessagesTable).values({
          sessionId: id,
          role: "assistant",
          content: fallback,
        });
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      },
    });
  }
);

router.put("/coaching/sessions/:id", requireAuth, validateBody(UpdateCoachingSessionBody), async (req, res) => {
  const id = getParamId(req);
  const { status } = req.body;
  const [session] = await db
    .update(coachingSessionsTable)
    .set({ status: status ?? "archived", updatedAt: new Date() })
    .where(
      and(
        eq(coachingSessionsTable.id, id),
        eq(coachingSessionsTable.userId, req.dbUserId!)
      )
    )
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

export default router;
