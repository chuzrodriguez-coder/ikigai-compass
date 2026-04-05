import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getParamId } from "../lib/param";

function makeRequest(id: string | string[]): Request {
  return { params: { id } } as unknown as Request;
}

describe("getParamId", () => {
  it("parses a valid numeric string param", () => {
    expect(getParamId(makeRequest("42"))).toBe(42);
  });

  it("parses the first element of an array param", () => {
    expect(getParamId(makeRequest(["7", "8"]))).toBe(7);
  });

  it("throws for a non-numeric string", () => {
    expect(() => getParamId(makeRequest("abc"))).toThrow();
  });

  it("throws for zero", () => {
    expect(() => getParamId(makeRequest("0"))).toThrow();
  });

  it("throws for a negative number", () => {
    expect(() => getParamId(makeRequest("-1"))).toThrow();
  });

  it("throws for an empty string", () => {
    expect(() => getParamId(makeRequest(""))).toThrow();
  });

  it("uses custom param name when specified", () => {
    const req = { params: { planId: "99" } } as unknown as Request;
    expect(getParamId(req, "planId")).toBe(99);
  });
});
