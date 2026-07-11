import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";
import sharp from "sharp";

const router = Router();

// Memory storage is ideal because we may proxy the upload to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = /^\.(jpg|jpeg|png|gif|webp|mov|mp4|webm|mp3|wav|m4a|ogg|aac)$/i;
    const allowedMimeTypes = /^(image|video|audio)\//i;

    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (allowedExtensions.test(ext) || allowedMimeTypes.test(mime) || mime === "application/octet-stream") {
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
    let ext = path.extname(file.originalname).toLowerCase() || "";
    let buffer = file.buffer;
    let mimeType = file.mimetype;

    // Detect if upload is a compressible image (JPEG, PNG, WebP) but exclude animated GIFs and SVGs
    const isCompressibleImage =
      mimeType.startsWith("image/") &&
      !mimeType.includes("gif") &&
      !mimeType.includes("svg") &&
      !mimeType.includes("icon");

    if (isCompressibleImage) {
      try {
        logger.info({ filename: file.originalname, originalSize: buffer.length }, "Compressing image using sharp...");
        let pipeline = sharp(buffer);
        const metadata = await pipeline.metadata();

        // Resize down to a maximum width of 1200px (retaining aspect ratio) if larger
        if (metadata.width && metadata.width > 1200) {
          pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
        }

        // Convert to WebP format with quality 75%
        buffer = await pipeline.webp({ quality: 75 }).toBuffer();
        ext = ".webp";
        mimeType = "image/webp";

        logger.info({ compressedSize: buffer.length }, "Image compressed successfully to WebP.");
      } catch (sharpErr) {
        logger.error({ err: sharpErr }, "Failed to compress image with sharp, fallback to original buffer");
      }
    }

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

        if (!mimeType || mimeType === "application/octet-stream" || mimeType === "blob") {
          const mimeMap: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".mov": "video/quicktime",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/x-m4a",
            ".ogg": "audio/ogg",
            ".aac": "audio/aac",
          };
          mimeType = mimeMap[ext] || "image/jpeg";
        }

        logger.info({ filename, bucket: supabaseBucket, mimeType }, "Uploading to Supabase Storage...");
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
            "Content-Type": mimeType,
            "x-upsert": "true",
          },
          body: buffer,
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
    fs.writeFileSync(filePath, buffer);

    // Return the relative URL from host root
    const localUrl = `/uploads/${filename}`;
    res.json({ url: localUrl });
  } catch (err: any) {
    logger.error({ err }, "Error in file upload endpoint");
    res.status(500).json({ error: err.message || "ファイルのアップロード中にエラーが発生しました。" });
  }
});

export default router;
