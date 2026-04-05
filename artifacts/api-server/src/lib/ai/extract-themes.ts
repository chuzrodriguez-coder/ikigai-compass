import { getOpenAIClient } from "../../openaiClient";
import { logAiInteraction, PROMPT_TEMPLATES } from "./logger";
import { z } from "zod";

const ThemeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(z.string()).optional().default([]),
});

const ThemesResponseSchema = z.array(ThemeSchema).min(1).max(10);

const SYSTEM_PROMPT = `You are a reflective coach who identifies recurring themes and patterns in personal narratives. You look beneath the surface to find the underlying values, drives, and recurring motifs in someone's self-expression.`;

function buildFallbackThemes(text: string) {
  return [
    {
      name: "Personal Growth",
      description: "A recurring orientation toward learning, development, and becoming.",
      evidence: [text.slice(0, 100)],
    },
  ];
}

export async function extractThemesFromText(
  userId: number,
  text: string
): Promise<{ name: string; description: string; evidence: string[] }[]> {
  const userPrompt = `Analyze the following personal reflection and identify 3-7 key recurring themes. Focus on values, drives, patterns, and underlying motivations.

Text:
${text}

Return a JSON array only, no markdown:
[
  {
    "name": "Theme name (2-4 words)",
    "description": "What this theme means in context (1-2 sentences)",
    "evidence": ["Direct quote or paraphrase from the text"]
  }
]`;

  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    let rawParsed: unknown;
    try {
      const trimmed = raw.trim();
      rawParsed = trimmed.startsWith("[") ? JSON.parse(trimmed) : JSON.parse((raw.match(/\[[\s\S]*\]/) ?? ["[]"])[0]);
    } catch {
      return buildFallbackThemes(text);
    }

    const validation = ThemesResponseSchema.safeParse(rawParsed);
    return validation.success ? validation.data : buildFallbackThemes(text);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    return buildFallbackThemes(text);
  } finally {
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.THEME_EXTRACTION.name,
      promptTemplateVersion: PROMPT_TEMPLATES.THEME_EXTRACTION.version,
      model: "gpt-4o",
      inputTokens: undefined,
      outputTokens: undefined,
      latencyMs: Date.now() - start,
      success,
      errorMessage,
      metadata: { textLength: text.length },
    });
  }
}
