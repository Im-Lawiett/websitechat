import { Router } from "express";
import { db } from "@workspace/db";
import { contactsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getDbUser } from "../lib/auth";

const router = Router();

// GET /api/contacts
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  try {
    const contacts = await db
      .select({ contact: contactsTable, contactUser: usersTable })
      .from(contactsTable)
      .innerJoin(usersTable, eq(contactsTable.contactUserId, usersTable.id))
      .where(eq(contactsTable.userId, user.id));

    res.json({
      contacts: contacts.map((c) => ({
        id: c.contact.id,
        userId: c.contact.userId,
        contactUserId: c.contact.contactUserId,
        contact: c.contactUser,
        createdAt: c.contact.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error in GET /contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/contacts
router.post("/", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const { contactUserId } = req.body;

  try {
    const existing = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.userId, user.id), eq(contactsTable.contactUserId, contactUserId)))
      .limit(1);

    if (existing.length > 0) {
      const contactUser = await db.select().from(usersTable).where(eq(usersTable.id, contactUserId)).limit(1);
      res.status(201).json({ id: existing[0].id, userId: existing[0].userId, contactUserId: existing[0].contactUserId, contact: contactUser[0], createdAt: existing[0].createdAt });
      return;
    }

    const [newContact] = await db.insert(contactsTable).values({ userId: user.id, contactUserId }).returning();
    const contactUser = await db.select().from(usersTable).where(eq(usersTable.id, contactUserId)).limit(1);

    res.status(201).json({
      id: newContact.id,
      userId: newContact.userId,
      contactUserId: newContact.contactUserId,
      contact: contactUser[0],
      createdAt: newContact.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error in POST /contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/contacts/:contactUserId
router.delete("/:contactUserId", requireAuth, async (req, res): Promise<void> => {
  const user = getDbUser(req);
  const { contactUserId } = req.params;

  try {
    await db
      .delete(contactsTable)
      .where(and(eq(contactsTable.userId, user.id), eq(contactsTable.contactUserId, contactUserId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error in DELETE /contacts/:contactUserId");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
