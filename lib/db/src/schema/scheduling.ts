import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { growthPlansTable } from "./growth";

export const reminderSchedulesTable = pgTable("reminder_schedules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => growthPlansTable.id, {
    onDelete: "set null",
  }),
  type: text("type").default("check_in").notNull(),
  frequency: text("frequency").default("weekly").notNull(),
  dayOfWeek: integer("day_of_week").default(1),
  hourOfDay: integer("hour_of_day").default(9),
  timezone: text("timezone").default("UTC").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReminderScheduleSchema = createInsertSchema(
  reminderSchedulesTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReminderSchedule = z.infer<typeof insertReminderScheduleSchema>;
export type ReminderSchedule = typeof reminderSchedulesTable.$inferSelect;

export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: integer("resource_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit(
  { id: true, createdAt: true }
);
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;

export const consentRecordsTable = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(),
  version: text("version").notNull(),
  granted: boolean("granted").default(false).notNull(),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConsentRecordSchema = createInsertSchema(
  consentRecordsTable
).omit({ id: true, createdAt: true });
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecordsTable.$inferSelect;
