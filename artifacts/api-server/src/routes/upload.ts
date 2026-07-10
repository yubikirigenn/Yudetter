import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// Memory storage is ideal because we may proxy the upload to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mp3|wav|m4a/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error("対応していないファイル形式です（画像、動画、音声のみ対応）。"));
    }
  },
});

router.post("/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "ファイルが添付されていません。" });
      return;
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase() || "";
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseBucket = process.env.SUPABASE_BUCKET || "yudetter-bucket";

    let uploaded = false;
    let publicUrl = "";

    // If Supabase credentials are provided, upload to Supabase Storage
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const cleanUrl = supabaseUrl.replace(/\/$/, "");
        const uploadUrl = `${cleanUrl}/storage/v1/object/${supabaseBucket}/${filename}`;

        logger.info({ filename, bucket: supabaseBucket }, "Uploading to Supabase Storage...");
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": file.mimetype,
            "x-upsert": "true",
          },
          body: file.buffer,
        });

        if (uploadResponse.ok) {
          publicUrl = `${cleanUrl}/storage/v1/object/public/${supabaseBucket}/${filename}`;
          logger.info({ publicUrl }, "Uploaded to Supabase successfully.");
          uploaded = true;
        } else {
          const errorText = await uploadResponse.text();
          logger.error({ error: errorText, status: uploadResponse.status }, "Supabase upload failed, fallback to local storage");
        }
      } catch (uploadErr) {
        logger.error({ err: uploadErr }, "Supabase upload threw error, fallback to local storage");
      }
    }

    if (uploaded && publicUrl) {
      res.json({ url: publicUrl });
      return;
    }

    // Fallback to local storage
    logger.info({ filename }, "Supabase config missing. Falling back to local storage upload.");
    const uploadDir = path.resolve(globalThis.__dirname || ".", "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    // Return the relative URL from host root
    const localUrl = `/uploads/${filename}`;
    res.json({ url: localUrl });
  } catch (err: any) {
    logger.error({ err }, "Error in file upload endpoint");
    res.status(500).json({ error: err.message || "ファイルのアップロード中にエラーが発生しました。" });
  }
});

export default router;
