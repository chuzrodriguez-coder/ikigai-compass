import { pgTable, serial, text, timestamp, integer, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const promptTemplateVersionsTable = pgTable("prompt_template_versions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  template: text("template").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiInteractionLogsTable = pgTable(
  "ai_interaction_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    promptTemplateName: text("prompt_template_name"),
    promptTemplateVersion: text("prompt_template_version"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    model: text("model").notNull().default("gpt-4o"),
    latencyMs: integer("latency_ms"),
    success: boolean("success").notNull().default(true),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ai_logs_user_idx").on(t.userId), index("ai_logs_created_idx").on(t.createdAt)]
);

export const insertAiInteractionLogSchema = createInsertSchema(aiInteractionLogsTable).omit({
  id: true,
  createdAt: true,
});

export type AiInteractionLog = typeof aiInteractionLogsTable.$inferSelect;
export type InsertAiInteractionLog = z.infer<typeof insertAiInteractionLogSchema>;
export type PromptTemplateVersion = typeof promptTemplateVersionsTable.$inferSelect;
