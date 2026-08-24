import { SheetData } from '../types';

// Pay Cycle Utility for 21st to 20th Monthly Billing & Operational Cycles
// Every month starts on the 21st and ends on the 20th of the following month.

const MONTHS_FULL = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

export interface PayCycleInfo {
  id: string; // e.g. "JUL_AUG_2026"
  label: string; // e.g. "21 JULY 2026 – 20 AUGUST 2026 (July/August Pay Cycle)"
  shortLabel: string; // e.g. "21 JUL – 20 AUG 2026"
  startYear: number;
  startMonthName: string;
  endYear: number;
  endMonthName: string;
}

/**
 * Given a date label like "21 JULY 2026", "15 AUGUST 2026", "20 AUGUST 2026", or "21 AUGUST 2026",
 * determines which 21st-to-20th Monthly Pay Cycle it belongs to.
 */
export function getPayCycleForDate(dateLabel: string): PayCycleInfo {
  const d = parseDateLabelToDate(dateLabel);
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();

  let startMonthIdx: number;
  let startYear: number;
  let endMonthIdx: number;
  let endYear: number;

  if (day >= 21) {
    // Falls in the cycle starting 21st of current month
    startMonthIdx = monthIdx;
    startYear = year;
    endMonthIdx = (monthIdx + 1) % 12;
    endYear = monthIdx === 11 ? year + 1 : year;
  } else {
    // Falls in the cycle ending 20th of current month (started 21st of previous month)
    startMonthIdx = (monthIdx - 1 + 12) % 12;
    startYear = monthIdx === 0 ? year - 1 : year;
    endMonthIdx = monthIdx;
    endYear = year;
  }

  const startMonthFull = MONTHS_FULL[startMonthIdx];
  const startMonthShort = MONTHS_SHORT[startMonthIdx];
  const endMonthFull = MONTHS_FULL[endMonthIdx];
  const endMonthShort = MONTHS_SHORT[endMonthIdx];

  const id = `${startMonthShort}_${endMonthShort}_${endYear}`;
  const label = `21 ${startMonthFull} ${startYear} – 20 ${endMonthFull} ${endYear} (${startMonthFull.slice(0, 3)}/${endMonthFull.slice(0, 3)} Pay Cycle)`;
  const shortLabel = `21 ${startMonthShort} – 20 ${endMonthShort} ${endYear}`;

  return {
    id,
    label,
    shortLabel,
    startYear,
    startMonthName: startMonthFull,
    endYear,
    endMonthName: endMonthFull
  };
}

export const CUTOFF_START_DATE_STR = "21 JULY 2026";
export const CUTOFF_TIMESTAMP = new Date(2026, 6, 21, 0, 0, 0).getTime(); // 21 July 2026

/**
 * Validates if a date label is valid - supports all shift dates across past, current, and future cycles
 */
export function isDateOnOrAfterCutoff(dateLabel: string): boolean {
  if (!dateLabel) return false;
  const d = parseDateLabelToDate(dateLabel);
  return !isNaN(d.getTime());
}

/**
 * Checks if a given Date object (or current local time) falls within the night shift operational hours.
 * Default auto night shift is 18:30 (6:30 PM) to 05:00 (5:00 AM).
 */
export function checkIsNightShiftTime(startStr: string = '18:30', endStr: string = '05:00', now: Date = new Date()): boolean {
  const [sH, sM] = (startStr || '18:30').split(':').map(Number);
  const [eH, eM] = (endStr || '05:00').split(':').map(Number);
  if (isNaN(sH) || isNaN(eH)) return false;

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sH * 60 + (sM || 0);
  const endMins = eH * 60 + (eM || 0);

  if (startMins > endMins) {
    // Spans across midnight (e.g. 18:30 to 05:00)
    return currentMins >= startMins || currentMins < endMins;
  } else {
    return currentMins >= startMins && currentMins < endMins;
  }
}

/**
 * Checks if a date sheet label belongs to a specific pay cycle ID
 */
export function isDateInPayCycle(dateLabel: string, cycleId: string): boolean {
  if (!dateLabel) return false;
  if (cycleId === 'ALL_LOGS') return true;
  const cycle = getPayCycleForDate(dateLabel);
  return cycle.id === cycleId;
}

/**
 * Returns all available pay cycles derived from standard cycles and imported user sheets across all dates.
 */
export function getAllPayCyclesFromSheets(sheets: { label: string }[]): PayCycleInfo[] {
  const map = new Map<string, PayCycleInfo>();

  // 1. Seed standard pay cycles
  const standard2026SampleDates = [
    '21 JULY 2026',
    '21 AUGUST 2026',
    '21 SEPTEMBER 2026',
    '21 OCTOBER 2026',
    '21 NOVEMBER 2026',
    '21 DECEMBER 2026'
  ];

  standard2026SampleDates.forEach(dStr => {
    const info = getPayCycleForDate(dStr);
    map.set(info.id, info);
  });

  // 2. Include any cycles present in user sheets across all dates
  (sheets || []).forEach(s => {
    if (s && s.label) {
      const info = getPayCycleForDate(s.label);
      if (!map.has(info.id)) {
        map.set(info.id, info);
      }
    }
  });

  const list = Array.from(map.values());

  // Sort chronologically by start year then start month
  list.sort((a, b) => {
    if (a.startYear !== b.startYear) return a.startYear - b.startYear;
    const aIdx = MONTHS_FULL.indexOf(a.startMonthName);
    const bIdx = MONTHS_FULL.indexOf(b.startMonthName);
    return aIdx - bIdx;
  });

  return list;
}

/**
 * Day & Overtime Information Interface
 */
export interface ShiftDayInfo {
  dayName: string; // e.g. "Saturday"
  dayShort: string; // e.g. "SAT"
  dayNum: number;
  monthName: string;
  year: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isOvertime: boolean;
  overtimeType: 'WEEKEND' | 'HOLIDAY' | 'WEEKDAY_AFTER_5PM' | 'REGULAR';
  badgeText: string; // e.g. "SAT (OT 2.0x)" or "HOLIDAY (OT 2.0x)" or "MON (+2.0h OT after 5 PM @ 1.5x)"
  standardShiftEndTime: string; // "17:00 (5:00 PM)"
  weekdayOtStart: string; // "17:00 (5:00 PM)"
  weekdayOtMultiplier: number; // 1.5
  weekendOtMultiplier: number; // 2.0
  regularShiftHours: number; // 9.0
  weekdayOtHours?: number; // Hours worked after 5:00 PM
}

// Lesotho Statutory Public Holidays & Easter Engine
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Checks if a date corresponds to an official statutory or observed Public Holiday in Lesotho.
 */
export function getLesothoPublicHoliday(year: number, monthIdx: number, dayNum: number): { isHoliday: boolean; name?: string } {
  const targetDate = new Date(year, monthIdx, dayNum);
  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Fixed Statutory Lesotho Public Holidays
  const fixedHolidays: Record<string, string> = {
    '0-1': "New Year's Day",
    '2-11': "Moshoeshoe's Day",
    '4-1': "Workers' Day",
    '4-25': "Africa Day",
    '6-17': "King's Birthday",
    '9-4': "Independence Day",
    '11-25': "Christmas Day",
    '11-26': "Boxing Day"
  };

  const key = `${monthIdx}-${dayNum}`;
  if (fixedHolidays[key]) {
    return { isHoliday: true, name: fixedHolidays[key] };
  }

  // Variable Christian Holidays based on Easter
  const easter = getEasterSunday(year);

  // Good Friday (2 days before Easter)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  if (goodFriday.getMonth() === monthIdx && goodFriday.getDate() === dayNum) {
    return { isHoliday: true, name: "Good Friday" };
  }

  // Easter Monday (1 day after Easter)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  if (easterMonday.getMonth() === monthIdx && easterMonday.getDate() === dayNum) {
    return { isHoliday: true, name: "Easter Monday" };
  }

  // Ascension Day (39 days after Easter - always a Thursday)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  if (ascension.getMonth() === monthIdx && ascension.getDate() === dayNum) {
    return { isHoliday: true, name: "Ascension Day" };
  }

  // Lesotho Public Holidays Act (Sunday Observed Rule):
  // When a statutory public holiday falls on a Sunday, the following Monday is observed as a paid public holiday.
  if (dayOfWeek === 1) { // Monday
    const yesterday = new Date(year, monthIdx, dayNum - 1);
    const yKey = `${yesterday.getMonth()}-${yesterday.getDate()}`;
    if (fixedHolidays[yKey]) {
      return { isHoliday: true, name: `${fixedHolidays[yKey]} (Observed)` };
    }
  }

  // Christmas Day / Boxing Day Sunday Rollover Rule:
  // If Dec 25 is Sunday, Dec 26 (Mon) is Christmas Day (Observed) and Dec 27 (Tue) is Boxing Day (Observed)
  if (monthIdx === 11 && dayNum === 27 && dayOfWeek === 2) { // Tuesday 27 Dec
    const dec25 = new Date(year, 11, 25);
    if (dec25.getDay() === 0) {
      return { isHoliday: true, name: "Boxing Day (Observed)" };
    }
  }

  return { isHoliday: false };
}

/**
 * Analyzes a shift date label (e.g. "25 JULY 2026") and returns detailed day/overtime metadata.
 * Accounts for standard 9.0h weekday shift ending at 17:00 (5:00 PM). Hours past 5 PM = Weekday Overtime @ 1.5x.
 */
export function getDayInfo(dateLabel: string, shiftHours?: number): ShiftDayInfo {
  const upper = dateLabel.trim().toUpperCase();
  let dayNum = 21;
  let monthIdx = 6;
  let year = 2026;

  const standardMatch = upper.match(/(\d{1,2})\s+([A-Z]{3,})\s+(\d{4})/);
  if (standardMatch) {
    dayNum = parseInt(standardMatch[1], 10);
    const mStr = standardMatch[2];
    year = parseInt(standardMatch[3], 10);
    const foundIdx = MONTHS_FULL.findIndex(m => m.startsWith(mStr)) !== -1 
      ? MONTHS_FULL.findIndex(m => m.startsWith(mStr))
      : MONTHS_SHORT.findIndex(m => m.startsWith(mStr));
    if (foundIdx !== -1) monthIdx = foundIdx;
  } else {
    const isoMatch = upper.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      monthIdx = Math.max(0, parseInt(isoMatch[2], 10) - 1);
      dayNum = parseInt(isoMatch[3], 10);
    }
  }

  const d = new Date(year, monthIdx, dayNum);
  const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayShorts = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const dayName = dayNames[dayOfWeek] || 'Unknown';
  const dayShort = dayShorts[dayOfWeek] || 'DAY';
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const hol = getLesothoPublicHoliday(year, monthIdx, dayNum);
  const isHoliday = hol.isHoliday;
  const holidayName = hol.name;

  const stdHrs = 9.0;
  const actualShiftHrs = shiftHours || stdHrs;
  const weekdayOtHours = (!isWeekend && !isHoliday && actualShiftHrs > stdHrs) ? actualShiftHrs - stdHrs : 0;

  const isOvertime = isWeekend || (actualShiftHrs > stdHrs);
  let overtimeType: 'WEEKEND' | 'HOLIDAY' | 'WEEKDAY_AFTER_5PM' | 'REGULAR' = 'REGULAR';
  let badgeText = '';

  if (isHoliday) {
    overtimeType = 'HOLIDAY';
    badgeText = `🇱🇸 ${holidayName?.toUpperCase() || 'PAID PUBLIC HOLIDAY'} (PAID DAY)`;
  } else if (isWeekend) {
    overtimeType = 'WEEKEND';
    badgeText = `${dayShort} (OT 2.0x)`;
  } else if (weekdayOtHours > 0) {
    overtimeType = 'WEEKDAY_AFTER_5PM';
    badgeText = `${dayShort} (+${weekdayOtHours.toFixed(1)}h OT after 5 PM @ 1.5x)`;
  } else {
    badgeText = `${dayShort} (Std Shift ends 5 PM)`;
  }

  return {
    dayName,
    dayShort,
    dayNum,
    monthName: MONTHS_FULL[monthIdx] || 'JULY',
    year,
    isWeekend,
    isHoliday,
    holidayName,
    isOvertime,
    overtimeType,
    badgeText,
    standardShiftEndTime: '17:00 (5:00 PM)',
    weekdayOtStart: '17:00 (5:00 PM)',
    weekdayOtMultiplier: 1.5,
    weekendOtMultiplier: 2.0,
    regularShiftHours: stdHrs,
    weekdayOtHours
  };
}

/**
 * Calculates detailed shift wage & overtime breakdown.
 * - Standard weekday shift: 9.0 hours (08:00 to 17:00 / 5:00 PM)
 * - Weekday Overtime: Hours past 17:00 (5:00 PM) calculated at 1.5x hourly rate (Daily Wage / 9 * 1.5)
 * - Weekend / Holiday Overtime: 2.0x multiplier
 */
export function calculateShiftOvertimeBreakdown(
  shiftHours: number = 9.0,
  isWeekendOrHoliday: boolean = false,
  dailyWage: number = 0
) {
  const hourlyRate = dailyWage > 0 ? dailyWage / 9.0 : 0;
  
  if (isWeekendOrHoliday) {
    const otCost = dailyWage * 2.0 * (shiftHours / 9.0);
    return {
      regularHours: 0,
      weekdayOtHours: 0,
      weekendOtHours: shiftHours,
      regularCost: 0,
      weekdayOtCost: 0,
      weekendOtCost: otCost,
      totalCost: otCost
    };
  } else {
    const regularHours = Math.min(9.0, shiftHours);
    const weekdayOtHours = Math.max(0, shiftHours - 9.0);
    
    const regularCost = (regularHours / 9.0) * dailyWage;
    const weekdayOtCost = weekdayOtHours * hourlyRate * 1.5;
    
    return {
      regularHours,
      weekdayOtHours,
      weekendOtHours: 0,
      regularCost,
      weekdayOtCost,
      weekendOtCost: 0,
      totalCost: regularCost + weekdayOtCost
    };
  }
}

/**
 * Returns ALL standard monthly payroll shift days for a pay cycle ID (from 21st of start month to 20th of end month).
 * Includes ALL weekdays (Monday to Friday) plus statutory / observed Lesotho Public Holidays.
 */
export function getAllDatesForPayCycle(cycleInfo: PayCycleInfo): string[] {
  const dates: string[] = [];
  const startMonthIdx = MONTHS_FULL.indexOf(cycleInfo.startMonthName);
  const endMonthIdx = MONTHS_FULL.indexOf(cycleInfo.endMonthName);

  // 1. Days 21 to end of start month (Weekdays Monday-Friday + Lesotho Public Holidays)
  const lastDayOfStartMonth = new Date(cycleInfo.startYear, startMonthIdx + 1, 0).getDate();
  for (let day = 21; day <= lastDayOfStartMonth; day++) {
    const d = new Date(cycleInfo.startYear, startMonthIdx, day);
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const hol = getLesothoPublicHoliday(cycleInfo.startYear, startMonthIdx, day);

    // Include all weekdays (Mon-Fri) and any statutory or observed public holidays
    if ((dayOfWeek >= 1 && dayOfWeek <= 5) || hol.isHoliday) {
      dates.push(`${day} ${cycleInfo.startMonthName} ${cycleInfo.startYear}`);
    }
  }

  // 2. Days 1 to 20 of end month (Weekdays Monday-Friday + Lesotho Public Holidays)
  for (let day = 1; day <= 20; day++) {
    const d = new Date(cycleInfo.endYear, endMonthIdx, day);
    const dayOfWeek = d.getDay();
    const hol = getLesothoPublicHoliday(cycleInfo.endYear, endMonthIdx, day);

    if ((dayOfWeek >= 1 && dayOfWeek <= 5) || hol.isHoliday) {
      dates.push(`${day} ${cycleInfo.endMonthName} ${cycleInfo.endYear}`);
    }
  }

  return dates;
}

/**
 * Extracts and normalizes any raw date string, Excel serial number, or Date object
 * into standard "D MONTH YYYY" format (e.g. "10 AUGUST 2026", "11 AUGUST 2026").
 * Correctly ignores non-date prefixes (such as "Quantum 2 - ", "Unit 1 - ", "Page 2").
 */
export function extractAndNormalizeDate(raw: any, fallbackDate: string = '21 JULY 2026'): string {
  if (raw === null || raw === undefined) return fallbackDate;

  // 1. Handle JS Date object
  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      const d = raw.getDate();
      const mIdx = raw.getMonth();
      const y = raw.getFullYear();
      if (mIdx >= 0 && mIdx < 12 && y >= 2020 && y <= 2035) {
        return `${d} ${MONTHS_FULL[mIdx]} ${y}`;
      }
    }
  }

  // 2. Handle Excel Serial Date number (e.g. 46244 -> 10 August 2026, 46245 -> 11 August 2026)
  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d{5}(\.\d+)?$/.test(raw.trim()))) {
    const num = typeof raw === 'number' ? raw : parseFloat(raw.trim());
    if (num >= 35000 && num <= 60000) {
      const parsedDate = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(parsedDate.getTime())) {
        const d = parsedDate.getDate();
        const mIdx = parsedDate.getMonth();
        const y = parsedDate.getFullYear();
        if (mIdx >= 0 && mIdx < 12 && y >= 2020 && y <= 2035) {
          return `${d} ${MONTHS_FULL[mIdx]} ${y}`;
        }
      }
    }
  }

  const str = String(raw).trim();
  if (!str) return fallbackDate;
  const upper = str.toUpperCase();

  const MONTH_PATTERN = '(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)';

  // 3. DMY with Month Word: e.g. "10 AUGUST 2026", "11th AUG 2026", "Cadre Details Quantum 2 - Manpower Details (10 AUGUST 2026)"
  const dmyWordMatch = upper.match(new RegExp(`(?:^|[^0-9A-Z])(\\d{1,2})(?:ST|ND|RD|TH)?[\\s\\-_/]+${MONTH_PATTERN}[\\s\\-_/]+(\\d{2,4})(?:[^0-9A-Z]|$)`, 'i'));
  if (dmyWordMatch) {
    const day = parseInt(dmyWordMatch[1], 10);
    const mStr = dmyWordMatch[2].toUpperCase();
    let year = parseInt(dmyWordMatch[3], 10);
    if (year < 100) year += 2000;

    let foundIdx = MONTHS_FULL.findIndex(m => m.startsWith(mStr));
    if (foundIdx === -1) foundIdx = MONTHS_SHORT.findIndex(m => m.startsWith(mStr));
    if (foundIdx !== -1 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      return `${day} ${MONTHS_FULL[foundIdx]} ${year}`;
    }
  }

  // 4. MDY with Month Word: e.g. "AUGUST 10 2026", "AUG-11-2026", "AUGUST 10, 2026"
  const mdyWordMatch = upper.match(new RegExp(`(?:^|[^0-9A-Z])${MONTH_PATTERN}[\\s\\-_/]+(\\d{1,2})(?:ST|ND|RD|TH)?[\\s\\-_/,\\.]+(\\d{2,4})(?:[^0-9A-Z]|$)`, 'i'));
  if (mdyWordMatch) {
    const mStr = mdyWordMatch[1].toUpperCase();
    const day = parseInt(mdyWordMatch[2], 10);
    let year = parseInt(mdyWordMatch[3], 10);
    if (year < 100) year += 2000;

    let foundIdx = MONTHS_FULL.findIndex(m => m.startsWith(mStr));
    if (foundIdx === -1) foundIdx = MONTHS_SHORT.findIndex(m => m.startsWith(mStr));
    if (foundIdx !== -1 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      return `${day} ${MONTHS_FULL[foundIdx]} ${year}`;
    }
  }

  // 5. ISO Format: e.g. "2026-08-10", "2026/08/11"
  const isoMatch = upper.match(/(?:^|[^0-9])(\d{4})([\/.-])(\d{1,2})\2(\d{1,2})(?:[^0-9]|$)/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIdx = parseInt(isoMatch[3], 10) - 1;
    const day = parseInt(isoMatch[4], 10);
    if (monthIdx >= 0 && monthIdx < 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      return `${day} ${MONTHS_FULL[monthIdx]} ${year}`;
    }
  }

  // 6. Numeric DMY Format with identical delimiters (e.g. "10.08.2026", "11/08/2026", "08-08-2026", "Cadre Details Quantum 2 - Manpower Details (10.08.2026)")
  // Ensures "Quantum 2 - 10.08.2026" does NOT match the "2 - 10" as a date!
  const numericDmyMatch = upper.match(/(?:^|[^0-9])(\d{1,2})([\/.-])(\d{1,2})\2(\d{2,4})(?:[^0-9]|$)/);
  if (numericDmyMatch) {
    const day = parseInt(numericDmyMatch[1], 10);
    const monthIdx = parseInt(numericDmyMatch[3], 10) - 1;
    let year = parseInt(numericDmyMatch[4], 10);
    if (year < 100) year += 2000;
    if (monthIdx >= 0 && monthIdx < 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
      return `${day} ${MONTHS_FULL[monthIdx]} ${year}`;
    }
  }

  // 7. Partial Day + Month Name: e.g. "10 AUGUST", "11th AUG", "8 AUGUST"
  const partialDmyMatch = upper.match(new RegExp(`(?:^|[^0-9A-Z])(\\d{1,2})(?:ST|ND|RD|TH)?[\\s\\-_/]+${MONTH_PATTERN}(?:[^0-9A-Z]|$)`, 'i'));
  if (partialDmyMatch) {
    const day = parseInt(partialDmyMatch[1], 10);
    const mStr = partialDmyMatch[2].toUpperCase();
    let foundIdx = MONTHS_FULL.findIndex(m => m.startsWith(mStr));
    if (foundIdx === -1) foundIdx = MONTHS_SHORT.findIndex(m => m.startsWith(mStr));
    if (foundIdx !== -1 && day >= 1 && day <= 31) {
      return `${day} ${MONTHS_FULL[foundIdx]} 2026`;
    }
  }

  // 8. Partial Month Name + Day: e.g. "AUGUST 10", "AUG 11"
  const partialMdyMatch = upper.match(new RegExp(`(?:^|[^0-9A-Z])${MONTH_PATTERN}[\\s\\-_/]+(\\d{1,2})(?:ST|ND|RD|TH)?(?:[^0-9A-Z]|$)`, 'i'));
  if (partialMdyMatch) {
    const mStr = partialMdyMatch[1].toUpperCase();
    const day = parseInt(partialMdyMatch[2], 10);
    let foundIdx = MONTHS_FULL.findIndex(m => m.startsWith(mStr));
    if (foundIdx === -1) foundIdx = MONTHS_SHORT.findIndex(m => m.startsWith(mStr));
    if (foundIdx !== -1 && day >= 1 && day <= 31) {
      return `${day} ${MONTHS_FULL[foundIdx]} 2026`;
    }
  }

  // 9. Numeric Partial DM: e.g. "10.08", "11/08", "8.8" (must be preceded/followed by non-digits or boundary)
  const numPartialMatch = upper.match(/(?:^|[^0-9])(\d{1,2})([\/.-])(\d{1,2})(?:[^0-9]|$)/);
  if (numPartialMatch) {
    const day = parseInt(numPartialMatch[1], 10);
    const monthIdx = parseInt(numPartialMatch[3], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12 && day >= 1 && day <= 31) {
      return `${day} ${MONTHS_FULL[monthIdx]} 2026`;
    }
  }

  return fallbackDate;
}

/**
 * Parses a date label like "21 JULY 2026" or "15 AUG 2026" into a JavaScript Date object.
 */
export function parseDateLabelToDate(label: string): Date {
  if (!label) return new Date(2026, 6, 21);
  const norm = extractAndNormalizeDate(label, '21 JULY 2026');
  const parts = norm.split(' ');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const mIdx = MONTHS_FULL.indexOf(parts[1].toUpperCase());
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && mIdx !== -1 && !isNaN(year)) {
      return new Date(year, mIdx, day);
    }
  }
  return new Date(2026, 6, 21);
}

/**
 * Returns shift dates for a given pay cycle (generates ALL consecutive days in the shift cycle).
 */
export function getSampleDatesForPayCycle(cycleInfo: PayCycleInfo): string[] {
  return getAllDatesForPayCycle(cycleInfo);
}

/**
 * Calculates complete labor cost breakdown for a sheet including permanent, temporary, base, and overtime costs.
 */
export function calculateSheetLaborCostBreakdown(sheet: SheetData) {
  const otHours = sheet.shiftOtHours || 0;
  const dayInfo = getDayInfo(sheet.label, 9.0 + otHours);
  const otMultiplier = (dayInfo.isWeekend || dayInfo.isHoliday) ? 2.0 : 1.5;

  let permBaseCost = 0;
  let tempBaseCost = 0;
  let otCost = 0;
  let permCount = 0;
  let tempCount = 0;
  let otHeadcountTotal = 0;

  (sheet.departments || []).forEach(d => {
    (d.roles || []).forEach(r => {
      permCount += r.perm;
      tempCount += r.temp;

      const pCost = (r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage);
      const tCost = r.temp * r.tempWage;
      permBaseCost += pCost;
      tempBaseCost += tCost;

      const totalPresent = r.perm + r.temp;
      const roleOtHc = (r.otHeadcount !== undefined && r.otHeadcount >= 0) ? r.otHeadcount : 0;

      let roleOtCost = 0;
      if (r.otCost !== undefined && r.otCost >= 0) {
        roleOtCost = r.otCost;
      } else if (otHours > 0 && roleOtHc > 0) {
        const avgHourly = totalPresent > 0 ? ((pCost + tCost) / totalPresent) / 9.0 : (r.permWage > 0 ? r.permWage / 9.0 : 0);
        roleOtCost = roleOtHc * otHours * avgHourly * otMultiplier;
      }

      if (roleOtHc > 0 || (r.otCost && r.otCost > 0)) {
        otHeadcountTotal += roleOtHc;
        otCost += roleOtCost;
      }
    });
  });

  const baseLaborCost = permBaseCost + tempBaseCost;
  const totalLaborCost = baseLaborCost + otCost;

  return {
    permCount,
    tempCount,
    totalHeadcount: permCount + tempCount,
    otHeadcountTotal,
    permBaseCost,
    tempBaseCost,
    baseLaborCost,
    otCost,
    totalLaborCost,
    otHours,
    otMultiplier,
    dayInfo
  };
}

/**
 * Sorts any array of sheets chronologically by date.
 */
export function sortSheetsChronologically<T extends { label: string } = SheetData>(sheets: T[]): T[] {
  return [...sheets].sort((a, b) => {
    const timeA = parseDateLabelToDate(a.label).getTime();
    const timeB = parseDateLabelToDate(b.label).getTime();
    return timeA - timeB;
  });
}

