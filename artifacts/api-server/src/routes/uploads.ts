import { Router } from "express";
import { requireAuth } from "../lib/auth";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// POST /api/uploads — accepts base64 encoded file
router.post("/", requireAuth, async (req, res): Promise<void> => {
  const { fileName, fileType, fileData } = req.body;

  if (!fileName || !fileType || !fileData) {
    res.status(400).json({ error: "fileName, fileType, and fileData are required" });
    return;
  }

  try {
    const buffer = Buffer.from(fileData, "base64");
    const ext = path.extname(fileName) || "";
    const uniqueName = `${nanoid()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const fileSize = buffer.length;
    const url = `/api/uploads/${uniqueName}`;

    res.json({ url, fileType, fileName, fileSize });
  } catch (err) {
    req.log.error({ err }, "Error in POST /uploads");
    res.status(500).json({ error: "Upload failed" });
  }
});

// Serve uploaded files
router.get("/:filename", (req, res): void => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
