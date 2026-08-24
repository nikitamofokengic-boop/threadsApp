import React, { useState, useMemo, useEffect } from 'react';
import { SheetData, Department } from '../types';
import { FileSpreadsheet, CheckCircle2, AlertCircle, Download, X, Clock, Calendar, Sparkles, Filter, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractAndNormalizeDate, getDayInfo, parseDateLabelToDate } from '../utils/payCycle';
import {
  QUANTUM2_STANDARD_ROSTER,
  QUANTUM2_03_AUG_ROSTER,
  QUANTUM2_07_AUG_ROSTER,
  QUANTUM2_10_AUG_ROSTER,
  QUANTUM2_12_AUG_ROSTER,
  QUANTUM2_14_AUG_ROSTER,
  QUANTUM2_08_AUG_ROSTER,
  QUANTUM2_21_JULY_ROSTER
} from '../data/initialData';

export interface ParsedDeptSummary {
  deptName: string;
  cadreCount: number;
  permCount: number; // Permanent Workers Present from clock-in
  absentCount: number;
  tempCount: number;
  costVal?: number;
}

export interface DateParsedEntry {
  dateLabel: string;
  departments: ParsedDeptSummary[];
}

interface ClockInUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSheet: SheetData;
  allSheets?: SheetData[];
  onApplyHeadcount: (updatedDepartments: Department[], importedDate?: string) => void;
  onApplyMultiDateHeadcount?: (dateUpdates: { dateLabel: string; departments: Department[] }[]) => void;
  currency: string;
}

const ROLE_SYNONYMS: Record<string, string[]> = {
  "Machine Operators": ["MACHINE OPERATORS", "MACHINE OPERATOR", "OPERATORS", "OPERATOR", "SEWING", "SEWING OPERATORS", "SEWING OPERATOR", "MACHINISTS", "MACHINIST", "PRODUCTION FLOOR", "PROD FLOOR", "SEWING FLOOR", "PRODUCTION WORKERS", "PRODUCTION WORKER", "SEWING DEPT", "SEWING LINE"],
  "Packing Employees": ["PACKING EMPLOYEES", "PACKING EMPLOYEE", "PACKING", "PACKERS", "PACKER", "PACKING DEPT", "PACKING SECTION"],
  "Iron Employees": ["IRON EMPLOYEES", "IRON EMPLOYEE", "IRON", "IRONING", "PRESSING", "PRESSERS", "PRESSER", "IRONERS", "IRONER", "IRONING DEPT"],
  "Quality Employees": ["QUALITY EMPLOYEES", "QUALITY EMPLOYEE", "QUALITY", "QC", "QA", "INSPECTION", "CHECKING", "QUALITY CONTROL", "QC CHECKERS", "QC INSPECTORS", "AUDITORS"],
  "Cutting": ["CUTTING", "CUTTING ROOM", "CUTTERS", "CUTTER", "CUTTING DEPT", "SPREADING"],
  "Maintanance": ["MAINTANANCE", "MAINTENANCE", "MECHANICAL", "MAINTENANCE DEPT", "FITTER"],
  "Needle-Room Ass.": ["NEEDLE-ROOM ASS.", "NEEDLE-ROOM ASS", "NEEDLE ROOM", "NEEDLE ROOM ASSISTANT", "NEEDLE", "NEEDLE ROOM ASS.", "NEEDLE DISPENSER"],
  "Production Coordinator": ["PRODUCTION COORDINATOR", "PROD COORDINATOR", "PRODUCTION CO-ORDINATOR", "PROD CO-ORDINATOR"],
  "Project Coordinator": ["PROJECT COORDINATOR", "PROJ COORDINATOR", "PROJECT CO-ORDINATOR"],
  "PPZ": ["PPZ", "PPZ OPERATOR"],
  "Printing": ["PRINTING", "PRINT", "EMBROIDERY", "PRINT DEPT", "HEAT TRANSFER"],
  "Score-Ladies/Man": ["SCORE-LADIES/MAN", "SCORE LADIES", "SCORE MAN", "SCORE-LADIES", "SCORE-MAN", "SCORE", "SCORE LADIES/MAN", "SCORE KEEPERS", "SCORE KEEPER"],
  "Supervisors": ["SUPERVISORS", "SUPERVISOR", "LINE SUPERVISORS", "LINE SUPERVISOR", "FLOOR SUPERVISOR"],
  "Technician": ["TECHNICIAN", "TECHNICIANS", "LINE TECHNICIAN", "CHIEF TECHNICIAN"],
  "Line-Manager": ["LINE-MANAGER", "LINE MANAGER", "PRODUCTION MANAGER", "LINE MANAGERS", "PROD MANAGER", "FACTORY MANAGER"],
  "Sub Stores": ["SUB STORES", "SUB-STORES", "ACCESSORY STORE", "ACCESSORIES STORE", "TRIMS STORE", "TRIMS", "SUB STORE"],
  "HR Employees": ["HR EMPLOYEES", "HR EMPLOYEE", "HR", "HUMAN RESOURCES", "PERSONNEL", "HR DEPT", "PEOPLE OPS"],
  "Admin Employees": ["ADMIN EMPLOYEES", "ADMIN EMPLOYEE", "ADMIN", "ADMINISTRATION", "OFFICE", "ADMIN DEPT", "CLERICAL"],
  "Boiler": ["BOILER", "BOILER OPERATOR", "STEAM OPERATOR"],
  "Electrician": ["ELECTRICIAN", "ELECTRICAL", "ELECTRICIANS"],
  "Mechanic": ["MECHANIC", "MECHANICS", "SEWING MECHANIC"],
  "Laundry": ["LAUNDRY", "WASHING", "AFTERWASH", "AFTERWASHING", "LAUNDRY DEPT", "WASHER"],
  "IE": ["IE", "INDUSTRIAL ENGINEERING", "WORK STUDY", "IE DEPT", "IE ENGINEER"],
  "Ware-house": ["WARE-HOUSE", "WAREHOUSE", "STORES", "MAIN STORE", "FABRIC ROOM", "FABRIC WAREHOUSE", "CENTRAL STORE", "FINISHED GOODS STORE"],
  "Sample Room": ["SAMPLE ROOM", "SAMPLE", "SAMPLING", "SAMPLE DEPT", "SAMPLE MAKERS"],
  "Jumpers": ["JUMPERS", "JUMPER", "FLOATERS", "FLOATER", "RELIEF WORKERS"],
  "Finishing": ["FINISHING", "FINISHING DEPT", "FINISHING SECTION"]
};

export function findMatchingRoleName(parsedDeptName: string): string | null {
  if (!parsedDeptName) return null;
  const clean = parsedDeptName.trim().toUpperCase().replace(/^[0-9.]+\s*/, '');
  
  // 1. Direct standard role match
  for (const std of QUANTUM2_STANDARD_ROSTER) {
    if (std.name.toUpperCase().trim() === clean) {
      return std.name;
    }
  }

  // 2. Exact match in synonyms
  for (const [stdName, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    if (synonyms.some(syn => syn === clean)) {
      return stdName;
    }
  }

  // 3. Substring / contains match in synonyms
  for (const [stdName, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    if (synonyms.some(syn => clean.includes(syn) || syn.includes(clean))) {
      return stdName;
    }
  }

  return null;
}

/**
 * Normalizes raw department names from Excel into standardized departmental categories,
 * while retaining exact casing for any custom user-added departments.
 */
export function canonicalDeptName(raw: string): string {
  if (!raw) return "OTHERS";
  const clean = raw.trim().toUpperCase().replace(/^[0-9.]+\s*/, '');
  
  if (clean.includes("CUTTING")) return "CUTTING";
  if (clean.includes("PROD") && clean.includes("MGMT")) return "PRODUCTION MANAGEMENT";
  if (clean.includes("MANAGEMENT") || clean.includes("COORDINATOR") || clean.includes("PLANNING")) return "PRODUCTION MANAGEMENT";
  if (clean.includes("PRODUCTION") || clean.includes("SEWING") || clean.includes("PROD FLOOR") || clean.includes("FLOOR") || clean.includes("OPERATOR") || clean.includes("IRON") || clean.includes("SCORE")) return "PRODUCTION FLOOR";
  if (clean.includes("FABRIC") && clean.includes("INSPECT")) return "FABRIC INSPECTION";
  if (clean.includes("FABRIC")) return "FABRIC ROOM";
  if (clean.includes("PRE") && clean.includes("PROD")) return "PRE-PRODUCTION";
  if (clean.includes("PPZ") || clean.includes("JUMPER") || clean.includes("TECHNICIAN")) return "PRE-PRODUCTION";
  if (clean.includes("SAMPLE")) return "SAMPLE ROOM";
  if (clean.includes("PACK")) return "PACKING";
  if (clean.includes("QC") || clean.includes("QUALITY") || clean.includes("CHECKING")) return "QC";
  if (clean.includes("MAINTENANCE") || clean.includes("MAINTANANCE") || clean.includes("MECHANIC") || clean.includes("BOILER") || clean.includes("ELECTRICIAN")) return "MAINTENANCE";
  if (clean.includes("WASH") || clean.includes("AFTERWASH") || clean.includes("LAUNDRY")) return "AFTERWASHING";
  if (clean.includes("CLEAN")) return "CLEANING";
  if (clean.includes("PRINT") || clean.includes("EMBROID")) return "PRINTING";
  if (clean.includes("IE") || clean.includes("INDUSTRIAL ENG") || clean.includes("ENGINEERING")) return "INDUSTRIAL ENGINEERING";
  if (clean.includes("STORE") || clean.includes("WAREHOUSE") || clean.includes("WARE-HOUSE") || clean.includes("ACCESSOR")) return "STORES";
  if (clean.includes("NEEDLE")) return "NEEDLE ROOM";
  if (clean.includes("SECURITY") || clean.includes("GUARD")) return "SECURITY";
  if (clean.includes("HR") || clean.includes("HUMAN RES") || clean.includes("ADMIN")) return "HUMAN RESOURCES";
  if (clean.includes("OTHER")) return "OTHERS";
  
  return clean;
}

/**
 * Merges parsed Excel summaries into the sheet's departmental structure,
 * guaranteeing the exact same 27-role Quantum 2 sequence across all dates,
 * properly matching synonyms and aggregating any duplicate section rows.
 */
function mergeParsedDepartmentsIntoSheet(
  targetSheet: SheetData | undefined,
  parsedSummaries: ParsedDeptSummary[]
): Department[] {
  if (!parsedSummaries || parsedSummaries.length === 0) {
    return targetSheet?.departments || [];
  }

  // Accumulate parsed summaries by mapped standard role name
  const roleAccumulator = new Map<string, { cadre: number; perm: number; absent: number; temp: number; cost: number; hasExplicitCost: boolean }>();
  const unmappedSummaries: ParsedDeptSummary[] = [];

  parsedSummaries.forEach(p => {
    const matchedRole = findMatchingRoleName(p.deptName);
    if (matchedRole) {
      const existing = roleAccumulator.get(matchedRole) || { cadre: 0, perm: 0, absent: 0, temp: 0, cost: 0, hasExplicitCost: false };
      const effectivePerm = Math.max(0, p.permCount);
      const effectiveAbsent = Math.max(0, p.absentCount);
      const effectiveTemp = p.tempCount !== undefined && p.tempCount >= 0 ? p.tempCount : 0;
      const effectiveCadre = p.cadreCount > 0 ? p.cadreCount : (effectivePerm + effectiveAbsent);
      const costVal = (p.costVal !== undefined && p.costVal > 0) ? p.costVal : 0;

      existing.cadre += effectiveCadre;
      existing.perm += effectivePerm;
      existing.absent += effectiveAbsent;
      existing.temp += effectiveTemp;
      existing.cost += costVal;
      if (p.costVal !== undefined && p.costVal > 0) {
        existing.hasExplicitCost = true;
      }
      roleAccumulator.set(matchedRole, existing);
    } else {
      unmappedSummaries.push(p);
    }
  });

  const existingDepts: Department[] = targetSheet?.departments || [];
  const existingMap = new Map<string, Department>();
  existingDepts.forEach(d => {
    existingMap.set(d.name.toUpperCase().trim(), d);
    const matchedStd = findMatchingRoleName(d.name);
    if (matchedStd) {
      existingMap.set(matchedStd.toUpperCase().trim(), d);
    }
  });

  // Rebuild strictly in QUANTUM2_STANDARD_ROSTER 27-role sequence
  const orderedDepts: Department[] = QUANTUM2_STANDARD_ROSTER.map((stdRole, idx) => {
    const stdUpper = stdRole.name.toUpperCase().trim();
    const parsedAccum = roleAccumulator.get(stdRole.name);
    const existing = existingMap.get(stdUpper);

    if (parsedAccum) {
      const effectivePerm = parsedAccum.perm;
      const effectiveAbsent = parsedAccum.absent;
      const effectiveTemp = parsedAccum.temp;
      const effectiveCadre = parsedAccum.cadre > 0 ? parsedAccum.cadre : (effectivePerm + effectiveAbsent || stdRole.cadre);
      
      const permWage = (parsedAccum.hasExplicitCost && effectivePerm > 0)
        ? Math.round((parsedAccum.cost / effectivePerm) * 100) / 100
        : (existing?.roles?.[0]?.permWage || stdRole.wage);

      const deptCost = parsedAccum.hasExplicitCost
        ? parsedAccum.cost
        : Math.round(effectivePerm * permWage * 100) / 100;

      const deptId = existing?.id || `dept_std_${idx}_${Date.now()}`;
      return {
        id: deptId,
        name: stdRole.name,
        cadre: effectiveCadre,
        absent: effectiveAbsent,
        cost: deptCost,
        roles: [{
          id: existing?.roles?.[0]?.id || `role_${deptId}_0`,
          title: stdRole.name,
          cadre: effectiveCadre,
          perm: effectivePerm,
          temp: effectiveTemp,
          absent: effectiveAbsent,
          permWage: permWage,
          tempWage: 125.95,
          cost: deptCost,
          otHeadcount: existing?.roles?.[0]?.otHeadcount || 0,
          otCost: existing?.roles?.[0]?.otCost || 0
        }]
      };
    }

    if (existing) {
      return existing;
    }

    const deptId = `dept_std_${idx}_${Date.now()}`;
    return {
      id: deptId,
      name: stdRole.name,
      cadre: stdRole.cadre,
      absent: 0,
      cost: 0,
      roles: [{
        id: `role_${deptId}_0`,
        title: stdRole.name,
        cadre: stdRole.cadre,
        perm: 0,
        temp: 0,
        absent: 0,
        permWage: stdRole.wage,
        tempWage: 125.95,
        cost: 0,
        otHeadcount: 0,
        otCost: 0
      }]
    };
  });

  // Preserve any custom user-added operational departments not in the 27 standard roles
  unmappedSummaries.forEach((p, pIdx) => {
    const effectivePerm = Math.max(0, p.permCount);
    const effectiveAbsent = Math.max(0, p.absentCount);
    const effectiveTemp = p.tempCount !== undefined && p.tempCount >= 0 ? p.tempCount : 0;
    const effectiveCadre = p.cadreCount > 0 ? p.cadreCount : (effectivePerm + effectiveAbsent);
    const permWage = (p.costVal && p.costVal > 0 && effectivePerm > 0)
      ? Math.round((p.costVal / effectivePerm) * 100) / 100
      : 140.00;
    const deptCost = (p.costVal !== undefined && p.costVal >= 0)
      ? p.costVal
      : Math.round(effectivePerm * permWage * 100) / 100;
    const deptId = `dept_extra_${Date.now()}_${pIdx}`;
    orderedDepts.push({
      id: deptId,
      name: p.deptName,
      cadre: effectiveCadre,
      absent: effectiveAbsent,
      cost: deptCost,
      roles: [{
        id: `role_${deptId}_0`,
        title: p.deptName,
        cadre: effectiveCadre,
        perm: effectivePerm,
        temp: effectiveTemp,
        absent: effectiveAbsent,
        permWage: permWage,
        tempWage: 125.95,
        cost: deptCost,
        otHeadcount: 0,
        otCost: 0
      }]
    });
  });

  return orderedDepts;
}

export default function ClockInUploadModal({
  isOpen,
  onClose,
  activeSheet,
  allSheets = [],
  onApplyHeadcount,
  onApplyMultiDateHeadcount,
  currency
}: ClockInUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [parsedMultiDate, setParsedMultiDate] = useState<DateParsedEntry[]>([]);
  const [selectedPreviewDate, setSelectedPreviewDate] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Date Range Filter & Selection State
  const [fromDateFilter, setFromDateFilter] = useState<string>('');
  const [toDateFilter, setToDateFilter] = useState<string>('');
  const [selectedDateLabels, setSelectedDateLabels] = useState<Set<string>>(new Set());

  // Available parsed date labels
  const allParsedDateLabels = useMemo(() => {
    return parsedMultiDate.map(d => d.dateLabel);
  }, [parsedMultiDate]);

  // When parsedMultiDate changes, initialize default From Date, To Date, and selected set
  useEffect(() => {
    if (parsedMultiDate.length > 0) {
      const firstDate = parsedMultiDate[0].dateLabel;
      const lastDate = parsedMultiDate[parsedMultiDate.length - 1].dateLabel;
      setFromDateFilter(firstDate);
      setToDateFilter(lastDate);
      setSelectedDateLabels(new Set(parsedMultiDate.map(d => d.dateLabel)));
    } else {
      setFromDateFilter('');
      setToDateFilter('');
      setSelectedDateLabels(new Set());
    }
  }, [parsedMultiDate]);

  // Compute which dates fall within the chosen [From Date -> To Date] range
  const datesInRange = useMemo(() => {
    if (parsedMultiDate.length === 0) return [];
    if (!fromDateFilter || !toDateFilter) return parsedMultiDate;

    const fromTime = parseDateLabelToDate(fromDateFilter).getTime();
    const toTime = parseDateLabelToDate(toDateFilter).getTime();
    const minTime = Math.min(fromTime, toTime);
    const maxTime = Math.max(fromTime, toTime);

    return parsedMultiDate.filter(entry => {
      const entryTime = parseDateLabelToDate(entry.dateLabel).getTime();
      return entryTime >= minTime && entryTime <= maxTime;
    });
  }, [parsedMultiDate, fromDateFilter, toDateFilter]);

  // Final filtered list of entries selected for updating
  const datesToApply = useMemo(() => {
    return datesInRange.filter(entry => selectedDateLabels.has(entry.dateLabel));
  }, [datesInRange, selectedDateLabels]);

  const handleFromDateChange = (newFrom: string) => {
    setFromDateFilter(newFrom);
    const fromTime = parseDateLabelToDate(newFrom).getTime();
    const toTime = parseDateLabelToDate(toDateFilter || newFrom).getTime();
    const minTime = Math.min(fromTime, toTime);
    const maxTime = Math.max(fromTime, toTime);

    const inRangeSet = new Set<string>();
    parsedMultiDate.forEach(entry => {
      const t = parseDateLabelToDate(entry.dateLabel).getTime();
      if (t >= minTime && t <= maxTime) {
        inRangeSet.add(entry.dateLabel);
      }
    });
    setSelectedDateLabels(inRangeSet);
  };

  const handleToDateChange = (newTo: string) => {
    setToDateFilter(newTo);
    const fromTime = parseDateLabelToDate(fromDateFilter || newTo).getTime();
    const toTime = parseDateLabelToDate(newTo).getTime();
    const minTime = Math.min(fromTime, toTime);
    const maxTime = Math.max(fromTime, toTime);

    const inRangeSet = new Set<string>();
    parsedMultiDate.forEach(entry => {
      const t = parseDateLabelToDate(entry.dateLabel).getTime();
      if (t >= minTime && t <= maxTime) {
        inRangeSet.add(entry.dateLabel);
      }
    });
    setSelectedDateLabels(inRangeSet);
  };

  const toggleDateSelection = (dateLabel: string) => {
    const nextSet = new Set(selectedDateLabels);
    if (nextSet.has(dateLabel)) {
      nextSet.delete(dateLabel);
    } else {
      nextSet.add(dateLabel);
    }
    setSelectedDateLabels(nextSet);
  };

  const selectAllInRange = () => {
    const nextSet = new Set(selectedDateLabels);
    datesInRange.forEach(d => nextSet.add(d.dateLabel));
    setSelectedDateLabels(nextSet);
  };

  const deselectAllInRange = () => {
    const nextSet = new Set(selectedDateLabels);
    datesInRange.forEach(d => nextSet.delete(d.dateLabel));
    setSelectedDateLabels(nextSet);
  };

  if (!isOpen) return null;

  const processMatrixRows = (
    matrix: any[][],
    defaultDate: string,
    datesAccumulator: Record<string, Record<string, { rawName: string; cadre: number; perm: number; absent: number; temp: number; cost: number }>>
  ) => {
    if (!matrix || matrix.length === 0) return;

    // Helper functions
    const parseNum = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      const str = String(val).trim();
      if (str === '-' || str === '' || str === 'nil' || str === 'N/A' || str === 'null') return 0;
      const cleanStr = str.replace(/[^0-9.-]/g, '');
      if (cleanStr === '-' || cleanStr === '') return 0;
      const num = parseFloat(cleanStr);
      return isNaN(num) ? 0 : num;
    };

    const parseStr = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    // 1. Detect explicit Date inside title cells in top 30 rows
    let detectedDate = defaultDate;
    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      if (!matrix[r]) continue;
      for (let c = 0; c < Math.min(matrix[r].length, 12); c++) {
        const cellText = parseStr(matrix[r][c]);
        if (cellText && cellText.length >= 4) {
          const norm = extractAndNormalizeDate(cellText, '');
          if (norm && norm.length >= 8) {
            detectedDate = norm;
            break;
          }
        }
      }
    }

    // 2. Scan for Header Row
    let headerLineIdx = -1;
    let maxKeywordMatches = 0;

    for (let r = 0; r < Math.min(matrix.length, 35); r++) {
      if (!matrix[r]) continue;
      let distinctColMatches = 0;

      for (let c = 0; c < matrix[r].length; c++) {
        const colStr = parseStr(matrix[r][c]).toLowerCase();
        if (!colStr) continue;

        if (
          colStr.includes('dept') || colStr.includes('department') || colStr.includes('section') || 
          colStr.includes('particulars') || colStr.includes('operation') || colStr.includes('role') || colStr.includes('name') ||
          colStr === 'cadre' || colStr.includes('budget') || colStr.includes('planned') || colStr.includes('sanction') ||
          colStr === 'permanent' || colStr.includes('perm') || colStr.includes('present') || colStr.includes('clock') || colStr.includes('actual') || colStr.includes('attended') ||
          colStr === 'absent' || colStr.includes('leave') || colStr.includes('off') ||
          colStr === 'cost' || colStr.includes('wage') || colStr.includes('amount') || colStr.includes('rate') || colStr.includes('spend') ||
          colStr.includes('temp') || colStr.includes('casual') || colStr.includes('contract') || colStr.includes('agency') || colStr.includes('temporary')
        ) {
          distinctColMatches++;
        }
      }

      if (distinctColMatches > maxKeywordMatches) {
        maxKeywordMatches = distinctColMatches;
        headerLineIdx = r;
      }
    }

    // Fallback: If no multi-column header row found, locate first valid department data row
    if (headerLineIdx === -1 || maxKeywordMatches < 2) {
      for (let r = 0; r < matrix.length; r++) {
        if (!matrix[r]) continue;
        const col0 = parseStr(matrix[r][0]);
        const col1 = parseStr(matrix[r][1]);
        const isDeptCandidate = (col0 && isNaN(Number(col0)) && col0.length > 2) || (col1 && isNaN(Number(col1)) && col1.length > 2);
        if (isDeptCandidate && !col0.toLowerCase().includes('total') && !col0.toLowerCase().includes('manpower') && !col0.toLowerCase().includes('cadre details')) {
          headerLineIdx = Math.max(0, r - 1);
          break;
        }
      }
      if (headerLineIdx === -1) headerLineIdx = 0;
    }

    // 3. Identify Column Indices from Header Row
    const headerRow = (matrix[headerLineIdx] || []).map(c => parseStr(c).toLowerCase());

    const dateIdx = headerRow.findIndex(h => h.includes('date') || h.includes('day') || h.includes('workdate') || h.includes('shift date'));
    const deptIdx = headerRow.findIndex(h => h.includes('dept') || h.includes('department') || h.includes('section') || h.includes('division') || h.includes('title') || h.includes('name') || h.includes('role') || h.includes('particulars') || h.includes('operation') || h.includes('description') || h.includes('job') || h.includes('manpower'));
    const cadreIdx = headerRow.findIndex(h => (h.includes('cadre') || h.includes('budget') || h.includes('planned') || h.includes('sanction') || h.includes('total staff') || h.includes('total headcount') || h.includes('total hc') || h.includes('headcount')) && !h.includes('details') && !h.includes('department') && !h.includes('dept'));
    const presentIdx = headerRow.findIndex(h => h.includes('present') || h.includes('at work') || h.includes('working') || h.includes('clock') || h.includes('perm') || h.includes('permanent') || h.includes('actual') || h.includes('attended') || h.includes('on duty') || h.includes('qty') || h.includes('count'));
    const absentIdx = headerRow.findIndex(h => h.includes('absent') || h.includes('leave') || h.includes('off') || h.includes('sick') || h.includes('away') || h.includes('not at work'));
    let tempIdx = headerRow.findIndex(h => h.includes('temp') || h.includes('casual') || h.includes('contract') || h.includes('agency') || h.includes('extra') || h.includes('sub') || h.includes('helper') || h.includes('temporary') || h.includes('outsourced') || h.includes('non-perm'));
    let costIdx = headerRow.findIndex(h => h.includes('cost') || h.includes('wage') || h.includes('rate') || h.includes('amount') || h.includes('spend') || h.includes('total cost') || h.includes('daily cost') || h.includes('val'));

    // Intelligent Column Resolution: Distinguish Temp Headcount from Currency Cost
    if (tempIdx === -1 || costIdx === -1) {
      const occupiedCols = [deptIdx, cadreIdx, presentIdx, absentIdx, tempIdx, costIdx].filter(i => i !== -1);
      
      for (let c = 0; c < 12; c++) {
        if (occupiedCols.includes(c) || c === deptIdx || c === cadreIdx || c === presentIdx || c === absentIdx) continue;
        
        let hasLargeNumbers = false;
        let hasSmallIntegers = false;

        for (let r = headerLineIdx + 1; r < Math.min(matrix.length, headerLineIdx + 25); r++) {
          if (!matrix[r]) continue;
          const val = parseNum(matrix[r][c]);
          if (val > 0) {
            if (val > 150 || (val % 1 !== 0)) {
              hasLargeNumbers = true;
            } else {
              hasSmallIntegers = true;
            }
          }
        }

        if (hasLargeNumbers && costIdx === -1) {
          costIdx = c;
        } else if (hasSmallIntegers && tempIdx === -1) {
          tempIdx = c;
        }
      }
    }

    // Smart Column Defaults
    let dCol = deptIdx !== -1 ? deptIdx : 0;
    let textInCol0 = 0;
    let textInCol1 = 0;
    for (let r = headerLineIdx + 1; r < Math.min(matrix.length, headerLineIdx + 10); r++) {
      if (!matrix[r]) continue;
      if (isNaN(Number(parseStr(matrix[r][0]))) && parseStr(matrix[r][0]).length > 2) textInCol0++;
      if (isNaN(Number(parseStr(matrix[r][1]))) && parseStr(matrix[r][1]).length > 2) textInCol1++;
    }
    if (deptIdx === -1) {
      dCol = (textInCol1 > textInCol0 && textInCol1 > 2) ? 1 : 0;
    }

    let pCol = presentIdx;
    if (pCol === -1) {
      if (cadreIdx !== -1) pCol = cadreIdx;
      else pCol = dCol === 0 ? 1 : 2;
    }

    // 4. Extract Data Rows
    for (let r = headerLineIdx + 1; r < matrix.length; r++) {
      if (!matrix[r]) continue;
      const rawDeptStr = parseStr(matrix[r][dCol]);
      if (!rawDeptStr) continue;

      const rawDept = rawDeptStr.replace(/^[0-9.]+\s*/, '').trim();
      const lowerDept = rawDept.toLowerCase();

      if (
        !rawDept ||
        lowerDept.includes('total') ||
        lowerDept.includes('subtotal') ||
        lowerDept.includes('cadre details') ||
        lowerDept.includes('summary') ||
        lowerDept.includes('department') ||
        lowerDept.includes('prepared by') ||
        lowerDept.includes('approved by') ||
        lowerDept.includes('signed') ||
        lowerDept.includes('page ')
      ) {
        continue;
      }

      let rowDate = detectedDate;
      if (dateIdx !== -1 && matrix[r][dateIdx]) {
        const rawRowDate = parseStr(matrix[r][dateIdx]);
        if (rawRowDate && rawRowDate.length >= 3) {
          rowDate = extractAndNormalizeDate(rawRowDate, detectedDate);
        }
      }

      const cadreVal = cadreIdx !== -1 && cadreIdx < matrix[r].length ? parseNum(matrix[r][cadreIdx]) : 0;
      let presentVal = pCol !== -1 && pCol < matrix[r].length ? parseNum(matrix[r][pCol]) : 0;

      if (presentVal === 0 && cadreVal > 0 && presentIdx === -1) {
        presentVal = cadreVal;
      }

      let absentVal = absentIdx !== -1 && absentIdx < matrix[r].length ? parseNum(matrix[r][absentIdx]) : 0;
      
      // Core Rule: CADRE = Total employees, PRESENT = At work today, ABSENT = Not at work
      if (absentVal === 0 && cadreVal > presentVal) {
        absentVal = cadreVal - presentVal;
      }

      let effectiveCadre = cadreVal;
      if (effectiveCadre === 0 && (presentVal > 0 || absentVal > 0)) {
        effectiveCadre = presentVal + absentVal;
      }

      const tempVal = tempIdx !== -1 && tempIdx < matrix[r].length ? parseNum(matrix[r][tempIdx]) : 0;
      const costVal = costIdx !== -1 && costIdx < matrix[r].length ? parseNum(matrix[r][costIdx]) : 0;

      // Skip row if completely non-data
      if (effectiveCadre === 0 && presentVal === 0 && absentVal === 0 && tempVal === 0 && costVal === 0) {
        if (rawDept.length < 2) continue;
      }

      if (!datesAccumulator[rowDate]) {
        datesAccumulator[rowDate] = {};
      }

      const deptKey = rawDept.toUpperCase();
      if (!datesAccumulator[rowDate][deptKey]) {
        datesAccumulator[rowDate][deptKey] = { rawName: rawDept, cadre: 0, perm: 0, absent: 0, temp: 0, cost: 0 };
      }

      datesAccumulator[rowDate][deptKey].cadre += effectiveCadre;
      datesAccumulator[rowDate][deptKey].perm += presentVal;
      datesAccumulator[rowDate][deptKey].absent += absentVal;
      datesAccumulator[rowDate][deptKey].temp += tempVal;
      datesAccumulator[rowDate][deptKey].cost += costVal;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles: File[] = Array.from(e.target.files || []);
    if (uploadedFiles.length === 0) return;
    setFiles(uploadedFiles);
    setParseError(null);
    setSuccessMessage(null);

    const datesAccumulator: Record<string, Record<string, { rawName: string; cadre: number; perm: number; absent: number; temp: number; cost: number }>> = {};

    try {
      for (const uploadedFile of uploadedFiles) {
        const fileName = uploadedFile.name;
        const fileDate = extractAndNormalizeDate(fileName, activeSheet?.label || '21 JULY 2026');

        if (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) {
          const buffer = await uploadedFile.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            const sheetDate = extractAndNormalizeDate(sheetName, fileDate);

            processMatrixRows(matrix, sheetDate, datesAccumulator);
          }
        } else {
          const text = await uploadedFile.text();
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          const textMatrix = lines.map(line => line.split(/,|\t|;/).map(cell => cell.trim().replace(/^["']|["']$/g, '')));
          processMatrixRows(textMatrix, fileDate, datesAccumulator);
        }
      }

      const multiDateEntries: DateParsedEntry[] = Object.keys(datesAccumulator).map(dLabel => {
        const deptMap = datesAccumulator[dLabel];
        const summaries: ParsedDeptSummary[] = Object.keys(deptMap).map(k => {
          const info = deptMap[k];
          return {
            deptName: info.rawName,
            cadreCount: info.cadre,
            permCount: info.perm,
            absentCount: info.absent,
            tempCount: info.temp,
            costVal: info.cost
          };
        });

        return {
          dateLabel: dLabel,
          departments: summaries
        };
      });

      if (multiDateEntries.length === 0) {
        setParseError("Could not parse any department records from file(s). Please verify column headers.");
      } else {
        // Sort parsed dates chronologically
        multiDateEntries.sort((a, b) => {
          const tA = new Date(extractAndNormalizeDate(a.dateLabel)).getTime();
          const tB = new Date(extractAndNormalizeDate(b.dateLabel)).getTime();
          return tA - tB;
        });

        setParsedMultiDate(multiDateEntries);
        setSelectedPreviewDate(multiDateEntries[0].dateLabel);
      }
    } catch (err: any) {
      setParseError(`Failed to parse file(s): ${err?.message || 'Invalid spreadsheet structure'}`);
    }
  };

  const activePreviewEntry = parsedMultiDate.find(d => d.dateLabel === selectedPreviewDate) || parsedMultiDate[0];

  const handleApplySelectedDates = () => {
    if (datesToApply.length === 0) return;

    const allUpdates = datesToApply.map(entry => {
      // Look up target sheet from allSheets or activeSheet
      const normalizedEntryDate = extractAndNormalizeDate(entry.dateLabel);
      const targetSheet = (allSheets || []).find(s => extractAndNormalizeDate(s.label) === normalizedEntryDate) ||
        (extractAndNormalizeDate(activeSheet?.label) === normalizedEntryDate ? activeSheet : undefined);

      const mergedDepts = mergeParsedDepartmentsIntoSheet(targetSheet, entry.departments);

      return {
        dateLabel: entry.dateLabel,
        departments: mergedDepts
      };
    });

    if (onApplyMultiDateHeadcount) {
      onApplyMultiDateHeadcount(allUpdates);
    } else {
      allUpdates.forEach(up => onApplyHeadcount(up.departments, up.dateLabel));
    }

    setSuccessMessage(`Clock-in data successfully applied & saved to Cloud Firestore for ${datesToApply.length} selected shift dates!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleApplyAllDates = () => {
    if (parsedMultiDate.length === 0) return;

    const allUpdates = parsedMultiDate.map(entry => {
      // Look up target sheet from allSheets or activeSheet
      const normalizedEntryDate = extractAndNormalizeDate(entry.dateLabel);
      const targetSheet = (allSheets || []).find(s => extractAndNormalizeDate(s.label) === normalizedEntryDate) ||
        (extractAndNormalizeDate(activeSheet?.label) === normalizedEntryDate ? activeSheet : undefined);

      const mergedDepts = mergeParsedDepartmentsIntoSheet(targetSheet, entry.departments);

      return {
        dateLabel: entry.dateLabel,
        departments: mergedDepts
      };
    });

    if (onApplyMultiDateHeadcount) {
      onApplyMultiDateHeadcount(allUpdates);
    } else {
      allUpdates.forEach(up => onApplyHeadcount(up.departments, up.dateLabel));
    }

    setSuccessMessage(`Clock-in data successfully applied & saved to Cloud Firestore for all ${parsedMultiDate.length} shift dates!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleApplySingleDate = () => {
    if (!activePreviewEntry) return;

    const normalizedEntryDate = extractAndNormalizeDate(activePreviewEntry.dateLabel);
    const targetSheet = (allSheets || []).find(s => extractAndNormalizeDate(s.label) === normalizedEntryDate) ||
      (extractAndNormalizeDate(activeSheet?.label) === normalizedEntryDate ? activeSheet : undefined);

    const mergedDepts = mergeParsedDepartmentsIntoSheet(targetSheet, activePreviewEntry.departments);

    onApplyHeadcount(mergedDepts, activePreviewEntry.dateLabel);
    setSuccessMessage(`Clock-in data updated & saved to Cloud Firestore for ${activePreviewEntry.dateLabel}!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const downloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();

    const generateSheetRows = (title: string, roster: typeof QUANTUM2_07_AUG_ROSTER) => {
      const rows: any[][] = [
        [title],
        ["Department/Role", "Cadre", "Present", "Absent", "Cost"]
      ];
      let totCadre = 0;
      let totPresent = 0;
      let totAbsent = 0;
      let totCost = 0;

      roster.forEach(r => {
        totCadre += r.cadre;
        totPresent += r.perm;
        totAbsent += r.absent;
        totCost += r.cost;
        rows.push([
          r.name,
          r.cadre,
          r.perm,
          r.absent > 0 ? r.absent : "-",
          r.cost > 0 ? r.cost : "-"
        ]);
      });

      rows.push(["Total", totCadre, totPresent, totAbsent, totCost]);
      return rows;
    };

    const sampleRows03 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (03.08.2026)", QUANTUM2_03_AUG_ROSTER);
    const sampleRows07 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (07.08.2026)", QUANTUM2_07_AUG_ROSTER);
    const sampleRows10 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (10.08.2026)", QUANTUM2_10_AUG_ROSTER);
    const sampleRows12 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (12.08.2026)", QUANTUM2_12_AUG_ROSTER);
    const sampleRows14 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (14.08.2026)", QUANTUM2_14_AUG_ROSTER);
    const sampleRows08 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (08.08.2026)", QUANTUM2_08_AUG_ROSTER);
    const sampleRows21 = generateSheetRows("Cadre Details Quantum 2 - Manpower Details (21 JULY 2026)", QUANTUM2_21_JULY_ROSTER);

    const ws03 = XLSX.utils.aoa_to_sheet(sampleRows03);
    const ws07 = XLSX.utils.aoa_to_sheet(sampleRows07);
    const ws10 = XLSX.utils.aoa_to_sheet(sampleRows10);
    const ws12 = XLSX.utils.aoa_to_sheet(sampleRows12);
    const ws14 = XLSX.utils.aoa_to_sheet(sampleRows14);
    const ws08 = XLSX.utils.aoa_to_sheet(sampleRows08);
    const ws21 = XLSX.utils.aoa_to_sheet(sampleRows21);

    XLSX.utils.book_append_sheet(wb, ws03, "03.08.2026");
    XLSX.utils.book_append_sheet(wb, ws07, "07.08.2026");
    XLSX.utils.book_append_sheet(wb, ws10, "10.08.2026");
    XLSX.utils.book_append_sheet(wb, ws12, "12.08.2026");
    XLSX.utils.book_append_sheet(wb, ws14, "14.08.2026");
    XLSX.utils.book_append_sheet(wb, ws08, "08.08.2026");
    XLSX.utils.book_append_sheet(wb, ws21, "21 JULY 2026");
    XLSX.writeFile(wb, "Cadre_Details_Quantum2_Manpower_Details.xlsx");
  };

  const grandTotalCadreAll = parsedMultiDate.reduce((acc, dateEntry) => {
    return acc + dateEntry.departments.reduce((s, d) => s + (d.cadreCount || (d.permCount + d.absentCount)), 0);
  }, 0);

  const grandTotalPermAll = parsedMultiDate.reduce((acc, dateEntry) => {
    return acc + dateEntry.departments.reduce((s, d) => s + d.permCount, 0);
  }, 0);

  const grandTotalAbsentAll = parsedMultiDate.reduce((acc, dateEntry) => {
    return acc + dateEntry.departments.reduce((s, d) => s + d.absentCount, 0);
  }, 0);

  const grandTotalTempAll = parsedMultiDate.reduce((acc, dateEntry) => {
    return acc + dateEntry.departments.reduce((s, d) => s + (d.tempCount || 0), 0);
  }, 0);

  const grandTotalCostAll = parsedMultiDate.reduce((acc, dateEntry) => {
    return acc + dateEntry.departments.reduce((s, d) => {
      const permCost = (d.costVal && d.costVal > 0) ? d.costVal : (d.permCount * 158.15);
      const tempCost = (d.tempCount || 0) * 125.95;
      return s + permCost + tempCost;
    }, 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-pink-200 shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with pastel pink theme */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight flex items-center gap-2">
                Cadre Clock-In Import
                <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-[10px] font-black tracking-wider uppercase">
                  Cadre / Present / Absent Format
                </span>
              </h3>
              <p className="text-pink-100 text-xs font-medium">
                Standard format: <strong className="text-white">Cadre</strong> (Total Staff), <strong className="text-white">Present</strong> (At Work Today), <strong className="text-white">Absent</strong> (Not At Work), and <strong className="text-white">Cost</strong>.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Format Specification Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3.5 bg-pink-50/60 border border-pink-200/80 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <div>
                <strong className="text-slate-800 block text-[11px] font-black uppercase">Cadre</strong>
                <span className="text-[10px] text-slate-500">Total employees headcount</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div>
                <strong className="text-emerald-800 block text-[11px] font-black uppercase">Present</strong>
                <span className="text-[10px] text-emerald-600 font-medium">Employees at work today</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <div>
                <strong className="text-rose-800 block text-[11px] font-black uppercase">Absent</strong>
                <span className="text-[10px] text-rose-600 font-medium">Employees not at work</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-600" />
              <div>
                <strong className="text-pink-800 block text-[11px] font-black uppercase">Cost</strong>
                <span className="text-[10px] text-pink-600 font-medium">Wage amount for present staff</span>
              </div>
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div className="border-2 border-dashed border-pink-300 rounded-2xl p-5 bg-pink-50/30 hover:bg-pink-50 transition text-center space-y-2.5 relative group">
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-11 h-11 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto text-pink-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800">
                {files.length > 0 
                  ? `${files.length} file(s) selected: ${files.map(f => f.name).join(', ')}`
                  : "Click or Drag & Drop Cadre Details Excel (.xlsx) / CSV file"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Matches "Cadre Details Quantum 2 - Manpower Details" with columns: <span className="font-mono font-bold text-slate-700">Department/Role | Cadre | Present | Absent | Cost</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 relative z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadSampleExcel();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-700 underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Quantum 2 Sample Excel (.xlsx) Template
              </button>
            </div>
          </div>

          {parseError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{parseError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          {/* Multi-Date Parsed Summary Preview */}
          {parsedMultiDate.length > 0 && (
            <div className="space-y-4">
              {/* Grand Total Header & Range Update Controls */}
              <div className="p-4 bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-pink-500/10 border border-pink-200 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-pink-600 text-white rounded-xl font-mono text-xs font-black">
                      {parsedMultiDate.length}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                        {parsedMultiDate.length === 1 ? '1 Shift Date Parsed' : `${parsedMultiDate.length} Shift Dates Parsed from Clock-In Data`}
                      </h4>
                      <p className="text-[11px] text-slate-600 font-medium flex items-center gap-2 flex-wrap mt-0.5">
                        <span>Cadre: <strong className="text-slate-800 font-mono font-bold">{grandTotalCadreAll}</strong></span>
                        <span>• Present: <strong className="text-emerald-700 font-mono font-bold">{grandTotalPermAll}</strong></span>
                        <span>• Absent: <strong className="text-rose-700 font-mono font-bold">{grandTotalAbsentAll}</strong></span>
                        {grandTotalTempAll > 0 && (
                          <span>• Temp: <strong className="text-amber-700 font-mono font-extrabold">{grandTotalTempAll}</strong></span>
                        )}
                        <span>• Combined Daily Cost: <strong className="text-slate-900 font-mono font-black">{currency} {grandTotalCostAll.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleApplySelectedDates}
                      disabled={datesToApply.length === 0}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer flex items-center gap-1.5 ${
                        datesToApply.length > 0
                          ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white hover:scale-[1.01]'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Apply {datesToApply.length} Selected Date{datesToApply.length === 1 ? '' : 's'}
                    </button>
                    {parsedMultiDate.length > 1 && (
                      <button
                        type="button"
                        onClick={handleApplyAllDates}
                        className="px-3.5 py-2 bg-white hover:bg-pink-50 text-pink-700 border border-pink-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        Apply All {parsedMultiDate.length}
                      </button>
                    )}
                  </div>
                </div>

                {/* Range Selector Controls (From Date to To Date) */}
                <div className="pt-3 border-t border-pink-200/80 bg-white/70 backdrop-blur-xs p-3.5 rounded-xl border space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-pink-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                        Choose Date Range to Update:
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllInRange}
                        className="text-[11px] font-bold text-pink-600 hover:text-pink-800 underline cursor-pointer"
                      >
                        Select All in Range
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={deselectAllInRange}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                        From Shift Date:
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        <select
                          value={fromDateFilter}
                          onChange={(e) => handleFromDateChange(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-pink-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-500 cursor-pointer"
                        >
                          {allParsedDateLabels.map(lbl => (
                            <option key={`from_${lbl}`} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>To Shift Date:</span>
                        <span className="text-[10px] font-bold text-pink-600 font-mono">
                          {datesToApply.length} of {parsedMultiDate.length} dates active
                        </span>
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        <select
                          value={toDateFilter}
                          onChange={(e) => handleToDateChange(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-pink-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-500 cursor-pointer"
                        >
                          {allParsedDateLabels.map(lbl => (
                            <option key={`to_${lbl}`} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Range Chips Filter & Toggle */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Included Dates (click checkbox to include/exclude specific dates in update):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
                      {parsedMultiDate.map((entry) => {
                        const isChecked = selectedDateLabels.has(entry.dateLabel);
                        const isInCurrentRange = datesInRange.some(d => d.dateLabel === entry.dateLabel);
                        const dayMeta = getDayInfo(entry.dateLabel);

                        return (
                          <label
                            key={`chip_${entry.dateLabel}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer select-none ${
                              isChecked
                                ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                                : isInCurrentRange
                                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDateSelection(entry.dateLabel)}
                              className="w-3.5 h-3.5 rounded text-pink-600 focus:ring-pink-500 cursor-pointer accent-pink-600"
                            />
                            <span className="text-[11px]">{dayMeta.dayShort} {entry.dateLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Selector Tabs */}
              {parsedMultiDate.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Select Shift Date to Preview Department Breakdown:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    {parsedMultiDate.map((entry) => {
                      const isSelected = entry.dateLabel === selectedPreviewDate;
                      const dateCadreCount = entry.departments.reduce((s, d) => s + (d.cadreCount || (d.permCount + d.absentCount)), 0);
                      const datePermCount = entry.departments.reduce((s, d) => s + d.permCount, 0);
                      const dateAbsentCount = entry.departments.reduce((s, d) => s + d.absentCount, 0);
                      const dayMeta = getDayInfo(entry.dateLabel);

                      return (
                        <button
                          key={entry.dateLabel}
                          type="button"
                          onClick={() => setSelectedPreviewDate(entry.dateLabel)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shrink-0 flex items-center gap-2 border ${
                            isSelected
                              ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 opacity-80" />
                          <span>{dayMeta.dayShort} {entry.dateLabel}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {datePermCount}/{dateCadreCount} Present ({dateAbsentCount} Abs)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Date Breakdown Table */}
              {activePreviewEntry && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-pink-600" />
                      Breakdown for: <strong className="text-slate-900">{activePreviewEntry.dateLabel}</strong> ({activePreviewEntry.departments.length} positions/departments)
                    </span>
                    <button
                      type="button"
                      onClick={handleApplySingleDate}
                      className="text-[11px] font-bold text-pink-600 hover:text-pink-800 underline cursor-pointer"
                    >
                      Update only {activePreviewEntry.dateLabel}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto border border-pink-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-[10px] font-extrabold uppercase text-slate-700 border-b border-slate-200 tracking-wider">
                        <tr>
                          <th className="p-2.5 pl-3">Department / Role</th>
                          <th className="p-2.5 text-right">Cadre (Total)</th>
                          <th className="p-2.5 text-right text-emerald-800 bg-emerald-50/50">Present (At Work)</th>
                          <th className="p-2.5 text-right text-rose-800">Absent</th>
                          <th className="p-2.5 text-right text-pink-900 bg-pink-50/50">Cost</th>
                          <th className="p-2.5 text-right pr-3">Rate / Person</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {activePreviewEntry.departments.map((d, idx) => {
                          const calculatedWage = d.costVal && d.costVal > 0 && d.permCount > 0 
                            ? Math.round((d.costVal / d.permCount) * 100) / 100 
                            : 158.15;
                          const calculatedPermCost = d.costVal && d.costVal > 0 
                            ? d.costVal 
                            : Math.round(calculatedWage * d.permCount);
                          const totalCadre = d.cadreCount || (d.permCount + d.absentCount);

                          return (
                            <tr key={idx} className="hover:bg-pink-50/40 transition">
                              <td className="p-2.5 pl-3 font-sans font-bold text-slate-800 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${d.absentCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                {d.deptName}
                              </td>
                              <td className="p-2.5 text-right text-slate-700 font-bold">
                                {totalCadre}
                              </td>
                              <td className="p-2.5 text-right font-black text-emerald-800 bg-emerald-50/30">
                                {d.permCount}
                              </td>
                              <td className="p-2.5 text-right font-bold text-rose-600">
                                {d.absentCount > 0 ? d.absentCount : '-'}
                              </td>
                              <td className="p-2.5 text-right font-black text-pink-900 bg-pink-50/30">
                                {currency} {calculatedPermCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="p-2.5 text-right pr-3 text-[11px] text-slate-500">
                                {currency} {calculatedWage.toFixed(2)}/day
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-pink-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Cloud Firestore Auto-Sync Active
            </span>
          </div>

          {parsedMultiDate.length > 0 && (
            <div className="flex items-center gap-2.5 flex-wrap">
              {parsedMultiDate.length > 1 && (
                <button
                  type="button"
                  onClick={handleApplyAllDates}
                  className="px-4 py-2.5 bg-white hover:bg-pink-50 text-pink-700 border border-pink-300 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-xs"
                >
                  Apply All {parsedMultiDate.length} Dates
                </button>
              )}
              <button
                type="button"
                onClick={handleApplySelectedDates}
                disabled={datesToApply.length === 0}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition cursor-pointer flex items-center gap-2 ${
                  datesToApply.length > 0
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Apply {datesToApply.length} Selected Date{datesToApply.length === 1 ? '' : 's'} ({fromDateFilter} → {toDateFilter})
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
