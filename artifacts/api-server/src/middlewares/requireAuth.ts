import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  userPreferencesTable,
  insertUserSchema,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      dbUserId?: number;
      clerkUserId?: string;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.clerkUserId = clerkUserId;

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkUserId),
  });

  if (!user) {
    const email =
      (auth.sessionClaims?.email as string) ||
      `${clerkUserId}@placeholder.local`;
    const parsed = insertUserSchema.parse({
      clerkId: clerkUserId,
      email,
    });
    const [newUser] = await db.insert(usersTable).values(parsed).returning();
    user = newUser;

    await db.insert(userPreferencesTable).values({ userId: user.id });
  }

  req.dbUserId = user.id;
  next();
};
