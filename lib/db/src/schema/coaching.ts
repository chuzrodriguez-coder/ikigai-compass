import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const coachingSessionsTable = pgTable("coaching_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").default("general").notNull(),
  title: text("title").notNull(),
  status: text("status").default("active").notNull(),
  openaiConversationId: integer("openai_conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCoachingSessionSchema = createInsertSchema(
  coachingSessionsTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCoachingSession = z.infer<typeof insertCoachingSessionSchema>;
export type CoachingSession = typeof coachingSessionsTable.$inferSelect;

export const coachingMessagesTable = pgTable("coaching_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => coachingSessionsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCoachingMessageSchema = createInsertSchema(
  coachingMessagesTable
).omit({ id: true, createdAt: true });
export type InsertCoachingMessage = z.infer<typeof insertCoachingMessageSchema>;
export type CoachingMessage = typeof coachingMessagesTable.$inferSelect;

export const obstaclesTable = pgTable("obstacles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("other").notNull(),
  status: text("status").default("active").notNull(),
  aiSuggestions: text("ai_suggestions"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertObstacleSchema = createInsertSchema(obstaclesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertObstacle = z.infer<typeof insertObstacleSchema>;
export type Obstacle = typeof obstaclesTable.$inferSelect;
