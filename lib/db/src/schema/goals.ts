import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { growthPlansTable } from "./growth";
import { ikigaiHypothesesTable } from "./hypotheses";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => growthPlansTable.id, {
    onDelete: "set null",
  }),
  hypothesisId: integer("hypothesis_id").references(
    () => ikigaiHypothesesTable.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("personal").notNull(),
  timeframe: text("timeframe").default("quarterly").notNull(),
  targetDate: date("target_date"),
  status: text("status").default("active").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;

export const opportunityPathsTable = pgTable("opportunity_paths", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  hypothesisId: integer("hypothesis_id").references(
    () => ikigaiHypothesesTable.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  description: text("description"),
  domain: text("domain"),
  potentialImpact: text("potential_impact"),
  effortEstimate: text("effort_estimate"),
  status: text("status").default("exploring").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOpportunityPathSchema = createInsertSchema(
  opportunityPathsTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpportunityPath = z.infer<typeof insertOpportunityPathSchema>;
export type OpportunityPath = typeof opportunityPathsTable.$inferSelect;
