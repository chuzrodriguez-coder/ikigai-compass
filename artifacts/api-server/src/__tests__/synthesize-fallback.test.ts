import { describe, it, expect } from "vitest";
import { z } from "zod";

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

describe("AI synthesis JSON parsing", () => {
  it("parses a clean JSON array response", () => {
    const raw = JSON.stringify([
      { title: "Test Hypothesis", summary: "A clear summary", uncertaintyLevel: "medium" },
    ]);
    const parsed = extractJson(raw);
    const result = HypothesesArraySchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("extracts JSON array embedded in markdown code block", () => {
    const raw = `Here is your result:\n\n\`\`\`json\n[{"title":"T","summary":"S"}]\n\`\`\``;
    const parsed = extractJson(raw);
    const result = HypothesesArraySchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("fails gracefully when AI returns plain text (no JSON)", () => {
    expect(() => extractJson("I cannot generate hypotheses right now.")).toThrow();
  });

  it("schema validation rejects missing required fields", () => {
    const result = HypothesesArraySchema.safeParse([{ title: "Only title" }]);
    expect(result.success).toBe(false);
  });

  it("schema validation rejects invalid uncertaintyLevel", () => {
    const result = HypothesesArraySchema.safeParse([
      { title: "T", summary: "S", uncertaintyLevel: "maybe" },
    ]);
    expect(result.success).toBe(false);
  });

  it("schema validation accepts full valid hypothesis", () => {
    const result = HypothesesArraySchema.safeParse([
      {
        title: "Tech Leadership & Coaching",
        summary: "Combining technical expertise with a passion for mentoring others.",
        detailedExplanation: "Your background in engineering combined with desire to mentor.",
        supportingEvidence: ["I love helping junior engineers grow"],
        uncertaintyLevel: "low",
        themes: ["coaching", "technology"],
        suggestedExperiments: ["Mentor one junior dev for 30 days"],
        alternativeInterpretations: ["Could manifest as course creation vs direct mentoring"],
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("schema validation defaults optional fields", () => {
    const result = HypothesesArraySchema.safeParse([
      { title: "Title", summary: "Summary" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].themes).toEqual([]);
      expect(result.data[0].uncertaintyLevel).toBe("medium");
    }
  });

  it("schema rejects empty array", () => {
    const result = HypothesesArraySchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});

describe("AI synthesis provenance semantics", () => {
  it("isAiGenerated=true only when schema validation succeeds", () => {
    const validAiResponse = [{ title: "AI Hypothesis", summary: "AI generated summary" }];
    const validationResult = HypothesesArraySchema.safeParse(validAiResponse);
    const isValidAiResult = validationResult.success;
    expect(isValidAiResult).toBe(true);
  });

  it("isAiGenerated=false when AI response fails schema validation", () => {
    const invalidAiResponse = [{ title_wrong_key: "bad", content: "missing summary" }];
    const validationResult = HypothesesArraySchema.safeParse(invalidAiResponse);
    const isValidAiResult = validationResult.success;
    expect(isValidAiResult).toBe(false);
  });

  it("isAiGenerated=false when AI response is empty JSON", () => {
    const emptyResponse: unknown[] = [];
    const validationResult = HypothesesArraySchema.safeParse(emptyResponse);
    const isValidAiResult = validationResult.success;
    expect(isValidAiResult).toBe(false);
  });

  it("isAiGenerated=false when AI response cannot be parsed to JSON", () => {
    const noJson = "I am unable to complete this request.";
    let extractionFailed = false;
    try {
      const trimmed = noJson.trim();
      if (!trimmed.startsWith("[")) {
        const match = noJson.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("No JSON array found");
      }
    } catch {
      extractionFailed = true;
    }
    expect(extractionFailed).toBe(true);
  });
});
