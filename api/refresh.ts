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
    console.log("[VERCEL WEBHOOK] Refresh received via Google Sheet onEdit trigger.");
    loadCacheFromDisk();

    if (globalSyncCache.size === 0) {
      let defaultUrl = process.env.APPS_SCRIPT_URL || "";
      if (!defaultUrl || defaultUrl.includes("YOUR_SCRIPT_ID") || !defaultUrl.includes("script.google.com")) {
        defaultUrl = "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
      }
      await triggerBackgroundSync(defaultUrl).catch(() => {});
    } else {
      const syncPromises = [];
      for (const [key, cache] of globalSyncCache.entries()) {
        cache.lastSynced = 0; // Mark stale so subsequent queries reload
        syncPromises.push(triggerBackgroundSync(key).catch(() => {}));
      }
      await Promise.all(syncPromises);
    }
    return res.json({ ok: true, message: "Incremental cache revalidation triggered inside serverless environment successfully." });
  } catch (err: any) {
    console.error("[VERCEL REFRESH ERROR]", err);
    return res.status(500).json({ ok: false, message: err.message || err });
  }
}
