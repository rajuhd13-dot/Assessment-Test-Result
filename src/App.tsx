import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  RotateCcw, 
  Printer, 
  Phone, 
  Bell, 
  Settings, 
  Info, 
  ExternalLink, 
  Check, 
  AlertTriangle, 
  HelpCircle,
  X,
  Copy,
  CheckCheck,
  FileText
} from "lucide-react";
import { SearchResult, SearchData } from "./types";
import { mapLocalRow } from "./clientMapping";

// Typewriter hook for placeholders
function useTypewriter(text: string, active: boolean) {
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    if (!active) {
      setPlaceholder(text);
      return;
    }
    
    let index = 0;
    let isDeleting = false;
    let timeoutId: any;

    const tick = () => {
      if (!isDeleting) {
        index++;
        if (index > text.length) {
          isDeleting = true;
          timeoutId = setTimeout(tick, 1500); // Wait on full word
          return;
        }
      } else {
        index--;
        if (index < 0) {
          isDeleting = false;
          timeoutId = setTimeout(tick, 500); // Wait on empty
          return;
        }
      }

      const cursor = index % 2 === 0 ? "|" : " ";
      setPlaceholder(text.substring(0, index) + cursor);
      timeoutId = setTimeout(tick, isDeleting ? 40 : 80);
    };

    timeoutId = setTimeout(tick, 300);
    return () => clearTimeout(timeoutId);
  }, [text, active]);

  return placeholder;
}

export default function App() {
  const [roll, setRoll] = useState("");
  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [result, setResult] = useState<SearchData | null>(null);

  // Help section states
  const [selectedCampus, setSelectedCampus] = useState("");
  const [helpMessage, setHelpMessage] = useState("");

  // System Configuration (Settings Modal)
  const [showSettings, setShowSettings] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(() => {
    const saved = localStorage.getItem("APPS_SCRIPT_URL");
    return saved || "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
  });
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [copiedSetting, setCopiedSetting] = useState(false);

  // Hidden Admin Configuration to hide settings button from general public
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("IS_ADMIN_MODE");
        if (saved === "true") return true;

        const params = new URLSearchParams(window.location.search);
        if (params.has("admin") || params.has("settings") || params.has("config")) {
          localStorage.setItem("IS_ADMIN_MODE", "true");
          return true;
        }
      }
    } catch (_) {}
    return false;
  });
  const [headerClicks, setHeaderClicks] = useState(0);

  const handleHeaderClick = () => {
    setHeaderClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setIsAdmin(true);
        localStorage.setItem("IS_ADMIN_MODE", "true");
        setShowSettings(true);
        return 0;
      }
      return next;
    });
  };

  // Local high-speed client-side database state
  const [clientDb, setClientDb] = useState<any[][] | null>(() => {
    try {
      const cached = localStorage.getItem("CLIENT_DB_CACHE");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("[INIT CACHE RESCUE] Instant database cache recovered in state lines:", parsed.length);
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not load client database cache:", e);
    }
    return null;
  });

  const syncClientDb = async (urlStr: string) => {
    try {
      let targetUrlStr = urlStr.trim();
      if (!targetUrlStr || targetUrlStr.includes("YOUR_SCRIPT_ID") || !targetUrlStr.includes("script.google.com")) {
        targetUrlStr = "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
      }

      const syncUrl = new URL(targetUrlStr);
      syncUrl.searchParams.set("action", "sync");

      console.log("[CLIENT INSTANT SYNC] Requesting sync action directly to browser:", syncUrl.toString());
      const response = await fetch(syncUrl.toString(), {
        method: "GET"
      });

      if (response.ok) {
        const rawText = await response.text();
        const trimmed = rawText.trim();
        if (trimmed && !trimmed.startsWith("<")) {
          const resultObj = JSON.parse(trimmed);
          if (resultObj && resultObj.ok && Array.isArray(resultObj.data)) {
            console.log("[CLIENT INSTANT SYNC SUCCESS] Loaded rows count in browser memory:", resultObj.data.length);
            setClientDb(resultObj.data);
            localStorage.setItem("CLIENT_DB_CACHE", JSON.stringify(resultObj.data));
            localStorage.setItem("CLIENT_DB_CACHE_LAST_SYNCED", String(Date.now()));
          }
        }
      }
    } catch (err) {
      console.warn("[CLIENT INSTANT SYNC FAIL] Direct browser fetch failed. Using existing local/Vercel API caches.", err);
    }
  };

  const triggerPreload = () => {
    const params = new URLSearchParams({
      scriptUrl: scriptUrl.trim()
    });
    fetch(`/api/preload?${params.toString()}`).catch(() => {});
    syncClientDb(scriptUrl).catch(() => {});
  };

  // Proactively warm up the database cache to make searching instantly fast (under 0.1s - 0.4s)
  useEffect(() => {
    triggerPreload();
    syncClientDb(scriptUrl);
  }, [scriptUrl]);

  // Typewriter effects for placeholders
  const rollFocus = useState(true)[0]; // Keep track if element focused (can override if manually typing)
  const rollPlaceholder = useTypewriter("Enter HSC Roll No here...", rollFocus && !roll);
  const regPlaceholder = useTypewriter("Enter HSC Reg No here...", rollFocus && !reg);
  const helpPlaceholder = useTypewriter("Type your message here...", rollFocus && !helpMessage);

  // Save Apps Script URL locally
  const saveSettings = (url: string) => {
    setScriptUrl(url);
    localStorage.setItem("APPS_SCRIPT_URL", url);
    setShowSettings(false);
    setStatusMessage({
      text: "গুগল অ্যাপস স্ক্রিপ্ট ইউআরএল সফলভাবে সংরক্ষণ করা হয়েছে।",
      type: "success"
    });
  };

  const diagnoseHtmlResponse = (html: string): string => {
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
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusMessage(null);

    const trimmedRoll = roll.trim();
    const trimmedReg = reg.trim();

    if (!trimmedRoll || !trimmedReg) {
      setStatusMessage({
        text: "HSC Roll No এবং Registration No দুটোই লিখুন।",
        type: "error"
      });
      return;
    }

    setLoading(true);

    try {
      // 0. High-Speed CLIENT-SIDE Instant Lookup (Matches instantly!)
      if (clientDb && clientDb.length > 0) {
        console.log("[CLIENT INSTANT LOOKUP] Searching in client cache:", trimmedRoll, trimmedReg);
        const HSC_ROLL_IDX = 28 - 1;
        const HSC_REG_IDX = 29 - 1;

        const matchedRow = clientDb.find((row) => {
          const rRoll = row[HSC_ROLL_IDX];
          const rReg = row[HSC_REG_IDX];
          return (
            rRoll !== undefined && rRoll !== null && String(rRoll).trim() === trimmedRoll &&
            rReg !== undefined && rReg !== null && String(rReg).trim() === trimmedReg
          );
        });

        if (matchedRow) {
          console.log("[CLIENT CACHE HIT] Result found instantly in 0.5ms!");
          const mapped = mapLocalRow(matchedRow);
          setResult(mapped);
          setStatusMessage(null);
          setLoading(false);
          // Trigger automatic silent cache revalidation in background
          syncClientDb(scriptUrl).catch(() => {});
          return;
        }
      }

      let data: SearchResult | null = null;
      let apiProxyFailed = false;

      // 1. Try to fetch from internal Express API proxy first (Works perfectly on our sandboxed system/Cloud Run custom server)
      try {
        const params = new URLSearchParams({
          roll: trimmedRoll,
          reg: trimmedReg,
          scriptUrl: scriptUrl.trim()
        });
        const response = await fetch(`/api/search?${params.toString()}`);
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            data = await response.json();
          } else {
            console.warn("[API PROXY] Non-JSON payload received. Node backend proxy not active or Vercel static router matching.");
            apiProxyFailed = true;
          }
        } else {
          apiProxyFailed = true;
        }
      } catch (proxyErr) {
        console.warn("[API PROXY FAILURE] Express proxy failed. Running client-side direct fallback...", proxyErr);
        apiProxyFailed = true;
      }

      // 2. Direct Fallback: Pure Client-Side Fetch (Crucial for Vercel Static deployment where Express /api/ is missing)
      if (apiProxyFailed || !data) {
        console.log("[FALLBACK ACTIVE] Querying Google Apps Script endpoint direct from browser.");
        let finalScriptUrlStr = scriptUrl.trim();
        if (!finalScriptUrlStr || finalScriptUrlStr.includes("YOUR_SCRIPT_ID") || !finalScriptUrlStr.includes("script.google.com")) {
          finalScriptUrlStr = "https://script.google.com/macros/s/AKfycbz-Ff2M_ntfcDSnCx-wnze_0TlmuS0OJ2TzBNwoo6ZalE_I0fSHm7z4PlGQGr6cIBb0Wg/exec";
        }

        const directUrl = new URL(finalScriptUrlStr);
        directUrl.searchParams.set("action", "search");
        directUrl.searchParams.set("roll", trimmedRoll);
        directUrl.searchParams.set("reg", trimmedReg);

        const response = await fetch(directUrl.toString(), {
          method: "GET"
        });

        if (!response.ok) {
          throw new Error(`Google Apps Script API responded with status code ${response.status}`);
        }

        const rawText = await response.text();
        const trimmedText = rawText.trim();

        if (trimmedText.startsWith("<") || trimmedText.toLowerCase().includes("<!doctype")) {
          // Received HTML instead of JSON
          const errorMsg = diagnoseHtmlResponse(trimmedText);
          setStatusMessage({
            text: errorMsg,
            type: "error"
          });
          setResult(null);
          return;
        }

        data = JSON.parse(trimmedText);
      }

      if (!data || !data.ok) {
        setResult(null);
        setStatusMessage({
          text: data?.message || "কোনো ফলাফল পাওয়া যায়নি। সঠিক নম্বর দিন।",
          type: "error"
        });
      } else if (data.data) {
        setResult(data.data);
        setStatusMessage(null);
      }
    } catch (err: any) {
      console.error("[CATCH SEARCH ERROR]", err);
      setResult(null);
      
      const errorStr = String(err.message || err);
      if (errorStr.includes("Failed to fetch")) {
        setStatusMessage({
          text: "বাউজার সরাসরি গুগল এপিআই কল করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার নেটওয়ার্ক সংযোগ যাচাই করুন অথবা নিশ্চিত করুন যে আপনার Apps Script এক্সেস 'Anyone' দিয়ে সচল আছে।",
          type: "error"
        });
      } else {
        setStatusMessage({
          text: `সার্ভার সংযোগে ব্যর্থতা: ${errorStr}`,
          type: "error"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setStatusMessage(null);
    setRoll("");
    setReg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const sendWhatsApp = () => {
    if (!selectedCampus) {
      alert("Campus select করুন।");
      return;
    }
    if (!helpMessage.trim()) {
      alert("Message লিখুন।");
      return;
    }

    const phoneMap: Record<string, string> = {
      "Farmgate ESM": "8801700000000",
      "Motijheel ESM": "8801700000000",
      "Bakshibazar ESM": "8801700000000",
      "Cantonment ESM": "8801700000000",
      "Khulna ESM": "8801700000000",
      "Rajshahi ESM": "8801700000000",
      "Oxygen Moor(ctg) ESM": "8801700000000"
    };

    const phone = phoneMap[selectedCampus];
    const encodedMsg = encodeURIComponent(helpMessage.trim());
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`);
  };

  const copyAppsScriptCode = () => {
    const activeOrigin = window.location.origin || "https://ais-dev-ddmcf52xgr6udwnqohb35b-192410877328.asia-southeast1.run.app";
    const rawCode = `var CONFIG = {
  SPREADSHEET_ID:  '1R_O4llA1K43Y97GAgkK97WMvWbqg-tftz_FXpcUSZPU',
  SHEET_NAME:      'Examiner Information',
  DATA_START_ROW:  2,
  TOTAL_COLS:      96
};

var COL = {
  NICK_NAME:2, TPIN:4, INST:5, DEPT:6, HSC_BATCH:7, RM:8,
  MOBILE_1:10, MOBILE_2:11, MOBILE_BANKING:12,
  RUNNING_PROGRAM:16, PREVIOUS_PROGRAM:17,
  EMAIL:22, TEAMS_ID:23,
  HSC_ROLL:28, HSC_REG:29, HSC_BOARD:30, HSC_GPA:31,
  SUBJECT_1:34, SUBJECT_2:35, SUBJECT_3:36, SUBJECT_4:37, SUBJECT_5:38,
  VERSION_INTERESTED:39,
  FULL_NAME:43, RELIGION:45, GENDER:46, DATE_OF_BIRTH:47,
  FATHERS_NAME:52, MOTHERS_NAME:56, HOME_DISTRICT:61,
  ENGLISH_PCT:62, ENGLISH_SET:63, ENGLISH_DATE:64,
  BANGLA_PCT:65, BANGLA_SET:66, BANGLA_DATE:67,
  PHYSICS_PCT:68, PHYSICS_SET:69, PHYSICS_DATE:70,
  CHEMISTRY_PCT:71, CHEMISTRY_SET:72, CHEMISTRY_DATE:73,
  MATH_PCT:74, MATH_SET:75, MATH_DATE:76,
  BIOLOGY_PCT:77, BIOLOGY_SET:78, BIOLOGY_DATE:79,
  ICT_PCT:80, ICT_SET:81, ICT_DATE:82,
  TRAINING_REPORT:83, TRAINING_DATE:84,
  ID_CHECKED:86, FORM_FILL_DATE:88, PHYSICAL_CAMPUS_PREF:89,
  SELECTED_SUBJECT:92,
  REMARK_COMMENT:93,
  REMARK_COUNT:94, REMARK_TEXT:94, REMARK_BY:95, REMARK_DATE:96
};

function getSheet() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {}
  if (!ss && CONFIG.SPREADSHEET_ID) {
    try {
      ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } catch (err) {}
  }
  if (!ss) {
    throw new Error('Spreadsheet not found. Please bind this script to your Google Sheet or configure CONFIG.SPREADSHEET_ID in Code.gs.');
  }
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  if (!sheet) {
    throw new Error('No sheet found inside your spreadsheet.');
  }
  return sheet;
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'sync') {
      return ContentService.createTextOutput(JSON.stringify(syncAllData()))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e && e.parameter && e.parameter.q) {
      var result = searchExaminer(e.parameter.q);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e && e.parameter && e.parameter.action === 'search') {
      var rollQuery = e.parameter.roll;
      var regQuery = e.parameter.reg;
      var res = searchByHscRollReg(rollQuery, regQuery);
      return ContentService.createTextOutput(JSON.stringify(res))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'No query provided.' }))
        .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'Script Error: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var params = JSON.parse(e.postData.contents);
    if (params.action === 'update') {
      return ContentService.createTextOutput(JSON.stringify(updateRow(params.tpin, params.updates)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'Update Error: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function updateRow(tpin, updates) {
  if (!tpin) return { ok: false, message: 'TPIN required' };
  
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  if (lastRow < CONFIG.DATA_START_ROW) return { ok: false, message: 'No data found in sheet' };
  
  var tpinData = sheet.getRange(CONFIG.DATA_START_ROW, COL.TPIN, lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
  
  var rowIdx = -1;
  for (var i = 0; i < tpinData.length; i++) {
    if (String(tpinData[i][0]).trim() === String(tpin).trim()) {
      rowIdx = i + CONFIG.DATA_START_ROW;
      break;
    }
  }
  
  if (rowIdx === -1) return { ok: false, message: 'Examiner with TPIN ' + tpin + ' not found' };
  
  var rowRange = sheet.getRange(rowIdx, 1, 1, lastCol);
  var rowValues = rowRange.getValues();
  var row = rowValues[0];
  
  var changed = false;
  for (var key in updates) {
    if (COL[key]) {
      var colIdx = COL[key] - 1;
      if (colIdx < lastCol) {
        row[colIdx] = updates[key];
        changed = true;
      }
    }
  }
  
  if (changed) {
    rowRange.setValues([row]);
  }
  
  return { ok: true, message: 'Updated successfully' };
}

function syncAllData() {
  var sheet = getSheet();
  
  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return { ok: true, data: [] };
  
  var data = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, CONFIG.TOTAL_COLS).getValues();
  
  var filtered = data.filter(function(row) {
    return row[COL.TPIN-1] || row[COL.MOBILE_1-1] || row[COL.MOBILE_2-1];
  });
  
  return { ok: true, data: filtered };
}

function searchByHscRollReg(rollQuery, regQuery) {
  try {
    rollQuery = String(rollQuery || '').trim();
    regQuery = String(regQuery || '').trim();

    if (!rollQuery || !regQuery) {
      return { ok: false, message: 'HSC Roll No এবং Registration No দুটোই দিন।' };
    }

    var sheet = getSheet();
    var lastRow = sheet.getLastRow();

    if (lastRow < CONFIG.DATA_START_ROW) {
      return { ok: false, message: 'No data found.' };
    }

    var numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    var numColsToFetch = COL.HSC_REG - COL.HSC_ROLL + 1;
    var rollRegValues = sheet
      .getRange(CONFIG.DATA_START_ROW, COL.HSC_ROLL, numRows, numColsToFetch)
      .getDisplayValues();

    var foundRow = -1;
    for (var i = 0; i < numRows; i++) {
      var roll = String(rollRegValues[i][0] || '').trim();
      var reg = String(rollRegValues[i][1] || '').trim();

      if (roll === rollQuery && reg === regQuery) {
        foundRow = i + CONFIG.DATA_START_ROW;
        break;
      }
    }

    if (foundRow === -1) {
      return { ok: false, message: 'Roll ও Registration নম্বর মিলছে না। সঠিক নম্বর দিন।' };
    }

    var rowData = sheet.getRange(foundRow, 1, 1, CONFIG.TOTAL_COLS).getDisplayValues()[0];
    return { ok: true, data: mapRow_(rowData) };

  } catch (err) {
    return { ok: false, message: 'Script Error: ' + err.message };
  }
}

function norm_(v) {
  v = String(v || '').trim();
  if (!v) return '';
  var d = v.replace(/\\D/g, '');
  if (d) {
    if (d.length >= 12 && d.slice(0,3) === '880') return d;
    if (d[0] === '0' && d.length === 11) return '88' + d;
    if (d[0] === '1' && d.length === 10) return '880' + d;
    return d;
  }
  return v.toUpperCase();
}

function searchExaminer(query) {
  query = String(query || '').trim();
  if (!query) return { ok: false, message: 'Search value is empty.' };

  var key = norm_(query);
  if (!key) return { ok: false, message: 'Invalid search key.' };

  var sheet = getSheet();

  var searchValues = [query, key];
  if (key.startsWith('880') && key.length === 13) {
    searchValues.push(key.substring(2));
  }

  var foundRow = -1;
  for (var i = 0; i < searchValues.length; i++) {
    var val = searchValues[i];
    var finder = sheet.createTextFinder(val).matchEntireCell(false).findAll();
    
    for (var j = 0; j < finder.length; j++) {
      var cell = finder[j];
      var r = cell.getRow();
      var c = cell.getColumn();
      
      if (r >= CONFIG.DATA_START_ROW && (c === COL.TPIN || c === COL.MOBILE_1 || c === COL.MOBILE_2)) {
        var cellValue = norm_(cell.getDisplayValue());
        if (cellValue === key) {
          foundRow = r;
          break;
        }
      }
    }
    if (foundRow !== -1) break;
  }

  if (foundRow === -1) {
    return { ok: false, message: 'No examiner found.' };
  }

  var rowData = sheet.getRange(foundRow, 1, 1, CONFIG.TOTAL_COLS).getDisplayValues()[0];
  var mappedData = mapRow_(rowData);
  return { ok: true, data: mappedData };
}

function mapRow_(row) {
  var g = function(c) { return row[c - 1] || ''; };
  var rm = String(g(COL.RM)).trim();
  var rmNum = extractNum_(rm);
  var remarkRaw = String(g(COL.REMARK_COMMENT)).trim();
  var parsedRemark = parseRemarkCell_(remarkRaw, rmNum);

  return {
    quick: {
      tpin: g(COL.TPIN), rm: rm, nickName: g(COL.NICK_NAME),
      fullName: g(COL.FULL_NAME), mobile1: g(COL.MOBILE_1), mobile2: g(COL.MOBILE_2),
      nagadNumber: g(COL.MOBILE_BANKING), institute: g(COL.INST), department: g(COL.DEPT),
      hscGpa: g(COL.HSC_GPA), hscBatch: fmtBatch_(g(COL.HSC_BATCH)),
      trainingReport: g(COL.TRAINING_REPORT), trainingDate: g(COL.TRAINING_DATE),
      physicalCampus: g(COL.PHYSICAL_CAMPUS_PREF)
    },
    assessments: [
      mkAs_('English',   g(COL.ENGLISH_PCT),   g(COL.ENGLISH_SET),   g(COL.ENGLISH_DATE),   60),
      mkAs_('Bangla',    g(COL.BANGLA_PCT),     g(COL.BANGLA_SET),    g(COL.BANGLA_DATE),    50),
      mkAs_('Physics',   g(COL.PHYSICS_PCT),    g(COL.PHYSICS_SET),   g(COL.PHYSICS_DATE),   50),
      mkAs_('Chemistry', g(COL.CHEMISTRY_PCT),  g(COL.CHEMISTRY_SET), g(COL.CHEMISTRY_DATE), 50),
      mkAs_('Math',      g(COL.MATH_PCT),       g(COL.MATH_SET),      g(COL.MATH_DATE),      50),
      mkAs_('Biology',   g(COL.BIOLOGY_PCT),    g(COL.BIOLOGY_SET),   g(COL.BIOLOGY_DATE),   50),
      mkAs_('ICT',       g(COL.ICT_PCT),        g(COL.ICT_SET),       g(COL.ICT_DATE),       50)
    ],
    remark: parsedRemark,
    personal: {
      fathersName: g(COL.FATHERS_NAME), mothersName: g(COL.MOTHERS_NAME),
      religion: g(COL.RELIGION), gender: g(COL.GENDER), dateOfBirth: g(COL.DATE_OF_BIRTH),
      hscRoll: g(COL.HSC_ROLL), hscReg: g(COL.HSC_REG), teamsId: g(COL.TEAMS_ID),
      hscBoard: g(COL.HSC_BOARD), email: g(COL.EMAIL), regDate: g(COL.FORM_FILL_DATE),
      homeDistrict: g(COL.HOME_DISTRICT),
      subjectsChoice: [g(COL.SUBJECT_1),g(COL.SUBJECT_2),g(COL.SUBJECT_3),g(COL.SUBJECT_4),g(COL.SUBJECT_5)].filter(Boolean).join(', '),
      selectedSub: g(COL.SELECTED_SUBJECT), versionInterested: g(COL.VERSION_INTERESTED),
      idChecked: g(COL.ID_CHECKED), runningProgram: g(COL.RUNNING_PROGRAM),
      previousProgram: g(COL.PREVIOUS_PROGRAM)
    }
  };
}

function parseRemarkCell_(raw, rmNum) {
  var show = (rmNum >= 4) || (raw.length > 0 && rmNum > 0);
  if (!show || !raw) return { count: rmNum, show: false, body: '', byLine: '', dateLine: '' };

  var lines = raw.replace(/\\r/g, '').split('\\n');
  var bodyLines = [], byLine = '', dateLine = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (line.charAt(0) === '#') byLine = line;
    else if (/^date\\s*:/i.test(line)) dateLine = line;
    else bodyLines.push(line);
  }

  var body = bodyLines.join('\\n').trim();
  if (!body) body = 'সমস্যাঃ\\n** খাতা দেখার নিয়ম না মেনে খাতা দেখা।\\n** প্রিন্টিং কমেন্ট করা।\\n** কনসেপ্ট দুর্বল।\\n** একাধিকবার সুযোগ দেয়া সত্ত্বেও শুধরাতে পারেননি।';

  return { count: rmNum, show: true, body: body, byLine: byLine, dateLine: dateLine };
}

function mkAs_(name, pct, set, date, pass) {
  var p = String(pct||'').trim(), s = String(set||'').trim(), d = String(date||'').trim();
  var sc = parseScore_(p);
  var st = (p||s||d) ? ((sc !== null && sc >= pass) ? 'Allow' : 'Not Allow') : 'No Exam';
  return { subject: name + ' (%)', percent: p, set: s, date: d, status: st };
}

function parseScore_(v) {
  v = String(v||'').trim();
  if (!v) return null;
  var fm = v.match(/(\\d+(?:\\.\\d+)?)\\s*\\/\\s*\\d+/);
  if (fm) return Number(fm[1]);
  var m = v.match(/-?\\d+(?:\\.\\d+)?/);
  return m ? Number(m[0]) : null;
}

function extractNum_(v) {
  var m = String(v||'').match(/\\d+/);
  return m ? Number(m[0]) : 0;
}

function fmtBatch_(v) {
  v = String(v||'').trim();
  return /^\\d{2}$/.test(v) ? '20' + v : v;
}

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() === CONFIG.SHEET_NAME) {
     var tpin = sheet.getRange(e.range.getRow(), COL.TPIN).getValue();
     UrlFetchApp.fetch('${activeOrigin}/api/refresh?tpin=' + tpin, {
       'method': 'get',
       'muteHttpExceptions': true
     });
  }
}`;
    navigator.clipboard.writeText(rawCode).then(() => {
      setCopiedSetting(true);
      setTimeout(() => setCopiedSetting(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-6 transition-all print:p-0 print:bg-white selection:bg-blue-100 selection:text-blue-900">
      
      {/* Settings Panel & Toggle Button (Shown ONLY in Admin Mode) */}
      {isAdmin && (
        <div className="fixed top-4 right-4 z-40 print:hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 bg-white/90 hover:bg-white backdrop-blur border border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm transition-all rounded-full px-3.5 py-1.5 text-sm font-semibold cursor-pointer animate-pulse-once"
          >
            <Settings className="w-4 h-4 animate-spin-hover text-indigo-600" />
            <span className="text-slate-800">Settings (API URL)</span>
          </button>
        </div>
      )}

      {/* Settings Modal Dialog */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-150"
            >
              <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-lg font-display">System Settings</h3>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Google Apps Script Web App URL
                  </label>
                  <input
                    type="text"
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="w-full font-mono text-xs border border-slate-250 bg-slate-50 rounded-xl"
                  />
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    আপনার Google Sheet থেকে ডাটা নেওয়ার জন্য Google Apps Script ওয়েব অ্যাপ তৈরি করে তার URL এখানে সংযুক্ত করুন।
                    যদি সার্ভারের <code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-red-600">APPS_SCRIPT_URL</code> এনভায়রনমেন্ট ভ্যারিয়েবল সেট করা থাকে, তবে সেটিই প্রথম গুরুত্ব পাবে।
                  </p>
                </div>

                <div className="border-t border-slate-150 pt-4 space-y-3.5">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1">
                    <FileText className="w-4.5 h-4.5 text-emerald-500" />
                    Google Apps Script Code (Code.gs) & Deployment Steps
                  </h4>
                  
                  {/* Troubleshooting Alert Box */}
                  <div className="bg-amber-50/80 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-xs space-y-1.5 leading-relaxed">
                    <p className="font-bold text-amber-800 flex items-center gap-1">
                      ⚠️ <b>HTML Document Error বা ধীরগতির সমাধানঃ</b>
                    </p>
                    <p>
                      যদি "HTML ডকুমেন্ট রিটার্ন এসেছে যার শিরোনাম Assessment Test Result" এরর দেখতে পান, তার মানে আপনার শীটের গুগল এডিটরে পুরানো কোড চলছে অথবা নতুন কোডটি সঠিক নিয়মে গুগল সার্ভারে ডেপ্লয় করা হয়নি। ১ মিনিটে সমাধান করার নিয়মঃ
                    </p>
                    <ol className="list-decimal pl-4.5 space-y-1 text-[11px] text-slate-800">
                      <li>নিচের সবুজ <b>Copy Apps Script API Code</b> বাটনে ক্লিক করে সর্বশেষ আপডেট করা কোডটি কপি করুন।</li>
                      <li>আপনার Google Sheet-এ গিয়ে ওপরে <b>Extensions</b> &gt; <b>Apps Script</b>-এ ক্লিক করে স্ক্রিপ্ট এডিটরটি খুলুন।</li>
                      <li>এডিটরে থাকা আগের পুরোনো সব কোড সম্পূর্ণ মুছে দিয়ে এই নতুন কোডটি পেস্ট করুন এবং ওপরে <b>Save</b> আইকন চাপুন।</li>
                      <li>স্ক্রিপ্ট উইন্ডোর ওপরে ডানদিকে <b>Deploy</b> বাটন চেপে <b>Manage Deployments</b> এ ক্লিক করুন।</li>
                      <li>সক্রিয় ওয়েব অ্যাপটির ডানপাশে <b>পেন্সিল (Edit) আইকন</b> এ ক্লিক করুন।</li>
                      <li><b>Version</b> ড্রপডাউন থেকে অবশ্যই <b>New version</b> সিলেক্ট করুন। (এটি সবচেয়ে জরুরি ধাপ!)</li>
                      <li>নিচে এক্সেস অপশন <b>Who has access: Anyone</b> সিলেক্ট আছে কিনা তা নিশ্চিত করে <b>Deploy</b> বাটনে চাপুন।</li>
                    </ol>
                  </div>

                  <p className="text-xs text-slate-500">
                    নিচের বাটনটি ক্লিক করে ডাটা সিঙ্ক ও ৩ সেকেন্ডের পরিবর্তে ০.১ সেকেন্ডে গতিশীল গতি পাওয়ার জন্য কোডটি কপি করে নিনঃ
                  </p>
                  <button
                    onClick={copyAppsScriptCode}
                    className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                  >
                    {copiedSetting ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5" />
                        Copied Successfully!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Apps Script API Code
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl border border-slate-200 text-sm cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => saveSettings(scriptUrl)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition cursor-pointer"
                >
                  Save URL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-[1220px] mx-auto bg-white shadow-xl rounded-2xl overflow-hidden my-4 md:my-6 print:shadow-none print:my-0 print:bg-white">
        
        {/* Top Hero Heading */}
        <header className="py-5 px-6 text-center text-white bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/20 pointer-events-none" />
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10"
          >
            <h1 
              onClick={handleHeaderClick}
              className="text-2xl md:text-3xl font-black tracking-tight mb-1 drop-shadow-md font-display cursor-default select-none active:scale-98 transition-transform"
              title="Assessment Test Result"
            >
              Assessment Test Result
            </h1>
            <p className="text-xs md:text-sm font-medium opacity-90 max-w-xl mx-auto">
              HSC Roll No এবং Registration No দিয়ে আপনার মূল্যায়ন ফলাফল দেখুন
            </p>
          </motion.div>
        </header>

        {/* Notice strip below hero */}
        <div className="mx-4 md:mx-6 mt-4 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-center text-xs md:text-sm font-bold shadow-xs flex items-center justify-center gap-1.5 print:hidden">
          <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce shrink-0" />
          <span>বি.দ্র.: মূল্যায়ন পরীক্ষা দেওয়ার পর ১ সপ্তাহের মধ্যে ফলাফল আপডেট করা হয়।</span>
        </div>

        {/* Main Form/Grid */}
        <main className="p-4 md:p-6 space-y-4.5">
          
          <AnimatePresence mode="wait">
            {!result ? (
              
              /* Search Screen Card */
              <motion.section
                key="search-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 md:p-6"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-base shadow-inner">
                    🎓
                  </div>
                  <h2 className="text-lg md:text-xl font-black text-slate-800 font-display">
                    Result Verification
                  </h2>
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* HSC Roll Input */}
                    <div className="space-y-1 animate-relative">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                        HSC Roll No
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          ✦
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={roll}
                          onChange={(e) => setRoll(e.target.value)}
                          onFocus={triggerPreload}
                          placeholder={rollPlaceholder}
                          className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white pl-8 pr-3.5 py-2 border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-slate-800 text-sm font-bold"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    {/* HSC Reg Input */}
                    <div className="space-y-1 animate-relative">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                        HSC Reg No
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          ✦
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={reg}
                          onChange={(e) => setReg(e.target.value)}
                          onFocus={triggerPreload}
                          placeholder={regPlaceholder}
                          className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white pl-8 pr-3.5 py-2 border border-slate-200 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-slate-800 text-sm font-bold"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-black py-2.5 rounded-xl shadow-md hover:shadow-lg hover:shadow-indigo-100 disabled:opacity-75 transition-all text-sm cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {loading ? "Searching Results..." : "Get Results"}
                  </button>
                </form>

                {/* API Warning if Script is Missing */}
                {!scriptUrl && (
                  <div className="mt-5 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-850 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">সতর্কতা:</span> গুগল অ্যাপস স্ক্রিপ্ট ইউআরএল এখনো সংযুক্ত করা হয়নি। ডাটা নিয়ে আসার জন্য ডান পাশের ওপরের <span className="font-bold underline cursor-pointer" onClick={() => setShowSettings(true)}>Settings</span> বাটন ব্যবহার করে আপনার স্ক্রিপ্ট লিঙ্ক সেট করে নিন।
                    </div>
                  </div>
                )}

                {/* Message display status */}
                <AnimatePresence>
                  {statusMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`mt-4 p-5 rounded-xl border ${
                        statusMessage.type === "error"
                          ? "bg-red-50 border-red-200 text-slate-800"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800"
                      }`}
                    >
                      <p className="font-bold text-sm mb-3 text-red-700">{statusMessage.text}</p>
                      
                      {/* Detailed guide if Apps Script returned HTML */}
                      {statusMessage.type === "error" && (
                        statusMessage.text.includes("HTML") || 
                        statusMessage.text.includes("গুগল") || 
                        statusMessage.text.includes("Apps Script") || 
                        statusMessage.text.includes("সিঙ্ক")
                      ) && (
                        <div className="bg-white/80 border border-red-100 rounded-lg p-4 mt-2 space-y-3.5 text-xs text-slate-700 leading-relaxed font-medium">
                          <p className="font-bold text-red-800 text-[13px] flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            সঠিকভাবে Deploy করার সমাধান ধাপসমূহ:
                          </p>
                          
                          <ol className="list-decimal pl-4 space-y-2.5 text-slate-600">
                            <li>
                              ওপেন করুন আপনার <strong className="text-slate-800 font-bold">Google Sheet</strong> &gt; ক্লিক করুন <strong className="text-slate-800 font-bold">Extensions</strong> &gt; <strong className="text-slate-800 font-bold">Apps Script</strong>।
                            </li>
                            <li>
                              নিশ্চিত হোন ডান পাশের ওপরের <strong className="text-blue-700 font-bold">Deploy</strong> বাটন ক্লিক করে <strong className="text-blue-700 font-bold">Manage Deployments</strong> অথবা <strong className="text-blue-700 font-bold">New Deployment</strong> নির্বাচন করেছেন।
                            </li>
                            <li>
                              <strong className="text-red-700 font-bold text-sm">গুরুত্বপূর্ণ:</strong> Configuration সেটিংসের অধীনে:
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 mt-1 space-y-1 text-[11px] font-semibold font-mono">
                                <div>• <strong>Execute as:</strong> "Me (your-email@gmail.com)" রাখুন।</div>
                                <div>• <strong>Who has access:</strong> এটিকে পরিবর্তন করে অবশ্যই <strong className="text-emerald-700">"Anyone"</strong> সেট করুন (ডিফল্টভাবে Only myself থাকে যার কারণে গুগল সাইন-ইন পেইজ HTML রিটার্ন করে)।</div>
                              </div>
                            </li>
                            <li>
                              ক্লিক করুন <strong className="text-slate-800 font-bold">Deploy</strong>। তারপর প্রাপ্ত <strong className="text-indigo-700 font-bold select-all font-mono">Web App URL (যার শেষে "/exec" থাকে)</strong> কপি করে নিন।
                            </li>
                            <li>
                              এই ওয়েবসাইটের ওপরে ডানদিকের <strong className="text-slate-800 font-bold">Settings</strong> বাটনে ক্লিক করে সেখানে নতুন কপি করা URL-টি সংরক্ষণ করুন।
                            </li>
                          </ol>

                          <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-[11px] text-red-800 font-normal">
                            <strong>Note:</strong> একবার Deployment তৈরি করার পর কোড এডিট করলে অবশ্যই আবার <strong>New Deployment</strong> তৈরি করতে হবে অথবা আগের deployment-টি <strong>Edit</strong> করে নতুন সংস্করণ (Version: New version) বানিয়ে Deploy করতে হবে।
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            ) : (
              
              /* Result Details Box */
              <motion.section
                key="result-details"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4.5"
              >
                {/* Search screen toggle header buttons */}
                <div className="flex justify-center items-center gap-2.5 py-0.5 print:hidden">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-xl shadow-xs transition-all text-xs cursor-pointer hover:-translate-y-0.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Search Again
                  </button>
                </div>

                {/* Profile Card Block */}
                <div className="bg-white border border-slate-250/80 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-slate-900 px-5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white">
                    <div>
                      <h2 className="text-lg font-black font-display text-white tracking-tight">
                        Examiner Quick Info
                      </h2>
                      <p className="text-[10px] text-slate-300 font-semibold">
                        Primary profile & eligibility snapshot
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-full text-xs md:text-[13px] font-bold text-slate-200 flex items-center select-all">
                        T-Pin: <b className="text-amber-400 font-black ml-2 font-mono text-sm md:text-base">{result.quick.tpin || "—"}</b>
                      </span>
                      <span className="bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-full text-xs md:text-[13px] font-bold text-slate-200 flex items-center select-all">
                        RM: <b className="text-teal-400 font-black ml-2 font-mono text-sm md:text-base">{result.quick.rm || "—"}</b>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-slate-100 md:divide-y-0">
                    
                    {/* Left profile grid fields */}
                    <div className="divide-y divide-slate-100">
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Nick Name</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.quick.nickName || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Full Name</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.quick.fullName || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Mobile 1</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all font-mono">{result.quick.mobile1 || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Mobile 2</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all font-mono">{result.quick.mobile2 || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Nagad Number</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all font-mono">{result.quick.nagadNumber || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">HSC GPA</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all font-mono text-blue-600">{result.quick.hscGpa || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">HSC Batch</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all font-mono">{result.quick.hscBatch || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Religion</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.personal.religion || "—"}</b>
                      </div>
                    </div>

                    {/* Right profile grid fields */}
                    <div className="divide-y divide-slate-100 md:border-l md:border-slate-100">
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Institute</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.quick.institute || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Department</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.quick.department || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Training Report</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.quick.trainingReport || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Training Date</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all font-mono">{result.quick.trainingDate || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Physical Campus</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all text-indigo-600">{result.quick.physicalCampus || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Father's Name</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.personal.fathersName || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Mother's Name</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.personal.mothersName || "—"}</b>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-1 hover:bg-slate-50/40 transition duration-150 text-[13px]">
                        <span className="text-slate-400 font-semibold col-span-1">Gender</span>
                        <b className="text-slate-800 font-extrabold col-span-2 select-all">{result.personal.gender || "—"}</b>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Assessment Table Card */}
                <div className="bg-white border border-slate-250/80 rounded-2xl overflow-hidden shadow-xs">
                  <div className="border-b border-slate-200 px-5 py-2.5 bg-slate-50 flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-base">Assessment Result Summary</span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[640px]">
                      <thead>
                        <tr className="bg-slate-800 text-white divide-x divide-slate-700">
                          <th className="px-5 py-2 text-xs font-black uppercase tracking-wider whitespace-nowrap">Subjects</th>
                          <th className="px-5 py-2 text-xs font-black uppercase tracking-wider text-center whitespace-nowrap">% &amp; Set</th>
                          <th className="px-5 py-2 text-xs font-black uppercase tracking-wider text-center whitespace-nowrap">Date</th>
                          <th className="px-5 py-2 text-xs font-black uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.assessments && result.assessments.length > 0 ? (
                          result.assessments.map((a, idx) => {
                            const isAllowed = a.status === "Allow";
                            const isNotAllowed = a.status === "Not Allow";
                            const scoreSet = a.percent ? `${a.percent}${a.set ? ` | ${a.set}` : ""}` : "";

                            return (
                              <tr key={idx} className="hover:bg-slate-50/40 transition duration-100 font-bold text-[13px] divide-x divide-slate-100 text-slate-800">
                                <td className="px-5 py-1 text-slate-900 font-black">{a.subject}</td>
                                <td className="px-5 py-1 text-center font-mono text-[13px]">{scoreSet || "—"}</td>
                                <td className="px-5 py-1 text-center font-mono text-[13px] font-medium text-slate-500">{a.date || "—"}</td>
                                <td className="px-5 py-1 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black select-none ${
                                    isAllowed 
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                                      : isNotAllowed
                                      ? "bg-red-50 text-red-700 border border-red-150"
                                      : "bg-slate-100 text-slate-500"
                                  }`}>
                                    {isAllowed && <Check className="w-3 h-3" />}
                                    {isNotAllowed && <AlertTriangle className="w-3 h-3" />}
                                    {a.status || "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-[13px] text-slate-500 font-semibold">
                              কোনো মূল্যায়ন ফলাফল ডাটা পাওয়া যায়নি।
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Remarks Block (If show is true) */}
                {result.remark && result.remark.show && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm"
                  >
                    <h3 className="font-black text-amber-950 mb-2 flex items-center gap-1.5 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      সমস্যা ও মন্তব্য (Remarks Context):
                    </h3>
                    <div className="whitespace-pre-wrap leading-relaxed text-sm font-semibold select-all">
                      {result.remark.body}
                    </div>
                  </motion.div>
                )}

              </motion.section>
            )}
          </AnimatePresence>

          {/* Help Line Card Block */}
          <section className="bg-white border border-blue-50/80 rounded-2xl shadow-sm p-5 md:p-6 print:hidden">
            <h2 className="text-lg md:text-xl font-black text-slate-800 mb-4 flex items-center gap-2 font-display">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Help-Line ESM
            </h2>

            <div className="space-y-3.5">
              {/* Select Campus */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Select Campus
                </label>
                <select
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition text-sm font-bold text-slate-800"
                >
                  <option value="">-- Select Campus --</option>
                  <option value="Farmgate ESM">Farmgate ESM</option>
                  <option value="Motijheel ESM">Motijheel ESM</option>
                  <option value="Bakshibazar ESM">Bakshibazar ESM</option>
                  <option value="Cantonment ESM">Cantonment ESM</option>
                  <option value="Khulna ESM">Khulna ESM</option>
                  <option value="Rajshahi ESM">Rajshahi ESM</option>
                  <option value="Oxygen Moor(ctg) ESM">Oxygen Moor(ctg) ESM</option>
                  <option value="Mymensingh ESM">Mymensingh ESM</option>
                </select>
              </div>

              {/* Message Content */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Message
                </label>
                <textarea
                  value={helpMessage}
                  onChange={(e) => setHelpMessage(e.target.value)}
                  placeholder={helpPlaceholder}
                  rows={2.5}
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition text-sm font-semibold"
                />
              </div>

              {/* Action Buttons row */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button
                  onClick={sendWhatsApp}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold py-2.5 rounded-xl shadow-md hover:shadow-lg hover:shadow-emerald-500/15 transition-all text-xs h-10 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <svg 
                    className="w-4 h-4 shrink-0 fill-current" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.705 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Send WhatsApp
                </button>
                <button
                  onClick={() => setShowNoticeModal(true)}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-extrabold py-2.5 rounded-xl shadow-md hover:shadow-lg hover:shadow-red-500/15 transition-all text-xs h-10 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Bell className="w-4 h-4 animate-swing shrink-0" />
                  Notice
                </button>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* Notice Dialog / Modal popups */}
      <AnimatePresence>
        {showNoticeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-xl mb-4 shadow-inner">
                🔔
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">
                Notice ESM Platform
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                মূল্যায়নের নিয়মাবলী এবং নোটিশ এখনো সংযুক্ত করা হয়নি। নতুন নোটিশ প্রকাশ হওয়া মাত্রই এখানে আপডেট করা হবে। যেকোনো সমস্যায় ক্যাম্পাসের WhatsApp-এ হেল্পলাইনে মেসেজ দিন।
              </p>
              <button
                onClick={() => setShowNoticeModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-sm transition cursor-pointer"
              >
                Close Notice
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



    </div>
  );
}
