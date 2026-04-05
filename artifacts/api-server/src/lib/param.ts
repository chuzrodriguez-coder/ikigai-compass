import type { Request } from "express";

export function getParamId(req: Request, name = "id"): number {
  const raw = req.params[name];
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str ?? "", 10);
  if (isNaN(id) || id <= 0) {
    throw Object.assign(new Error("Invalid ID parameter"), { status: 400 });
  }
  return id;
}
