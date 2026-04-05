import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const discoverySessionsTable = pgTable("discovery_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").default("in_progress").notNull(),
  currentStep: integer("current_step").default(1).notNull(),
  totalSteps: integer("total_steps").default(10).notNull(),
  answers: jsonb("answers").default({}).notNull(),
  themes: jsonb("themes").default([]).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDiscoverySessionSchema = createInsertSchema(
  discoverySessionsTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiscoverySession = z.infer<
  typeof insertDiscoverySessionSchema
>;
export type DiscoverySession = typeof discoverySessionsTable.$inferSelect;

export const reflectionEntriesTable = pgTable("reflection_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => discoverySessionsTable.id, {
    onDelete: "set null",
  }),
  prompt: text("prompt").notNull(),
  content: text("content").notNull(),
  aiSummary: text("ai_summary"),
  themes: jsonb("themes").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReflectionEntrySchema = createInsertSchema(
  reflectionEntriesTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReflectionEntry = z.infer<typeof insertReflectionEntrySchema>;
export type ReflectionEntry = typeof reflectionEntriesTable.$inferSelect;
