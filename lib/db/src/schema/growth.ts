import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { ikigaiHypothesesTable } from "./hypotheses";

export const growthPlansTable = pgTable("growth_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  hypothesisId: integer("hypothesis_id").references(
    () => ikigaiHypothesesTable.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  longTermDirection: text("long_term_direction").notNull(),
  ninetyDaySummary: text("ninety_day_summary"),
  status: text("status").default("active").notNull(),
  startDate: date("start_date"),
  targetEndDate: date("target_end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGrowthPlanSchema = createInsertSchema(growthPlansTable).omit(
  { id: true, createdAt: true, updatedAt: true }
);
export type InsertGrowthPlan = z.infer<typeof insertGrowthPlanSchema>;
export type GrowthPlan = typeof growthPlansTable.$inferSelect;

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => growthPlansTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: date("target_date"),
  completedAt: timestamp("completed_at"),
  status: text("status").default("pending").notNull(),
  horizon: text("horizon").default("monthly").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestonesTable.$inferSelect;

export const taskActionsTable = pgTable("task_actions", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => growthPlansTable.id, { onDelete: "cascade" }),
  milestoneId: integer("milestone_id").references(() => milestonesTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  weekOf: date("week_of"),
  status: text("status").default("pending").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTaskActionSchema = createInsertSchema(taskActionsTable).omit(
  { id: true, createdAt: true }
);
export type InsertTaskAction = z.infer<typeof insertTaskActionSchema>;
export type TaskAction = typeof taskActionsTable.$inferSelect;

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => growthPlansTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  frequency: text("frequency").default("daily").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHabitSchema = createInsertSchema(habitsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
