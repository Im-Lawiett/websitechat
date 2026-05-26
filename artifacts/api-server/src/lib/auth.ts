import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (user.length === 0) {
    res.status(401).json({ error: "User not found. Please complete registration." });
    return;
  }
  if (user[0].isBanned) {
    res.status(403).json({ error: "banned", banReason: user[0].banReason });
    return;
  }
  (req as any).dbUser = user[0];
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (user.length === 0 || user[0].role !== "admin") {
    res.status(403).json({ error: "Forbidden. Admin only." });
    return;
  }
  (req as any).dbUser = user[0];
  next();
}

export function getDbUser(req: Request) {
  return (req as any).dbUser as typeof usersTable.$inferSelect;
}
