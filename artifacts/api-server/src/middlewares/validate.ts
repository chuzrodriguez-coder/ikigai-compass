import type { Request, Response, NextFunction } from "express";

interface ZodLike {
  safeParse(data: unknown): { success: true; data: unknown } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };
}

export function validateBody(schema: ZodLike) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodLike) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: "Query validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
    next();
  };
}
