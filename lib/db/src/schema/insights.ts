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
import { ikigaiHypothesesTable } from "./hypotheses";
import { discoverySessionsTable } from "./discovery";

export const themesTable = pgTable("themes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertThemeSchema = createInsertSchema(themesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type Theme = typeof themesTable.$inferSelect;

export const insightCardsTable = pgTable("insight_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => discoverySessionsTable.id, {
    onDelete: "set null",
  }),
  hypothesisId: integer("hypothesis_id").references(
    () => ikigaiHypothesesTable.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("insight").notNull(),
  tags: text("tags").array().default([]).notNull(),
  isFavorited: boolean("is_favorited").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInsightCardSchema = createInsertSchema(insightCardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInsightCard = z.infer<typeof insertInsightCardSchema>;
export type InsightCard = typeof insightCardsTable.$inferSelect;
