import { Router } from "express";
import { db } from "@workspace/db";
import { groupsTable, groupMembersTable, usersTable, activityTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, getDbUser } from "../lib/auth";
import { broadcast } from "../lib/websocket";

const router = Router();

async function getGroupWithMeta(groupId: number, userId: string) {
  const group = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (group.length === 0) return null;

  const memberCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));

  const membership = await db
    .select()
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId))
    .limit(1);

  const isMember = membership.some((m) => m.userId === userId);

  return {
    ...group[0],
    memberCount: Number(memberCount[0].count),
    isMember,
  };
}

// GET /api/groups
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  try {
    const groups = await db.select().from(groupsTable).orderBy(groupsTable.createdAt);
    const enriched = await Promise.all(
      groups.map(async (g) => {
        const cnt = await db.select({ count: sql<number>`count(*)` }).from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id));
        const mem = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id)).limit(1);
        return { ...g, memberCount: Number(cnt[0].count), isMember: mem.some((m) => m.userId === user.id) };
      })
    );
    res.json({ groups: enriched });
  } catch (err) {
    req.log.error({ err }, "Error in GET /groups");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups (admin only)
router.post("/", requireAdmin, async (req, res): Promise<void> => {
  const admin = getDbUser(req);
  const { name, description, avatarUrl } = req.body;
  try {
    const group = await db.insert(groupsTable).values({ name, description, avatarUrl, createdBy: admin.id }).returning();
    await db.insert(activityTable).values({
      type: "group_created",
      description: `Admin created group "${name}"`,
      actorName: admin.displayName,
      targetName: name,
    });
    const result = await getGroupWithMeta(group[0].id, admin.id);
    broadcast({ type: "group_created", group: result });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Error in POST /groups");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:groupId
router.get("/:groupId", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const groupId = parseInt(req.params.groupId);
  try {
    const result = await getGroupWithMeta(groupId, user.id);
    if (!result) { res.status(404).json({ error: "Group not found" }); return; }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error in GET /groups/:groupId");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/groups/:groupId (admin only)
router.patch("/:groupId", requireAdmin, async (req, res): Promise<void> => {
  const admin = getDbUser(req);
  const groupId = parseInt(req.params.groupId);
  const { name, description, avatarUrl } = req.body;
  try {
    await db.update(groupsTable).set({ name, description, avatarUrl }).where(eq(groupsTable.id, groupId));
    const result = await getGroupWithMeta(groupId, admin.id);
    if (!result) { res.status(404).json({ error: "Group not found" }); return; }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error in PATCH /groups/:groupId");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/groups/:groupId (admin only)
router.delete("/:groupId", requireAdmin, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId);
  try {
    await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error in DELETE /groups/:groupId");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:groupId/join
router.post("/:groupId/join", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const groupId = parseInt(req.params.groupId);
  try {
    const existing = await db.select().from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId))
      .limit(1);
    if (existing.some((m) => m.userId === user.id)) {
      const result = await getGroupWithMeta(groupId, user.id);
      res.json({ userId: user.id, groupId, user, joinedAt: new Date().toISOString(), ...result });
      return;
    }
    const member = await db.insert(groupMembersTable).values({ groupId, userId: user.id }).returning();
    broadcast({ type: "user_joined", groupId, user });
    res.json({ userId: user.id, groupId, user, joinedAt: member[0].joinedAt });
  } catch (err) {
    req.log.error({ err }, "Error in POST /groups/:groupId/join");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:groupId/leave
router.post("/:groupId/leave", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const groupId = parseInt(req.params.groupId);
  try {
    await db.delete(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error in POST /groups/:groupId/leave");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:groupId/members
router.get("/:groupId/members", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId);
  try {
    const members = await db
      .select({ member: groupMembersTable, user: usersTable })
      .from(groupMembersTable)
      .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
      .where(eq(groupMembersTable.groupId, groupId));

    const total = members.length;
    res.json({
      members: members.map((m) => ({
        userId: m.member.userId,
        groupId: m.member.groupId,
        user: m.user,
        joinedAt: m.member.joinedAt,
      })),
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Error in GET /groups/:groupId/members");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
