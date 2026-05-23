import { SearchData } from "./types";

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

export function mapLocalRow(row: any[]): SearchData {
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
