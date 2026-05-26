import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, usersTable, activityTable } from "@workspace/db";
import { eq, and, lt, desc, or } from "drizzle-orm";
import { requireAuth, requireAdmin, getDbUser } from "../lib/auth";
import { broadcast } from "../lib/websocket";

const router = Router();

async function enrichMessage(msg: typeof messagesTable.$inferSelect) {
  const sender = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1);
  return { ...msg, sender: sender[0] };
}

// GET /api/groups/:groupId/messages
router.get("/groups/:groupId/messages", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.groupId);
  const { before, limit = "50" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit), 100);

  try {
    let query = db
      .select()
      .from(messagesTable)
      .where(
        before
          ? and(eq(messagesTable.groupId, groupId), lt(messagesTable.id, parseInt(before)))
          : eq(messagesTable.groupId, groupId)
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(lim + 1);

    const rows = await query;
    const hasMore = rows.length > lim;
    const messages = await Promise.all(rows.slice(0, lim).reverse().map(enrichMessage));
    res.json({ messages, hasMore });
  } catch (err) {
    req.log.error({ err }, "Error in GET /groups/:groupId/messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:groupId/messages
router.post("/groups/:groupId/messages", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const groupId = parseInt(req.params.groupId);
  const { content, fileUrl, fileType, fileName, messageType = "text" } = req.body;

  try {
    const [msg] = await db.insert(messagesTable).values({
      content, fileUrl, fileType, fileName,
      messageType: messageType as any,
      senderId: user.id,
      groupId,
    }).returning();

    const enriched = await enrichMessage(msg);
    broadcast({ type: "new_message", message: enriched });
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Error in POST /groups/:groupId/messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/groups/:groupId/messages/:messageId
router.delete("/groups/:groupId/messages/:messageId", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const messageId = parseInt(req.params.messageId);

  try {
    const msg = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId)).limit(1);
    if (msg.length === 0) { res.status(404).json({ error: "Message not found" }); return; }
    if (msg[0].senderId !== user.id && user.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error in DELETE /groups/:groupId/messages/:messageId");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dm/:contactUserId/messages
router.get("/dm/:contactUserId/messages", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const { contactUserId } = req.params;
  const { before, limit = "50" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit), 100);

  try {
    const condition = and(
      or(
        and(eq(messagesTable.senderId, user.id), eq(messagesTable.recipientId, contactUserId)),
        and(eq(messagesTable.senderId, contactUserId), eq(messagesTable.recipientId, user.id))
      ),
      before ? lt(messagesTable.id, parseInt(before)) : undefined
    );

    const rows = await db
      .select()
      .from(messagesTable)
      .where(condition)
      .orderBy(desc(messagesTable.createdAt))
      .limit(lim + 1);

    const hasMore = rows.length > lim;
    const messages = await Promise.all(rows.slice(0, lim).reverse().map(enrichMessage));
    res.json({ messages, hasMore });
  } catch (err) {
    req.log.error({ err }, "Error in GET /dm/:contactUserId/messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/dm/:contactUserId/messages
router.post("/dm/:contactUserId/messages", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const { contactUserId } = req.params;
  const { content, fileUrl, fileType, fileName, messageType = "text" } = req.body;

  try {
    const [msg] = await db.insert(messagesTable).values({
      content, fileUrl, fileType, fileName,
      messageType: messageType as any,
      senderId: user.id,
      recipientId: contactUserId,
    }).returning();

    const enriched = await enrichMessage(msg);
    broadcast({ type: "new_message", message: enriched });
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Error in POST /dm/:contactUserId/messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin force-delete
router.delete("/admin/messages/:messageId", requireAdmin, async (req, res): Promise<void> => {
  const admin = getDbUser(req);
  const messageId = parseInt(req.params.messageId);
  try {
    const msg = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId)).limit(1);
    if (msg.length === 0) { res.status(404).json({ error: "Message not found" }); return; }
    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
    await db.insert(activityTable).values({
      type: "message_deleted",
      description: `Admin deleted a message`,
      actorName: admin.displayName,
      targetName: null,
    });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error in DELETE /admin/messages/:messageId");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
