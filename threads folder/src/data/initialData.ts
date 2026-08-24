import { SheetData, Department, StyleEarning, SahRecord } from '../types';
import { getAllPayCyclesFromSheets, getAllDatesForPayCycle, parseDateLabelToDate, isDateOnOrAfterCutoff, sortSheetsChronologically, extractAndNormalizeDate } from '../utils/payCycle';

// Production Department calculated wage benchmarks derived from 41 staff members CSV:
// - 27 staff @ R158.15 (25 MOs, 1 Checking, 1 Supervisor) = R4,270.05
// - 7 staff @ R152.30 (7 MOs) = R1,066.10
// - 7 staff @ R156.90 (2 Ironing, 2 Checking, 2 Packing, 1 Scorelady) = R1,098.30
// Total Daily Wage: R6,434.45 / 41 staff = R156.94 Overall Production Daily Average
export const PRODUCTION_WAGE_BENCHMARKS = {
  OVERALL_AVG: 156.94,      // Total Daily R6,434.45 / 41 staff
  MO_AVG: 156.87,           // 32 Machine Operators (25 @ R158.15, 7 @ R152.30)
  SUPERVISOR_AVG: 158.15,   // 1 Supervisor @ R158.15
  CHECKING_AVG: 157.32,     // 3 Checkers (1 @ R158.15, 2 @ R156.90)
  GENERAL_AVG: 156.90,      // Ironing (2), Packing (2), Scorelady (1) @ R156.90
  TOTAL_STAFF_COUNT: 41,
  TOTAL_DAILY_WAGE: 6434.45
};

export const WAGE_RATES = {
  PERM_MO: PRODUCTION_WAGE_BENCHMARKS.MO_AVG,        // R156.87 (Production MO Average)
  PERM_GEN: PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG,   // R156.90 (Production General Average)
  PERM_SUP: PRODUCTION_WAGE_BENCHMARKS.SUPERVISOR_AVG,// R158.15 (Production Supervisor Average)
  PRODUCTION_AVG: PRODUCTION_WAGE_BENCHMARKS.OVERALL_AVG, // R156.94 (Production Department Overall Average)
  TEMP: 125.95
};

export const ALL_DEPTS = [
  "CUTTING", "PRODUCTION FLOOR", "FABRIC ROOM", "FABRIC INSPECTION",
  "PRE-PRODUCTION", "SAMPLE ROOM", "PACKING", "QC", "MAINTENANCE",
  "AFTERWASHING", "PRODUCTION MANAGEMENT", "CLEANING", "PRINTING",
  "INDUSTRIAL ENGINEERING", "STORES", "NEEDLE ROOM", "SECURITY",
  "HUMAN RESOURCES", "OTHERS"
];

export const DEPT_ROLES: Record<string, { title: string; wage: number; type: 'sup' | 'mo' | 'gen'; weight: number }[]> = {
  "CUTTING": [
    { title: "Supervisor", wage: WAGE_RATES.PERM_SUP, type: "sup", weight: 0.05 },
    { title: "Team Leader", wage: WAGE_RATES.PERM_SUP, type: "sup", weight: 0.05 },
    { title: "Cutter", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.25 },
    { title: "Piping MO", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.08 },
    { title: "Re-cut", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.06 },
    { title: "Bundling", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.12 },
    { title: "Layer", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.10 },
    { title: "QCs", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.08 },
    { title: "Cleaner", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.05 },
    { title: "Bundle Boy", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.06 },
    { title: "CAD", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.05 },
    { title: "Data Entry", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.05 }
  ],
  "PRODUCTION FLOOR": [
    { title: "Line Managers", wage: WAGE_RATES.PERM_SUP, type: "sup", weight: 0.03 },
    { title: "Supervisors", wage: WAGE_RATES.PERM_SUP, type: "sup", weight: 0.05 },
    { title: "Scoreladies", wage: PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG, type: "sup", weight: 0.02 },
    { title: "MOs", wage: PRODUCTION_WAGE_BENCHMARKS.MO_AVG, type: "mo", weight: 0.65 },
    { title: "Ironers", wage: PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG, type: "gen", weight: 0.10 },
    { title: "Helpers", wage: PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG, type: "gen", weight: 0.10 },
    { title: "Packers", wage: PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG, type: "gen", weight: 0.05 }
  ],
  "FABRIC ROOM": [
    { title: "Manager", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.08 },
    { title: "Supervisor", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.08 },
    { title: "Offloaders", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.25 },
    { title: "Relaxing", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.20 },
    { title: "Swatchers", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.20 },
    { title: "Binding Cutters", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.19 }
  ],
  "FABRIC INSPECTION": [
    { title: "Fabric Inspectors", wage: WAGE_RATES.PERM_MO, type: "gen", weight: 1.0 }
  ],
  "PRE-PRODUCTION": [
    { title: "QCO Champion", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.08 },
    { title: "Senior Technician", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.08 },
    { title: "Technician", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.20 },
    { title: "PPZ QC", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.18 },
    { title: "Jumpers", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.18 },
    { title: "Packers", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.14 },
    { title: "Helpers", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.14 }
  ],
  "SAMPLE ROOM": [
    { title: "Supervisor", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.15 },
    { title: "MOs", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.60 },
    { title: "QC", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.25 }
  ],
  "PACKING": [
    { title: "Packing Supervisor", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.20 },
    { title: "Packing Assistant", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.80 }
  ],
  "QC": [
    { title: "QC Assistant", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.25 },
    { title: "Production Floor QC", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.30 },
    { title: "Fabric Inspection QC", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.25 },
    { title: "Heat Seal", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.20 }
  ],
  "MAINTENANCE": [
    { title: "Maintenance Assistant", wage: WAGE_RATES.PERM_MO, type: "gen", weight: 1.0 }
  ],
  "AFTERWASHING": [
    { title: "MOs", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 0.20 },
    { title: "Helper", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.20 },
    { title: "Ironer", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.20 },
    { title: "QC", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.15 },
    { title: "Packer", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.15 },
    { title: "Printing", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.10 }
  ],
  "PRODUCTION MANAGEMENT": [
    { title: "Production Coordinator", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.50 },
    { title: "Planning", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.50 }
  ],
  "CLEANING": [
    { title: "Cleaners", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 1.0 }
  ],
  "PRINTING": [
    { title: "Printing Supervisor", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.25 },
    { title: "Printing Assistant", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.75 }
  ],
  "INDUSTRIAL ENGINEERING": [
    { title: "Engineering Officers", wage: WAGE_RATES.PERM_MO, type: "mo", weight: 1.0 }
  ],
  "STORES": [
    { title: "Sub Stores Assistant", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 1.0 }
  ],
  "NEEDLE ROOM": [
    { title: "Needle Room Assistant", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 1.0 }
  ],
  "SECURITY": [
    { title: "Security Officer", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 1.0 }
  ],
  "HUMAN RESOURCES": [
    { title: "HR Officer", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.40 },
    { title: "HR Assistant", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.60 }
  ],
  "OTHERS": [
    { title: "Project Coordinator", wage: WAGE_RATES.PERM_MO, type: "sup", weight: 0.25 },
    { title: "Packer", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.40 },
    { title: "Scorelady", wage: WAGE_RATES.PERM_GEN, type: "gen", weight: 0.35 }
  ]
};

// Headcount dataset mapped to 2026 starting strictly from 21st July 2026 across monthly pay cycles
export const HC_BY_DATE_2026: Record<string, Record<string, number>> = {
  // Pay Cycle: 21 JULY 2026 - 20 AUGUST 2026 (Jul/Aug Pay Cycle)
  "21 JULY 2026": { "CUTTING": 58, "PRODUCTION FLOOR": 270, "FABRIC ROOM": 10, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 8, "SAMPLE ROOM": 8, "PACKING": 5, "QC": 38, "MAINTENANCE": 3, "AFTERWASHING": 20, "PRODUCTION MANAGEMENT": 1, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 4, "HUMAN RESOURCES": 3, "OTHERS": 3 },
  "22 JULY 2026": { "CUTTING": 60, "PRODUCTION FLOOR": 275, "FABRIC ROOM": 10, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 8, "SAMPLE ROOM": 8, "PACKING": 5, "QC": 40, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 1, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 4, "HUMAN RESOURCES": 3, "OTHERS": 3 },
  "23 JULY 2026": { "CUTTING": 60, "PRODUCTION FLOOR": 280, "FABRIC ROOM": 10, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 8, "SAMPLE ROOM": 9, "PACKING": 5, "QC": 40, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 4, "HUMAN RESOURCES": 3, "OTHERS": 3 },
  "25 JULY 2026": { "CUTTING": 61, "PRODUCTION FLOOR": 282, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 9, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 3 },
  "28 JULY 2026": { "CUTTING": 61, "PRODUCTION FLOOR": 283, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 9, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 3 },
  "30 JULY 2026": { "CUTTING": 52, "PRODUCTION FLOOR": 67, "FABRIC ROOM": 8, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 1, "SAMPLE ROOM": 6, "PACKING": 3, "QC": 14, "MAINTENANCE": 1, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 0, "CLEANING": 1, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 0, "STORES": 1, "NEEDLE ROOM": 0, "SECURITY": 2, "HUMAN RESOURCES": 1, "OTHERS": 1 },
  "1 AUGUST 2026": { "CUTTING": 62, "PRODUCTION FLOOR": 284, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 9, "PACKING": 5, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 1, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 2, "HUMAN RESOURCES": 3, "OTHERS": 4 },
  "3 AUGUST 2026": { "CUTTING": 61, "PRODUCTION FLOOR": 281, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 8, "SAMPLE ROOM": 9, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 4 },
  "5 AUGUST 2026": { "CUTTING": 62, "PRODUCTION FLOOR": 284, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 20, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 4 },
  "8 AUGUST 2026": { "CUTTING": 63, "PRODUCTION FLOOR": 295, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 1, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "10 AUGUST 2026": { "CUTTING": 64, "PRODUCTION FLOOR": 295, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 1, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "11 AUGUST 2026": { "CUTTING": 64, "PRODUCTION FLOOR": 295, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 1, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "12 AUGUST 2026": { "CUTTING": 64, "PRODUCTION FLOOR": 295, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 5, "QC": 41, "MAINTENANCE": 3, "AFTERWASHING": 21, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 1, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "14 AUGUST 2026": { "CUTTING": 65, "PRODUCTION FLOOR": 296, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "15 AUGUST 2026": { "CUTTING": 65, "PRODUCTION FLOOR": 298, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "18 AUGUST 2026": { "CUTTING": 65, "PRODUCTION FLOOR": 300, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "20 AUGUST 2026": { "CUTTING": 65, "PRODUCTION FLOOR": 300, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },

  // Pay Cycle 9: 21 AUGUST 2026 - 20 SEPTEMBER 2026 (Aug/Sep Pay Cycle)
  "21 AUGUST 2026": { "CUTTING": 65, "PRODUCTION FLOOR": 300, "FABRIC ROOM": 11, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 42, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "25 AUGUST 2026": { "CUTTING": 66, "PRODUCTION FLOOR": 302, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 43, "MAINTENANCE": 3, "AFTERWASHING": 22, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "1 SEPTEMBER 2026": { "CUTTING": 66, "PRODUCTION FLOOR": 305, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 9, "SAMPLE ROOM": 10, "PACKING": 6, "QC": 43, "MAINTENANCE": 3, "AFTERWASHING": 23, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "10 SEPTEMBER 2026": { "CUTTING": 67, "PRODUCTION FLOOR": 308, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 44, "MAINTENANCE": 3, "AFTERWASHING": 23, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "20 SEPTEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 310, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 45, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },

  // Pay Cycle 10: 21 SEP 2026 – 20 OCT 2026 (Sep/Oct Pay Cycle)
  "21 SEPTEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 310, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 45, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "25 SEPTEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 310, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 45, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "1 OCTOBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 312, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 45, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "10 OCTOBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "20 OCTOBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },

  // Pay Cycle 11: 21 OCT 2026 – 20 NOV 2026 (Oct/Nov Pay Cycle)
  "21 OCTOBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "25 OCTOBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "1 NOVEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "10 NOVEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "20 NOVEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },

  // Pay Cycle 12: 21 NOV 2026 – 20 DEC 2026 (Nov/Dec Pay Cycle)
  "21 NOVEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "25 NOVEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "1 DECEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "10 DECEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "20 DECEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },

  // Pay Cycle 13: 21 DEC 2026 – 20 JAN 2027 (Dec 2026/Jan 2027 Pay Cycle)
  "21 DECEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "25 DECEMBER 2026": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "2 JANUARY 2027": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "10 JANUARY 2027": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 },
  "20 JANUARY 2027": { "CUTTING": 68, "PRODUCTION FLOOR": 315, "FABRIC ROOM": 12, "FABRIC INSPECTION": 1, "PRE-PRODUCTION": 10, "SAMPLE ROOM": 10, "PACKING": 7, "QC": 46, "MAINTENANCE": 3, "AFTERWASHING": 24, "PRODUCTION MANAGEMENT": 2, "CLEANING": 5, "PRINTING": 2, "INDUSTRIAL ENGINEERING": 4, "STORES": 3, "NEEDLE ROOM": 1, "SECURITY": 5, "HUMAN RESOURCES": 3, "OTHERS": 2 }
};

// Default styles with prices and initial SMVs (Standard Minute Values) - users requested SMVs for each style!
export const DEFAULT_STYLES: { style: string; cmPrice: number; smv: number }[] = [
  { style: "NWJ1492/A-CHOCO", cmPrice: 31.0, smv: 12.5 },
  { style: "PW4630/B-PRINT 2", cmPrice: 10.5, smv: 8.2 },
  { style: "WSH7265/A PRINT 1", cmPrice: 10.5, smv: 9.0 },
  { style: "PW4630/C-PRINT 3", cmPrice: 11.0, smv: 8.5 },
  { style: "KGD1188/A-WHITE", cmPrice: 34.0, smv: 15.0 },
  { style: "KGP4357/BD1-BLACK", cmPrice: 4.2, smv: 4.5 },
  { style: "KBSW0217/A-1-2", cmPrice: 6.0, smv: 5.5 },
  { style: "KWSW0217/A-1-2", cmPrice: 8.0, smv: 6.2 },
  { style: "OPP RUNNING SHORT", cmPrice: 17.0, smv: 11.0 }
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function distributeHC(total: number, weights: number[]): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW === 0) return weights.map(() => 0);
  const counts = weights.map(w => Math.floor((w / sumW) * total));
  const remainder = total - counts.reduce((a, b) => a + b, 0);
  const fracs = weights.map((w, i) => ({ i, frac: ((w / sumW) * total) - counts[i] }));
  fracs.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) {
    counts[fracs[i % fracs.length].i]++;
  }
  return counts;
}

export interface Quantum2RoleItem {
  name: string;
  cadre: number;
  wage: number;
  tempWage?: number;
}

export const QUANTUM2_STANDARD_ROSTER: Quantum2RoleItem[] = [
  { name: "Machine Operators", cadre: 301, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, wage: 140.00 },
  { name: "Cutting", cadre: 80, wage: 140.00 },
  { name: "Maintanance", cadre: 3, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, wage: 140.00 },
  { name: "PPZ", cadre: 6, wage: 140.00 },
  { name: "Printing", cadre: 8, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, wage: 140.00 },
  { name: "Supervisors", cadre: 6, wage: 140.00 },
  { name: "Technician", cadre: 2, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, wage: 140.00 },
  { name: "HR Employees", cadre: 3, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, wage: 140.00 },
  { name: "Boiler", cadre: 1, wage: 140.00 },
  { name: "Electrician", cadre: 2, wage: 140.00 },
  { name: "Mechanic", cadre: 4, wage: 140.00 },
  { name: "Laundry", cadre: 2, wage: 140.00 },
  { name: "IE", cadre: 3, wage: 140.00 },
  { name: "Ware-house", cadre: 6, wage: 146.00 },
  { name: "Sample Room", cadre: 7, wage: 146.00 },
  { name: "Jumpers", cadre: 8, wage: 146.00 },
  { name: "Finishing", cadre: 5, wage: 140.00 }
];

export const QUANTUM2_07_AUG_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 90, absent: 211, cost: 13140.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 4, absent: 19, cost: 560.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 6, absent: 17, cost: 840.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 34, absent: 6, cost: 4760.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 57, absent: 23, cost: 7980.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 7, absent: 1, cost: 980.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 5, absent: 1, cost: 700.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 2, absent: 1, cost: 280.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 13, absent: 2, cost: 1820.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 3, absent: 1, cost: 420.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 0, absent: 2, cost: 0.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 2, absent: 1, cost: 280.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 5, absent: 1, cost: 730.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 5, absent: 2, cost: 730.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export const QUANTUM2_10_AUG_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 295, absent: 6, cost: 43070.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 38, absent: 2, cost: 5320.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 64, absent: 16, cost: 8960.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 14, absent: 1, cost: 1960.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 4, absent: 0, cost: 560.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 6, absent: 0, cost: 876.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 7, absent: 0, cost: 1022.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export const QUANTUM2_12_AUG_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 295, absent: 6, cost: 43070.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 38, absent: 2, cost: 5320.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 64, absent: 16, cost: 8960.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 14, absent: 1, cost: 1960.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 4, absent: 0, cost: 560.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 6, absent: 0, cost: 876.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 7, absent: 0, cost: 1022.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export const QUANTUM2_14_AUG_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 296, absent: 5, cost: 43216.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 39, absent: 1, cost: 5460.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 65, absent: 15, cost: 9100.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 14, absent: 1, cost: 1960.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 4, absent: 0, cost: 560.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 6, absent: 0, cost: 876.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 7, absent: 0, cost: 1022.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export const QUANTUM2_08_AUG_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 295, absent: 6, cost: 43070.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 21, absent: 2, cost: 2940.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 38, absent: 2, cost: 5320.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 63, absent: 17, cost: 8820.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 14, absent: 1, cost: 1960.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 4, absent: 0, cost: 560.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 6, absent: 0, cost: 876.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 7, absent: 0, cost: 1022.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export const QUANTUM2_21_JULY_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 288, absent: 13, cost: 42048.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 23, absent: 0, cost: 3220.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 21, absent: 2, cost: 2940.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 40, absent: 0, cost: 5600.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 61, absent: 19, cost: 8540.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 15, absent: 0, cost: 2100.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 3, absent: 1, cost: 420.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 2, absent: 1, cost: 280.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 6, absent: 0, cost: 876.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 7, absent: 0, cost: 1022.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export function buildRosterDepartments(roster: typeof QUANTUM2_07_AUG_ROSTER, prefix: string): Department[] {
  return roster.map((item, idx) => ({
    id: `dept_${prefix}_${idx}`,
    name: item.name,
    cadre: item.cadre,
    absent: item.absent,
    cost: item.cost,
    roles: [{
      id: `role_${prefix}_${idx}_0`,
      title: item.name,
      cadre: item.cadre,
      perm: item.perm,
      temp: 0,
      absent: item.absent,
      permWage: item.wage,
      tempWage: 125.95,
      cost: item.cost,
      otHeadcount: 0,
      otCost: 0
    }]
  }));
}

export function buildStandardCleanSlateDepartments(prefix: string = "clean"): Department[] {
  return QUANTUM2_STANDARD_ROSTER.map((item, idx) => ({
    id: `dept_${prefix}_${idx}`,
    name: item.name,
    cadre: item.cadre,
    absent: 0,
    cost: 0,
    roles: [{
      id: `role_${prefix}_${idx}_0`,
      title: item.name,
      cadre: item.cadre,
      perm: 0,
      temp: 0,
      absent: 0,
      permWage: item.wage,
      tempWage: 125.95,
      cost: 0,
      otHeadcount: 0,
      otCost: 0
    }]
  }));
}

export const QUANTUM2_03_AUG_ROSTER = [
  { name: "Machine Operators", cadre: 301, perm: 281, absent: 20, cost: 41026.00, wage: 146.00 },
  { name: "Packing Employees", cadre: 23, perm: 22, absent: 1, cost: 3080.00, wage: 140.00 },
  { name: "Iron Employees", cadre: 23, perm: 21, absent: 2, cost: 2940.00, wage: 140.00 },
  { name: "Quality Employees", cadre: 40, perm: 41, absent: 0, cost: 5740.00, wage: 140.00 },
  { name: "Cutting", cadre: 80, perm: 61, absent: 19, cost: 8540.00, wage: 140.00 },
  { name: "Maintanance", cadre: 3, perm: 3, absent: 0, cost: 438.00, wage: 146.00 },
  { name: "Needle-Room Ass.", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Production Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Project Coordinator", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "PPZ", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Printing", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Score-Ladies/Man", cadre: 8, perm: 8, absent: 0, cost: 1120.00, wage: 140.00 },
  { name: "Supervisors", cadre: 6, perm: 6, absent: 0, cost: 840.00, wage: 140.00 },
  { name: "Technician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Line-Manager", cadre: 1, perm: 1, absent: 0, cost: 277.00, wage: 277.00 },
  { name: "Sub Stores", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "HR Employees", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Admin Employees", cadre: 15, perm: 14, absent: 1, cost: 1960.00, wage: 140.00 },
  { name: "Boiler", cadre: 1, perm: 1, absent: 0, cost: 140.00, wage: 140.00 },
  { name: "Electrician", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "Mechanic", cadre: 4, perm: 4, absent: 0, cost: 560.00, wage: 140.00 },
  { name: "Laundry", cadre: 2, perm: 2, absent: 0, cost: 280.00, wage: 140.00 },
  { name: "IE", cadre: 3, perm: 3, absent: 0, cost: 420.00, wage: 140.00 },
  { name: "Ware-house", cadre: 6, perm: 6, absent: 0, cost: 876.00, wage: 146.00 },
  { name: "Sample Room", cadre: 7, perm: 7, absent: 0, cost: 1022.00, wage: 146.00 },
  { name: "Jumpers", cadre: 8, perm: 8, absent: 0, cost: 1168.00, wage: 146.00 },
  { name: "Finishing", cadre: 5, perm: 5, absent: 0, cost: 700.00, wage: 140.00 }
];

export function build03AugDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_03_AUG_ROSTER, "03aug");
}

export function build07AugDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_07_AUG_ROSTER, "07aug");
}

export function build10AugDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_10_AUG_ROSTER, "10aug");
}

export function build12AugDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_12_AUG_ROSTER, "12aug");
}

export function build08AugDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_08_AUG_ROSTER, "08aug");
}

export function build14AugDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_14_AUG_ROSTER, "14aug");
}

export function build21JulDepartments(): Department[] {
  return buildRosterDepartments(QUANTUM2_21_JULY_ROSTER, "21jul");
}

export function buildDepartmentsForDate(dateLabel: string): Department[] {
  const norm = extractAndNormalizeDate(dateLabel);
  if (norm === "3 AUGUST 2026" || norm === "03 AUGUST 2026" || norm === "3 AUG 2026" || norm === "03 AUG 2026") {
    return build03AugDepartments();
  }
  if (norm === "7 AUGUST 2026" || norm === "07 AUGUST 2026" || norm === "7 AUG 2026" || norm === "07 AUG 2026") {
    return build07AugDepartments();
  }
  if (norm === "10 AUGUST 2026" || norm === "10 AUG 2026") {
    return build10AugDepartments();
  }
  if (norm === "12 AUGUST 2026" || norm === "12 AUG 2026") {
    return build12AugDepartments();
  }
  if (norm === "14 AUGUST 2026" || norm === "14 AUG 2026") {
    return build14AugDepartments();
  }
  if (norm === "8 AUGUST 2026" || norm === "08 AUGUST 2026" || norm === "8 AUG 2026" || norm === "08 AUG 2026") {
    return build08AugDepartments();
  }
  if (norm === "21 JULY 2026" || norm === "21 JUL 2026") {
    return build21JulDepartments();
  }
  // All other dates start with the identical standard 27-role sequence
  return buildStandardCleanSlateDepartments(`std_${dateLabel.replace(/\s+/g, '_').toLowerCase()}`);
}

export function buildDefaultEarnings(sheetIdx: number = 0): StyleEarning[] {
  // Give realistic initial daily production quantities so earnings & margins calculate automatically
  const qtyPresets = [
    [320, 850, 600, 450, 200, 1200, 800, 500, 350],
    [400, 920, 550, 480, 250, 1500, 900, 600, 400],
    [280, 780, 620, 410, 180, 1100, 750, 480, 300],
    [350, 900, 650, 500, 220, 1350, 850, 550, 380]
  ];
  const preset = qtyPresets[sheetIdx % qtyPresets.length];

  return DEFAULT_STYLES.map((s, idx) => ({
    id: uid(),
    style: s.style,
    cmPrice: s.cmPrice,
    smv: s.smv,
    qtyProduced: preset[idx % preset.length] || 300
  }));
}

export function buildDefaultSah(earnings: StyleEarning[]): SahRecord[] {
  return [
    { id: uid(), line: "Line 1", style: earnings[0].style, mos: 28, output: earnings[0]?.qtyProduced || 320, smv: earnings[0]?.smv || 12.5 },
    { id: uid(), line: "Line 2", style: earnings[1].style, mos: 32, output: earnings[1]?.qtyProduced || 850, smv: earnings[1]?.smv || 8.2 },
    { id: uid(), line: "Line 3", style: earnings[4].style, mos: 30, output: earnings[4]?.qtyProduced || 200, smv: earnings[4]?.smv || 15.0 },
    { id: uid(), line: "Line 4", style: earnings[5].style, mos: 35, output: earnings[5]?.qtyProduced || 1200, smv: earnings[5]?.smv || 4.5 }
  ];
}

export function syncProductionWages(sheets: SheetData[]): SheetData[] {
  return (sheets || []).map(sheet => {
    if (!sheet || !sheet.departments) return sheet;
    // Preserve existing wages, only populate if 0 or missing
    const updatedDepts = sheet.departments.map(dept => {
      if (dept.name === "PRODUCTION FLOOR") {
        const updatedRoles = (dept.roles || []).map(role => {
          if (role.permWage && role.permWage > 0) {
            return role;
          }
          let targetWage = role.permWage || PRODUCTION_WAGE_BENCHMARKS.MO_AVG;
          const tName = (role.title || '').toLowerCase();
          if (tName.includes('mo')) {
            targetWage = PRODUCTION_WAGE_BENCHMARKS.MO_AVG;
          } else if (tName.includes('manager') || tName.includes('supervisor')) {
            targetWage = PRODUCTION_WAGE_BENCHMARKS.SUPERVISOR_AVG;
          } else if (tName.includes('ironer') || tName.includes('helper') || tName.includes('packer') || tName.includes('score')) {
            targetWage = PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG;
          }
          return { ...role, permWage: targetWage };
        });
        return { ...dept, roles: updatedRoles };
      }
      return dept;
    });
    return { ...sheet, departments: updatedDepts };
  });
}

export function standardizeSheetDepartments(sheet: SheetData): SheetData {
  if (!sheet) return sheet;
  // If the sheet already has departments configured by the user or from previous save, NEVER overwrite them
  if (sheet.departments && sheet.departments.length > 0) {
    return sheet;
  }

  const norm = extractAndNormalizeDate(sheet.label);

  if (norm === "3 AUGUST 2026" || norm === "03 AUGUST 2026" || norm === "3 AUG 2026" || norm === "03 AUG 2026") {
    return { ...sheet, departments: build03AugDepartments() };
  }

  if (norm === "10 AUGUST 2026" || norm === "10 AUG 2026") {
    return { ...sheet, departments: build10AugDepartments() };
  }

  if (norm === "12 AUGUST 2026" || norm === "12 AUG 2026") {
    return { ...sheet, departments: build12AugDepartments() };
  }

  if (norm === "14 AUGUST 2026" || norm === "14 AUG 2026") {
    return { ...sheet, departments: build14AugDepartments() };
  }

  if (norm === "7 AUGUST 2026" || norm === "07 AUGUST 2026" || norm === "7 AUG 2026" || norm === "07 AUG 2026") {
    return { ...sheet, departments: build07AugDepartments() };
  }

  if (norm === "8 AUGUST 2026" || norm === "08 AUGUST 2026" || norm === "8 AUG 2026" || norm === "08 AUG 2026") {
    return { ...sheet, departments: build08AugDepartments() };
  }

  if (norm === "21 JULY 2026" || norm === "21 JUL 2026") {
    return { ...sheet, departments: build21JulDepartments() };
  }

  // Supply standard clean slate for new blank dates
  return { ...sheet, departments: buildStandardCleanSlateDepartments(`std_${sheet.label.replace(/\s+/g, '_').toLowerCase()}`) };
}

function stripPresetDefaultDepartments(sheets: SheetData[]): SheetData[] {
  return (sheets || []).map(s => standardizeSheetDepartments(s));
}

export function ensureAllPayCycleDates(existingSheets: SheetData[]): SheetData[] {
  // Keep all valid sheets from existing sheets
  const validSheets = (existingSheets || []).filter(s => s && s.label && String(s.label).trim().length > 0);
  
  // Create a map keyed strictly by CANONICAL NORMALIZED DATE
  const sheetMap = new Map<string, SheetData>();

  // 1. Populate sheetMap with existing sheets, preserving all user edits, clock-in uploads & data
  validSheets.forEach(s => {
    if (!s || !s.label) return;
    const normKey = extractAndNormalizeDate(s.label);
    if (!normKey) return;

    const normalizedSheet: SheetData = {
      ...s,
      label: normKey,
      departments: s.departments || [],
      earnings: s.earnings || [],
      sahData: s.sahData || []
    };

    if (sheetMap.has(normKey)) {
      const existing = sheetMap.get(normKey)!;
      const existingHasData = (existing.departments || []).some(d => (d.roles || []).some(r => r.perm > 0 || r.temp > 0 || (r.cost && r.cost > 0)));
      const newHasData = (normalizedSheet.departments || []).some(d => (d.roles || []).some(r => r.perm > 0 || r.temp > 0 || (r.cost && r.cost > 0)));
      // If the incoming sheet has data, or existing has no data, update with incoming
      if (newHasData || !existingHasData) {
        sheetMap.set(normKey, normalizedSheet);
      }
    } else {
      sheetMap.set(normKey, normalizedSheet);
    }
  });

  // 2. Ensure known benchmark dates have departments if completely empty
  sheetMap.forEach((sheet, normKey) => {
    if (!sheet.departments || sheet.departments.length === 0) {
      sheetMap.set(normKey, {
        ...sheet,
        departments: buildDepartmentsForDate(normKey)
      });
    }
  });

  // 3. For all required pay cycles, ensure every working day has a sheet
  const cycles = getAllPayCyclesFromSheets(Array.from(sheetMap.values()));
  cycles.forEach(cycle => {
    const cycleDates = getAllDatesForPayCycle(cycle);
    cycleDates.forEach((dateLabel, idx) => {
      const normKey = extractAndNormalizeDate(dateLabel);
      if (!normKey) return;

      if (!sheetMap.has(normKey)) {
        const departments = buildDepartmentsForDate(normKey);
        const earnings = buildDefaultEarnings(idx);
        const sahData = buildDefaultSah(earnings);
        const newSheet: SheetData = {
          id: `sheet_${normKey.replace(/\s+/g, '_').toLowerCase()}`,
          label: normKey,
          departments,
          earnings,
          sahData
        };
        sheetMap.set(normKey, newSheet);
      }
    });
  });

  // 4. Also check HC_BY_DATE_2026 for any additional benchmark dates
  Object.keys(HC_BY_DATE_2026).forEach((k, idx) => {
    const normKey = extractAndNormalizeDate(k);
    if (!normKey) return;

    if (!sheetMap.has(normKey)) {
      const departments = buildDepartmentsForDate(normKey);
      const earnings = buildDefaultEarnings(idx);
      const sahData = buildDefaultSah(earnings);
      const newSheet: SheetData = {
        id: `sheet_${normKey.replace(/\s+/g, '_').toLowerCase()}`,
        label: normKey,
        departments,
        earnings,
        sahData
      };
      sheetMap.set(normKey, newSheet);
    }
  });

  const resultSheets = Array.from(sheetMap.values());
  const sanitized = sanitizeSheets(resultSheets);
  return sortSheetsChronologically(sanitized);
}

export function sanitizeSheet(sheet: SheetData): SheetData {
  if (!sheet) return sheet;

  // Guarantee unique IDs for departments & roles while preserving existing valid IDs
  const seenDeptIds = new Set<string>();
  const sanitizedDepts = (sheet.departments || []).map((d, dIdx) => {
    let deptId = d.id;
    if (!deptId || seenDeptIds.has(deptId)) {
      deptId = `dept_${(sheet.id || 'sh').replace(/[^a-zA-Z0-9_-]/g, '')}_${dIdx}_${Math.random().toString(36).slice(2, 7)}`;
    }
    seenDeptIds.add(deptId);

    const seenRoleIds = new Set<string>();
    const sanitizedRoles = (d.roles || []).map((r, rIdx) => {
      let roleId = r.id;
      if (!roleId || seenRoleIds.has(roleId)) {
        roleId = `role_${deptId}_${rIdx}_${Math.random().toString(36).slice(2, 7)}`;
      }
      seenRoleIds.add(roleId);
      return { ...r, id: roleId };
    });

    return { ...d, id: deptId, roles: sanitizedRoles };
  });

  // Guarantee unique IDs for earnings
  const seenEarningIds = new Set<string>();
  const sanitizedEarnings = (sheet.earnings || []).map((e, eIdx) => {
    let earnId = e.id;
    if (!earnId || seenEarningIds.has(earnId)) {
      earnId = `style_${(sheet.id || 'sh').replace(/[^a-zA-Z0-9_-]/g, '')}_${eIdx}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    seenEarningIds.add(earnId);
    return { ...e, id: earnId };
  });

  // Guarantee unique IDs for sahData
  const seenSahIds = new Set<string>();
  const sanitizedSah = (sheet.sahData || []).map((s, sIdx) => {
    let sahId = s.id;
    if (!sahId || seenSahIds.has(sahId)) {
      sahId = `sah_${(sheet.id || 'sh').replace(/[^a-zA-Z0-9_-]/g, '')}_${sIdx}_${Math.random().toString(36).slice(2, 7)}`;
    }
    seenSahIds.add(sahId);
    return { ...s, id: sahId };
  });

  return {
    ...sheet,
    departments: sanitizedDepts,
    earnings: sanitizedEarnings,
    sahData: sanitizedSah
  };
}

export function sanitizeSheets(sheets: SheetData[]): SheetData[] {
  const seenSheetIds = new Set<string>();
  return (sheets || []).map((s, sIdx) => {
    let sheetId = s.id;
    if (!sheetId || seenSheetIds.has(sheetId)) {
      sheetId = `sheet_${(s.label || 'date').replace(/\s+/g, '_').toLowerCase()}_${sIdx}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seenSheetIds.add(sheetId);
    return sanitizeSheet({ ...s, id: sheetId });
  });
}

export const DEFAULT_SUBSIDIARIES: import('../types').SubsidiaryProfile[] = [
  {
    id: 'sub_q1',
    code: 'QUANTUM-1',
    name: 'Quantum 1 Apparel Facility (Raw Materials Dept Hub)',
    location: 'Maseru Industrial Estate, Plant A',
    contactPerson: 'Thabo Lerotholi (Raw Materials & Plant Mgr)',
    defaultBillingType: 'Charged to Subsidiary',
    defaultHeadcount: 10,
    defaultDailyWage: 146.00,
    defaultOtHours: 1.5,
    notes: 'Runs the central Raw Materials, Fabric Warehousing, and Trims Supply division for Quantum facilities.'
  },
  {
    id: 'sub_q3',
    code: 'QUANTUM-3',
    name: 'Quantum 3 Activewear & Knitwear Unit',
    location: 'Thetsane Export Park, Zone 4',
    contactPerson: 'Mpho Mokoena (Operations Lead)',
    defaultBillingType: 'Cross-Subsidized',
    defaultHeadcount: 5,
    defaultDailyWage: 140.00,
    defaultOtHours: 0,
    notes: 'Activewear sewing and seam-bonding sister unit.'
  },
  {
    id: 'sub_central_hub',
    code: 'CENTRAL-HUB',
    name: 'Central Cutting & Marker Logistics Hub',
    location: 'Ha Hoohlo Logistics Center',
    contactPerson: 'Lineo Ramoshebi (Logistics Dir)',
    defaultBillingType: 'Reimbursable',
    defaultHeadcount: 2,
    defaultDailyWage: 140.00,
    defaultOtHours: 0,
    notes: 'Automated fabric spreading and computerized marker cutting.'
  },
  {
    id: 'sub_ph_finish',
    code: 'PH-FINISHING',
    name: 'Pink Harmony Specialized Finishing & Wash',
    location: 'Maseru West Unit 2',
    contactPerson: 'Keketso Molapo (Quality Lead)',
    defaultBillingType: 'Charged to Subsidiary',
    defaultHeadcount: 4,
    defaultDailyWage: 140.00,
    defaultOtHours: 1.5,
    notes: 'Garment washing, stain removal, and pre-export AQL inspection.'
  },
  {
    id: 'sub_export_pack',
    code: 'EXPORT-HUB',
    name: 'Export Freight & Final Dispatch Division',
    location: 'Moshoeshoe I Logistics Terminal',
    contactPerson: 'David Khuele (Dispatch Mgr)',
    defaultBillingType: 'Reimbursable',
    defaultHeadcount: 2,
    defaultDailyWage: 140.00,
    defaultOtHours: 0,
    notes: 'Container loading, customs sealing, and port dispatch.'
  }
];

export const DEFAULT_SUBSIDY_PROGRAMS: import('../types').WageSubsidyProgram[] = [
  {
    id: 'prog_apparel_wage_copay',
    programName: 'Apparel Export Line Operator Subsidy',
    agency: 'Ministry of Trade & Industry / Export Co-Pay Fund',
    subsidyType: 'custom_salaries_charged',
    amountPerUnit: 140.00,
    eligibleDepts: ['Machine Operators', 'Cutting', 'Packing Employees'],
    monthlyCap: 200000,
    isActive: true,
    targetHeadcount: 50,
    salaryPerWorkerDaily: 140.00,
    otHoursPerWorker: 1.5,
    otSalaryRateDaily: 1750.00,
    totalDailySalaryCharged: 8750.00,
    notes: 'Direct 50-operator wage and overtime relief subsidy for high-volume activewear manufacturing lines.'
  },
  {
    id: 'prog_lndc_garment',
    programName: 'LNDC Garment Sector Employment Subsidy',
    agency: 'Lesotho National Development Corporation (LNDC)',
    subsidyType: 'per_headcount_daily',
    amountPerUnit: 14.50, // M 14.50 per present worker per day
    eligibleDepts: ['Machine Operators', 'Cutting', 'Iron Employees', 'Packing Employees'],
    monthlyCap: 180000,
    isActive: true,
    notes: 'Government daily employment wage assistance for registered textile sewing and cutting staff.'
  },
  {
    id: 'prog_youth_training',
    programName: 'Youth Apparel Skills & Productivity Incentive',
    agency: 'Ministry of Trade & Industry / Ministry of Labour',
    subsidyType: 'percentage_wage_bill',
    amountPerUnit: 4.5, // 4.5% rebate on gross eligible department wages
    eligibleDepts: ['Machine Operators', 'Technician', 'IE', 'Sample Room', 'PPZ'],
    monthlyCap: 95000,
    isActive: true,
    notes: 'Incentive rebate for upskilling and training garment line operators and pre-production apprentices.'
  },
  {
    id: 'prog_export_grant',
    programName: 'Export Competitiveness & Logistics Grant',
    agency: 'Lesotho Garment Export Promotion Board',
    subsidyType: 'fixed_monthly_grant',
    amountPerUnit: 15000.00, // M 15,000 monthly fixed grant
    eligibleDepts: ['All Departments'],
    monthlyCap: 15000,
    isActive: true,
    notes: 'Fixed monthly operational relief grant credited against overall factory wage bill.'
  }
];

export const DEFAULT_SUBSIDIARY_ALLOCATIONS: import('../types').SubsidiaryAllocation[] = [
  {
    id: 'alloc_14aug_q1_delay',
    dateLabel: '14 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-1',
    subsidiaryName: 'Quantum 1 Apparel Facility (Raw Materials Dept Hub)',
    deptName: 'Machine Operators',
    headcountPerm: 0,
    headcountTemp: 8,
    dailyWagePerPerson: 125.95,
    totalCost: 1007.60,
    otHours: 1.5,
    otCost: 1460.00, // 40 machine operators on 1.5h OT
    allocationType: 'q1_raw_material_delay',
    delayReason: 'Late fabric rolls and trim dispatch from Q1 Raw Materials Dept',
    tempWorkersHired: 8,
    tempWorkersDailyWage: 125.95,
    delayOtWorkersCount: 40,
    delayOtHours: 1.5,
    delayOtCost: 1460.00,
    totalDelaySurcharge: 2467.60, // 1007.60 + 1460.00
    projectNote: 'Hired 8 temp workers for emergency fabric sorting + 40 operators on 1.5h OT due to Q1 supply delay',
    billingStatus: 'Charged to Subsidiary',
    createdAt: '2026-08-14T07:15:00Z'
  },
  {
    id: 'alloc_14aug_1',
    dateLabel: '14 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-1',
    subsidiaryName: 'Quantum 1 Apparel Facility (Raw Materials Dept Hub)',
    deptName: 'Machine Operators',
    headcountPerm: 10,
    headcountTemp: 0,
    dailyWagePerPerson: 146.00,
    totalCost: 1460.00,
    otHours: 1.5,
    otCost: 365.00,
    allocationType: 'workforce_loan',
    projectNote: 'End-of-week activewear rush support for export line',
    billingStatus: 'Charged to Subsidiary',
    createdAt: '2026-08-14T07:30:00Z'
  },
  {
    id: 'alloc_14aug_2',
    dateLabel: '14 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-3',
    subsidiaryName: 'Quantum 3 Activewear & Knitwear Unit',
    deptName: 'Cutting',
    headcountPerm: 3,
    headcountTemp: 1,
    dailyWagePerPerson: 140.00,
    totalCost: 545.95,
    otHours: 0,
    otCost: 0,
    allocationType: 'workforce_loan',
    projectNote: 'Laser pattern cutting assistance for weekend loading',
    billingStatus: 'Cross-Subsidized',
    createdAt: '2026-08-14T08:00:00Z'
  },
  {
    id: 'alloc_12aug_q1_delay',
    dateLabel: '12 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-1',
    subsidiaryName: 'Quantum 1 Apparel Facility (Raw Materials Dept Hub)',
    deptName: 'Production Floor',
    headcountPerm: 0,
    headcountTemp: 5,
    dailyWagePerPerson: 125.95,
    totalCost: 629.75,
    otHours: 1.5,
    otCost: 973.33, // 30 operators on 1.5h OT
    allocationType: 'q1_raw_material_delay',
    delayReason: 'Missing zippers and thread shortage from Q1 Raw Materials Dept',
    tempWorkersHired: 5,
    tempWorkersDailyWage: 125.95,
    delayOtWorkersCount: 30,
    delayOtHours: 1.5,
    delayOtCost: 973.33,
    totalDelaySurcharge: 1603.08,
    projectNote: 'Hired 5 temp helpers + 30 operators on OT to recover Q1 trim shortage backlog',
    billingStatus: 'Charged to Subsidiary',
    createdAt: '2026-08-12T07:15:00Z'
  },
  {
    id: 'alloc_12aug_1',
    dateLabel: '12 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-1',
    subsidiaryName: 'Quantum 1 Apparel Facility (Raw Materials Dept Hub)',
    deptName: 'Machine Operators',
    headcountPerm: 12,
    headcountTemp: 0,
    dailyWagePerPerson: 146.00,
    totalCost: 1752.00,
    otHours: 2,
    otCost: 486.67,
    allocationType: 'workforce_loan',
    projectNote: 'Line 4 emergency support for bulk fleece jacket order',
    billingStatus: 'Charged to Subsidiary',
    createdAt: '2026-08-12T07:30:00Z'
  },
  {
    id: 'alloc_12aug_2',
    dateLabel: '12 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-3',
    subsidiaryName: 'Quantum 3 Activewear & Knitwear Unit',
    deptName: 'Cutting',
    headcountPerm: 4,
    headcountTemp: 2,
    dailyWagePerPerson: 140.00,
    totalCost: 811.90, // 4*140 + 2*125.95
    otHours: 0,
    otCost: 0,
    projectNote: 'Assistance for precision knit panel cutting',
    billingStatus: 'Cross-Subsidized',
    createdAt: '2026-08-12T08:00:00Z'
  },
  {
    id: 'alloc_12aug_3',
    dateLabel: '12 AUGUST 2026',
    subsidiaryCode: 'PH-FINISHING',
    subsidiaryName: 'Pink Harmony Specialized Finishing & Wash',
    deptName: 'Quality Employees',
    headcountPerm: 3,
    headcountTemp: 0,
    dailyWagePerPerson: 140.00,
    totalCost: 420.00,
    otHours: 1.5,
    otCost: 105.00,
    projectNote: 'Pre-shipment AQL audit inspection team',
    billingStatus: 'Charged to Subsidiary',
    createdAt: '2026-08-12T08:15:00Z'
  },
  {
    id: 'alloc_10aug_1',
    dateLabel: '10 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-1',
    subsidiaryName: 'Quantum 1 Apparel Facility',
    deptName: 'Machine Operators',
    headcountPerm: 15,
    headcountTemp: 0,
    dailyWagePerPerson: 146.00,
    totalCost: 2190.00,
    otHours: 2,
    otCost: 608.33,
    projectNote: 'Peak sewing shift loan',
    billingStatus: 'Charged to Subsidiary',
    createdAt: '2026-08-10T07:30:00Z'
  },
  {
    id: 'alloc_10aug_2',
    dateLabel: '10 AUGUST 2026',
    subsidiaryCode: 'CENTRAL-HUB',
    subsidiaryName: 'Central Raw Materials & Cutting Hub',
    deptName: 'Technician',
    headcountPerm: 1,
    headcountTemp: 0,
    dailyWagePerPerson: 140.00,
    totalCost: 140.00,
    otHours: 0,
    otCost: 0,
    projectNote: 'Automated spreading machine calibration and maintenance',
    billingStatus: 'Reimbursable',
    createdAt: '2026-08-10T08:45:00Z'
  },
  {
    id: 'alloc_07aug_1',
    dateLabel: '7 AUGUST 2026',
    subsidiaryCode: 'QUANTUM-3',
    subsidiaryName: 'Quantum 3 Activewear & Knitwear Unit',
    deptName: 'Machine Operators',
    headcountPerm: 10,
    headcountTemp: 0,
    dailyWagePerPerson: 146.00,
    totalCost: 1460.00,
    otHours: 0,
    otCost: 0,
    projectNote: 'Activewear seam bonding setup',
    billingStatus: 'Cross-Subsidized',
    createdAt: '2026-08-07T07:30:00Z'
  }
];

export function buildInitialSheets(): SheetData[] {
  return ensureAllPayCycleDates([]);
}
