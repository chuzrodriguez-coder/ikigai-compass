import {
  pgTable,
  serial,
  integer,
  text,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { growthPlansTable } from "./growth";

export const checkInsTable = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => growthPlansTable.id, {
    onDelete: "set null",
  }),
  period: text("period").notNull(),
  plannedActions: text("planned_actions"),
  actualActions: text("actual_actions"),
  blockers: text("blockers"),
  energyLevel: integer("energy_level"),
  satisfactionLevel: integer("satisfaction_level"),
  nextSteps: text("next_steps"),
  aiSuggestions: text("ai_suggestions"),
  momentumScore: real("momentum_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCheckInSchema = createInsertSchema(checkInsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkInsTable.$inferSelect;

export const progressSnapshotsTable = pgTable("progress_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => growthPlansTable.id, {
    onDelete: "set null",
  }),
  week: text("week").notNull(),
  momentumScore: real("momentum_score").default(0).notNull(),
  actionsCompleted: integer("actions_completed").default(0).notNull(),
  actionsTotal: integer("actions_total").default(0).notNull(),
  energyAvg: real("energy_avg"),
  satisfactionAvg: real("satisfaction_avg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProgressSnapshotSchema = createInsertSchema(
  progressSnapshotsTable
).omit({ id: true, createdAt: true });
export type InsertProgressSnapshot = z.infer<
  typeof insertProgressSnapshotSchema
>;
export type ProgressSnapshot = typeof progressSnapshotsTable.$inferSelect;
