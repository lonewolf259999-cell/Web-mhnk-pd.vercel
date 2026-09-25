/* Shared data models — shapes produced by the Google Sheets layer */

export interface Officer {
  code: string;
  name: string;
  phone: string;
  rank: string;
  cases: string;
  steamId: string;
  workDays: string;
  daysAway: string;
  steamKey: string;
  fullName: string;
  schedule: string[];
}

export interface WeekOfficerData {
  name: string;
  rank: string;
  take2: string;
  weeklyCases: string;
  interrogations: string;
  totalCases: string;
  totalAmount: number;
  paid: string;
  duty: string[];
  dutyTotal: string;
}

export type WeekData = Record<string, WeekOfficerData>;

interface Top10Entry {
  name: string;
  rank: string;
  totalCases: number;
}

export interface WeekTop10 {
  weekName: string;
  top10: Top10Entry[];
}

export interface ConductItem {
  id: string;
  title: string;
  text: string;
}

export interface RuleItem {
  id: string;
  category: string;
  text: string;
}

export interface FineItem {
  id: string;
  category: string;
  text: string;
  amount: string;
  time: string;
}

export interface CaseItem {
  id: string;
  title: string;
  description: string;
  video_url: string;
}

export type RulesType = 'conduct' | 'rules' | 'fines';

interface ScheduleDay {
  key: string;
  label: string;
  short: string;
}

export interface ScheduleConfig {
  days: ScheduleDay[];
  [key: string]: unknown;
}
