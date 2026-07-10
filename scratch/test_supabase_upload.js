import fs from "fs";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "yudetter-bucket";

console.log("=== SUPABASE CONFIG ===");
console.log("URL:", supabaseUrl);
console.log("Bucket:", supabaseBucket);
console.log("Service Key exists:", !!supabaseServiceKey);
console.log("=======================");

async function testUpload() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Supabase config missing in .env");
    return;
  }

  const filename = `test-${Date.now()}.txt`;
  const cleanUrl = supabaseUrl.replace(/\/$/, "");
  const uploadUrl = `${cleanUrl}/storage/v1/object/${supabaseBucket}/${filename}`;
  const dummyContent = Buffer.from("Hello Supabase Storage test");

  try {
    console.log(`Uploading dummy file to: ${uploadUrl}...`);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "text/plain",
        "x-upsert": "true",
      },
      body: dummyContent,
    });

    console.log("HTTP Status:", response.status, response.statusText);
    const body = await response.text();
    console.log("Response Body:", body);

    if (response.ok) {
      const publicUrl = `${cleanUrl}/storage/v1/object/public/${supabaseBucket}/${filename}`;
      console.log("Upload Success! Public URL:", publicUrl);
    } else {
      console.error("Upload Failed.");
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testUpload();
