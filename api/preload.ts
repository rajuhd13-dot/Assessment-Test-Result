import {
  globalSyncCache,
  loadCacheFromDisk,
  triggerBackgroundSync
} from "./_shared";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { scriptUrl } = req.query;

    let finalScriptUrlStr = process.env.APPS_SCRIPT_URL || "";
    if (finalScriptUrlStr.includes("YOUR_SCRIPT_ID") || !finalScriptUrlStr.includes("script.google.com")) {
      finalScriptUrlStr = "";
    }

    if (!finalScriptUrlStr && typeof scriptUrl === "string" && scriptUrl.trim() !== "" && scriptUrl.includes("script.google.com")) {
      finalScriptUrlStr = scriptUrl.trim();
    }

    if (!finalScriptUrlStr) {
      finalScriptUrlStr = "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
    }

    loadCacheFromDisk();

    const cached = globalSyncCache.get(finalScriptUrlStr);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      console.log(`[VERCEL API PRELOAD] Serving hot cache warm check for ${finalScriptUrlStr}. Rows: ${cached.data.length}`);
      return res.json({ ok: true, cached: true, message: "Cache is already hot and responsive.", count: cached.data.length });
    }

    // Spawn background loading of database
    console.log(`[VERCEL API PRELOAD] Spawning proactive fetch on serverless container for ${finalScriptUrlStr}`);
    
    // In serverless, we must await the sync to keep the function alive until the write is saved to /tmp disk successfully.
    await triggerBackgroundSync(finalScriptUrlStr);

    return res.json({ ok: true, cached: false, message: "Apps Script Synchronized and Cached successfully in Serverless Temp Space." });
  } catch (err: any) {
    console.error("[VERCEL API PRELOAD ERROR]", err);
    return res.json({ ok: false, message: err.message || err });
  }
}
