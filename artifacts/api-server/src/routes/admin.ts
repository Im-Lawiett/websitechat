import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, groupsTable, messagesTable, activityTable } from "@workspace/db";
import { eq, ilike, sql, and } from "drizzle-orm";
import { requireAdmin, getDbUser } from "../lib/auth";
import { broadcast } from "../lib/websocket";

const router = Router();

// GET /api/admin/stats
router.get("/stats", requireAdmin, async (req, res): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [activeUsers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isBanned, false));
    const [bannedUsers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isBanned, true));
    const [totalGroups] = await db.select({ count: sql<number>`count(*)` }).from(groupsTable);
    const [totalMessages] = await db.select({ count: sql<number>`count(*)` }).from(messagesTable);
    const [messagesToday] = await db.select({ count: sql<number>`count(*)` }).from(messagesTable).where(sql`created_at >= ${today.toISOString()}`);
    const [newUsersToday] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`created_at >= ${today.toISOString()}`);

    res.json({
      totalUsers: Number(totalUsers.count),
      activeUsers: Number(activeUsers.count),
      bannedUsers: Number(bannedUsers.count),
      totalGroups: Number(totalGroups.count),
      totalMessages: Number(totalMessages.count),
      messagesToday: Number(messagesToday.count),
      newUsersToday: Number(newUsersToday.count),
    });
  } catch (err) {
    req.log.error({ err }, "Error in GET /admin/stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users
router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const { search, status = "all", limit = "50", offset = "0" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit), 100);
  const off = parseInt(offset);

  try {
    let conditions: any[] = [];

    if (search) {
      conditions.push(
        sql`(${usersTable.displayName} ilike ${`%${search}%`} OR ${usersTable.username} ilike ${`%${search}%`} OR ${usersTable.email} ilike ${`%${search}%`})`
      );
    }
    if (status === "active") conditions.push(eq(usersTable.isBanned, false));
    if (status === "banned") conditions.push(eq(usersTable.isBanned, true));

    const query = conditions.length > 0
      ? db.select().from(usersTable).where(and(...conditions))
      : db.select().from(usersTable);

    const users = await query.limit(lim).offset(off).orderBy(usersTable.createdAt);
    const [countResult] = conditions.length > 0
      ? await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(...conditions))
      : await db.select({ count: sql<number>`count(*)` }).from(usersTable);

    res.json({ users, total: Number(countResult.count) });
  } catch (err) {
    req.log.error({ err }, "Error in GET /admin/users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:userId/ban
router.post("/users/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const admin = getDbUser(req);
  const { userId } = req.params;
  const { reason } = req.body;

  try {
    const [updated] = await db.update(usersTable)
      .set({ isBanned: true, banReason: reason })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

    await db.insert(activityTable).values({
      type: "user_banned",
      description: `Admin banned ${updated.displayName}: ${reason}`,
      actorName: admin.displayName,
      targetName: updated.displayName,
    });

    broadcast({ type: "user_banned", userId });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error in POST /admin/users/:userId/ban");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:userId/unban
router.post("/users/:userId/unban", requireAdmin, async (req, res): Promise<void> => {
  const admin = getDbUser(req);
  const { userId } = req.params;

  try {
    const [updated] = await db.update(usersTable)
      .set({ isBanned: false, banReason: null })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

    await db.insert(activityTable).values({
      type: "user_unbanned",
      description: `Admin unbanned ${updated.displayName}`,
      actorName: admin.displayName,
      targetName: updated.displayName,
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error in POST /admin/users/:userId/unban");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/recent-activity
router.get("/recent-activity", requireAdmin, async (req, res): Promise<void> => {
  try {
    const activities = await db
      .select()
      .from(activityTable)
      .orderBy(sql`created_at desc`)
      .limit(50);
    res.json({ activities });
  } catch (err) {
    req.log.error({ err }, "Error in GET /admin/recent-activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
