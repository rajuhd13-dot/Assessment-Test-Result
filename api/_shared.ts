import path from "path";
import fs from "fs";
import os from "os";

// Column mappings (1-based index)
export const COL = {
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
export interface SyncCache {
  data: any[][];
  lastSynced: number;
}

export const globalSyncCache = new Map<string, SyncCache>();
export const inProgressSyncs = new Set<string>();

// High reliability cross-platform temp directories
export const CACHE_FILE_PATH = path.join(os.tmpdir(), "db_cache.json");

export function saveCacheToDisk() {
  try {
    const obj: Record<string, SyncCache> = {};
    for (const [key, value] of globalSyncCache.entries()) {
      obj[key] = value;
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(obj, null, 2), "utf-8");
    console.log(`[VERCEL DISK CACHE] Cache successfully persisted to ${CACHE_FILE_PATH}`);
  } catch (err: any) {
    console.error("[VERCEL DISK CACHE WRITE ERROR] Could not persist cache:", err.message);
  }
}

export function loadCacheFromDisk() {
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
        console.log(`[VERCEL DISK CACHE] Successfully loaded cached database for ${count} endpoints from ${CACHE_FILE_PATH}`);
      }
    }
  } catch (err: any) {
    console.error("[VERCEL DISK CACHE READ ERROR] Could not load cache:", err.message);
  }
}

export async function triggerBackgroundSync(finalScriptUrlStr: string): Promise<any[][]> {
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

export function diagnoseHtmlResponse(html: string): string {
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
  
  return "অ্যাপস স্ক্রিপ্ট থেকে আনএক্সপেক্টেড HTML চলে এসেছে। অনুগ্রহ করে নিশ্চিত করুন যে আপনার গুগল শীটের কোডটি ঠিকভাবে পাবলিশ করা হয়েছে এবং 'Anyone' হিসেবে সচল এক্সেস রয়েছে।";
}

export function extractNum(v: any): number {
  const m = String(v || '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export function fmtBatch(v: any): string {
  const vStr = String(v || '').trim();
  return /^\d{2}$/.test(vStr) ? '20' + vStr : vStr;
}

export function parseScore(v: any): number | null {
  const vStr = String(v || '').trim();
  if (!vStr) return null;

  const fm = vStr.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+/);
  if (fm) return Number(fm[1]);

  const m = vStr.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function mkAs(name: string, pct: any, set: any, date: any, pass: number) {
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

export function parseRemarkCell(raw: any, rmNum: number, byLineFromCol: any, dateLineFromCol: any) {
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

export function mapRow(row: any[]) {
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
