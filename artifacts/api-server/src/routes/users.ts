import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth, getDbUser } from "../lib/auth";
import { activityTable } from "@workspace/db";
import { nanoid } from "nanoid";

const router = Router();

// GET /api/users/me — get or create user profile
router.get("/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    let user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);

    if (user.length === 0) {
      // First time — create the user
      const clerkUser = (req as any).auth?.sessionClaims;
      const email = clerkUser?.email_address || `user_${userId}@globalchat.app`;
      const firstName = clerkUser?.first_name || "";
      const lastName = clerkUser?.last_name || "";
      const displayName = `${firstName} ${lastName}`.trim() || `User_${userId.slice(0, 6)}`;
      const username = displayName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + nanoid(4);
      const avatarUrl = clerkUser?.image_url || null;

      // Check if this is the first user — make them admin
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
      const isFirstUser = Number(userCount[0].count) === 0;

      const newUser = await db.insert(usersTable).values({
        id: nanoid(),
        clerkId: userId,
        username,
        displayName,
        email,
        avatarUrl,
        role: isFirstUser ? "admin" : "user",
        isBanned: false,
      }).returning();

      // Log activity
      await db.insert(activityTable).values({
        type: "user_joined",
        description: `${displayName} joined GlobalChat`,
        actorName: displayName,
        targetName: null,
      });

      res.json(newUser[0]);
    } else {
      res.json(user[0]);
    }
  } catch (err) {
    req.log.error({ err }, "Error in GET /users/me");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me
router.patch("/me", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const { username, displayName, avatarUrl } = req.body;

  try {
    const updated = await db.update(usersTable)
      .set({ username, displayName, avatarUrl })
      .where(eq(usersTable.id, user.id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Error in PATCH /users/me");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users — list users with optional search
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit), 100);
  const off = parseInt(offset);

  try {
    let query = db.select().from(usersTable);
    if (search) {
      query = query.where(
        or(
          ilike(usersTable.displayName, `%${search}%`),
          ilike(usersTable.username, `%${search}%`),
          ilike(usersTable.email, `%${search}%`)
        )
      ) as typeof query;
    }
    const users = await query.limit(lim).offset(off);
    const total = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    res.json({ users, total: Number(total[0].count) });
  } catch (err) {
    req.log.error({ err }, "Error in GET /users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId
router.get("/:userId", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId)).limit(1);
    if (user.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user[0]);
  } catch (err) {
    req.log.error({ err }, "Error in GET /users/:userId");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
