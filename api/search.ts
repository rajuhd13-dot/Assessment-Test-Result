import {
  globalSyncCache,
  loadCacheFromDisk,
  triggerBackgroundSync,
  mapRow,
  COL
} from "./_shared";

export default async function handler(req: any, res: any) {
  // Add CORS headers for high availability integration environments
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { roll, reg, scriptUrl } = req.query;

    if (!roll || !reg) {
      return res.status(400).json({
        ok: false,
        message: "HSC Roll No এবং Registration No দুটোই দিতে হবে।"
      });
    }

    const cleanRoll = String(roll).trim();
    const cleanReg = String(reg).trim();

    // Determine the Google Apps Script Web App URL
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

    // Restore cached records from temp disk
    loadCacheFromDisk();

    // Check the Cache
    let cached = globalSyncCache.get(finalScriptUrlStr);
    let rawRows: any[][] | null = null;

    // SWR (Stale-While-Revalidate) Cache Strategy
    const STALE_THRESHOLD = 30 * 1000; // 30 seconds threshold to trigger background refresh
    
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      rawRows = cached.data;
      const cacheAge = Date.now() - cached.lastSynced;
      
      if (cacheAge > STALE_THRESHOLD) {
        console.log(`[VERCEL STALE CACHE HIT] Serving instant response. Cache age: ${Math.round(cacheAge / 1000)}s. Triggering background refresh.`);
        triggerBackgroundSync(finalScriptUrlStr).catch((err) => {
          console.error("[VERCEL BACKGROUND SYNC ERROR]", err.message || err);
        });
      } else {
        console.log(`[VERCEL FRESH CACHE HIT] Serving response. Cache age: ${Math.round(cacheAge / 1000)}s.`);
      }
    } else {
      // Cache miss: must fetch synchronously
      console.log(`[VERCEL CACHE MISS] Fetching synchronously from Google Sheet...`);
      try {
        rawRows = await triggerBackgroundSync(finalScriptUrlStr);
      } catch (syncErr: any) {
        console.error("[VERCEL SYNC CRASH] Synchronous cache sync failed:", syncErr);
        
        // Old/Direct action=search Query Fallback
        console.log(`[VERCEL FALLBACK] Querying direct action=search for roll=${cleanRoll}, reg=${cleanReg}`);
        try {
          const fallbackUrl = new URL(finalScriptUrlStr);
          fallbackUrl.searchParams.set("action", "search");
          fallbackUrl.searchParams.set("roll", cleanRoll);
          fallbackUrl.searchParams.set("reg", cleanReg);

          const fallbackRes = await fetch(fallbackUrl.toString());
          if (fallbackRes.ok) {
            const fallbackText = await fallbackRes.text();
            const trimmedFallback = fallbackText.trim();
            if (trimmedFallback && !trimmedFallback.startsWith("<") && !trimmedFallback.toLowerCase().includes("<!doctype")) {
              const parsed = JSON.parse(trimmedFallback);
              if (parsed && parsed.ok && parsed.data) {
                console.log("[VERCEL FALLBACK SUCCESS] Successfully retrieved data via direct query.");
                return res.json({
                  ok: true,
                  data: parsed.data
                });
              } else if (parsed && !parsed.ok) {
                return res.json({
                  ok: false,
                  message: parsed.message || "Roll ও Registration নম্বর মিলছে না। সঠিক নম্বর দিন।"
                });
              }
            }
          }
        } catch (fallbackErr: any) {
          console.error("[VERCEL FALLBACK FAILURE] Direct query failed too:", fallbackErr);
        }

        return res.json({
          ok: false,
          message: `সার্ভার ডাটা সিঙ্ক করতে পারেনি। নিচে বিস্তারিত সমাধান দেওয়া হলোঃ

⚠️ ত্রুটি: ${syncErr.message || syncErr}

১. সমাধান ১: নিশ্চিত করুন আপনার Google Sheets এর Apps Script "Deploy" করার সময় "Who has access" অবশ্যই "Anyone" সেট করেছেন (Only myself নয়)।
২. সমাধান ২: নতুন দ্রুতগতির v9.0 Apps Script কোডটি এই ওয়েবসাইটের ওপরে ডানদিকের Settings বাটন থেকে কপি করে আপনার Sheets-এ সম্পূর্ণ একটি "New Deployment" বানিয়ে Deploy করুন।`
        });
      }
    }

    if (!rawRows || rawRows.length === 0) {
      return res.json({
        ok: false,
        message: "কোনো ডাটা পাওয়া যায়নি। আপনার গুগল শীটে তথ্য আছে কিনা চেক করুন।"
      });
    }

    // High-speed memory scanning of the 2D array
    const matchedRow = rawRows.find((row) => {
      const rRoll = row[COL.HSC_ROLL - 1];
      const rReg = row[COL.HSC_REG - 1];
      return (
        rRoll !== undefined && rRoll !== null && String(rRoll).trim() === cleanRoll &&
        rReg !== undefined && rReg !== null && String(rReg).trim() === cleanReg
      );
    });

    if (!matchedRow) {
      return res.json({
        ok: false,
        message: "Roll ও Registration নম্বর মিলছে না। সঠিক নম্বর দিন।"
      });
    }

    // Map and send instantly (taking under 0.5ms!)
    const mappedResult = mapRow(matchedRow);
    return res.json({
      ok: true,
      data: mappedResult
    });

  } catch (error: any) {
    console.error("Error in server search processing:", error);
    return res.status(500).json({
      ok: false,
      message: `সার্ভার সংযোগে সমস্যা হয়েছে: ${error.message || error}`
    });
  }
}
