import { db } from "@workspace/db";
import { ikigaiHypothesesTable } from "@workspace/db/schema";
import { getOpenAIClient } from "../../openaiClient";
import { logAiInteraction, PROMPT_TEMPLATES } from "./logger";
import { z } from "zod";

const DISCOVERY_STEP_LABELS: Record<string, string> = {
  step1: "Interests & Passions",
  step2: "Strengths & Skills",
  step3: "Values & Meaning",
  step4: "Energizers & Drainers",
  step5: "Admired Roles",
  step6: "Desired Contribution",
  step7: "Life Constraints",
  step8: "Fears & Blockers",
  step9: "Past Highlights",
  step10: "Ideal Lifestyle",
};

const SYSTEM_PROMPT = `You are a wise, empathetic Ikigai coach. You help people discover the meaningful intersection of what they love, what they're good at, what the world needs, and what can sustain them economically. Your hypotheses should be specific, grounded in the person's actual words, and feel like a profound insight — not a generic platitude. You are thoughtful, warm, and honest about uncertainty.`;

const HypothesisItemSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  detailedExplanation: z.string().optional().default(""),
  supportingEvidence: z.array(z.string()).optional().default([]),
  uncertaintyLevel: z.enum(["low", "medium", "high"]).optional().default("medium"),
  themes: z.array(z.string()).optional().default([]),
  suggestedExperiments: z.array(z.string()).optional().default([]),
  alternativeInterpretations: z.array(z.string()).optional().default([]),
});

const HypothesesArraySchema = z.array(HypothesisItemSchema).min(1).max(5);

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  throw new Error("No JSON array found in AI response");
}

function buildFallbackHypotheses(answers: Record<string, unknown>) {
  const topics = Object.values(answers)
    .filter(Boolean)
    .map((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
    .slice(0, 2)
    .join(" and ");

  return [
    {
      title: "Your Ikigai Awaits Further Exploration",
      summary:
        "Based on your responses, your path to purpose involves what you care about deeply.",
      detailedExplanation: topics
        ? `Your responses mention themes around ${topics}. This suggests a rich area to explore further.`
        : "Please complete more discovery steps for a personalized synthesis.",
      supportingEvidence: [],
      uncertaintyLevel: "high" as const,
      themes: ["purpose", "self-discovery"],
      suggestedExperiments: [
        "Talk to someone in a field you admire for 30 minutes",
        "Try one activity that combines your skills with your values",
      ],
      alternativeInterpretations: ["There may be multiple paths — stay open to all of them"],
    },
  ];
}

export async function synthesizeFallbackHypotheses(
  userId: number,
  sessionId: number,
  answers: Record<string, unknown>
): Promise<typeof ikigaiHypothesesTable.$inferSelect[]> {
  const fallbacks = buildFallbackHypotheses(answers);
  const inserted: (typeof ikigaiHypothesesTable.$inferSelect)[] = [];
  for (let i = 0; i < fallbacks.length; i++) {
    const h = fallbacks[i];
    const [row] = await db
      .insert(ikigaiHypothesesTable)
      .values({
        userId,
        sessionId,
        version: i + 1,
        title: h.title,
        summary: h.summary,
        detailedExplanation: h.detailedExplanation ?? null,
        supportingEvidence: h.supportingEvidence ?? [],
        uncertaintyLevel: h.uncertaintyLevel ?? "high",
        themes: h.themes ?? [],
        suggestedExperiments: h.suggestedExperiments ?? [],
        alternativeInterpretations: h.alternativeInterpretations ?? [],
        isAiGenerated: false,
        status: "draft",
      })
      .returning();
    inserted.push(row);
  }
  return inserted;
}

export async function synthesizeHypotheses(
  userId: number,
  sessionId: number,
  answers: Record<string, unknown>
): Promise<typeof ikigaiHypothesesTable.$inferSelect[]> {
  const answersText = Object.entries(answers)
    .map(([key, value]) => {
      const label = DISCOVERY_STEP_LABELS[key] ?? key;
      const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return `${label}: ${text}`;
    })
    .filter((line) => !line.endsWith(": "))
    .join("\n");

  const userPrompt = `Based on this person's self-discovery responses, generate 3 distinct Ikigai hypotheses. Each should be specific to their responses, not generic. Return a JSON array with exactly 3 objects.

Discovery responses:
${answersText}

Return JSON array only, no markdown, no explanation:
[
  {
    "title": "Brief compelling title (8-12 words)",
    "summary": "One clear sentence describing their Ikigai intersection",
    "detailedExplanation": "3-4 sentences grounding this in their specific responses and exploring what this path could look like",
    "supportingEvidence": ["Quote or paraphrase from their responses that supports this", "Another piece of evidence"],
    "uncertaintyLevel": "low|medium|high",
    "themes": ["theme1", "theme2", "theme3"],
    "suggestedExperiments": ["A small concrete experiment to test this hypothesis", "Another experiment"],
    "alternativeInterpretations": ["A nuanced alternative angle on the same data"]
  }
]`;

  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 2000,
    });

    inputTokens = completion.usage?.prompt_tokens;
    outputTokens = completion.usage?.completion_tokens;

    const raw = completion.choices[0]?.message?.content ?? "[]";

    let rawParsed: unknown;
    try {
      rawParsed = extractJson(raw);
    } catch {
      rawParsed = buildFallbackHypotheses(answers);
      success = false;
      errorMessage = "JSON extraction failed — using fallback hypotheses";
    }

    const validation = HypothesesArraySchema.safeParse(rawParsed);
    const isValidAiResult = validation.success;
    const parsed = isValidAiResult
      ? validation.data
      : buildFallbackHypotheses(answers);

    if (!isValidAiResult) {
      success = false;
      errorMessage = `Schema validation failed: ${validation.error.issues.map((i) => i.message).join("; ")} — using fallback`;
    }

    const inserted: (typeof ikigaiHypothesesTable.$inferSelect)[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const h = parsed[i];
      const [row] = await db
        .insert(ikigaiHypothesesTable)
        .values({
          userId,
          sessionId,
          version: i + 1,
          title: h.title,
          summary: h.summary,
          detailedExplanation: h.detailedExplanation ?? null,
          supportingEvidence: h.supportingEvidence ?? [],
          uncertaintyLevel: h.uncertaintyLevel ?? "medium",
          themes: h.themes ?? [],
          suggestedExperiments: h.suggestedExperiments ?? [],
          alternativeInterpretations: h.alternativeInterpretations ?? [],
          isAiGenerated: isValidAiResult,
          status: "draft",
        })
        .returning();
      inserted.push(row);
    }

    return inserted;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.IKIGAI_SYNTHESIZE.name,
      promptTemplateVersion: PROMPT_TEMPLATES.IKIGAI_SYNTHESIZE.version,
      model: "gpt-4o",
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      success,
      errorMessage,
      metadata: { sessionId, answerCount: Object.keys(answers).length },
    });
  }
}
