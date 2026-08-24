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
  Edit3
} from 'lucide-react';

export type WageClassification = 'MACHINE_OPERATOR' | 'SUPERVISOR' | 'GENERAL_WORKER';

export interface ClassificationMeta {
  key: WageClassification;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: string;
  defaultPermWage: number;
  defaultTempWage: number;
}

export const CLASSIFICATIONS: Record<WageClassification, ClassificationMeta> = {
  MACHINE_OPERATOR: {
    key: 'MACHINE_OPERATOR',
    label: 'Machine Operators',
    shortLabel: 'Operators',
    description: 'Sewing machine operators, overlockers, flatlockers, and dedicated sewing line stitchers.',
    color: 'indigo',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900 border-indigo-200',
    borderColor: 'border-indigo-300',
    icon: '🧵',
    defaultPermWage: 146.00,
    defaultTempWage: 125.95
  },
  SUPERVISOR: {
    key: 'SUPERVISOR',
    label: 'Supervisors & Technical Staff',
    shortLabel: 'Supervisors',
    description: 'Line supervisors, line managers, technicians, maintenance mechanics, coordinators, IE, and QC leads.',
    color: 'purple',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900 border-purple-200',
    borderColor: 'border-purple-300',
    icon: '👔',
    defaultPermWage: 180.00,
    defaultTempWage: 150.00
  },
  GENERAL_WORKER: {
    key: 'GENERAL_WORKER',
    label: 'General Workers',
    shortLabel: 'General',
    description: 'Packing, ironing, cutting helpers, quality auditors, needle room, PPZ, printing, stores, cleaners, and floor support.',
    color: 'emerald',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900 border-emerald-200',
    borderColor: 'border-emerald-300',
    icon: '🛠️',
    defaultPermWage: 140.00,
    defaultTempWage: 125.95
  }
};

// Helper to determine the wage classification of a role or department
export function getRoleClassification(roleTitle: string, deptName: string = ''): WageClassification {
  const text = `${roleTitle} ${deptName}`.toUpperCase();

  // 1. Supervisors & Management / Technical Staff
  if (
    text.includes('SUPERVISOR') ||
    text.includes('LINE-MANAGER') ||
    text.includes('LINE MANAGER') ||
    text.includes('MANAGER') ||
    text.includes('COORDINATOR') ||
    text.includes('TECHNICIAN') ||
    text.includes('MAINTANANCE') ||
    text.includes('MAINTENANCE') ||
    text.includes('MECHANIC') ||
    text.includes('INDUSTRIAL ENGINEERING') ||
    text.includes('IE ') ||
    text.includes('ENGINEER') ||
    text.includes('HR ') ||
    text.includes('HUMAN RESOURCES')
  ) {
    return 'SUPERVISOR';
  }

  // 2. Machine Operators
  if (
    text.includes('MACHINE OPERATOR') ||
    text.includes('MACHINE-OPERATOR') ||
    text.includes('OPERATOR') ||
    text.includes('SEWING') ||
    text.includes('OVERLOCK') ||
    text.includes('FLATLOCK') ||
    text.includes('STITCHER') ||
    text.includes('HEMMER')
  ) {
    return 'MACHINE_OPERATOR';
  }

  // 3. General Workers (Default for Packing, Ironing, Cutting, Quality, PPZ, Stores, Cleaning, etc.)
  return 'GENERAL_WORKER';
}

interface BatchWageUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheet: SheetData;
  allSheets: SheetData[];
  onUpdateSheet: (updatedSheet: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  currency: string;
  canEditWages: boolean;
}

export default function BatchWageUpdateModal({
  isOpen,
  onClose,
  currentSheet,
  allSheets,
  onUpdateSheet,
  onUpdateAllSheets,
  currency,
  canEditWages
}: BatchWageUpdateModalProps) {
  // Tabs: 'by_classification' (Quick 3-tier bulk edit) vs 'role_matrix' (individual role override)
  const [activeTab, setActiveTab] = useState<'by_classification' | 'role_matrix'>('by_classification');
  const [targetScope, setTargetScope] = useState<'CURRENT_SHEET' | 'ALL_SHEETS'>('CURRENT_SHEET');
  const [activeClassFilter, setActiveClassFilter] = useState<WageClassification | 'ALL'>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Classification-level Wage States
  const [moPermWage, setMoPermWage] = useState<number>(146.00);
  const [moTempWage, setMoTempWage] = useState<number>(125.95);

  const [supPermWage, setSupPermWage] = useState<number>(180.00);
  const [supTempWage, setSupTempWage] = useState<number>(150.00);

  const [genPermWage, setGenPermWage] = useState<number>(140.00);
  const [genTempWage, setGenTempWage] = useState<number>(125.95);

  // Custom overrides map: { [roleKey]: { permWage: number, tempWage: number } }
  const [customRoleWages, setCustomRoleWages] = useState<Record<string, { permWage: number; tempWage: number }>>({});

  // Flattened role items from currentSheet with classification metadata
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

  // Helper to compute new wage for a role based on current state
  const getNewWageForRole = (item: typeof roleItems[0]): { permWage: number; tempWage: number } => {
    if (customRoleWages[item.key]) {
      return customRoleWages[item.key];
    }

    if (item.classification === 'MACHINE_OPERATOR') {
      return { permWage: moPermWage, tempWage: moTempWage };
    }
    if (item.classification === 'SUPERVISOR') {
      // Preserve specialized high-wage roles like Line-Manager (M 277) if default is lower, unless user adjusted it
      if (item.roleTitle.toUpperCase().includes('LINE-MANAGER') && supPermWage < 200 && !customRoleWages[item.key]) {
        return { permWage: 277.00, tempWage: supTempWage };
      }
      return { permWage: supPermWage, tempWage: supTempWage };
    }
    return { permWage: genPermWage, tempWage: genTempWage };
  };

  // Summary Metrics Breakdown by Classification
  const metrics = useMemo(() => {
    let moPermCount = 0;
    let moTempCount = 0;
    let moOldCost = 0;
    let moNewCost = 0;

    let supPermCount = 0;
    let supTempCount = 0;
    let supOldCost = 0;
    let supNewCost = 0;

    let genPermCount = 0;
    let genTempCount = 0;
    let genOldCost = 0;
    let genNewCost = 0;

    roleItems.forEach(item => {
      const oldItemCost = (item.perm * item.currentPermWage) + (item.temp * item.currentTempWage);
      const { permWage: nPerm, tempWage: nTemp } = getNewWageForRole(item);
      const newItemCost = (item.perm * nPerm) + (item.temp * nTemp);

      if (item.classification === 'MACHINE_OPERATOR') {
        moPermCount += item.perm;
        moTempCount += item.temp;
        moOldCost += oldItemCost;
        moNewCost += newItemCost;
      } else if (item.classification === 'SUPERVISOR') {
        supPermCount += item.perm;
        supTempCount += item.temp;
        supOldCost += oldItemCost;
        supNewCost += newItemCost;
      } else {
        genPermCount += item.perm;
        genTempCount += item.temp;
        genOldCost += oldItemCost;
        genNewCost += newItemCost;
      }
    });

    const totalOldCost = moOldCost + supOldCost + genOldCost;
    const totalNewCost = moNewCost + supNewCost + genNewCost;
    const costDiff = totalNewCost - totalOldCost;
    const totalHeadcount = (moPermCount + moTempCount) + (supPermCount + supTempCount) + (genPermCount + genTempCount);

    return {
      mo: { perm: moPermCount, temp: moTempCount, total: moPermCount + moTempCount, oldCost: moOldCost, newCost: moNewCost },
      sup: { perm: supPermCount, temp: supTempCount, total: supPermCount + supTempCount, oldCost: supOldCost, newCost: supNewCost },
      gen: { perm: genPermCount, temp: genTempCount, total: genPermCount + genTempCount, oldCost: genOldCost, newCost: genNewCost },
      totalHeadcount,
      totalOldCost,
      totalNewCost,
      costDiff
    };
  }, [roleItems, moPermWage, moTempWage, supPermWage, supTempWage, genPermWage, genTempWage, customRoleWages]);

  // Quick Preset Adjustments
  const applyPercentageAdjustment = (pct: number) => {
    const factor = 1 + (pct / 100);
    setMoPermWage(prev => Math.round(prev * factor * 100) / 100);
    setMoTempWage(prev => Math.round(prev * factor * 100) / 100);
    setSupPermWage(prev => Math.round(prev * factor * 100) / 100);
    setSupTempWage(prev => Math.round(prev * factor * 100) / 100);
    setGenPermWage(prev => Math.round(prev * factor * 100) / 100);
    setGenTempWage(prev => Math.round(prev * factor * 100) / 100);
    setCustomRoleWages({});
  };

  const resetToStandardFactoryWages = () => {
    setMoPermWage(146.00);
    setMoTempWage(125.95);
    setSupPermWage(180.00);
    setSupTempWage(150.00);
    setGenPermWage(140.00);
    setGenTempWage(125.95);
    setCustomRoleWages({});
  };

  // Handle Save / Apply Changes
  const handleApplyWages = () => {
    if (!canEditWages) {
      alert("You do not have administrative permission to edit wage rates.");
      return;
    }

    const updateDepartments = (departments: Department[]): Department[] => {
      return (departments || []).map(d => {
        const updatedRoles = (d.roles || []).map((r, rIdx) => {
          const key = `${d.id}__${r.title}__${rIdx}`;
          const classification = getRoleClassification(r.title, d.name);
          
          let nPerm = r.permWage;
          let nTemp = r.tempWage;

          if (customRoleWages[key]) {
            nPerm = customRoleWages[key].permWage;
            nTemp = customRoleWages[key].tempWage;
          } else if (classification === 'MACHINE_OPERATOR') {
            nPerm = moPermWage;
            nTemp = moTempWage;
          } else if (classification === 'SUPERVISOR') {
            if (r.title.toUpperCase().includes('LINE-MANAGER') && supPermWage < 200) {
              nPerm = 277.00;
            } else {
              nPerm = supPermWage;
            }
            nTemp = supTempWage;
          } else {
            nPerm = genPermWage;
            nTemp = genTempWage;
          }

          const newCost = (r.perm * nPerm) + (r.temp * nTemp);
          return {
            ...r,
            permWage: nPerm,
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
      setSuccessMsg(`Successfully updated daily wages for all staff across ALL ${allSheets.length} shift dates!`);
    } else {
      const updatedSheet: SheetData = {
        ...currentSheet,
        departments: updateDepartments(currentSheet.departments)
      };
      onUpdateSheet(updatedSheet);
      setSuccessMsg(`Successfully updated daily wages for sheet "${currentSheet.label}"!`);
    }

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-indigo-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl text-white shadow-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black text-white tracking-wide">
                    EDIT DAILY WAGES BY CLASSIFICATION
                  </h2>
                  <span className="px-3 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-black uppercase font-mono">
                    {currentSheet.label}
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-1">
                  Classify and set daily wages for <strong>Machine Operators</strong>, <strong>Supervisors</strong>, and <strong>General Workers</strong>.
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
                    ? 'bg-white text-indigo-950 shadow-xs font-extrabold'
                    : 'text-indigo-200 hover:text-white'
                }`}
              >
                Current Shift Date Only
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('ALL_SHEETS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  targetScope === 'ALL_SHEETS'
                    ? 'bg-white text-indigo-950 shadow-xs font-extrabold'
                    : 'text-indigo-200 hover:text-white'
                }`}
              >
                All Shift Dates ({allSheets.length})
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Quick Classification Edit vs Detailed Role Matrix */}
          <div className="flex gap-2 mt-5 pt-3 border-t border-white/10 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('by_classification')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'by_classification'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white/5 hover:bg-white/15 text-indigo-200 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Bulk Wages by 3 Classifications</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('role_matrix')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'role_matrix'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white/5 hover:bg-white/15 text-indigo-200 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Role-by-Role Wage Matrix ({roleItems.length} Roles)</span>
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

          {/* 3 Classification Summary KPI Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Machine Operators Card */}
            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs relative overflow-hidden bg-indigo-50/20">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 rounded-lg text-[10px] font-black uppercase font-mono border border-indigo-200">
                  🧵 MACHINE OPERATORS
                </span>
                <span className="text-xs font-black text-indigo-900 font-mono">
                  {metrics.mo.total} Staff
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Permanent Wage:</div>
                  <div className="text-lg font-black text-slate-900 font-mono">{currency} {moPermWage.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Temp Wage:</div>
                  <div className="text-lg font-black text-slate-700 font-mono">{currency} {moTempWage.toFixed(2)}</div>
                </div>
              </div>
              <div className="text-[11px] text-indigo-700 font-bold mt-2 pt-2 border-t border-indigo-100 flex justify-between">
                <span>Daily Wage Bill:</span>
                <span className="font-mono">{currency} {metrics.mo.newCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="absolute right-0 bottom-0 h-1 bg-indigo-500 w-full" />
            </div>

            {/* 2. Supervisors Card */}
            <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs relative overflow-hidden bg-purple-50/20">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-900 rounded-lg text-[10px] font-black uppercase font-mono border border-purple-200">
                  👔 SUPERVISORS & TECH
                </span>
                <span className="text-xs font-black text-purple-900 font-mono">
                  {metrics.sup.total} Staff
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Permanent Wage:</div>
                  <div className="text-lg font-black text-slate-900 font-mono">{currency} {supPermWage.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Temp Wage:</div>
                  <div className="text-lg font-black text-slate-700 font-mono">{currency} {supTempWage.toFixed(2)}</div>
                </div>
              </div>
              <div className="text-[11px] text-purple-700 font-bold mt-2 pt-2 border-t border-purple-100 flex justify-between">
                <span>Daily Wage Bill:</span>
                <span className="font-mono">{currency} {metrics.sup.newCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="absolute right-0 bottom-0 h-1 bg-purple-500 w-full" />
            </div>

            {/* 3. General Workers Card */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs relative overflow-hidden bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black uppercase font-mono border border-emerald-200">
                  🛠️ GENERAL WORKERS
                </span>
                <span className="text-xs font-black text-emerald-900 font-mono">
                  {metrics.gen.total} Staff
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Permanent Wage:</div>
                  <div className="text-lg font-black text-slate-900 font-mono">{currency} {genPermWage.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Temp Wage:</div>
                  <div className="text-lg font-black text-slate-700 font-mono">{currency} {genTempWage.toFixed(2)}</div>
                </div>
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-emerald-100 flex justify-between">
                <span>Daily Wage Bill:</span>
                <span className="font-mono">{currency} {metrics.gen.newCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="absolute right-0 bottom-0 h-1 bg-emerald-500 w-full" />
            </div>
          </div>

          {/* TAB 1: BULK WAGE EDIT BY 3 CLASSIFICATIONS */}
          {activeTab === 'by_classification' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" /> Set Daily Wages by Classification Tier
                    </h3>
                    <p className="text-xs text-slate-500">
                      Changes made here instantly update every matching role across the factory floor.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPercentageAdjustment(5)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold border border-indigo-200 transition cursor-pointer"
                    >
                      +5% Increase
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPercentageAdjustment(7.5)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold border border-indigo-200 transition cursor-pointer"
                    >
                      +7.5% Annual
                    </button>
                    <button
                      type="button"
                      onClick={resetToStandardFactoryWages}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* 1. Machine Operators Section */}
                  <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-indigo-600 text-white rounded-xl text-xs font-black">
                          🧵 TIER 1
                        </span>
                        <div>
                          <h4 className="text-sm font-extrabold text-indigo-950">Machine Operators</h4>
                          <p className="text-[11px] text-slate-500">Sewing line operators, stitchers, flatlockers & overlockers ({metrics.mo.total} staff)</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-indigo-100">
                      <div>
                        <label className="block font-extrabold text-indigo-950 mb-1 text-xs">
                          Permanent Daily Salary ({currency}):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono">{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={moPermWage}
                            onChange={(e) => setMoPermWage(parseFloat(e.target.value) || 0)}
                            className="w-full pl-8 p-2 border border-indigo-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-extrabold text-indigo-950 mb-1 text-xs">
                          Temporary Daily Salary ({currency}):
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
                    </div>
                  </div>

                  {/* 2. Supervisors Section */}
                  <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-purple-600 text-white rounded-xl text-xs font-black">
                          👔 TIER 2
                        </span>
                        <div>
                          <h4 className="text-sm font-extrabold text-purple-950">Supervisors & Technical Staff</h4>
                          <p className="text-[11px] text-slate-500">Floor supervisors, managers, technicians, coordinators, maintenance ({metrics.sup.total} staff)</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-purple-100">
                      <div>
                        <label className="block font-extrabold text-purple-950 mb-1 text-xs">
                          Permanent Daily Salary ({currency}):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono">{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={supPermWage}
                            onChange={(e) => setSupPermWage(parseFloat(e.target.value) || 0)}
                            className="w-full pl-8 p-2 border border-purple-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-extrabold text-purple-950 mb-1 text-xs">
                          Temporary Daily Salary ({currency}):
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
                    </div>
                  </div>

                  {/* 3. General Workers Section */}
                  <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-600 text-white rounded-xl text-xs font-black">
                          🛠️ TIER 3
                        </span>
                        <div>
                          <h4 className="text-sm font-extrabold text-emerald-950">General Workers</h4>
                          <p className="text-[11px] text-slate-500">Packing, ironing, cutting helpers, QC auditors, stores, PPZ, printing & cleaning ({metrics.gen.total} staff)</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-emerald-100">
                      <div>
                        <label className="block font-extrabold text-emerald-950 mb-1 text-xs">
                          Permanent Daily Salary ({currency}):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-400 font-bold font-mono">{currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={genPermWage}
                            onChange={(e) => setGenPermWage(parseFloat(e.target.value) || 0)}
                            className="w-full pl-8 p-2 border border-emerald-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-extrabold text-emerald-950 mb-1 text-xs">
                          Temporary Daily Salary ({currency}):
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
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ROLE-BY-ROLE WAGE MATRIX */}
          {activeTab === 'role_matrix' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Classification Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase mr-1">Filter Tier:</span>
                  {[
                    { id: 'ALL', label: 'All Roles' },
                    { id: 'MACHINE_OPERATOR', label: '🧵 Machine Operators' },
                    { id: 'SUPERVISOR', label: '👔 Supervisors' },
                    { id: 'GENERAL_WORKER', label: '🛠️ General Workers' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveClassFilter(tab.id as any)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeClassFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="text-xs font-bold text-slate-500 font-mono">
                  Showing {roleItems.filter(r => activeClassFilter === 'ALL' || r.classification === activeClassFilter).length} roles
                </div>
              </div>

              {/* Roles Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-extrabold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Department / Role</th>
                        <th className="p-3 text-center">Wage Classification</th>
                        <th className="p-3 text-center">Present Staff (P/T)</th>
                        <th className="p-3 text-right">Permanent Daily Wage</th>
                        <th className="p-3 text-right">Temporary Daily Wage</th>
                        <th className="p-3 text-right font-extrabold text-slate-900">Total Daily Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {roleItems
                        .filter(r => activeClassFilter === 'ALL' || r.classification === activeClassFilter)
                        .map(item => {
                          const { permWage, tempWage } = getNewWageForRole(item);
                          const totalCost = (item.perm * permWage) + (item.temp * tempWage);
                          const meta = CLASSIFICATIONS[item.classification];

                          return (
                            <tr key={item.key} className="hover:bg-slate-50 transition">
                              <td className="p-3 font-sans">
                                <span className="font-extrabold text-slate-900 block">{item.roleTitle}</span>
                                <span className="text-[10px] text-slate-500">{item.deptName}</span>
                              </td>
                              <td className="p-3 text-center font-sans">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeText}`}>
                                  {meta.icon} {meta.label}
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800">
                                {item.perm}P {item.temp > 0 ? `+ ${item.temp}T` : ''}
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={permWage}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCustomRoleWages(prev => ({
                                      ...prev,
                                      [item.key]: { permWage: val, tempWage: prev[item.key]?.tempWage ?? tempWage }
                                    }));
                                  }}
                                  className="w-24 p-1 text-right border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs inline-block"
                                />
                              </td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={tempWage}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCustomRoleWages(prev => ({
                                      ...prev,
                                      [item.key]: { permWage: prev[item.key]?.permWage ?? permWage, tempWage: val }
                                    }));
                                  }}
                                  className="w-24 p-1 text-right border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs inline-block"
                                />
                              </td>
                              <td className="p-3 text-right font-extrabold text-slate-900 bg-slate-50/60">
                                {currency} {totalCost.toFixed(2)}
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

          {/* Financial Impact Comparison Footer Box */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-indigo-300">Total Factory Wage Impact:</div>
              <div className="text-xs text-slate-300 mt-0.5">
                Targeting <strong>{metrics.totalHeadcount} staff</strong> on <span className="font-mono text-white">{targetScope === 'ALL_SHEETS' ? `All ${allSheets.length} Shift Dates` : currentSheet.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono">Current: {currency} {metrics.totalOldCost.toFixed(0)}</div>
                <div className="text-lg font-black text-white font-mono">
                  New: {currency} {metrics.totalNewCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold ${metrics.costDiff >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                {metrics.costDiff >= 0 ? '+' : ''}{currency} {metrics.costDiff.toFixed(2)} / day
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Scope: <strong className="text-slate-800 font-mono">{targetScope === 'ALL_SHEETS' ? `All ${allSheets.length} Shift Dates` : currentSheet.label}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyWages}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-extrabold shadow-md transition cursor-pointer text-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Apply Daily Wages
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
