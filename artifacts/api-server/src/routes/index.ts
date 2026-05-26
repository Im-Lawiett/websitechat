import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import groupsRouter from "./groups";
import messagesRouter from "./messages";
import contactsRouter from "./contacts";
import adminRouter from "./admin";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/groups", groupsRouter);
router.use("/", messagesRouter);
router.use("/contacts", contactsRouter);
router.use("/admin", adminRouter);
router.use("/uploads", uploadsRouter);

export default router;
