import { Router } from "express";
import { db } from "@workspace/db";
import {
  reminderSchedulesTable,
  consentRecordsTable,
  auditEventsTable,
  checkInsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { validateBody } from "../middlewares/validate";
import { getParamId } from "../lib/param";
import { computeNextTrigger, detectStagnation } from "../lib/momentum";
import { z } from "zod";

const CreateReminderBody = z.object({
  type: z.enum(["check_in", "milestone", "habit", "coaching"]).optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  hourOfDay: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
  planId: z.number().int().positive().optional(),
});

const UpdateReminderBody = z.object({
  type: z.enum(["check_in", "milestone", "habit", "coaching"]).optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  hourOfDay: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
});

const CreateConsentBody = z.object({
  consentType: z.string().min(1),
  version: z.string().min(1),
  granted: z.boolean(),
  ipAddress: z.string().optional(),
});

const router = Router();

router.get("/reminders", requireAuth, async (req, res) => {
  const reminders = await db.query.reminderSchedulesTable.findMany({
    where: eq(reminderSchedulesTable.userId, req.dbUserId!),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  res.json(reminders);
});

router.post("/reminders", requireAuth, validateBody(CreateReminderBody), async (req, res) => {
  const { type, frequency, dayOfWeek, hourOfDay, timezone, planId } = req.body as {
    type?: string;
    frequency?: string;
    dayOfWeek?: number;
    hourOfDay?: number;
    timezone?: string;
    planId?: number;
  };
  const [reminder] = await db
    .insert(reminderSchedulesTable)
    .values({
      userId: req.dbUserId!,
      type: type ?? "check_in",
      frequency: frequency ?? "weekly",
      dayOfWeek: dayOfWeek ?? 1,
      hourOfDay: hourOfDay ?? 9,
      timezone: timezone ?? "UTC",
      planId: planId ?? null,
    })
    .returning();
  res.status(201).json(reminder);
});

router.get("/reminders/due", requireAuth, async (req, res) => {
  const reminders = await db.query.reminderSchedulesTable.findMany({
    where: and(
      eq(reminderSchedulesTable.userId, req.dbUserId!),
      eq(reminderSchedulesTable.isActive, true)
    ),
  });

  const now = new Date();
  const due = reminders
    .map((r) => {
      const trigger = computeNextTrigger(
        {
          type: r.type,
          frequency: r.frequency as "daily" | "weekly" | "monthly",
          dayOfWeek: r.dayOfWeek ?? 1,
          hourOfDay: r.hourOfDay ?? 9,
          timezone: r.timezone ?? "UTC",
        },
        now
      );
      return { ...r, trigger };
    })
    .filter((r) => r.trigger.isDue);

  res.json(due);
});

router.get("/accountability/status", requireAuth, async (req, res) => {
  const reminders = await db.query.reminderSchedulesTable.findMany({
    where: and(
      eq(reminderSchedulesTable.userId, req.dbUserId!),
      eq(reminderSchedulesTable.isActive, true)
    ),
  });

  const [latestCheckIn] = await db
    .select()
    .from(checkInsTable)
    .where(eq(checkInsTable.userId, req.dbUserId!))
    .orderBy(desc(checkInsTable.createdAt))
    .limit(1);

  const primaryReminder = reminders.find((r) => r.type === "check_in") ?? reminders[0];
  const frequency = (primaryReminder?.frequency ?? "weekly") as "daily" | "weekly" | "monthly";

  const stagnation = detectStagnation(latestCheckIn?.createdAt ?? null, frequency, new Date());

  const triggers = reminders.map((r) =>
    computeNextTrigger(
      {
        type: r.type,
        frequency: r.frequency as "daily" | "weekly" | "monthly",
        dayOfWeek: r.dayOfWeek ?? 1,
        hourOfDay: r.hourOfDay ?? 9,
        timezone: r.timezone ?? "UTC",
      },
      new Date()
    )
  );

  const nextDue = triggers.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0] ?? null;

  res.json({
    stagnation,
    nextCheckIn: nextDue,
    activeReminders: reminders.length,
    lastCheckInAt: latestCheckIn?.createdAt ?? null,
  });
});

router.get("/reminders/:id/next-trigger", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const reminder = await db.query.reminderSchedulesTable.findFirst({
    where: and(eq(reminderSchedulesTable.id, id), eq(reminderSchedulesTable.userId, req.dbUserId!)),
  });
  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  const trigger = computeNextTrigger(
    {
      type: reminder.type,
      frequency: reminder.frequency as "daily" | "weekly" | "monthly",
      dayOfWeek: reminder.dayOfWeek ?? 1,
      hourOfDay: reminder.hourOfDay ?? 9,
      timezone: reminder.timezone ?? "UTC",
    },
    new Date()
  );
  res.json({ reminderId: id, ...trigger });
});

router.put("/reminders/:id", requireAuth, validateBody(UpdateReminderBody), async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.reminderSchedulesTable.findFirst({
    where: and(eq(reminderSchedulesTable.id, id), eq(reminderSchedulesTable.userId, req.dbUserId!)),
  });
  if (!existing) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  const body = req.body as {
    type?: string;
    frequency?: string;
    dayOfWeek?: number;
    hourOfDay?: number;
    timezone?: string;
    isActive?: boolean;
  };
  const updates: Partial<typeof reminderSchedulesTable.$inferInsert> = { updatedAt: new Date() };
  if (body.type !== undefined) updates.type = body.type;
  if (body.frequency !== undefined) updates.frequency = body.frequency;
  if (body.dayOfWeek !== undefined) updates.dayOfWeek = body.dayOfWeek;
  if (body.hourOfDay !== undefined) updates.hourOfDay = body.hourOfDay;
  if (body.timezone !== undefined) updates.timezone = body.timezone;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  const [reminder] = await db
    .update(reminderSchedulesTable)
    .set(updates)
    .where(eq(reminderSchedulesTable.id, id))
    .returning();
  res.json(reminder);
});

router.delete("/reminders/:id", requireAuth, async (req, res) => {
  const id = getParamId(req);
  const existing = await db.query.reminderSchedulesTable.findFirst({
    where: and(eq(reminderSchedulesTable.id, id), eq(reminderSchedulesTable.userId, req.dbUserId!)),
  });
  if (!existing) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  await db.delete(reminderSchedulesTable).where(eq(reminderSchedulesTable.id, id));
  res.status(204).send();
});

router.get("/consents", requireAuth, async (req, res) => {
  const records = await db.query.consentRecordsTable.findMany({
    where: eq(consentRecordsTable.userId, req.dbUserId!),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  res.json(records);
});

router.post("/consents", requireAuth, validateBody(CreateConsentBody), async (req, res) => {
  const { consentType, version, granted, ipAddress } = req.body as {
    consentType: string;
    version: string;
    granted: boolean;
    ipAddress?: string;
  };
  const now = new Date();
  const [record] = await db
    .insert(consentRecordsTable)
    .values({
      userId: req.dbUserId!,
      consentType,
      version,
      granted,
      grantedAt: granted ? now : null,
      revokedAt: !granted ? now : null,
      ipAddress: ipAddress ?? null,
    })
    .returning();
  res.status(201).json(record);
});

router.get("/audit-events", requireAuth, async (req, res) => {
  const events = await db
    .select()
    .from(auditEventsTable)
    .where(eq(auditEventsTable.userId, req.dbUserId!))
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(100);
  res.json(events);
});

export default router;
