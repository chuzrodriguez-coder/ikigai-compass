import {
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { discoverySessionsTable } from "./discovery";

export const ikigaiHypothesesTable = pgTable("ikigai_hypotheses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(
    () => discoverySessionsTable.id,
    { onDelete: "set null" }
  ),
  version: integer("version").default(1).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  detailedExplanation: text("detailed_explanation"),
  supportingEvidence: jsonb("supporting_evidence").default([]).notNull(),
  uncertaintyLevel: text("uncertainty_level").default("medium").notNull(),
  resonanceScore: real("resonance_score"),
  themes: jsonb("themes").default([]).notNull(),
  suggestedExperiments: jsonb("suggested_experiments").default([]).notNull(),
  alternativeInterpretations: jsonb("alternative_interpretations")
    .default([])
    .notNull(),
  status: text("status").default("draft").notNull(),
  isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIkigaiHypothesisSchema = createInsertSchema(
  ikigaiHypothesesTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIkigaiHypothesis = z.infer<
  typeof insertIkigaiHypothesisSchema
>;
export type IkigaiHypothesis = typeof ikigaiHypothesesTable.$inferSelect;
