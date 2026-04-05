import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";

const OPENAPI_PATH = resolve(__dirname, "../../../../lib/api-spec/openapi.yaml");

interface OpenApiPaths {
  [path: string]: Record<string, unknown>;
}

interface OpenApiSpec {
  paths?: OpenApiPaths;
}

function loadOpenApiPaths(): string[] {
  try {
    const content = readFileSync(OPENAPI_PATH, "utf8");
    const spec = yaml.load(content) as OpenApiSpec;
    return Object.keys(spec?.paths ?? {});
  } catch {
    return [];
  }
}

describe("OpenAPI spec — removed stale endpoints", () => {
  it("spec does not include /openai/generate-image (no implementation exists)", () => {
    const paths = loadOpenApiPaths();
    expect(paths).not.toContain("/openai/generate-image");
  });

  it("spec includes core conversation routes that are implemented", () => {
    const paths = loadOpenApiPaths();
    expect(paths).toContain("/openai/conversations");
    expect(paths).toContain("/openai/conversations/{id}");
    expect(paths).toContain("/openai/conversations/{id}/messages");
  });

  it("spec includes all core Ikigai domain routes", () => {
    const paths = loadOpenApiPaths();
    const required = [
      "/discovery/sessions",
      "/hypotheses",
      "/growth/plans",
      "/checkins",
      "/obstacles",
      "/coaching/sessions",
      "/dashboard/summary",
      "/goals",
      "/insights",
      "/themes",
      "/opportunity-paths",
      "/reminders",
    ];
    for (const route of required) {
      expect(paths, `Expected ${route} to be in OpenAPI spec`).toContain(route);
    }
  });

  it("spec includes coaching messages and hypothesis compare routes", () => {
    const paths = loadOpenApiPaths();
    expect(paths).toContain("/coaching/sessions/{id}/messages");
    expect(paths).toContain("/hypotheses/compare");
  });

  it("spec includes auth and scheduling infrastructure routes", () => {
    const paths = loadOpenApiPaths();
    expect(paths).toContain("/healthz");
    expect(paths).toContain("/reminders/due");
    expect(paths).toContain("/accountability/status");
  });
});
