import { describe, it, expect, vi } from "vitest";
import { validateBody } from "../middlewares/validate";
import type { Request, Response, NextFunction } from "express";

function makeReq(body: unknown): Request {
  return { body } as Request;
}

interface MockRes {
  _status?: number;
  _json?: unknown;
  status(code: number): MockRes;
  json(data: unknown): MockRes;
}

function makeRes(): MockRes {
  const res: MockRes = {
    _status: undefined,
    _json: undefined,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res;
}

type ParseResult =
  | { success: true; data: unknown }
  | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };

function makeSchema(result: ParseResult) {
  return { safeParse: (_data: unknown) => result };
}

describe("validateBody middleware", () => {
  it("calls next() when schema parse succeeds", () => {
    const middleware = validateBody(makeSchema({ success: true, data: { name: "Alice" } }));
    const req = makeReq({ name: "Alice" });
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBeUndefined();
  });

  it("replaces req.body with parsed data on success", () => {
    const parsed = { name: "Bob" };
    const middleware = validateBody(makeSchema({ success: true, data: parsed }));
    const req = makeReq({ name: "Bob", extra: "stripped" });
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    expect(req.body).toBe(parsed);
  });

  it("returns 400 and does not call next when parse fails", () => {
    const middleware = validateBody(
      makeSchema({
        success: false,
        error: { issues: [{ path: ["name"], message: "Required" }] },
      })
    );
    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  it("returns error message in JSON response on validation failure", () => {
    const middleware = validateBody(
      makeSchema({
        success: false,
        error: { issues: [{ path: ["age"], message: "Expected number" }] },
      })
    );
    const req = makeReq({ name: "Charlie", age: "bad" });
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    const json = res._json as { error: string; details: { path: string; message: string }[] };
    expect(json.error).toBe("Validation failed");
    expect(json.details).toHaveLength(1);
    expect(json.details[0].path).toBe("age");
    expect(json.details[0].message).toBe("Expected number");
  });

  it("includes multiple field errors when multiple issues exist", () => {
    const middleware = validateBody(
      makeSchema({
        success: false,
        error: {
          issues: [
            { path: ["name"], message: "Required" },
            { path: ["age"], message: "Expected number" },
          ],
        },
      })
    );
    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    const json = res._json as { details: { path: string }[] };
    expect(json.details).toHaveLength(2);
    expect(json.details.map((d) => d.path)).toContain("name");
    expect(json.details.map((d) => d.path)).toContain("age");
  });

  it("joins nested path segments with dots", () => {
    const middleware = validateBody(
      makeSchema({
        success: false,
        error: { issues: [{ path: ["user", "address", "city"], message: "Required" }] },
      })
    );
    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res as unknown as Response, next as NextFunction);

    const json = res._json as { details: { path: string }[] };
    expect(json.details[0].path).toBe("user.address.city");
  });
});
