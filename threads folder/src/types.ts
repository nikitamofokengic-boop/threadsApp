export type UserRole = 
  | 'admin'
  | 'sys_admin'
  | 'cutting_lead' 
  | 'production_lead' 
  | 'qc_lead' 
  | 'ie_engineer' 
  | 'finance' 
  | 'viewer'
  | string;

export interface User {
  username: string;
  name: string;
  role: UserRole;
  roleName: string;
  deptAccess?: string; // e.g. "CUTTING", "PRODUCTION FLOOR", "QC"
}

export interface RolePermissions {
  roleId?: string;
  roleName?: string;
  allowedTabs: string[]; // e.g. ['summary', 'headcount', 'earnings', 'payroll', 'sah', 'overheads', 'changes', 'admin']
  canEditHeadcount: boolean | string; // true, false, or dept name e.g. "CUTTING"
  canEditWages: boolean;
  canEditEarnings: boolean;
  canEditSAH: boolean;
  canEditOverheads: boolean;
  canAddDeleteDates: boolean;
  canManageRoles?: boolean; // Admin permission to manage roles and grant permissions
}

export interface EmployeeRole {
  id: string;
  title: string;
  perm: number;
  temp: number;
  permWage: number;
  tempWage: number;
  cadre?: number;
  absent?: number;
  cost?: number;
  otHeadcount?: number; // Custom OT headcount (starts at 0 if undefined)
  otCost?: number; // Custom OT cost override (defaults to calculated if undefined)
}

export interface Department {
  id: string;
  name: string;
  roles: EmployeeRole[];
  cadre?: number;
  absent?: number;
  cost?: number;
}

export interface StyleEarning {
  id: string;
  style: string;
  cmPrice: number;
  smv: number; // Standard Minute Value - user requested SMVs for each style!
  qtyProduced: number;
  plannedQty?: number; // Target / Planned production volume in pcs
}

export interface SahRecord {
  id: string;
  line: string;
  style: string;
  mos: number;
  output: number;
  smv: number;
  shiftHours?: number; // Shift hours per operator (defaults to 9.0)
}

export interface Overheads {
  rent: number;
  utilities: number;
  admin: number;
  other: number;
}

export interface PayrollParams {
  monthDays: number;
  weekendDays: number;
  otHours: number;
}

export interface SubsidiaryAllocation {
  id: string;
  dateLabel: string;
  subsidiaryCode: string;
  subsidiaryName: string;
  deptName: string;
  headcountPerm: number;
  headcountTemp: number;
  dailyWagePerPerson: number;
  totalCost: number;
  otHours?: number;
  otCost?: number;
  projectNote?: string;
  billingStatus?: 'Charged to Subsidiary' | 'Cross-Subsidized' | 'Reimbursable' | 'Pending';
  allocationType?: 'workforce_loan' | 'q1_raw_material_delay';
  delayReason?: string;
  tempWorkersHired?: number;
  tempWorkersDailyWage?: number;
  delayOtWorkersCount?: number;
  delayOtHours?: number;
  delayOtCost?: number;
  totalDelaySurcharge?: number;
  createdAt?: string;
}

export interface WageSubsidyProgram {
  id: string;
  programName: string;
  agency: string;
  subsidyType: 'per_headcount_daily' | 'percentage_wage_bill' | 'fixed_monthly_grant' | 'custom_salaries_charged';
  amountPerUnit: number;
  eligibleDepts: string[];
  monthlyCap?: number;
  isActive: boolean;
  notes?: string;
  targetHeadcount?: number;
  salaryPerWorkerDaily?: number;
  otHoursPerWorker?: number;
  otSalaryRateDaily?: number;
  totalDailySalaryCharged?: number;
}

export interface SubsidiaryProfile {
  id: string;
  code: string;
  name: string;
  location: string;
  contactPerson?: string;
  defaultBillingType: 'Charged to Subsidiary' | 'Cross-Subsidized' | 'Reimbursable';
  defaultHeadcount?: number;
  defaultDailyWage?: number;
  defaultOtHours?: number;
  notes?: string;
  isActive?: boolean;
}

export interface SheetData {
  id: string;
  label: string;
  departments: Department[];
  earnings: StyleEarning[];
  sahData: SahRecord[];
  sahMode?: 'standard_9hrs' | 'piece_rate';
  standardShiftHours?: number; // Defaults to 9.0 for set 9-hour factories
  shiftOtHours?: number; // Overtime hours past 5 PM (or weekend OT) for this date
}
