import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Column mappings (1-based index)
const COL = {
  NICK_NAME: 2,
  TPIN: 4,
  INST: 5,
  DEPT: 6,
  HSC_BATCH: 7,
  RM: 8,
  MOBILE_1: 10,
  MOBILE_2: 11,
  MOBILE_BANKING: 12,
  RUNNING_PROGRAM: 16,
  PREVIOUS_PROGRAM: 17,
  EMAIL: 22,
  TEAMS_ID: 23,
  HSC_ROLL: 28,
  HSC_REG: 29,
  HSC_BOARD: 30,
  HSC_GPA: 31,
  SUBJECT_1: 34,
  SUBJECT_2: 35,
  SUBJECT_3: 36,
  SUBJECT_4: 37,
  SUBJECT_5: 38,
  VERSION_INTERESTED: 39,
  FULL_NAME: 43,
  RELIGION: 45,
  GENDER: 46,
  DATE_OF_BIRTH: 47,
  FATHERS_NAME: 52,
  MOTHERS_NAME: 56,
  HOME_DISTRICT: 61,
  ENGLISH_PCT: 62,
  ENGLISH_SET: 63,
  ENGLISH_DATE: 64,
  BANGLA_PCT: 65,
  BANGLA_SET: 66,
  BANGLA_DATE: 67,
  PHYSICS_PCT: 68,
  PHYSICS_SET: 69,
  PHYSICS_DATE: 70,
  CHEMISTRY_PCT: 71,
  CHEMISTRY_SET: 72,
  CHEMISTRY_DATE: 73,
  MATH_PCT: 74,
  MATH_SET: 75,
  MATH_DATE: 76,
  BIOLOGY_PCT: 77,
  BIOLOGY_SET: 78,
  BIOLOGY_DATE: 79,
  ICT_PCT: 80,
  ICT_SET: 81,
  ICT_DATE: 82,
  TRAINING_REPORT: 83,
  TRAINING_DATE: 84,
  ID_CHECKED: 86,
  FORM_FILL_DATE: 88,
  PHYSICAL_CAMPUS_PREF: 89,
  SELECTED_SUBJECT: 92,
  REMARK_COMMENT: 93,
  REMARK_COUNT: 94,
  REMARK_BY: 95,
  REMARK_DATE: 96
};

// Global memory sync cache structure
interface SyncCache {
  data: any[][];
  lastSynced: number;
}
const globalSyncCache = new Map<string, SyncCache>();
const inProgressSyncs = new Set<string>();

const CACHE_FILE_PATH = path.join(process.cwd(), "db_cache.json");

function saveCacheToDisk() {
  try {
    const obj: Record<string, SyncCache> = {};
    for (const [key, value] of globalSyncCache.entries()) {
      obj[key] = value;
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(obj, null, 2), "utf-8");
    console.log("[DISK CACHE] Cache successfully persisted to disk.");
  } catch (err: any) {
    console.error("[DISK CACHE WRITE ERROR] Could not persist cache:", err.message);
  }
}

function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const content = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
      if (content.trim()) {
        const obj = JSON.parse(content);
        let count = 0;
        for (const key of Object.keys(obj)) {
          globalSyncCache.set(key, obj[key]);
          count++;
        }
        console.log(`[DISK CACHE] Successfully loaded cached database for ${count} endpoints on startup.`);
      }
    }
  } catch (err: any) {
    console.error("[DISK CACHE READ ERROR] Could not load cache on startup:", err.message);
  }
}

async function triggerBackgroundSync(finalScriptUrlStr: string): Promise<any[][]> {
  if (inProgressSyncs.has(finalScriptUrlStr)) {
    console.log(`[CONCURRENCY BLOCKED] Sync already in-progress for ${finalScriptUrlStr}`);
    const cached = globalSyncCache.get(finalScriptUrlStr);
    return cached ? cached.data : [];
  }

  inProgressSyncs.add(finalScriptUrlStr);
  console.log(`[BACKGROUND SYNC] Fetching entire sheet database from Web App URL: ${finalScriptUrlStr}`);

  try {
    const targetUrl = new URL(finalScriptUrlStr);
    targetUrl.searchParams.set("action", "sync");
    
    const response = await fetch(targetUrl.toString(), {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Sync action responded with status code ${response.status}`);
    }

    const text = await response.text();
    const trimmed = text.trim();
    
    if (trimmed.startsWith("<") || trimmed.toLowerCase().includes("<!doctype")) {
      const failureCause = diagnoseHtmlResponse(trimmed);
      throw new Error(failureCause);
    }

    const resultObj = JSON.parse(trimmed);
    if (!resultObj.ok || !Array.isArray(resultObj.data)) {
      throw new Error(resultObj.message || "Invalid payload format.");
    }

    globalSyncCache.set(finalScriptUrlStr, {
      data: resultObj.data,
      lastSynced: Date.now()
    });
    saveCacheToDisk();

    console.log(`[BACKGROUND SYNC SUCCESS] Cache updated for ${finalScriptUrlStr}. Rows: ${resultObj.data.length}`);
    return resultObj.data;
  } catch (err: any) {
    console.error(`[BACKGROUND SYNC ERROR] Failed to sync ${finalScriptUrlStr}:`, err.message || err);
    throw err;
  } finally {
    inProgressSyncs.delete(finalScriptUrlStr);
  }
}

// Diagnose what Google's returned HTML page signifies (e.g. login walls, missing permissions)
function diagnoseHtmlResponse(html: string): string {
  const htmlLower = html.toLowerCase();
  
  if (htmlLower.includes("accounts.google.com") || htmlLower.includes("sign-in") || htmlLower.includes("signin") || htmlLower.includes("sign in") || htmlLower.includes("service login")) {
    return "গুগল সাইন-ইন রিকোয়েস্ট সনাক্ত করা হয়েছে। অনুগ্রহ করে নিশ্চিত করুন আপনার Google Sheets এর Apps Script 'Deploy' বা 'Manage Deployments' সাবমিট করার সময় [Who has access] অপশনটি অবশ্যই 'Anyone' সেট করেছেন (গুগল অ্যাকাউন্টে লগইন থাকা বাধ্যতামূলক নয়)।";
  }
  
  if (htmlLower.includes("authorization required") || htmlLower.includes("unauthorized") || htmlLower.includes("permission") || htmlLower.includes("need permission")) {
    return "অনুমোদন বা পারমিশন (Authorization) লক করা রয়েছে। আপনার Google Sheets-এর Apps Script এডিটরে প্রবেশ করে doGet বা অন্য কোনো ফাংশন অন্তত একবার টেস্ট রান (Run) করুন এবং আপনার গুগল অ্যাকাউন্ট থেকে শীটটি রিড-রাইট করার ড্রাইভ সিকিউরিটি পারমিশন কনফার্ম করুন।";
  }
  
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const titleVal = titleMatch[1].trim();
    if (htmlLower.includes("script error") || titleVal.includes("Error") || titleVal.includes("ভুল")) {
      return `গুগল অ্যাপস স্ক্রিপ্ট একটি ইন্টারনাল স্ক্রিপ্ট এরর বা এক্সিপশনের সম্মুখীন হয়েছে [বার্তা: "${titleVal}"]. এটি সাধারণত স্প্রেডশীট আইডি ভুল হলে, ডিলিট হলে, অথবা শিটের নাম ভুল হলে ঘটে। অনুগ্রহ করে আপনার Spreadsheet ID ও Sheet Name চেক করুন।`;
    }
    return `গুগল অ্যাপস স্ক্রিপ্ট থেকে সঠিক JSON তথ্য না এসে একটি HTML ডকুমেন্ট রিটার্ন এসেছে যার শিরোনাম "${titleVal}"। 

সম্ভাব্য কারণ ও সমাধান:
১. আপনি কোড আপডেট করলেও অ্যাপস স্ক্রিপ্টে "New Deployment" বা নতুন সংস্করণ ডেপ্লয় করেননি। কোড পরিবর্তন করার পর অবশ্যই Google Apps Script এডিটরে "Deploy" > "Manage Deployments" এ ক্লিক করে পেন্সিল আইকন চেপে "Version: New Version" সিলেক্ট করে পুনরায় deploy করুন।
২. আপনার গুগল শীটের স্ক্রিপ্টটি এখনো পুরানো বা ভুল HTML রেসপন্স রিটার্ন করছে। অনুগ্রহ করে আমাদের ওয়েবসাইটের ওপরে ডানদিকের Settings (API URL) বাটন থেকে সর্বশেষ স্ক্রিপ্ট কোডটি কপি করে আপনার Google Sheet এর Extensions > Apps Script ফাইলে সম্পূর্ণ রিপ্লেস করুন এবং Deploy করুন।
৩. ডেপ্লয়মেন্টের সময় এক্সেস লেভেল "Who has access: Anyone" সিলেক্ট করা হয়েছে কিনা তা নিশ্চিত করুন।`;
  }
  
  return "অ্যাপস স্ক্রিপ্ট থেকে আনএক্সপেক্টেড HTML চলে এসেছে। অনুগ্রহ করে নিশ্চিত করুন যে আপনার গুগল শিটের কোডটি ঠিকভাবে পাবলিশ করা হয়েছে এবং 'Anyone' হিসেবে সচল এক্সেস রয়েছে।";
}

// Helper functions for mapping raw data rows to structured schema
function extractNum(v: any): number {
  const m = String(v || '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function fmtBatch(v: any): string {
  const vStr = String(v || '').trim();
  return /^\d{2}$/.test(vStr) ? '20' + vStr : vStr;
}

function parseScore(v: any): number | null {
  const vStr = String(v || '').trim();
  if (!vStr) return null;

  const fm = vStr.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+/);
  if (fm) return Number(fm[1]);

  const m = vStr.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function mkAs(name: string, pct: any, set: any, date: any, pass: number) {
  const p = String(pct || '').trim();
  const s = String(set || '').trim();
  const d = String(date || '').trim();
  const sc = parseScore(p);

  const st = (p || s || d)
    ? ((sc !== null && sc >= pass) ? 'Allow' : 'Not Allow')
    : 'No Exam';

  return {
    subject: name + ' (%)',
    percent: p,
    set: s,
    date: d,
    status: st
  };
}

function parseRemarkCell(raw: any, rmNum: number, byLineFromCol: any, dateLineFromCol: any) {
  const rawStr = String(raw || '').trim();
  const byLineFromColStr = String(byLineFromCol || '').trim();
  const dateLineFromColStr = String(dateLineFromCol || '').trim();

  const show = (rmNum >= 4) || (rawStr.length > 0 && rmNum > 0);

  if (!show) {
    return {
      count: rmNum,
      show: false,
      body: '',
      byLine: '',
      dateLine: ''
    };
  }

  const lines = rawStr.replace(/\r/g, '').split('\n');
  const bodyLines: string[] = [];
  let byLine = byLineFromColStr;
  let dateLine = dateLineFromColStr;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.charAt(0) === '#') {
      byLine = line;
    } else if (/^date\s*:/i.test(line)) {
      dateLine = line;
    } else {
      bodyLines.push(line);
    }
  }

  let body = bodyLines.join('\n').trim();

  if (!body) {
    body =
      'সমস্যাঃ\n' +
      '** খাতা দেখার নিয়ম না মেনে খাতা দেখা।\n' +
      '** প্রিন্টিং কমেন্ট করা।\n' +
      '** কনসেপ্ট দুর্বল।\n' +
      '** একাধিকবার সুযোগ দেয়া সত্ত্বেও শুধরাতে পারেননি।';
  }

  return {
    count: rmNum,
    show: true,
    body: body,
    byLine: byLine,
    dateLine: dateLine
  };
}

function mapRow(row: any[]) {
  const g = (c: number) => {
    const val = row[c - 1];
    return val !== undefined && val !== null ? String(val).trim() : '';
  };

  const rmStr = g(COL.RM);
  const rmNum = extractNum(rmStr);
  const rmkRaw = g(COL.REMARK_COMMENT);
  const remark = parseRemarkCell(rmkRaw, rmNum, g(COL.REMARK_BY), g(COL.REMARK_DATE));

  return {
    quick: {
      tpin: g(COL.TPIN),
      rm: rmStr,
      nickName: g(COL.NICK_NAME),
      fullName: g(COL.FULL_NAME),
      mobile1: g(COL.MOBILE_1),
      mobile2: g(COL.MOBILE_2),
      nagadNumber: g(COL.MOBILE_BANKING),
      institute: g(COL.INST),
      department: g(COL.DEPT),
      hscGpa: g(COL.HSC_GPA),
      hscBatch: fmtBatch(g(COL.HSC_BATCH)),
      trainingReport: g(COL.TRAINING_REPORT),
      trainingDate: g(COL.TRAINING_DATE),
      physicalCampus: g(COL.PHYSICAL_CAMPUS_PREF)
    },

    assessments: [
      mkAs('English', g(COL.ENGLISH_PCT), g(COL.ENGLISH_SET), g(COL.ENGLISH_DATE), 60),
      mkAs('Bangla', g(COL.BANGLA_PCT), g(COL.BANGLA_SET), g(COL.BANGLA_DATE), 50),
      mkAs('Physics', g(COL.PHYSICS_PCT), g(COL.PHYSICS_SET), g(COL.PHYSICS_DATE), 50),
      mkAs('Chemistry', g(COL.CHEMISTRY_PCT), g(COL.CHEMISTRY_SET), g(COL.CHEMISTRY_DATE), 50),
      mkAs('Math', g(COL.MATH_PCT), g(COL.MATH_SET), g(COL.MATH_DATE), 50),
      mkAs('Biology', g(COL.BIOLOGY_PCT), g(COL.BIOLOGY_SET), g(COL.BIOLOGY_DATE), 50),
      mkAs('ICT', g(COL.ICT_PCT), g(COL.ICT_SET), g(COL.ICT_DATE), 50)
    ],

    remark: remark,

    personal: {
      fathersName: g(COL.FATHERS_NAME),
      mothersName: g(COL.MOTHERS_NAME),
      religion: g(COL.RELIGION),
      gender: g(COL.GENDER),
      dateOfBirth: g(COL.DATE_OF_BIRTH),
      hscRoll: g(COL.HSC_ROLL),
      hscReg: g(COL.HSC_REG),
      hscBoard: g(COL.HSC_BOARD),
      teamsId: g(COL.TEAMS_ID),
      email: g(COL.EMAIL),
      regDate: g(COL.FORM_FILL_DATE),
      homeDistrict: g(COL.HOME_DISTRICT),
      subjectsChoice: [
        g(COL.SUBJECT_1),
        g(COL.SUBJECT_2),
        g(COL.SUBJECT_3),
        g(COL.SUBJECT_4),
        g(COL.SUBJECT_5)
      ].filter(Boolean).join(', '),
      selectedSub: g(COL.SELECTED_SUBJECT),
      versionInterested: g(COL.VERSION_INTERESTED),
      idChecked: g(COL.ID_CHECKED),
      runningProgram: g(COL.RUNNING_PROGRAM),
      previousProgram: g(COL.PREVIOUS_PROGRAM)
    }
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Restore cache records from server disk instantly on start
  loadCacheFromDisk();

  // Webhook for immediate cache clearance on Google Sheet Edits
  app.get("/api/refresh", (req, res) => {
    console.log("[WEBHOOK] Refresh received via Google Sheet onEdit trigger.");
    if (globalSyncCache.size === 0) {
      let defaultUrl = process.env.APPS_SCRIPT_URL || "";
      if (!defaultUrl || defaultUrl.includes("YOUR_SCRIPT_ID") || !defaultUrl.includes("script.google.com")) {
        defaultUrl = "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
      }
      triggerBackgroundSync(defaultUrl).catch(() => {});
    } else {
      for (const [key, cache] of globalSyncCache.entries()) {
        cache.lastSynced = 0; // Mark stale so subsequent queries reload
        triggerBackgroundSync(key).catch(() => {}); // Re-preload in background instantly
      }
    }
    res.json({ ok: true, message: "Incremental cache revalidation triggered in background." });
  });

  // API Route for preloading data to guarantee 0.1-0.4 second response
  app.get("/api/preload", async (req, res) => {
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

      const cached = globalSyncCache.get(finalScriptUrlStr);
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        console.log(`[API PRELOAD] Serving hot cache warm check for ${finalScriptUrlStr}. Rows: ${cached.data.length}`);
        return res.json({ ok: true, cached: true, message: "Cache is already hot and responsive.", count: cached.data.length });
      }

      // Spawn background loading of database
      console.log(`[API PRELOAD] Spawning proactive fetch on server for ${finalScriptUrlStr}`);
      triggerBackgroundSync(finalScriptUrlStr)
        .then((data) => {
          console.log(`[API PRELOAD SUCCESS] Background preload warmed for ${finalScriptUrlStr}. Rows: ${data.length}`);
        })
        .catch((err) => {
          console.error(`[API PRELOAD WARNING] Preload failed for ${finalScriptUrlStr}:`, err.message || err);
        });

      return res.json({ ok: true, cached: false, message: "Background preload initiated gracefully." });
    } catch (err: any) {
      console.error("[API PRELOAD ERROR]", err);
      return res.json({ ok: false, message: err.message || err });
    }
  });

  // API Route for Searching Results (Ultra Fast Sync Implementation)
  app.get("/api/search", async (req, res) => {
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

      // Check the Cache
      let cached = globalSyncCache.get(finalScriptUrlStr);
      let rawRows: any[][] | null = null;

      // SWR (Stale-While-Revalidate) Cache Strategy
      const STALE_THRESHOLD = 30 * 1000; // 30 seconds threshold to trigger background refresh
      
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        rawRows = cached.data;
        const cacheAge = Date.now() - cached.lastSynced;
        
        if (cacheAge > STALE_THRESHOLD) {
          console.log(`[STALE CACHE HIT] Serving instant response. Cache age: ${Math.round(cacheAge / 1000)}s. Triggering background refresh.`);
          triggerBackgroundSync(finalScriptUrlStr).catch((err) => {
            console.error("[BACKGROUND SYNC ERROR]", err.message || err);
          });
        } else {
          console.log(`[FRESH CACHE HIT] Serving instant response from memory. Cache age: ${Math.round(cacheAge / 1000)}s.`);
        }
      } else {
        // Cache miss: must fetch synchronously of course
        console.log(`[CACHE MISS] No cached data found. Fetching synchronously from sheet database...`);
        try {
          rawRows = await triggerBackgroundSync(finalScriptUrlStr);
        } catch (syncErr: any) {
          console.error("Synchronous cache sync failed:", syncErr);
          
          // Old/Direct action=search Query Fallback
          console.log(`[FALLBACK TRYING] Testing old / direct action=search query for roll=${cleanRoll}, reg=${cleanReg}`);
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
                  console.log("[FALLBACK SUCCESS] Successfully retrieved data via direct query fallback.");
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
            console.error("Direct fallback query failed too:", fallbackErr);
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
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Proactively pre-fetch/cache Google Sheets sync database on startup
    let defaultUrl = process.env.APPS_SCRIPT_URL || "";
    if (!defaultUrl || defaultUrl.includes("YOUR_SCRIPT_ID") || !defaultUrl.includes("script.google.com")) {
      defaultUrl = "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
    }
    if (defaultUrl) {
      console.log("[PRE-FETCH] Dynamically preloading database records into fast cache...");
      triggerBackgroundSync(defaultUrl)
        .then((data) => {
          console.log(`[PRE-FETCH SUCCESS] Preloaded ${data.length} records into cache successfully!`);
        })
        .catch((err) => {
          console.warn("[PRE-FETCH WARNING] Automated database preload yielded:", err.message);
        });
    }
  });
}

startServer();
