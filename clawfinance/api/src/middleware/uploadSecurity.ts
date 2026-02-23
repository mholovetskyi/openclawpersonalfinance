import { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";

// Magic bytes for allowed file types
const MAGIC_BYTES: Record<string, Buffer[]> = {
  pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  png: [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  jpg: [Buffer.from([0xff, 0xd8, 0xff])],
  tiff: [Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.from([0x4d, 0x4d, 0x00, 0x2a])],
};

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif"]);
const MAX_FILENAME_LENGTH = 255;

/**
 * Validates uploaded files by checking:
 * 1. File extension is in allowlist
 * 2. Magic bytes match the claimed file type
 * 3. Filename doesn't contain path traversal sequences
 * 4. Filename length is reasonable
 */
export function validateUpload(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }

  const file = req.file;

  // Check filename for path traversal
  const originalName = file.originalname ?? "";
  if (originalName.includes("..") || originalName.includes("/") || originalName.includes("\\")) {
    res.status(400).json({ error: "Invalid filename: path traversal detected" });
    return;
  }

  if (originalName.length > MAX_FILENAME_LENGTH) {
    res.status(400).json({ error: "Filename too long" });
    return;
  }

  // Check extension
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    res.status(400).json({
      error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    });
    return;
  }

  // Check magic bytes
  try {
    const buffer = readFileSync(file.path);
    if (buffer.length < 4) {
      res.status(400).json({ error: "File too small to validate" });
      return;
    }

    const header = buffer.subarray(0, 8);
    const matchesAnyType = Object.values(MAGIC_BYTES).some((signatures) =>
      signatures.some((sig) => header.subarray(0, sig.length).equals(sig))
    );

    if (!matchesAnyType) {
      res.status(400).json({
        error: "File content does not match a supported document type",
      });
      return;
    }
  } catch {
    res.status(400).json({ error: "Could not validate file" });
    return;
  }

  next();
}
