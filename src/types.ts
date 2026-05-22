export interface Assessment {
  subject: string;
  percent: string;
  set: string;
  date: string;
  status: 'Allow' | 'Not Allow' | 'No Exam' | string;
}

export interface QuickInfo {
  tpin: string;
  rm: string;
  nickName: string;
  fullName: string;
  mobile1: string;
  mobile2: string;
  nagadNumber: string;
  institute: string;
  department: string;
  hscGpa: string;
  hscBatch: string;
  trainingReport: string;
  trainingDate: string;
  physicalCampus: string;
}

export interface Remark {
  count: number;
  show: boolean;
  body: string;
  byLine: string;
  dateLine: string;
}

export interface PersonalInfo {
  fathersName: string;
  mothersName: string;
  religion: string;
  gender: string;
  dateOfBirth: string;
  hscRoll: string;
  hscReg: string;
  hscBoard: string;
  teamsId: string;
  email: string;
  regDate: string;
  homeDistrict: string;
  subjectsChoice: string;
  selectedSub: string;
  versionInterested: string;
  idChecked: string;
  runningProgram: string;
  previousProgram: string;
}

export interface SearchData {
  quick: QuickInfo;
  assessments: Assessment[];
  remark: Remark;
  personal: PersonalInfo;
}

export interface SearchResult {
  ok: boolean;
  message?: string;
  data?: SearchData;
}
