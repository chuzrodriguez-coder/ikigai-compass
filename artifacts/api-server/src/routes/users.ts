import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  userPreferencesTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { UpdateMeBody, UpdateUserPreferencesBody } from "@workspace/api-zod";

const router = Router();

router.get("/users/me", requireAuth, async (req, res) => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.dbUserId!),
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.put("/users/me", requireAuth, validateBody(UpdateMeBody), async (req, res) => {
  const { displayName, timezone, onboardingCompleted } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (timezone !== undefined) updates.timezone = timezone;
  if (onboardingCompleted !== undefined)
    updates.onboardingCompleted = onboardingCompleted;
  updates.updatedAt = new Date();

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.dbUserId!))
    .returning();
  res.json(user);
});

router.get("/users/me/preferences", requireAuth, async (req, res) => {
  let prefs = await db.query.userPreferencesTable.findFirst({
    where: eq(userPreferencesTable.userId, req.dbUserId!),
  });
  if (!prefs) {
    const [newPrefs] = await db
      .insert(userPreferencesTable)
      .values({ userId: req.dbUserId! })
      .returning();
    prefs = newPrefs;
  }
  res.json(prefs);
});

router.put("/users/me/preferences", requireAuth, validateBody(UpdateUserPreferencesBody), async (req, res) => {
  const {
    coachingTone,
    checkInFrequency,
    checkInDayOfWeek,
    notificationsEnabled,
    aiEnabled,
    discoveryMode,
  } = req.body;

  const updates: Partial<typeof userPreferencesTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (coachingTone !== undefined) updates.coachingTone = coachingTone;
  if (checkInFrequency !== undefined) updates.checkInFrequency = checkInFrequency;
  if (checkInDayOfWeek !== undefined) updates.checkInDayOfWeek = checkInDayOfWeek;
  if (notificationsEnabled !== undefined)
    updates.notificationsEnabled = notificationsEnabled;
  if (aiEnabled !== undefined) updates.aiEnabled = aiEnabled;
  if (discoveryMode !== undefined) updates.discoveryMode = discoveryMode;

  let prefs = await db.query.userPreferencesTable.findFirst({
    where: eq(userPreferencesTable.userId, req.dbUserId!),
  });

  if (!prefs) {
    const [newPrefs] = await db
      .insert(userPreferencesTable)
      .values({ userId: req.dbUserId!, ...updates })
      .returning();
    res.json(newPrefs);
    return;
  }

  const [updated] = await db
    .update(userPreferencesTable)
    .set(updates)
    .where(eq(userPreferencesTable.userId, req.dbUserId!))
    .returning();
  res.json(updated);
});

export default router;
