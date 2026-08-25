import React, { useState } from 'react';
import { SheetData, Department, EmployeeRole } from '../types';
import EditableCell from './EditableCell';
import BatchWageUpdateModal from './BatchWageUpdateModal';
import BatchTempWageModal from './BatchTempWageModal';
import AddDepartmentModal from './AddDepartmentModal';
import ConfirmModal from './ConfirmModal';
import { Plus, Trash2, ShieldAlert, ShieldCheck, Clock, Upload, Zap, Percent, FolderPlus, Building2, Users, RotateCcw, DollarSign, UserCheck, UserX, Briefcase, Sparkles, PieChart, Info, HelpCircle, Edit3 } from 'lucide-react';
import { getDayInfo, calculateSheetLaborCostBreakdown } from '../utils/payCycle';

interface HeadcountTabProps {
  sheet: SheetData;
  sheets?: SheetData[];
  onUpdateSheet: (updated: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  canEditHeadcount: boolean | string; // true (all), false (none), or string (deptName e.g. "CUTTING")
  canEditWages: boolean;
  currency: string;
  onOpenClockInModal?: () => void;
  onOpenSubsidiesPanel?: () => void;
  subsidizedHeadcount?: number;
  subsidizedCost?: number;
}

export default function HeadcountTab({
  sheet,
  sheets = [],
  onUpdateSheet,
  onUpdateAllSheets,
  canEditHeadcount,
  canEditWages,
  currency,
  onOpenClockInModal,
  onOpenSubsidiesPanel,
  subsidizedHeadcount = 0,
  subsidizedCost = 0
}: HeadcountTabProps) {
  const [newRoleDeptId, setNewRoleDeptId] = useState<string | null>(null);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRolePerm, setNewRolePerm] = useState(0);
  const [newRoleTemp, setNewRoleTemp] = useState(0);
  const [newRolePermW, setNewRolePermW] = useState(139.25);
  const [newRoleTempW, setNewRoleTempW] = useState(125.95);

  // Modals state
  const [showBatchWageModal, setShowBatchWageModal] = useState(false);
  const [showBatchTempWageModal, setShowBatchTempWageModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showResetCleanSlateModal, setShowResetCleanSlateModal] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<{ id: string; name: string; rolesCount: number } | null>(null);
  const [deptToSetWage, setDeptToSetWage] = useState<{
    id: string;
    name: string;
    permWage: number;
    tempWage: number;
    adjustmentMode: 'set' | 'percentage';
    adjustmentPercent: number;
    applyToAllDates: boolean;
  } | null>(null);

  const canEditAnyWages = Boolean(canEditWages || canEditHeadcount);

  const isDeptEditable = (deptName: string) => {
    if (canEditHeadcount === true) return true;
    if (canEditHeadcount === false) return false;
    return String(canEditHeadcount).toUpperCase() === deptName.toUpperCase();
  };

  const handleApplyDeptWages = (deptId: string, permWage: number, tempWage: number, applyToAllDates: boolean = false) => {
    const pW = Math.max(0, permWage);
    const tW = Math.max(0, tempWage);

    const updateDeptList = (depts: Department[]) => {
      return depts.map((d) => {
        if (d.id !== deptId && d.name.toUpperCase() !== deptToSetWage?.name.toUpperCase()) return d;
        const updatedRoles = d.roles.map((r) => {
          const factor = deptToSetWage?.adjustmentMode === 'percentage'
            ? Math.max(0, 1 + ((deptToSetWage.adjustmentPercent || 0) / 100))
            : 1;
          const nextPermWage = deptToSetWage?.adjustmentMode === 'percentage'
            ? Math.round(r.permWage * factor * 100) / 100
            : pW;
          const nextTempWage = deptToSetWage?.adjustmentMode === 'percentage'
            ? Math.round(r.tempWage * factor * 100) / 100
            : tW;
          return {
            ...r,
            permWage: nextPermWage,
            tempWage: nextTempWage,
            cost: (r.perm * nextPermWage) + (r.temp * nextTempWage)
          };
        });
        return { ...d, roles: updatedRoles };
      });
    };

    if (applyToAllDates && onUpdateAllSheets && sheets.length > 0) {
      const updatedSheets = sheets.map(s => ({
        ...s,
        departments: updateDeptList(s.departments)
      }));
      onUpdateAllSheets(updatedSheets);
    } else {
      const updatedDepts = updateDeptList(sheet.departments);
      onUpdateSheet({ ...sheet, departments: updatedDepts });
    }

    setDeptToSetWage(null);
  };

  const handleRenameDept = (deptId: string, newName: string) => {
    if (!newName.trim()) return;
    const updatedDepts = sheet.departments.map((d) => {
      if (d.id !== deptId) return d;
      return { ...d, name: newName.trim().toUpperCase() };
    });
    onUpdateSheet({ ...sheet, departments: updatedDepts });
  };

  const handleDeleteDept = (deptId: string) => {
    const dept = sheet.departments.find((d) => d.id === deptId);
    if (!dept) return;
    if (sheet.departments.length <= 1) {
      alert("Cannot delete the only remaining department. At least one department must exist.");
      return;
    }
    setDeptToDelete({ id: dept.id, name: dept.name, rolesCount: dept.roles.length });
  };

  const executeDeleteDept = (deptId: string) => {
    const updatedDepts = sheet.departments.filter((d) => d.id !== deptId);
    onUpdateSheet({ ...sheet, departments: updatedDepts });
  };

  const handleUpdateRole = (deptId: string, roleId: string, field: keyof EmployeeRole | 'permCost' | 'tempCost', value: any) => {
    const updatedDepts = sheet.departments.map((d) => {
      if (d.id !== deptId) return d;
      const updatedRoles = d.roles.map((r) => {
        if (r.id !== roleId) return r;
        if (field === 'permCost') {
          const costVal = Math.max(0, parseFloat(value) || 0);
          const newWage = r.perm > 0 ? Math.round((costVal / r.perm) * 100) / 100 : costVal;
          return { ...r, cost: costVal, permWage: newWage };
        }
        if (field === 'permWage') {
          const wageVal = Math.max(0, parseFloat(value) || 0);
          return { ...r, permWage: wageVal, cost: r.perm * wageVal };
        }
        if (field === 'perm') {
          const permVal = Math.max(0, parseInt(value, 10) || 0);
          return { ...r, perm: permVal, cost: permVal * r.permWage };
        }
        if (field === 'tempCost') {
          const costVal = Math.max(0, parseFloat(value) || 0);
          const newWage = r.temp > 0 ? Math.round((costVal / r.temp) * 100) / 100 : costVal;
          return { ...r, tempWage: newWage };
        }
        if (field === 'tempWage') {
          const wageVal = Math.max(0, parseFloat(value) || 0);
          return { ...r, tempWage: wageVal };
        }
        if (field === 'temp') {
          const tempVal = Math.max(0, parseInt(value, 10) || 0);
          return { ...r, temp: tempVal };
        }
        if (field === 'otHeadcount') {
          const otVal = Math.max(0, parseInt(value, 10) || 0);
          const updated = { ...r, otHeadcount: otVal };
          delete updated.otCost; // Recalculate cost dynamically when headcount changes
          return updated;
        }
        if (field === 'otCost') {
          const otCostVal = Math.max(0, parseFloat(value) || 0);
          return { ...r, otCost: otCostVal };
        }
        return { ...r, [field]: value };
      });
      return { ...d, roles: updatedRoles };
    });
    onUpdateSheet({ ...sheet, departments: updatedDepts });
  };

  const handleSetAllRolesOtHeadcount = (mode: 'all' | 'clear') => {
    const updatedDepts = sheet.departments.map(d => ({
      ...d,
      roles: d.roles.map(r => {
        const updated = { ...r };
        delete updated.otCost;
        if (mode === 'all') {
          updated.otHeadcount = r.perm + r.temp;
        } else {
          updated.otHeadcount = 0;
        }
        return updated;
      })
    }));
    onUpdateSheet({ ...sheet, departments: updatedDepts });
  };

  const handleDeleteRole = (deptId: string, roleId: string) => {
    const dept = sheet.departments.find(d => d.id === deptId);
    if (!dept) return;
    if (dept.roles.length <= 1) {
      alert("Cannot delete the last remaining role of a department. Please keep at least one role.");
      return;
    }
    const updatedDepts = sheet.departments.map((d) => {
      if (d.id !== deptId) return d;
      return { ...d, roles: d.roles.filter((r) => r.id !== roleId) };
    });
    onUpdateSheet({ ...sheet, departments: updatedDepts });
  };

  const handleAddRoleSubmit = (deptId: string) => {
    if (!newRoleTitle.trim()) return;
    const updatedDepts = sheet.departments.map((d) => {
      if (d.id !== deptId) return d;
      const newRole: EmployeeRole = {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        title: newRoleTitle.trim(),
        perm: Math.max(0, newRolePerm),
        temp: Math.max(0, newRoleTemp),
        permWage: Math.max(0, newRolePermW),
        tempWage: Math.max(0, newRoleTempW)
      };
      return { ...d, roles: [...d.roles, newRole] };
    });
    onUpdateSheet({ ...sheet, departments: updatedDepts });
    setNewRoleDeptId(null);
    setNewRoleTitle('');
    setNewRolePerm(0);
    setNewRoleTemp(0);
  };

  // Overtime & labor cost breakdown for current sheet
  const sheetBreakdown = calculateSheetLaborCostBreakdown(sheet);
  const otHours = sheetBreakdown.otHours;
  const dayInfo = sheetBreakdown.dayInfo;
  const otMultiplier = sheetBreakdown.otMultiplier;

  // Grand totals
  let totalCadre = 0;
  let totalAbsent = 0;

  sheet.departments.forEach(d => {
    d.roles.forEach(r => {
      const cVal = r.cadre ?? (r.perm + (r.absent || 0));
      const aVal = r.absent ?? (cVal ? Math.max(0, cVal - r.perm) : 0);
      totalCadre += cVal;
      totalAbsent += aVal;
    });
  });

  const totalPerm = sheetBreakdown.permCount;
  const totalTemp = sheetBreakdown.tempCount;
  const totalPresent = totalPerm + totalTemp;
  const totalPermCost = sheetBreakdown.permBaseCost;
  const totalTempCost = sheetBreakdown.tempBaseCost;
  const totalOtHeadcount = sheetBreakdown.otHeadcountTotal;
  const totalOtCost = sheetBreakdown.otCost;
  const totalCostToday = sheetBreakdown.totalLaborCost;

  const tempSharePct = totalPresent > 0 ? ((totalTemp / totalPresent) * 100).toFixed(1) : '0.0';
  const permSharePct = totalPresent > 0 ? ((totalPerm / totalPresent) * 100).toFixed(1) : '0.0';
  const avgTempWage = totalTemp > 0 ? (totalTempCost / totalTemp).toFixed(2) : '125.95';
  const avgPermWage = totalPerm > 0 ? (totalPermCost / totalPerm).toFixed(2) : '146.00';
  const absentRatePct = totalCadre > 0 ? ((totalAbsent / totalCadre) * 100).toFixed(1) : '0.0';
  const tempCostSharePct = totalCostToday > 0 ? ((totalTempCost / totalCostToday) * 100).toFixed(1) : '0.0';

  // Department-by-department temporary worker deployment breakdown
  const tempDepts = sheet.departments
    .map(d => {
      const deptTempCount = d.roles.reduce((s, r) => s + (r.temp || 0), 0);
      const deptTempCost = d.roles.reduce((s, r) => s + ((r.temp || 0) * (r.tempWage || 125.95)), 0);
      const deptPermCount = d.roles.reduce((s, r) => s + (r.perm || 0), 0);
      const deptTotalPresent = deptTempCount + deptPermCount;
      const deptTempPct = deptTotalPresent > 0 ? ((deptTempCount / deptTotalPresent) * 100).toFixed(1) : '0.0';
      return {
        id: d.id,
        name: d.name,
        tempCount: deptTempCount,
        tempCost: deptTempCost,
        permCount: deptPermCount,
        totalPresent: deptTotalPresent,
        tempPct: deptTempPct
      };
    })
    .filter(d => d.tempCount > 0);

  const handleResetSheetToCleanSlate = () => {
    setShowResetCleanSlateModal(true);
  };

  const executeResetSheetToCleanSlate = () => {
    const resetDepts = sheet.departments.map(d => ({
      ...d,
      cadre: 0,
      absent: 0,
      cost: 0,
      roles: d.roles.map(r => ({
        ...r,
        cadre: 0,
        perm: 0,
        temp: 0,
        absent: 0,
        cost: 0,
        otHeadcount: 0,
        otHours: 0,
        otCost: 0
      }))
    }));
    onUpdateSheet({
      ...sheet,
      departments: resetDepts,
      earnings: [],
      sahData: [],
      shiftOtHours: 0
    });
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Access Permission Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
        canEditHeadcount === true 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : typeof canEditHeadcount === 'string'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-slate-100 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          {canEditHeadcount === false ? (
            <>
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              <span>READ-ONLY VIEW: You do not have permission to modify headcount values on this sheet.</span>
            </>
          ) : typeof canEditHeadcount === 'string' ? (
            <>
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>RESTRICTED PERMISSION: You can only edit roles and headcount for the <strong className="underline">{canEditHeadcount}</strong> department. Previous date logs are unlocked for editing.</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ADMINISTRATOR MODE: Full edit permissions across all departments. All past date sheets unlocked.</span>
            </>
          )}
        </div>
      </div>

      <div className="bento-card p-4 sm:p-6 overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-pink-100 pb-4 mb-4 gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-pink-500 rounded-full" /> Active Headcount & Wage Breakdown
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage daily staffing or import attendance directly from biometric clocking machines.</p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full xl:w-auto">
            {canEditHeadcount && (
              <button
                type="button"
                onClick={() => setShowAddDeptModal(true)}
                className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:scale-[1.01] shrink-0"
                title="Create a new department in headcount staffing"
              >
                <FolderPlus className="w-3.5 h-3.5 text-pink-100" />
                <span>+ Add Dept</span>
              </button>
            )}

            {onOpenSubsidiesPanel && (
              <button
                type="button"
                onClick={onOpenSubsidiesPanel}
                className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:scale-[1.01] shrink-0"
                title="Open Subsidiary Workforce Allocations & Overtime Billing Panel"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Subsidiaries & OT</span>
                {subsidizedHeadcount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 rounded-full text-[10px] font-black font-mono">
                    {subsidizedHeadcount}
                  </span>
                )}
              </button>
            )}

            {canEditAnyWages && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBatchWageModal(true)}
                  className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:scale-[1.01] shrink-0"
                  title="Edit Daily Wages for all staff classifying by Machine Operators, Supervisors, and General Workers"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Daily Wages</span>
                  <span className="hidden sm:inline text-[10px] text-indigo-200 font-medium">(MO/Sup/Gen)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchTempWageModal(true)}
                  className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:scale-[1.01] shrink-0"
                  title="Edit and bulk update all temporary worker daily wages across roles and departments"
                >
                  <Zap className="w-3.5 h-3.5 fill-pink-200 text-white" />
                  <span>All Temp Wages</span>
                </button>
              </>
            )}

            {onOpenClockInModal && (
              <button
                type="button"
                onClick={onOpenClockInModal}
                className="px-2.5 sm:px-3 py-1.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:scale-[1.01] shrink-0"
                title="Import clock-in headcount Excel or text file"
              >
                <Clock className="w-3.5 h-3.5 text-pink-600" />
                <span>Clock-In Import</span>
              </button>
            )}

            {canEditHeadcount && (
              <button
                type="button"
                onClick={handleResetSheetToCleanSlate}
                className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:scale-[1.01] shrink-0"
                title="Reset all headcount and clock-in attendance data for this date to 0 (clean slate)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Reset Slate</span>
              </button>
            )}
          </div>
        </div>

        {/* Lesotho Statutory Paid Holiday Banner */}
        {dayInfo.isHoliday && (
          <div className="mb-4 bg-gradient-to-r from-purple-50 via-purple-50/70 to-indigo-50/50 border border-purple-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-2xs">
                🇱🇸
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-purple-200 text-purple-900 border border-purple-300 rounded-md text-[10px] font-black uppercase tracking-wider">
                    Lesotho Statutory Paid Public Holiday
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-700">
                    {sheet.label} ({dayInfo.dayName})
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-purple-950 mt-0.5">
                  {dayInfo.holidayName}
                </h3>
                <p className="text-xs text-purple-900/80 mt-0.5">
                  Under Lesotho Labor Regulations, public holidays are <strong>fully paid standard shift days</strong>. Staff receive their full regular daily wage; any additional overtime hours worked are calculated at 2.0× double time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Daily Overtime & Shift Schedule Configurator Banner */}
        <div className={`mb-5 border rounded-2xl p-4 sm:p-5 space-y-3 ${
          dayInfo.isHoliday
            ? 'bg-gradient-to-r from-purple-50/60 via-purple-50/40 to-indigo-50/30 border-purple-200'
            : 'bg-gradient-to-r from-amber-50 via-amber-50/60 to-orange-50/40 border-amber-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  {dayInfo.badgeText}
                </span>
                <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" /> Shift Overtime Schedule — {sheet.label} ({dayInfo.dayName})
                </h3>
              </div>
              <p className="text-xs text-amber-900/80 mt-1">
                Standard shift: <strong>08:00 to 17:00 (5:00 PM = 9.0 Hours Regular)</strong>. Hours past 5:00 PM = <strong>Weekday Overtime @ 1.5×</strong>. Weekend/Holiday shift = <strong>2.0× Double Time</strong>.
              </p>
            </div>

            {/* Live OT Cost & Headcount Pill */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3 bg-white/90 border border-amber-300 p-2.5 sm:px-4 sm:py-2 rounded-xl shadow-2xs shrink-0 w-full md:w-auto">
              <div className="text-center sm:text-left">
                <div className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                  <Users className="w-3 h-3 text-amber-600 shrink-0" /> OT Staff
                </div>
                <div className="text-xs sm:text-sm font-black text-amber-950 font-mono">
                  {totalOtHeadcount} Workers
                </div>
              </div>
              <div className="hidden sm:block h-7 w-px bg-amber-200" />
              <div className="text-center sm:text-left border-x border-amber-200 sm:border-0 px-1 sm:px-0">
                <div className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider">OT Payroll</div>
                <div className="text-xs sm:text-sm font-black text-amber-950 font-mono">
                  {currency} {totalOtCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="hidden sm:block h-7 w-px bg-amber-200" />
              <div className="text-center sm:text-left">
                <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Today</div>
                <div className="text-xs sm:text-sm font-black text-indigo-950 font-mono">
                  {currency} {totalCostToday.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          {/* OT Control & Quick Presets */}
          {canEditHeadcount && (
            <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <label className="font-bold text-amber-900 uppercase tracking-wider shrink-0 text-[11px]">
                  OT Hours Past 5 PM:
                </label>
                <input
                  type="number"
                  min={0}
                  max={12}
                  step={0.5}
                  value={otHours}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    onUpdateSheet({ ...sheet, shiftOtHours: val });
                  }}
                  className="w-20 px-2.5 py-1 bg-white border border-amber-300 text-amber-950 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-amber-800 font-medium text-[11px]">hrs ({otMultiplier}× rate)</span>
              </div>

              {/* Quick Presets & OT Headcount Shortcuts */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-amber-800 uppercase w-full sm:w-auto">Shift Presets:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onUpdateSheet({ ...sheet, shiftOtHours: 0 })}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                      otHours === 0
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                  >
                    0h
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSheet({ ...sheet, shiftOtHours: 1 })}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                      otHours === 1
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                  >
                    +1h OT
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSheet({ ...sheet, shiftOtHours: 2 })}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                      otHours === 2
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                  >
                    +2h OT
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSheet({ ...sheet, shiftOtHours: 3 })}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                      otHours === 3
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                  >
                    +3h OT
                  </button>
                </div>

                <div className="hidden sm:block h-4 w-px bg-amber-300 mx-1" />

                <div className="flex items-center gap-1 w-full sm:w-auto mt-1 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => handleSetAllRolesOtHeadcount('all')}
                    className="flex-1 sm:flex-initial px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-extrabold transition cursor-pointer text-center"
                    title="Set OT headcount for all roles equal to working staff"
                  >
                    Set All Staff to OT
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllRolesOtHeadcount('clear')}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition cursor-pointer text-center"
                    title="Reset OT headcount to zero"
                  >
                    Clear OT HC
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* UNIVERSAL GRAND TOTAL WORKFORCE & TEMPORARY WORKER SUMMARY BANNER         */}
        {/* ========================================================================= */}
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-indigo-500/30 space-y-4">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-pink-500 to-rose-600 rounded-2xl text-white shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black tracking-wide uppercase text-white flex items-center gap-1.5">
                    Grand Total Workforce & Temporary Worker Summary
                  </h3>
                  <span className="px-2.5 py-0.5 bg-pink-500/30 text-pink-200 border border-pink-400/30 rounded-full text-[10px] font-black uppercase font-mono">
                    {sheet.label}
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Consolidated plant breakdown: <strong>Permanent Staff ({totalPerm})</strong> + <strong>Temporary Staff (+{totalTemp})</strong> = <strong>Active Workforce ({totalPresent})</strong>, plus Overtime and Shift Payroll.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-3 py-1 bg-white/10 border border-white/15 rounded-xl text-indigo-100 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {totalPresent} Active Workforce ({totalPerm} Perm + {totalTemp} Temp)
              </span>
            </div>
          </div>

          {/* 4 Core Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Card 1: Total Present & Attendance */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200 flex items-center justify-between">
                <span>Active Workforce</span>
                <span className="font-mono text-emerald-300 font-bold">Perm + Temp</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {totalPresent} <span className="text-xs font-normal text-indigo-200">Staff ({totalPerm} + {totalTemp})</span>
              </div>
              <div className="text-[10px] text-indigo-200/90 font-mono flex items-center justify-between pt-0.5 border-t border-white/10">
                <span>Cadre: {totalCadre}</span>
                <span className={totalAbsent > 0 ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                  Absent: {totalAbsent} ({absentRatePct}%)
                </span>
              </div>
            </div>

            {/* Card 2: Permanent Workforce */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 flex items-center justify-between">
                <span>Permanent Staff</span>
                <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-200 rounded text-[9px] font-mono font-bold">
                  {permSharePct}% of Workforce
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
                {totalPerm} <span className="text-xs font-normal text-emerald-200">Workers</span>
              </div>
              <div className="text-[10px] text-emerald-200/90 font-mono flex items-center justify-between pt-0.5 border-t border-white/10">
                <span>Base: {currency} {totalPermCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                <span>Avg: {currency}{avgPermWage}</span>
              </div>
            </div>

            {/* Card 3: TEMPORARY WORKERS SUMMARY (Highlighted Pink/Rose Card) */}
            <div className="bg-gradient-to-br from-pink-500/30 to-rose-600/35 backdrop-blur-md p-3.5 rounded-2xl border-2 border-pink-400/50 space-y-1 relative shadow-inner">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-pink-200 flex items-center justify-between">
                <span className="flex items-center gap-1 font-black">
                  <Zap className="w-3 h-3 text-pink-300 fill-pink-300" />
                  Temporary Staff (+Added)
                </span>
                <div className="flex items-center gap-1">
                  {canEditWages && (
                    <button
                      type="button"
                      onClick={() => setShowBatchTempWageModal(true)}
                      className="px-1.5 py-0.5 bg-pink-400 hover:bg-pink-300 text-pink-950 rounded text-[9px] font-black uppercase transition cursor-pointer shadow-xs flex items-center gap-0.5"
                      title="Edit all temporary worker wages"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  <span className="px-1.5 py-0.2 bg-pink-400/40 text-pink-100 rounded text-[9px] font-mono font-black border border-pink-300/40">
                    +{tempSharePct}%
                  </span>
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-pink-200 font-mono flex items-baseline justify-between">
                <span>+{totalTemp} <span className="text-xs font-normal text-pink-300">Temps</span></span>
                <span className="text-xs font-bold text-pink-300 font-mono">
                  {currency} {totalTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="text-[10px] text-pink-200/90 font-mono flex items-center justify-between pt-0.5 border-t border-pink-400/20">
                <span>Avg: {currency}{avgTempWage}/d</span>
                <span>{tempDepts.length} {tempDepts.length === 1 ? 'Dept' : 'Depts'}</span>
              </div>
            </div>

            {/* Card 4: Total Daily Labor Cost */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-200 flex items-center justify-between">
                <span>Shift Labor Cost</span>
                <span className="font-mono text-amber-300 font-bold">
                  {otHours > 0 ? `+${otHours.toFixed(1)}h OT` : 'Standard'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {currency} {totalCostToday.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-indigo-200/90 font-mono flex items-center justify-between pt-0.5 border-t border-white/10">
                <span>Base: {currency} {(totalPermCost + totalTempCost).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                <span className={totalOtCost > 0 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                  OT: {currency} {totalOtCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

          </div>

          {/* Temporary Worker Department-by-Department Breakdown Sub-Section */}
          <div className="bg-black/25 rounded-2xl p-3.5 border border-white/10 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-pink-200">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-pink-400" />
                <span className="uppercase text-[11px] font-extrabold tracking-wider">
                  Temporary Worker Deployment Summary:
                </span>
              </div>
              <span className="text-[11px] font-mono text-pink-100 font-normal">
                {totalTemp > 0 
                  ? `${totalTemp} temporary workers active across ${tempDepts.length} department(s) totaling ${currency} ${totalTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}/day (${tempCostSharePct}% of shift payroll)`
                  : 'No temporary workers deployed on this shift date (100% permanent workforce coverage)'}
              </span>
            </div>

            {totalTemp > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {tempDepts.map(td => (
                  <div 
                    key={`temp_dept_${td.id}`}
                    className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-400/30 text-white text-xs font-mono flex items-center gap-2 transition"
                  >
                    <span className="font-sans font-extrabold text-pink-200 text-[11px] uppercase tracking-wide">
                      {td.name}:
                    </span>
                    <span className="px-1.5 py-0.2 rounded-md bg-pink-500/40 font-black text-pink-100 text-[10px]">
                      {td.tempCount} {td.tempCount === 1 ? 'temp' : 'temps'} ({td.tempPct}%)
                    </span>
                    <span className="text-pink-300 text-[11px]">
                      {currency} {td.tempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-300 font-medium italic">
                All {totalPerm} present staff members are permanent workers. No temporary workers hired for this operational shift.
              </div>
            )}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* MOBILE WORKFORCE VIEW (Cards view for small screens: block lg:hidden)     */}
        {/* ========================================================================= */}
        <div className="block lg:hidden space-y-4">
          {/* Mobile Grand Total Summary Card - Positioned at top */}
          <div className="p-4 bg-gradient-to-r from-pink-700 via-rose-700 to-indigo-900 text-white rounded-2xl space-y-3 shadow-md border border-pink-500/20">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <div className="text-[10px] font-extrabold text-pink-100 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-300 animate-pulse" />
                Grand Total Workforce & Temp Summary
              </div>
              <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-white/15 text-pink-100 border border-white/20">
                {sheet.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <span className="text-pink-200/90 block text-[9px] font-sans font-bold uppercase tracking-wider">Cadre / Present</span>
                <span className="font-extrabold text-white text-sm">{totalCadre} / {totalPresent}</span>
              </div>

              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <span className="text-emerald-200 block text-[9px] font-sans font-bold uppercase tracking-wider">Permanent Staff</span>
                <span className="font-extrabold text-emerald-300 text-sm">{totalPerm} ({permSharePct}%)</span>
              </div>

              <div className="bg-pink-950/50 p-2.5 rounded-xl border border-pink-400/40 col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-pink-200 block text-[9px] font-sans font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 text-pink-300 fill-pink-300" />
                    Temporary Worker Summary
                  </span>
                  <span className="text-pink-300 text-[10px] font-bold">
                    {tempSharePct}% of Plant
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="font-black text-pink-100 text-sm">{totalTemp} Temps</span>
                  <span className="font-black text-pink-200">
                    {currency} {totalTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="text-[10px] text-pink-300/80 mt-0.5 flex justify-between">
                  <span>Avg: {currency}{avgTempWage}/day</span>
                  <span>{tempDepts.length} dept(s)</span>
                </div>
              </div>

              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <span className="text-emerald-200 block text-[9px] font-sans font-bold uppercase tracking-wider">Base Payroll</span>
                <span className="font-extrabold text-emerald-300 text-sm">
                  {currency} {(totalPermCost + totalTempCost).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                <span className="text-amber-200 block text-[9px] font-sans font-bold uppercase tracking-wider">OT Payroll</span>
                <span className="font-extrabold text-amber-300 text-sm">
                  {currency} {totalOtCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} ({totalOtHeadcount} HC)
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/15 flex items-center justify-between font-mono bg-black/20 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
              <span className="text-xs font-extrabold text-pink-100 uppercase tracking-wider">Total Today</span>
              <span className="text-base font-black text-emerald-300">
                {currency} {totalCostToday.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {sheet.departments.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              <Clock className="w-8 h-8 text-pink-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">No Departments Loaded</p>
              <p className="text-[11px] text-slate-500 mt-1">Upload a clock-in file or add a department to start.</p>
            </div>
          ) : (
            sheet.departments.map((d) => {
              const deptEditable = isDeptEditable(d.name);
              const deptCadre = d.roles.reduce((s, r) => s + (r.cadre ?? (r.perm + (r.absent || 0))), 0);
              const deptPerm = d.roles.reduce((s, r) => s + r.perm, 0);
              const deptAbsent = d.roles.reduce((s, r) => s + (r.absent ?? (r.cadre ? Math.max(0, r.cadre - r.perm) : 0)), 0);
              const deptTemp = d.roles.reduce((s, r) => s + r.temp, 0);
              const deptTotalPresent = deptPerm + deptTemp;
              const deptPermCost = d.roles.reduce((s, r) => s + ((r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage)), 0);
              const deptTempCost = d.roles.reduce((s, r) => s + (r.temp * r.tempWage), 0);
              const deptBaseCost = deptPermCost + deptTempCost;

              let deptOtHc = 0;
              let deptOtCost = 0;

              d.roles.forEach(r => {
                const totPres = r.perm + r.temp;
                const rOtHc = (r.otHeadcount !== undefined && r.otHeadcount >= 0) ? r.otHeadcount : 0;
                const pCost = (r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage);
                const tCost = r.temp * r.tempWage;
                const bCost = pCost + tCost;

                let rOtCost = 0;
                if (r.otCost !== undefined && r.otCost >= 0) {
                  rOtCost = r.otCost;
                } else if (otHours > 0 && rOtHc > 0) {
                  const avgHourly = totPres > 0 ? (bCost / totPres) / 9.0 : (r.permWage > 0 ? r.permWage / 9.0 : 0);
                  rOtCost = rOtHc * otHours * avgHourly * otMultiplier;
                }

                if (rOtHc > 0 || (r.otCost && r.otCost > 0)) {
                  deptOtHc += rOtHc;
                  deptOtCost += rOtCost;
                }
              });

              const deptCost = deptBaseCost + deptOtCost;

              return (
                <div key={`mob_${d.id}`} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  {/* Department Header */}
                  <div className="bg-slate-100 p-3.5 border-b border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs uppercase">
                        <span>📁</span>
                        <EditableCell
                          value={d.name}
                          onSave={(val) => handleRenameDept(d.id, val)}
                          isEditable={deptEditable}
                          placeholder="DEPARTMENT"
                          className="font-black text-indigo-950"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {deptEditable && canEditAnyWages && (
                          <button
                            type="button"
                            onClick={() => {
                              const avgP = d.roles.length > 0 ? (d.roles[0].permWage || 146.00) : 146.00;
                              const avgT = d.roles.length > 0 ? (d.roles[0].tempWage || 125.95) : 125.95;
                              setDeptToSetWage({ id: d.id, name: d.name, permWage: avgP, tempWage: avgT, adjustmentMode: 'set', adjustmentPercent: 0, applyToAllDates: false });
                            }}
                            className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition shadow-2xs"
                            title={`Edit daily wage rate for ${d.name}`}
                          >
                            <DollarSign className="w-3 h-3 text-emerald-200" />
                            <span>Wage Rates</span>
                          </button>
                        )}
                        {deptEditable && (
                          <button
                            type="button"
                            onClick={() => setNewRoleDeptId(d.id)}
                            className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-600 text-white flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Role
                          </button>
                        )}
                        {deptEditable && sheet.departments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDept(d.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono pt-1 border-t border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">Present: <strong className="text-indigo-950">{deptTotalPresent}</strong></span>
                        <span className="text-amber-800 font-bold">OT Staff: <strong className="text-amber-950">{deptOtHc}</strong></span>
                      </div>
                      <div className="font-extrabold text-slate-900">
                        Total: {currency} {deptCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  {/* Roles List */}
                  <div className="divide-y divide-slate-100 p-2 space-y-2">
                    {d.roles.map((r) => {
                      const cadreVal = r.cadre ?? (r.perm + (r.absent || 0));
                      const absentVal = r.absent ?? (cadreVal ? Math.max(0, cadreVal - r.perm) : 0);
                      const totalPresent = r.perm + r.temp;
                      const permCost = (r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage);
                      const tempCost = r.temp * r.tempWage;
                      const baseCost = permCost + tempCost;

                      const roleOtHc = (r.otHeadcount !== undefined && r.otHeadcount >= 0) ? r.otHeadcount : 0;

                      let roleOtCost = 0;
                      if (r.otCost !== undefined && r.otCost >= 0) {
                        roleOtCost = r.otCost;
                      } else if (otHours > 0 && roleOtHc > 0) {
                        const avgHourly = totalPresent > 0 ? (baseCost / totalPresent) / 9.0 : (r.permWage > 0 ? r.permWage / 9.0 : 0);
                        roleOtCost = roleOtHc * otHours * avgHourly * otMultiplier;
                      }

                      const dailyCost = baseCost + roleOtCost;

                      return (
                        <div key={`mob_r_${r.id}`} className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/70 space-y-2.5">
                          {/* Role Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-slate-900 text-xs">
                              <EditableCell
                                value={r.title}
                                onSave={(val) => handleUpdateRole(d.id, r.id, 'title', val)}
                                isEditable={deptEditable}
                                placeholder="Role Title"
                                className="font-bold text-slate-900"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-extrabold text-[10px] rounded-md font-mono">
                                Total {totalPresent} Working
                              </span>
                              {deptEditable && d.roles.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRole(d.id, r.id)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Headcount Grid */}
                          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-slate-200/80">
                            <div>
                              <span className="block text-slate-400 uppercase font-bold text-[9px]">Cadre</span>
                              <EditableCell
                                value={cadreVal}
                                type="number"
                                min={0}
                                onSave={(val) => handleUpdateRole(d.id, r.id, 'cadre', val)}
                                isEditable={deptEditable}
                                className="font-mono text-slate-700 font-bold"
                              />
                            </div>
                            <div className="bg-emerald-50/50 rounded p-0.5">
                              <span className="block text-emerald-800 uppercase font-bold text-[9px]">Perm</span>
                              <EditableCell
                                value={r.perm}
                                type="number"
                                min={0}
                                onSave={(val) => handleUpdateRole(d.id, r.id, 'perm', val)}
                                isEditable={deptEditable}
                                className="font-mono text-emerald-900 font-extrabold"
                              />
                            </div>
                            <div>
                              <span className="block text-rose-500 uppercase font-bold text-[9px]">Absent</span>
                              <EditableCell
                                value={absentVal}
                                type="number"
                                min={0}
                                onSave={(val) => handleUpdateRole(d.id, r.id, 'absent', val)}
                                isEditable={deptEditable}
                                className="font-mono text-rose-600 font-bold"
                              />
                            </div>
                            <div className="bg-pink-50/50 rounded p-0.5">
                              <span className="block text-pink-800 uppercase font-bold text-[9px]">Temp</span>
                              <EditableCell
                                value={r.temp}
                                type="number"
                                min={0}
                                onSave={(val) => handleUpdateRole(d.id, r.id, 'temp', val)}
                                isEditable={deptEditable}
                                className="font-mono text-pink-900 font-extrabold"
                              />
                            </div>
                          </div>

                          {/* Base Wages & Overtime Controls */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* Perm & Temp Base Wage */}
                            <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
                              <div className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center justify-between border-b border-slate-100 pb-1">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-emerald-600" />
                                  Daily Wage Rates (M/day)
                                </span>
                                {canEditAnyWages && (
                                  <button
                                    type="button"
                                    onClick={() => setShowBatchWageModal(true)}
                                    className="text-[8px] font-bold text-indigo-700 hover:underline uppercase flex items-center gap-0.5"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    <span>Batch</span>
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100">
                                <div>
                                  <span className="text-emerald-900 font-bold block text-[10px] uppercase">Perm Wage Rate</span>
                                  <span className="text-[9px] text-slate-500 font-normal">Base: {currency} {permCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                                </div>
                                <EditableCell
                                  value={r.permWage ?? 140.00}
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  prefix={`${currency} `}
                                  suffix="/d"
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'permWage', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-black text-emerald-950 bg-white border-emerald-300 shadow-2xs"
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono bg-pink-50/50 p-1.5 rounded-lg border border-pink-100">
                                <div>
                                  <span className="text-pink-900 font-bold block text-[10px] uppercase">Temp Wage Rate</span>
                                  <span className="text-[9px] text-slate-500 font-normal">Base: {currency} {tempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                                </div>
                                <EditableCell
                                  value={r.tempWage ?? 125.95}
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  prefix={`${currency} `}
                                  suffix="/d"
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'tempWage', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-black text-pink-950 bg-white border-pink-300 shadow-2xs"
                                />
                              </div>
                            </div>

                            {/* Overtime Box (Amber) */}
                            <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5">
                              <div className="text-[10px] font-extrabold text-amber-900 uppercase flex items-center justify-between border-b border-amber-200/60 pb-1">
                                <span>OT Controls</span>
                                <span className="text-[8px] font-mono bg-amber-200 px-1 rounded text-amber-950">
                                  {r.otHeadcount !== undefined && r.otHeadcount > 0 ? 'Custom' : '0 Default'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-amber-900 font-medium">OT HC:</span>
                                <EditableCell
                                  value={roleOtHc}
                                  type="number"
                                  min={0}
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'otHeadcount', val)}
                                  isEditable={deptEditable}
                                  className="font-extrabold text-amber-950"
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-amber-900 font-medium">OT Cost:</span>
                                <EditableCell
                                  value={roleOtCost}
                                  type="number"
                                  min={0}
                                  prefix={`${currency} `}
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'otCost', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-extrabold text-amber-950"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Role Total Cost Footer */}
                          <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500 font-bold text-[10px] uppercase">Daily Total Cost</span>
                            <span className="font-black text-indigo-950">
                              {currency} {dailyCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================================= */}
        {/* DESKTOP WORKFORCE VIEW (Full Table view for large screens: hidden lg:block)*/}
        {/* ========================================================================= */}
        <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
          <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-indigo-900 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3 pl-4">Role / Department</th>
                <th className="p-3 text-right">Cadre (Budget)</th>
                <th className="p-3 text-right text-emerald-800 bg-emerald-50/50">Perm Staff (Present)</th>
                <th className="p-3 text-right text-rose-800">Absent (Perm)</th>
                <th className="p-3 text-right text-pink-800 bg-pink-50/50">Temp Staff (+Added)</th>
                <th className="p-3 text-right font-black text-indigo-950 bg-indigo-50/40">Active Workforce (Perm + Temp)</th>
                <th className="p-3 text-right text-emerald-900 bg-emerald-50/50">
                  <div className="flex items-center justify-end gap-1">
                    <span>Perm Wage Rate & Cost</span>
                    {canEditAnyWages && (
                      <button
                        type="button"
                        onClick={() => setShowBatchWageModal(true)}
                        className="p-1 rounded-md bg-emerald-200 hover:bg-emerald-300 text-emerald-950 transition cursor-pointer"
                        title="Quick edit daily wages by classification"
                      >
                        <Edit3 className="w-3 h-3 text-emerald-900" />
                      </button>
                    )}
                  </div>
                </th>
                <th className="p-3 text-right text-pink-950 bg-pink-50/60">
                  <div className="flex items-center justify-end gap-1">
                    <span>Temp Wage Rate & Cost</span>
                    {canEditAnyWages && (
                      <button
                        type="button"
                        onClick={() => setShowBatchTempWageModal(true)}
                        className="p-1 rounded-md bg-pink-200 hover:bg-pink-300 text-pink-950 transition cursor-pointer"
                        title="Edit and bulk update all temporary worker wages"
                      >
                        <Zap className="w-3 h-3 fill-pink-900" />
                      </button>
                    )}
                  </div>
                </th>
                <th className="p-3 text-right text-amber-900 bg-amber-100/60 font-black">OT Headcount</th>
                <th className="p-3 text-right text-amber-950 bg-amber-100/60 font-black">OT Cost (After 5 PM / Wknd)</th>
                <th className="p-3 text-right font-black">Total Cost Today</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {sheet.departments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-500 bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mx-auto shadow-xs">
                        <Clock className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-800">Clean Slate — No Departments Loaded</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Upload your Cadre Clock-In Excel (.xlsx) file to automatically populate workforce headcount and departments, or create a department manually to start.
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        {onOpenClockInModal && (
                          <button
                            type="button"
                            onClick={onOpenClockInModal}
                            className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs transition cursor-pointer hover:scale-[1.01]"
                          >
                            <Upload className="w-4 h-4 text-pink-100" /> Upload Clock-In Excel File
                          </button>
                        )}
                        {canEditHeadcount && (
                          <button
                            type="button"
                            onClick={() => setShowAddDeptModal(true)}
                            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition cursor-pointer shadow-2xs"
                          >
                            + Add Department
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sheet.departments.map((d) => {
                const deptEditable = isDeptEditable(d.name);
                const deptCadre = d.roles.reduce((s, r) => s + (r.cadre ?? (r.perm + (r.absent || 0))), 0);
                const deptPerm = d.roles.reduce((s, r) => s + r.perm, 0);
                const deptAbsent = d.roles.reduce((s, r) => s + (r.absent ?? (r.cadre ? Math.max(0, r.cadre - r.perm) : 0)), 0);
                const deptTemp = d.roles.reduce((s, r) => s + r.temp, 0);
                const deptTotalPresent = deptPerm + deptTemp;
                const deptPermCost = d.roles.reduce((s, r) => s + ((r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage)), 0);
                const deptTempCost = d.roles.reduce((s, r) => s + (r.temp * r.tempWage), 0);
                const deptBaseCost = deptPermCost + deptTempCost;

                let deptOtHc = 0;
                let deptOtCost = 0;

                d.roles.forEach(r => {
                  const totPres = r.perm + r.temp;
                  const rOtHc = (r.otHeadcount !== undefined && r.otHeadcount >= 0) ? r.otHeadcount : 0;
                  const pCost = (r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage);
                  const tCost = r.temp * r.tempWage;
                  const bCost = pCost + tCost;

                  let rOtCost = 0;
                  if (r.otCost !== undefined && r.otCost >= 0) {
                    rOtCost = r.otCost;
                  } else if (otHours > 0 && rOtHc > 0) {
                    const avgHourly = totPres > 0 ? (bCost / totPres) / 9.0 : (r.permWage > 0 ? r.permWage / 9.0 : 0);
                    rOtCost = rOtHc * otHours * avgHourly * otMultiplier;
                  }

                  if (rOtHc > 0 || (r.otCost && r.otCost > 0)) {
                    deptOtHc += rOtHc;
                    deptOtCost += rOtCost;
                  }
                });

                const deptCost = deptBaseCost + deptOtCost;

                return (
                  <React.Fragment key={d.id}>
                    {/* Department Header Row */}
                    <tr className="bg-slate-100/80 border-y border-slate-200 font-bold">
                      <td className="p-3 pl-4 font-extrabold text-indigo-950 uppercase tracking-wide text-xs">
                        <div className="flex items-center gap-2">
                          <span>📁</span>
                          <EditableCell
                            value={d.name}
                            onSave={(val) => handleRenameDept(d.id, val)}
                            isEditable={deptEditable}
                            placeholder="DEPARTMENT NAME"
                            className="font-extrabold text-indigo-950 uppercase"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 font-extrabold">{deptCadre}</td>
                      <td className="p-3 text-right font-mono text-emerald-800 bg-emerald-50/30 font-extrabold">{deptPerm}</td>
                      <td className="p-3 text-right font-mono text-rose-700 font-extrabold">{deptAbsent}</td>
                      <td className="p-3 text-right font-mono text-pink-800 bg-pink-50/30 font-extrabold">{deptTemp}</td>
                      <td className="p-3 text-right font-mono text-indigo-900 font-black">{deptTotalPresent}</td>
                      <td className="p-3 text-right font-mono text-emerald-900 bg-emerald-50/30 font-extrabold">
                        {currency} {deptPermCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 text-right font-mono text-pink-900 bg-pink-50/30 font-extrabold">
                        {currency} {deptTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-amber-950 bg-amber-100/40">
                        {deptOtHc}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-amber-950 bg-amber-100/40">
                        {currency} {deptOtCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">
                        {currency} {deptCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 text-center">
                        {deptEditable && (
                          <div className="flex items-center justify-center gap-1.5">
                            {canEditAnyWages && (
                              <button
                                onClick={() => {
                                  const avgP = d.roles.length > 0 ? (d.roles[0].permWage || 146.00) : 146.00;
                                  const avgT = d.roles.length > 0 ? (d.roles[0].tempWage || 125.95) : 125.95;
                                  setDeptToSetWage({ id: d.id, name: d.name, permWage: avgP, tempWage: avgT, adjustmentMode: 'set', adjustmentPercent: 0, applyToAllDates: false });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition cursor-pointer shadow-2xs"
                                title={`Set wage rates for all roles in ${d.name}`}
                              >
                                <DollarSign className="w-3 h-3 text-emerald-600" /> Wages
                              </button>
                            )}
                            <button
                              onClick={() => setNewRoleDeptId(d.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer shadow-2xs"
                              title="Add a new role to this department"
                            >
                              <Plus className="w-3 h-3" /> Add Role
                            </button>
                            {sheet.departments.length > 1 && (
                              <button
                                onClick={() => handleDeleteDept(d.id)}
                                title={`Delete department "${d.name}"`}
                                className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-700 transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Department Roles Rows */}
                    {d.roles.map((r) => {
                      const cadreVal = r.cadre ?? (r.perm + (r.absent || 0));
                      const absentVal = r.absent ?? (cadreVal ? Math.max(0, cadreVal - r.perm) : 0);
                      const totalPresent = r.perm + r.temp;
                      const permCost = (r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage);
                      const tempCost = r.temp * r.tempWage;
                      const baseCost = permCost + tempCost;

                      const roleOtHc = (r.otHeadcount !== undefined && r.otHeadcount >= 0) ? r.otHeadcount : 0;

                      let roleOtCost = 0;
                      if (r.otCost !== undefined && r.otCost >= 0) {
                        roleOtCost = r.otCost;
                      } else if (otHours > 0 && roleOtHc > 0) {
                        const avgHourly = totalPresent > 0 ? (baseCost / totalPresent) / 9.0 : (r.permWage > 0 ? r.permWage / 9.0 : 0);
                        roleOtCost = roleOtHc * otHours * avgHourly * otMultiplier;
                      }

                      const dailyCost = baseCost + roleOtCost;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition text-slate-800">
                          <td className="p-3 pl-8 font-semibold text-slate-900">
                            <EditableCell
                              value={r.title}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'title', val)}
                              isEditable={deptEditable}
                              placeholder="e.g. Supervisor"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <EditableCell
                              value={cadreVal}
                              type="number"
                              min={0}
                              max={9999}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'cadre', val)}
                              isEditable={deptEditable}
                              className="text-right font-mono text-slate-600"
                            />
                          </td>
                          <td className="p-3 text-right bg-emerald-50/20">
                            <EditableCell
                              value={r.perm}
                              type="number"
                              min={0}
                              max={9999}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'perm', val)}
                              isEditable={deptEditable}
                              className="text-right font-mono font-bold text-emerald-800"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <EditableCell
                              value={absentVal}
                              type="number"
                              min={0}
                              max={9999}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'absent', val)}
                              isEditable={deptEditable}
                              className="text-right font-mono text-rose-600"
                            />
                          </td>
                          <td className="p-3 text-right bg-pink-50/20">
                            <EditableCell
                              value={r.temp}
                              type="number"
                              min={0}
                              max={9999}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'temp', val)}
                              isEditable={deptEditable}
                              className="text-right font-mono font-bold text-pink-700"
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-indigo-900">
                            {totalPresent}
                          </td>
                          <td className="p-3 text-right bg-emerald-50/20">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-emerald-800 font-bold uppercase">Rate:</span>
                                <EditableCell
                                  value={r.permWage}
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  prefix={`${currency} `}
                                  suffix="/d"
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'permWage', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-mono text-emerald-950 font-black bg-emerald-100/70 border-emerald-300 px-2 py-0.5 shadow-2xs"
                                />
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center justify-end gap-1">
                                <span>Cost:</span>
                                <EditableCell
                                  value={permCost}
                                  type="number"
                                  min={0}
                                  step={1}
                                  prefix={`${currency} `}
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'permCost', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-mono font-bold text-emerald-900"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right bg-pink-50/20">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-pink-800 font-bold uppercase">Rate:</span>
                                <EditableCell
                                  value={r.tempWage ?? 125.95}
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  prefix={`${currency} `}
                                  suffix="/d"
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'tempWage', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-mono text-pink-950 font-black bg-pink-100/70 border-pink-300 px-2 py-0.5 shadow-2xs"
                                />
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono flex items-center justify-end gap-1">
                                <span>Cost:</span>
                                <EditableCell
                                  value={tempCost}
                                  type="number"
                                  min={0}
                                  step={1}
                                  prefix={`${currency} `}
                                  onSave={(val) => handleUpdateRole(d.id, r.id, 'tempCost', val)}
                                  isEditable={deptEditable && canEditAnyWages}
                                  className="font-mono font-bold text-pink-900"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right bg-amber-50/30">
                            <EditableCell
                              value={roleOtHc}
                              type="number"
                              min={0}
                              max={9999}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'otHeadcount', val)}
                              isEditable={deptEditable}
                              className="text-right font-mono font-extrabold text-amber-900"
                            />
                            <div className="text-[9px] text-amber-700 font-sans font-medium mt-0.5">
                              {r.otHeadcount !== undefined && r.otHeadcount > 0 ? 'Custom HC' : '0 (Default)'}
                            </div>
                          </td>
                          <td className="p-3 text-right bg-amber-50/30">
                            <EditableCell
                              value={roleOtCost}
                              type="number"
                              min={0}
                              step={1}
                              prefix={`${currency} `}
                              onSave={(val) => handleUpdateRole(d.id, r.id, 'otCost', val)}
                              isEditable={deptEditable && canEditWages}
                              className="text-right font-mono font-extrabold text-amber-950"
                            />
                            {otHours > 0 && (
                              <div className="text-[9px] text-amber-700 font-sans font-extrabold mt-0.5">
                                {otHours.toFixed(1)}h @ {otMultiplier}× {r.otCost !== undefined ? '(Custom Cost)' : ''}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {currency} {dailyCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-3 text-center">
                            {deptEditable ? (
                              <button
                                onClick={() => handleDeleteRole(d.id, r.id)}
                                title="Delete role"
                                className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Add Role Inline Form Dialog */}
                    {newRoleDeptId === d.id && (
                      <tr className="bg-slate-50/80 border border-dashed border-slate-300">
                        <td className="p-3 pl-6" colSpan={12}>
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Add New Role to {d.name}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title</label>
                                <input
                                  type="text"
                                  value={newRoleTitle}
                                  onChange={(e) => setNewRoleTitle(e.target.value)}
                                  placeholder="e.g. Cutter Helper"
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Perm Count</label>
                                <input
                                  type="number"
                                  value={newRolePerm}
                                  onChange={(e) => setNewRolePerm(parseInt(e.target.value) || 0)}
                                  min={0}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp Count</label>
                                <input
                                  type="number"
                                  value={newRoleTemp}
                                  onChange={(e) => setNewRoleTemp(parseInt(e.target.value) || 0)}
                                  min={0}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Perm Wage/Day</label>
                                <input
                                  type="number"
                                  value={newRolePermW}
                                  onChange={(e) => setNewRolePermW(parseFloat(e.target.value) || 0)}
                                  min={0}
                                  step={0.01}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp Wage/Day</label>
                                <input
                                  type="number"
                                  value={newRoleTempW}
                                  onChange={(e) => setNewRoleTempW(parseFloat(e.target.value) || 0)}
                                  min={0}
                                  step={0.01}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-mono"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 text-xs">
                              <button
                                onClick={() => setNewRoleDeptId(null)}
                                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAddRoleSubmit(d.id)}
                                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-xs"
                              >
                                Confirm Add
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              }))}
            </tbody>
            <tfoot>
              {/* Row 1: Primary Grand Total Workforce */}
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900 text-xs">
                <td className="p-3 pl-4 text-indigo-950 uppercase tracking-wider font-black">
                  GRAND TOTAL ACTIVE WORKFORCE
                </td>
                <td className="p-3 text-right font-mono text-slate-700 font-extrabold">{totalCadre}</td>
                <td className="p-3 text-right font-mono text-emerald-800 bg-emerald-50/50 font-extrabold">{totalPerm}</td>
                <td className="p-3 text-right font-mono text-rose-700 font-extrabold">{totalAbsent}</td>
                <td className="p-3 text-right font-mono text-pink-800 bg-pink-50/50 font-extrabold">+{totalTemp}</td>
                <td className="p-3 text-right font-mono text-indigo-950 bg-indigo-50/70 font-black text-sm">{totalPresent}</td>
                <td className="p-3 text-right font-mono text-emerald-950 bg-emerald-100/50 font-black">
                  {currency} {totalPermCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right font-mono text-pink-950 bg-pink-100/50 font-black">
                  {currency} {totalTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right font-mono text-amber-950 bg-amber-200/60 font-black">
                  {totalOtHeadcount}
                </td>
                <td className="p-3 text-right font-mono text-amber-950 bg-amber-200/60 font-black">
                  {currency} {totalOtCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right font-mono text-indigo-950 font-black">
                  {currency} {totalCostToday.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
                <td></td>
              </tr>

              {/* Row 2: Dedicated Temporary Worker Summary Row */}
              <tr className="bg-pink-50/90 border-t border-pink-200 font-mono text-xs text-pink-950">
                <td className="p-3 pl-4 font-sans font-extrabold text-pink-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-pink-600 fill-pink-500" />
                  TEMPORARY WORKER SUMMARY
                </td>
                <td colSpan={3} className="p-3 text-center font-sans text-[11px] text-pink-800 font-bold bg-pink-100/40">
                  {totalTemp > 0 
                    ? `${tempSharePct}% of Plant Manpower (${totalTemp} of ${totalPresent} staff)`
                    : '100% Permanent Workforce (0 Temps)'}
                </td>
                <td className="p-3 text-right font-black text-pink-900 bg-pink-200/50">
                  {totalTemp} <span className="text-[10px] font-sans font-normal text-pink-700">Temps</span>
                </td>
                <td className="p-3 text-right font-sans text-[11px] text-pink-800 font-medium">
                  {totalTemp > 0 ? `Avg ${currency}${avgTempWage}/d` : '—'}
                </td>
                <td className="p-3 text-right font-sans text-[11px] text-slate-500">
                  Perm: {currency}{totalPermCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right font-black text-pink-900 bg-pink-200/50">
                  {currency} {totalTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                  <div className="text-[9px] font-sans font-bold text-pink-700">
                    {tempCostSharePct}% of Labor
                  </div>
                </td>
                <td colSpan={2} className="p-3 text-center font-sans text-[11px] text-pink-800 font-medium bg-pink-100/30">
                  {totalTemp > 0 ? `Active in ${tempDepts.length} department(s)` : 'No Temp Deployments'}
                </td>
                <td className="p-3 text-right font-bold text-pink-900">
                  {currency} {totalTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {canEditHeadcount && (
          <div className="mt-4 flex justify-start">
            <button
              type="button"
              onClick={() => setShowAddDeptModal(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-pink-50 text-slate-700 hover:text-pink-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-300 hover:border-pink-300 transition cursor-pointer shadow-2xs"
            >
              <FolderPlus className="w-4 h-4 text-pink-600" />
              <span>+ Add New Department</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      <AddDepartmentModal
        isOpen={showAddDeptModal}
        onClose={() => setShowAddDeptModal(false)}
        currentSheet={sheet}
        allSheets={sheets}
        onUpdateSheet={onUpdateSheet}
        onUpdateAllSheets={onUpdateAllSheets}
        currency={currency}
      />

      {/* Batch Wage Adjustment Modal */}
      <BatchWageUpdateModal
        isOpen={showBatchWageModal}
        onClose={() => setShowBatchWageModal(false)}
        currentSheet={sheet}
        allSheets={sheets}
        onUpdateSheet={onUpdateSheet}
        onUpdateAllSheets={onUpdateAllSheets}
        currency={currency}
        canEditWages={canEditWages}
      />

      {/* Batch Temporary Wages Modal */}
      <BatchTempWageModal
        isOpen={showBatchTempWageModal}
        onClose={() => setShowBatchTempWageModal(false)}
        currentSheet={sheet}
        allSheets={sheets}
        onUpdateSheet={onUpdateSheet}
        onUpdateAllSheets={onUpdateAllSheets}
        currency={currency}
        canEditWages={canEditWages}
      />

      {/* Reset Date to Clean Slate Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetCleanSlateModal}
        onClose={() => setShowResetCleanSlateModal(false)}
        onConfirm={executeResetSheetToCleanSlate}
        title={`Reset "${sheet.label}" to Clean Slate`}
        message={`Are you sure you want to completely reset all data for "${sheet.label}" to a clean slate?`}
        subMessage="This will clear all daily data on this date: Cadre, Present Permanent Workers, Absent Workers, Temporary Workers, Overtime records, Style production revenue, and SAH targets (all set to 0). Department structures and role titles will remain intact."
        confirmText="Yes, Clear All Date Data"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="reset"
      />

      {/* Delete Department Confirmation Modal */}
      {deptToDelete && (
        <ConfirmModal
          isOpen={!!deptToDelete}
          onClose={() => setDeptToDelete(null)}
          onConfirm={() => executeDeleteDept(deptToDelete.id)}
          title={`Delete Department "${deptToDelete.name}"`}
          message={`Are you sure you want to delete the department "${deptToDelete.name}" and all of its ${deptToDelete.rolesCount} role(s)?`}
          subMessage="This action will remove the department and its associated positions from this sheet."
          confirmText="Yes, Delete Department"
          cancelText="Cancel"
          confirmVariant="danger"
          icon="trash"
        />
      )}

      {/* Set Department Daily Wage Rates Modal */}
      {deptToSetWage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Set Daily Wages for {deptToSetWage.name}
                  </h3>
                  <p className="text-xs text-slate-500">Apply daily wage rates to all roles in this department</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeptToSetWage(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Wage Update Method
                </label>
                <select
                  value={deptToSetWage.adjustmentMode}
                  onChange={(e) => setDeptToSetWage({
                    ...deptToSetWage,
                    adjustmentMode: e.target.value as 'set' | 'percentage'
                  })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="set">Set fixed daily wage rates</option>
                  <option value="percentage">Adjust existing rates by percentage</option>
                </select>
              </div>

              {deptToSetWage.adjustmentMode === 'percentage' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Percentage Adjustment
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={0.1}
                      min={-100}
                      value={deptToSetWage.adjustmentPercent}
                      onChange={(e) => setDeptToSetWage({
                        ...deptToSetWage,
                        adjustmentPercent: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-sm text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Use a positive value to increase wages or a negative value to reduce them. Current role rates are preserved individually.
                  </p>
                </div>
              )}

              {deptToSetWage.adjustmentMode === 'set' && (
                <>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Permanent Staff Daily Wage ({currency}/day)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">{currency}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={deptToSetWage.permWage}
                    onChange={(e) => setDeptToSetWage({ ...deptToSetWage, permWage: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Standard factory default: M 146.00 (Operators) / M 140.00 (General) / M 180.00 (Supervisors)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Temporary Staff Daily Wage ({currency}/day)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">{currency}</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={deptToSetWage.tempWage}
                    onChange={(e) => setDeptToSetWage({ ...deptToSetWage, tempWage: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Standard factory default: M 125.95/day</p>
              </div>
                </>
              )}

              {sheets.length > 1 && onUpdateAllSheets && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={deptToSetWage.applyToAllDates}
                      onChange={(e) => setDeptToSetWage({ ...deptToSetWage, applyToAllDates: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>Apply these wage rates across ALL {sheets.length} shift dates</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeptToSetWage(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApplyDeptWages(deptToSetWage.id, deptToSetWage.permWage, deptToSetWage.tempWage, deptToSetWage.applyToAllDates)}
                className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl shadow-xs transition cursor-pointer"
              >
                {deptToSetWage.adjustmentMode === 'percentage' ? 'Apply Percentage Adjustment' : 'Apply Wage Rates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
