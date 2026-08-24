import React, { useState, useMemo } from 'react';
import { SheetData, Department, EmployeeRole } from '../types';
import { 
  DollarSign, 
  Users, 
  Zap, 
  Check, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  RotateCcw,
  Sliders,
  ShieldCheck,
  TrendingUp,
  Percent,
  Calculator,
  UserCheck,
  Briefcase,
  HelpCircle,
  Edit3,
  Building2,
  Clock
} from 'lucide-react';
import { getRoleClassification, WageClassification, CLASSIFICATIONS } from './BatchWageUpdateModal';

interface BatchTempWageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheet: SheetData;
  allSheets: SheetData[];
  onUpdateSheet: (updatedSheet: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  currency: string;
  canEditWages: boolean;
}

export default function BatchTempWageModal({
  isOpen,
  onClose,
  currentSheet,
  allSheets,
  onUpdateSheet,
  onUpdateAllSheets,
  currency,
  canEditWages
}: BatchTempWageModalProps) {
  // Modes: 'universal' (one single rate for all temps), 'by_tier' (MO/Sup/Gen), 'by_dept' (per department), 'role_matrix' (per role)
  const [activeMode, setActiveMode] = useState<'universal' | 'by_tier' | 'by_dept' | 'role_matrix'>('universal');
  const [targetScope, setTargetScope] = useState<'CURRENT_SHEET' | 'ALL_SHEETS'>('CURRENT_SHEET');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Universal single temp wage rate
  const [universalTempWage, setUniversalTempWage] = useState<number>(125.95);

  // 2. Classification-level Temp Wage States
  const [moTempWage, setMoTempWage] = useState<number>(125.95);
  const [supTempWage, setSupTempWage] = useState<number>(150.00);
  const [genTempWage, setGenTempWage] = useState<number>(125.95);

  // 3. Department-level temp wages map: { [deptId]: number }
  const [deptTempWages, setDeptTempWages] = useState<Record<string, number>>({});

  // 4. Role-level custom overrides: { [roleKey]: number }
  const [customRoleTempWages, setCustomRoleTempWages] = useState<Record<string, number>>({});

  // Flattened role items with temp headcount metadata
  const roleItems = useMemo(() => {
    const items: {
      key: string;
      deptId: string;
      deptName: string;
      roleTitle: string;
      classification: WageClassification;
      perm: number;
      temp: number;
      currentPermWage: number;
      currentTempWage: number;
    }[] = [];

    (currentSheet.departments || []).forEach(d => {
      (d.roles || []).forEach((r, rIdx) => {
        const classification = getRoleClassification(r.title, d.name);
        const key = `${d.id}__${r.title}__${rIdx}`;
        items.push({
          key,
          deptId: d.id,
          deptName: d.name,
          roleTitle: r.title,
          classification,
          perm: r.perm || 0,
          temp: r.temp || 0,
          currentPermWage: r.permWage ?? (classification === 'MACHINE_OPERATOR' ? 146.00 : classification === 'SUPERVISOR' ? 180.00 : 140.00),
          currentTempWage: r.tempWage ?? 125.95
        });
      });
    });

    return items;
  }, [currentSheet]);

  // Total temp workers count on this sheet
  const totalTempWorkers = useMemo(() => {
    return roleItems.reduce((sum, r) => sum + r.temp, 0);
  }, [roleItems]);

  // Helper to compute new temp wage for a role based on current active mode and state
  const getNewTempWageForRole = (item: typeof roleItems[0]): number => {
    if (activeMode === 'universal') {
      return universalTempWage;
    }

    if (activeMode === 'by_tier') {
      if (item.classification === 'MACHINE_OPERATOR') return moTempWage;
      if (item.classification === 'SUPERVISOR') return supTempWage;
      return genTempWage;
    }

    if (activeMode === 'by_dept') {
      if (deptTempWages[item.deptId] !== undefined) {
        return deptTempWages[item.deptId];
      }
      return item.currentTempWage;
    }

    // activeMode === 'role_matrix'
    if (customRoleTempWages[item.key] !== undefined) {
      return customRoleTempWages[item.key];
    }
    return item.currentTempWage;
  };

  // Metrics summary
  const metrics = useMemo(() => {
    let oldTempCost = 0;
    let newTempCost = 0;

    let moTempCount = 0;
    let moOldCost = 0;
    let moNewCost = 0;

    let supTempCount = 0;
    let supOldCost = 0;
    let supNewCost = 0;

    let genTempCount = 0;
    let genOldCost = 0;
    let genNewCost = 0;

    roleItems.forEach(item => {
      const oldCost = item.temp * item.currentTempWage;
      const nTempWage = getNewTempWageForRole(item);
      const newCost = item.temp * nTempWage;

      oldTempCost += oldCost;
      newTempCost += newCost;

      if (item.classification === 'MACHINE_OPERATOR') {
        moTempCount += item.temp;
        moOldCost += oldCost;
        moNewCost += newCost;
      } else if (item.classification === 'SUPERVISOR') {
        supTempCount += item.temp;
        supOldCost += oldCost;
        supNewCost += newCost;
      } else {
        genTempCount += item.temp;
        genOldCost += oldCost;
        genNewCost += newCost;
      }
    });

    const costDiff = newTempCost - oldTempCost;
    const avgOldWage = totalTempWorkers > 0 ? (oldTempCost / totalTempWorkers).toFixed(2) : '125.95';
    const avgNewWage = totalTempWorkers > 0 ? (newTempCost / totalTempWorkers).toFixed(2) : '125.95';

    return {
      oldTempCost,
      newTempCost,
      costDiff,
      avgOldWage,
      avgNewWage,
      mo: { count: moTempCount, oldCost: moOldCost, newCost: moNewCost },
      sup: { count: supTempCount, oldCost: supOldCost, newCost: supNewCost },
      gen: { count: genTempCount, oldCost: genOldCost, newCost: genNewCost }
    };
  }, [roleItems, activeMode, universalTempWage, moTempWage, supTempWage, genTempWage, deptTempWages, customRoleTempWages, totalTempWorkers]);

  // Quick preset adjustments
  const applyPresetUniversal = (rate: number) => {
    setActiveMode('universal');
    setUniversalTempWage(rate);
  };

  const applyPercentageAdjustment = (pct: number) => {
    const factor = 1 + (pct / 100);
    setUniversalTempWage(prev => Math.round(prev * factor * 100) / 100);
    setMoTempWage(prev => Math.round(prev * factor * 100) / 100);
    setSupTempWage(prev => Math.round(prev * factor * 100) / 100);
    setGenTempWage(prev => Math.round(prev * factor * 100) / 100);
  };

  const resetToStandardDefaults = () => {
    setUniversalTempWage(125.95);
    setMoTempWage(125.95);
    setSupTempWage(150.00);
    setGenTempWage(125.95);
    setDeptTempWages({});
    setCustomRoleTempWages({});
  };

  // Handle Save / Apply Changes
  const handleApplyTempWages = () => {
    if (!canEditWages) {
      alert("You do not have administrative permission to edit wage rates.");
      return;
    }

    const updateDepartments = (departments: Department[]): Department[] => {
      return (departments || []).map(d => {
        const updatedRoles = (d.roles || []).map((r, rIdx) => {
          const key = `${d.id}__${r.title}__${rIdx}`;
          const classification = getRoleClassification(r.title, d.name);
          
          let nTemp = r.tempWage ?? 125.95;

          if (activeMode === 'universal') {
            nTemp = universalTempWage;
          } else if (activeMode === 'by_tier') {
            if (classification === 'MACHINE_OPERATOR') nTemp = moTempWage;
            else if (classification === 'SUPERVISOR') nTemp = supTempWage;
            else nTemp = genTempWage;
          } else if (activeMode === 'by_dept') {
            if (deptTempWages[d.id] !== undefined) {
              nTemp = deptTempWages[d.id];
            }
          } else if (activeMode === 'role_matrix') {
            if (customRoleTempWages[key] !== undefined) {
              nTemp = customRoleTempWages[key];
            }
          }

          const nPerm = r.permWage;
          const newCost = (r.perm * nPerm) + (r.temp * nTemp);
          return {
            ...r,
            tempWage: nTemp,
            cost: newCost
          };
        });

        return { ...d, roles: updatedRoles };
      });
    };

    if (targetScope === 'ALL_SHEETS' && onUpdateAllSheets) {
      const updatedSheets = allSheets.map(s => ({
        ...s,
        departments: updateDepartments(s.departments)
      }));
      onUpdateAllSheets(updatedSheets);
      setSuccessMsg(`Successfully updated temporary daily wages for all staff across ALL ${allSheets.length} shift dates!`);
    } else {
      const updatedSheet: SheetData = {
        ...currentSheet,
        departments: updateDepartments(currentSheet.departments)
      };
      onUpdateSheet(updatedSheet);
      setSuccessMsg(`Successfully updated temporary daily wages for sheet "${currentSheet.label}"!`);
    }

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-pink-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-pink-950 to-slate-900 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-200 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-pink-500 to-rose-600 rounded-2xl text-white shadow-lg">
                <Zap className="w-6 h-6 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black text-white tracking-wide">
                    ALL TEMPORARY WAGES EDITING
                  </h2>
                  <span className="px-3 py-0.5 bg-pink-500/30 text-pink-200 border border-pink-400/30 rounded-full text-xs font-black uppercase font-mono">
                    {currentSheet.label}
                  </span>
                </div>
                <p className="text-xs text-pink-200 mt-1">
                  Bulk update or individually customize temporary worker daily rates across all roles, departments, or shift dates.
                </p>
              </div>
            </div>

            {/* Scope Toggle in Header */}
            <div className="bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/15 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTargetScope('CURRENT_SHEET')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  targetScope === 'CURRENT_SHEET'
                    ? 'bg-white text-pink-950 shadow-xs font-extrabold'
                    : 'text-pink-200 hover:text-white'
                }`}
              >
                Current Shift Date Only
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('ALL_SHEETS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  targetScope === 'ALL_SHEETS'
                    ? 'bg-white text-pink-950 shadow-xs font-extrabold'
                    : 'text-pink-200 hover:text-white'
                }`}
              >
                All Shift Dates ({allSheets.length})
              </button>
            </div>
          </div>

          {/* Sub-Mode Tabs */}
          <div className="flex gap-2 mt-5 pt-3 border-t border-white/10 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveMode('universal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'universal'
                  ? 'bg-pink-600 text-white shadow-xs font-black'
                  : 'bg-white/5 hover:bg-white/15 text-pink-200 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. Single Universal Rate (All Temps)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('by_tier')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'by_tier'
                  ? 'bg-pink-600 text-white shadow-xs font-black'
                  : 'bg-white/5 hover:bg-white/15 text-pink-200 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>2. By 3 Classification Tiers</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('by_dept')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'by_dept'
                  ? 'bg-pink-600 text-white shadow-xs font-black'
                  : 'bg-white/5 hover:bg-white/15 text-pink-200 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>3. Department Rates</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('role_matrix')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'role_matrix'
                  ? 'bg-pink-600 text-white shadow-xs font-black'
                  : 'bg-white/5 hover:bg-white/15 text-pink-200 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>4. Role-by-Role Table ({roleItems.length} Roles)</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/60 space-y-6">

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold">{successMsg}</span>
            </div>
          )}

          {/* Temporary Worker Impact KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-pink-200 shadow-xs space-y-1 bg-pink-50/20">
              <div className="text-[10px] text-pink-700 font-extrabold uppercase tracking-wider">Total Temps Active</div>
              <div className="text-xl font-black text-pink-950 font-mono">{totalTempWorkers} Workers</div>
              <div className="text-[10px] text-slate-500 font-medium">{roleItems.filter(r => r.temp > 0).length} Active Temp Roles</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Previous Temp Bill</div>
              <div className="text-xl font-black text-slate-700 font-mono">{currency} {metrics.oldTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
              <div className="text-[10px] text-slate-500 font-mono">Avg {currency} {metrics.avgOldWage}/day</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-xs space-y-1 bg-indigo-50/20">
              <div className="text-[10px] text-indigo-700 font-extrabold uppercase tracking-wider">New Temp Bill</div>
              <div className="text-xl font-black text-indigo-950 font-mono">{currency} {metrics.newTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
              <div className="text-[10px] text-indigo-700 font-mono font-bold">Avg {currency} {metrics.avgNewWage}/day</div>
            </div>

            <div className={`p-3.5 rounded-2xl border shadow-xs space-y-1 ${metrics.costDiff === 0 ? 'bg-slate-50 border-slate-200 text-slate-700' : metrics.costDiff > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider">Daily Cost Variance</div>
              <div className="text-xl font-black font-mono">
                {metrics.costDiff > 0 ? `+${currency} ${metrics.costDiff.toFixed(0)}` : metrics.costDiff < 0 ? `-${currency} ${Math.abs(metrics.costDiff).toFixed(0)}` : 'No Change'}
              </div>
              <div className="text-[10px] font-medium">
                {metrics.costDiff > 0 ? 'Cost Increase' : metrics.costDiff < 0 ? 'Cost Savings' : 'Wages Unchanged'}
              </div>
            </div>
          </div>

          {/* MODE 1: SINGLE UNIVERSAL TEMP RATE */}
          {activeMode === 'universal' && (
            <div className="bg-white p-5 rounded-2xl border border-pink-200 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-600" /> Apply Universal Temporary Wage Across ALL Roles
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sets a single standard daily rate for every temporary worker on the factory floor.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Quick Rates:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetUniversal(125.95)}
                    className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-800 rounded-lg text-xs font-bold border border-pink-200 transition cursor-pointer"
                  >
                    {currency} 125.95 (Statutory Min)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetUniversal(130.00)}
                    className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-800 rounded-lg text-xs font-bold border border-pink-200 transition cursor-pointer"
                  >
                    {currency} 130.00
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetUniversal(140.00)}
                    className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-800 rounded-lg text-xs font-bold border border-pink-200 transition cursor-pointer"
                  >
                    {currency} 140.00
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetUniversal(150.00)}
                    className="px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-pink-800 rounded-lg text-xs font-bold border border-pink-200 transition cursor-pointer"
                  >
                    {currency} 150.00
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-pink-200 bg-pink-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-black text-pink-950 uppercase tracking-wider">
                    Universal Temporary Daily Wage ({currency}/day):
                  </label>
                  <p className="text-xs text-slate-600">
                    Will be assigned to all {totalTempWorkers} temporary workers across all {currentSheet.departments.length} departments.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold font-mono">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={universalTempWage}
                      onChange={(e) => setUniversalTempWage(parseFloat(e.target.value) || 0)}
                      className="w-36 pl-8 p-2.5 border-2 border-pink-400 rounded-xl font-mono font-black text-slate-900 bg-white text-base focus:ring-2 focus:ring-pink-500 focus:outline-none shadow-xs"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 font-mono">per day</span>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: BY 3 CLASSIFICATION TIERS */}
          {activeMode === 'by_tier' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" /> Temporary Daily Wages by Classification Tier
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Set customized temporary wage rates for Machine Operators, Supervisors, and General Workers.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPercentageAdjustment(5)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold border border-indigo-200 transition cursor-pointer"
                  >
                    +5%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPercentageAdjustment(10)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold border border-indigo-200 transition cursor-pointer"
                  >
                    +10%
                  </button>
                  <button
                    type="button"
                    onClick={resetToStandardDefaults}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Machine Operators Temp */}
                <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-md text-[10px] font-black uppercase font-mono border border-indigo-200">
                      🧵 TIER 1: OPERATORS
                    </span>
                    <span className="text-xs font-black text-indigo-900 font-mono">{metrics.mo.count} Temps</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1">
                      Temp Daily Salary ({currency}):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={moTempWage}
                        onChange={(e) => setMoTempWage(parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 p-2 border border-indigo-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-bold flex justify-between pt-1 border-t border-indigo-100">
                    <span>Temp Bill:</span>
                    <span className="font-mono">{currency} {metrics.mo.newCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                {/* 2. Supervisors Temp */}
                <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded-md text-[10px] font-black uppercase font-mono border border-purple-200">
                      👔 TIER 2: SUPERVISORS
                    </span>
                    <span className="text-xs font-black text-purple-900 font-mono">{metrics.sup.count} Temps</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-950 mb-1">
                      Temp Daily Salary ({currency}):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={supTempWage}
                        onChange={(e) => setSupTempWage(parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 p-2 border border-purple-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-purple-700 font-bold flex justify-between pt-1 border-t border-purple-100">
                    <span>Temp Bill:</span>
                    <span className="font-mono">{currency} {metrics.sup.newCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                {/* 3. General Workers Temp */}
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md text-[10px] font-black uppercase font-mono border border-emerald-200">
                      🛠️ TIER 3: GENERAL
                    </span>
                    <span className="text-xs font-black text-emerald-900 font-mono">{metrics.gen.count} Temps</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      Temp Daily Salary ({currency}):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={genTempWage}
                        onChange={(e) => setGenTempWage(parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 p-2 border border-emerald-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold flex justify-between pt-1 border-t border-emerald-100">
                    <span>Temp Bill:</span>
                    <span className="font-mono">{currency} {metrics.gen.newCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: BY DEPARTMENT */}
          {activeMode === 'by_dept' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600" /> Temporary Daily Wages by Department
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set specific temporary wage rates per department across the factory.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(currentSheet.departments || []).map(dept => {
                  const deptTemps = (dept.roles || []).reduce((s, r) => s + (r.temp || 0), 0);
                  const currentWage = deptTempWages[dept.id] ?? (dept.roles?.[0]?.tempWage || 125.95);

                  return (
                    <div key={dept.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 uppercase truncate max-w-[160px]" title={dept.name}>
                          {dept.name}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-pink-700 bg-pink-100 px-2 py-0.2 rounded-full">
                          {deptTemps} Temps
                        </span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Temp Daily Salary ({currency}):
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold font-mono text-xs">{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={currentWage}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setDeptTempWages(prev => ({ ...prev, [dept.id]: val }));
                            }}
                            className="w-full pl-7 p-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE 4: ROLE-BY-ROLE TABLE */}
          {activeMode === 'role_matrix' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase">
                    Role-by-Role Temporary Wage Table
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {roleItems.length} Roles ({totalTempWorkers} Temporary Staff)
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full min-w-[580px] text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Department / Role</th>
                        <th className="p-3 text-center">Tier</th>
                        <th className="p-3 text-center text-pink-700">Temp Staff</th>
                        <th className="p-3 text-right">Current Temp Wage</th>
                        <th className="p-3 text-right text-pink-900 bg-pink-50/50">New Temp Wage ({currency})</th>
                        <th className="p-3 text-right font-extrabold">Total Temp Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {roleItems.map(item => {
                        const currentWage = customRoleTempWages[item.key] ?? item.currentTempWage;
                        const roleTempCost = item.temp * currentWage;

                        return (
                          <tr key={item.key} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-sans">
                              <div className="font-extrabold text-slate-900">{item.roleTitle}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-mono">{item.deptName}</div>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.classification === 'MACHINE_OPERATOR' ? 'MO' : item.classification === 'SUPERVISOR' ? 'SUP' : 'GEN'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-pink-700">
                              {item.temp}
                            </td>
                            <td className="p-3 text-right text-slate-500">
                              {currency} {item.currentTempWage.toFixed(2)}
                            </td>
                            <td className="p-3 text-right bg-pink-50/30">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 text-xs">{currency}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={currentWage}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCustomRoleTempWages(prev => ({ ...prev, [item.key]: val }));
                                  }}
                                  className="w-24 px-2 py-1 text-right border border-pink-300 rounded-lg text-xs font-bold text-pink-950 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                                />
                              </div>
                            </td>
                            <td className="p-3 text-right font-black text-slate-900">
                              {currency} {roleTempCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-slate-800">Target Scope:</span>
            <span className="px-2.5 py-0.5 bg-white border border-slate-300 rounded-full font-mono text-[11px] font-bold text-pink-800">
              {targetScope === 'ALL_SHEETS' ? `All ${allSheets.length} Shift Dates` : `Only ${currentSheet.label}`}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyTempWages}
              className="px-6 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2 hover:scale-[1.01]"
            >
              <Check className="w-4 h-4" />
              <span>Apply Temporary Wages</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
