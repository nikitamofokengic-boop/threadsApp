import React, { useState, useMemo } from 'react';
import { SheetData, StyleEarning, SahRecord } from '../types';
import { 
  Shirt, 
  DollarSign, 
  TrendingUp, 
  Check, 
  X, 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  Percent, 
  Calculator, 
  ArrowRight, 
  Users, 
  Layers, 
  Zap, 
  Target, 
  BarChart2, 
  Copy, 
  DownloadCloud,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { calculateSheetLaborCostBreakdown, getPayCycleForDate, getDayInfo } from '../utils/payCycle';

interface DailyOutputEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheet: SheetData;
  allSheets: SheetData[];
  onUpdateSheet: (updatedSheet: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  currency: string;
  canEditEarnings: boolean;
  overheadDaily: number;
}

export default function DailyOutputEntryModal({
  isOpen,
  onClose,
  currentSheet,
  allSheets,
  onUpdateSheet,
  onUpdateAllSheets,
  currency,
  canEditEarnings,
  overheadDaily
}: DailyOutputEntryModalProps) {
  // Allow switching shift date inside the modal for rapid daily logging across days
  const [selectedSheetId, setSelectedSheetId] = useState<string>(currentSheet.id);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Get active sheet based on selectedSheetId or fallback to currentSheet
  const activeSheet = useMemo(() => {
    return allSheets.find(s => s.id === selectedSheetId) || currentSheet;
  }, [allSheets, selectedSheetId, currentSheet]);

  // Working state of earnings output: { [styleId]: number }
  const [outputValues, setOutputValues] = useState<Record<string, number>>({});

  // Initialize output values whenever activeSheet changes
  React.useEffect(() => {
    const initial: Record<string, number> = {};
    (activeSheet.earnings || []).forEach(e => {
      initial[e.id] = e.qtyProduced;
    });
    setOutputValues(initial);
  }, [activeSheet]);

  // Sync state if modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedSheetId(currentSheet.id);
      const initial: Record<string, number> = {};
      (currentSheet.earnings || []).forEach(e => {
        initial[e.id] = e.qtyProduced;
      });
      setOutputValues(initial);
    }
  }, [isOpen, currentSheet]);

  // Daily Labour Cost breakdown for the selected sheet
  const sheetBreakdown = useMemo(() => {
    return calculateSheetLaborCostBreakdown(activeSheet);
  }, [activeSheet]);

  const totalLabourCost = sheetBreakdown.totalLaborCost;
  const permLabourCost = sheetBreakdown.permLaborCost;
  const tempLabourCost = sheetBreakdown.tempLaborCost;
  const otCost = sheetBreakdown.otCost;
  const totalHeadcount = sheetBreakdown.totalHeadcount;

  // Real-time calculations of earnings & metrics based on current draft outputValues
  const liveMetrics = useMemo(() => {
    let totalActualQty = 0;
    let totalPlannedQty = 0;
    let totalRealizedRevenue = 0;
    let totalExpectedRevenue = 0;

    const stylesMetrics = (activeSheet.earnings || []).map(e => {
      const actualQty = outputValues[e.id] !== undefined ? outputValues[e.id] : e.qtyProduced;
      const plannedQty = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
      const actualRevenue = actualQty * e.cmPrice;
      const expectedRevenue = plannedQty * e.cmPrice;
      const achievementPct = plannedQty > 0 ? (actualQty / plannedQty) * 100 : 0;

      totalActualQty += actualQty;
      totalPlannedQty += plannedQty;
      totalRealizedRevenue += actualRevenue;
      totalExpectedRevenue += expectedRevenue;

      return {
        ...e,
        actualQty,
        plannedQty,
        actualRevenue,
        expectedRevenue,
        achievementPct
      };
    });

    const totalCosts = totalLabourCost + overheadDaily;
    const netDailyIncome = totalRealizedRevenue - totalCosts;
    const labourCostRatio = totalRealizedRevenue > 0 ? (totalLabourCost / totalRealizedRevenue) * 100 : 0;
    const profitMargin = totalRealizedRevenue > 0 ? (netDailyIncome / totalRealizedRevenue) * 100 : 0;
    const costPerUnit = totalActualQty > 0 ? totalLabourCost / totalActualQty : 0;
    const revenuePerUnit = totalActualQty > 0 ? totalRealizedRevenue / totalActualQty : 0;

    // Overall target achievement %
    const overallAchievementPct = totalPlannedQty > 0 ? (totalActualQty / totalPlannedQty) * 100 : 0;

    // Break-even pieces needed today
    const avgCmPrice = stylesMetrics.length > 0 && totalPlannedQty > 0 
      ? totalExpectedRevenue / totalPlannedQty 
      : 12.0;
    const breakEvenUnits = avgCmPrice > 0 ? Math.ceil(totalCosts / avgCmPrice) : 0;
    const breakEvenSurplus = totalActualQty - breakEvenUnits;

    return {
      stylesMetrics,
      totalActualQty,
      totalPlannedQty,
      totalRealizedRevenue,
      totalExpectedRevenue,
      netDailyIncome,
      labourCostRatio,
      profitMargin,
      costPerUnit,
      revenuePerUnit,
      overallAchievementPct,
      breakEvenUnits,
      breakEvenSurplus,
      totalCosts
    };
  }, [activeSheet, outputValues, totalLabourCost, overheadDaily]);

  // Quick batch adjustments
  const handleSetOutput = (id: string, val: number) => {
    setOutputValues(prev => ({
      ...prev,
      [id]: Math.max(0, Math.round(val))
    }));
  };

  const handleAdjustOutput = (id: string, delta: number) => {
    const current = outputValues[id] ?? 0;
    handleSetOutput(id, current + delta);
  };

  const handleSetAllToTarget = () => {
    const next: Record<string, number> = {};
    (activeSheet.earnings || []).forEach(e => {
      const planned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
      next[e.id] = planned;
    });
    setOutputValues(next);
  };

  const handleResetAllToZero = () => {
    const next: Record<string, number> = {};
    (activeSheet.earnings || []).forEach(e => {
      next[e.id] = 0;
    });
    setOutputValues(next);
  };

  // Sync actual output from SAH Lines recorded for this sheet
  const handleSyncFromSah = () => {
    const sahList = activeSheet.sahData || [];
    if (sahList.length === 0) {
      alert("No SAH line records found for this shift date to sync from.");
      return;
    }

    const next = { ...outputValues };
    let matchedCount = 0;

    (activeSheet.earnings || []).forEach(e => {
      // Find SAH records matching this style
      const eStyleNorm = e.style.trim().toUpperCase();
      const matchedSah = sahList.filter(s => s.style.trim().toUpperCase() === eStyleNorm);
      
      if (matchedSah.length > 0) {
        const sahTotalOutput = matchedSah.reduce((sum, s) => sum + s.output, 0);
        if (sahTotalOutput > 0) {
          next[e.id] = sahTotalOutput;
          matchedCount++;
        }
      }
    });

    if (matchedCount === 0) {
      alert("No matching style names found in SAH line outputs for today. You can enter outputs manually or check style names in SAH tab.");
    } else {
      setOutputValues(next);
      setSuccessMsg(`Synced output for ${matchedCount} styles from SAH line logs!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Copy output from previous shift sheet
  const handleCopyFromPreviousShift = () => {
    const curIdx = allSheets.findIndex(s => s.id === activeSheet.id);
    if (curIdx <= 0) {
      alert("No previous shift date found to copy output from.");
      return;
    }

    const prevSheet = allSheets[curIdx - 1];
    const next = { ...outputValues };
    let copiedCount = 0;

    (activeSheet.earnings || []).forEach(e => {
      const prevE = (prevSheet.earnings || []).find(pe => pe.style.trim().toUpperCase() === e.style.trim().toUpperCase());
      if (prevE && prevE.qtyProduced > 0) {
        next[e.id] = prevE.qtyProduced;
        copiedCount++;
      }
    });

    setOutputValues(next);
    setSuccessMsg(`Copied ${copiedCount} style output figures from previous shift (${prevSheet.label})!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Save changes to the sheet
  const handleSaveOutputs = () => {
    if (!canEditEarnings) {
      alert("You do not have permission to edit style output and revenue data.");
      return;
    }

    const updatedEarnings: StyleEarning[] = (activeSheet.earnings || []).map(e => {
      const newQty = outputValues[e.id] !== undefined ? outputValues[e.id] : e.qtyProduced;
      return {
        ...e,
        qtyProduced: newQty
      };
    });

    const updatedSheet: SheetData = {
      ...activeSheet,
      earnings: updatedEarnings
    };

    if (allSheets && onUpdateAllSheets) {
      const nextSheets = allSheets.map(s => s.id === activeSheet.id ? updatedSheet : s);
      onUpdateAllSheets(nextSheets);
    } else {
      onUpdateSheet(updatedSheet);
    }

    setSuccessMsg(`Successfully saved daily style outputs and updated revenue for ${activeSheet.label}!`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  // Filtered styles list for search
  const filteredStyles = useMemo(() => {
    if (!searchFilter.trim()) return liveMetrics.stylesMetrics;
    const q = searchFilter.toLowerCase();
    return liveMetrics.stylesMetrics.filter(s => 
      s.style.toLowerCase().includes(q) || s.cmPrice.toString().includes(q)
    );
  }, [liveMetrics.stylesMetrics, searchFilter]);

  // Sheet date navigation inside modal
  const currentIndex = allSheets.findIndex(s => s.id === activeSheet.id);
  const prevSheet = currentIndex > 0 ? allSheets[currentIndex - 1] : null;
  const nextSheet = currentIndex >= 0 && currentIndex < allSheets.length - 1 ? allSheets[currentIndex + 1] : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:hidden">
      <div className="bg-white rounded-3xl max-w-5xl w-full border border-indigo-200 shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[94vh]">
        
        {/* Header with Shift Date Switcher & Close */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-indigo-500 to-indigo-700 rounded-2xl text-white shadow-lg">
                <Shirt className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black text-white tracking-wide">
                    DAILY STYLE OUTPUT & REVENUE LOGGER
                  </h2>
                  <span className="px-3 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-black uppercase font-mono">
                    {activeSheet.label}
                  </span>
                </div>
                <p className="text-xs text-indigo-200/90 mt-1">
                  Log actual production pieces daily per style to instantly compute daily CM revenue, compare against daily labor costs, and track profitability.
                </p>
              </div>
            </div>

            {/* Quick Date Switcher in Header */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
              <button
                type="button"
                disabled={!prevSheet}
                onClick={() => prevSheet && setSelectedSheetId(prevSheet.id)}
                className="p-1.5 rounded-xl hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent text-white transition cursor-pointer"
                title="Previous Shift Date"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={activeSheet.id}
                onChange={(e) => setSelectedSheetId(e.target.value)}
                className="bg-slate-900/90 text-white font-mono text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              >
                {allSheets.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.label} ({s.earnings?.filter(e => e.qtyProduced > 0).length || 0} styles active)
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!nextSheet}
                onClick={() => nextSheet && setSelectedSheetId(nextSheet.id)}
                className="p-1.5 rounded-xl hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent text-white transition cursor-pointer"
                title="Next Shift Date"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/70 space-y-5">
          
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold">{successMsg}</span>
            </div>
          )}

          {/* Real-time Executive KPI Banner: Daily Revenue vs. Labour Costs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Daily Realized Revenue */}
            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs space-y-1.5 bg-indigo-50/20">
              <div className="flex items-center justify-between text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                <span>Daily Realized Revenue</span>
                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-mono text-[9px]">CMT</span>
              </div>
              <div className="text-2xl font-black text-indigo-950 font-mono">
                {currency} {liveMetrics.totalRealizedRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{liveMetrics.totalActualQty.toLocaleString()} pcs output</span>
                <span className="text-indigo-700 font-bold">{liveMetrics.overallAchievementPct.toFixed(0)}% of target</span>
              </div>
            </div>

            {/* 2. Total Daily Labour Cost */}
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs space-y-1.5 bg-rose-50/20">
              <div className="flex items-center justify-between text-[10px] font-black text-rose-700 uppercase tracking-wider">
                <span>Total Daily Labour Cost</span>
                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded font-mono text-[9px]">{totalHeadcount} Staff</span>
              </div>
              <div className="text-2xl font-black text-rose-950 font-mono">
                {currency} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                <span>Perm: {currency}{permLabourCost.toFixed(0)}</span>
                <span>Temp: {currency}{tempLabourCost.toFixed(0)}</span>
                {otCost > 0 && <span className="text-amber-700 font-bold">OT: {currency}{otCost.toFixed(0)}</span>}
              </div>
            </div>

            {/* 3. Labour Cost Ratio (%) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-black text-slate-600 uppercase tracking-wider">
                <span>Labour % of Revenue</span>
                <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${
                  liveMetrics.labourCostRatio <= 45 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : liveMetrics.labourCostRatio <= 65 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                }`}>
                  {liveMetrics.labourCostRatio <= 45 ? '🟢 Efficient' : liveMetrics.labourCostRatio <= 65 ? '🟡 Moderate' : '🔴 High'}
                </span>
              </div>
              <div className={`text-2xl font-black font-mono ${
                liveMetrics.labourCostRatio <= 45 
                  ? 'text-emerald-700' 
                  : liveMetrics.labourCostRatio <= 65 
                    ? 'text-amber-700' 
                    : 'text-rose-700'
              }`}>
                {liveMetrics.totalRealizedRevenue > 0 ? `${liveMetrics.labourCostRatio.toFixed(1)}%` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Cost Per Unit: <strong className="text-slate-800">{currency} {liveMetrics.costPerUnit.toFixed(2)}/pc</strong>
              </div>
            </div>

            {/* 4. Net Operational Margin */}
            <div className={`p-4 rounded-2xl border shadow-xs space-y-1.5 ${
              liveMetrics.netDailyIncome >= 0 
                ? 'bg-emerald-50/40 border-emerald-300 text-emerald-950' 
                : 'bg-rose-50/40 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span>Daily Operating Margin</span>
                <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${liveMetrics.netDailyIncome >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                  {liveMetrics.profitMargin.toFixed(1)}%
                </span>
              </div>
              <div className="text-2xl font-black font-mono">
                {liveMetrics.netDailyIncome >= 0 ? '+' : ''}{currency} {liveMetrics.netDailyIncome.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] font-medium opacity-90 flex justify-between">
                <span>{liveMetrics.breakEvenSurplus >= 0 ? `+${liveMetrics.breakEvenSurplus} pcs above B/E` : `${Math.abs(liveMetrics.breakEvenSurplus)} pcs below B/E`}</span>
                <span className="font-mono">B/E: {liveMetrics.breakEvenUnits.toLocaleString()} pcs</span>
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1">
                Quick Tools:
              </span>
              <button
                type="button"
                onClick={handleSyncFromSah}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold border border-indigo-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Automatically import actual output logged in SAH Line Records for this date"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sync from SAH Lines</span>
              </button>

              <button
                type="button"
                onClick={handleSetAllToTarget}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Fill all styles actual output with their planned target quantity"
              >
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fill Planned Targets</span>
              </button>

              <button
                type="button"
                onClick={handleCopyFromPreviousShift}
                disabled={currentIndex <= 0}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 text-purple-800 rounded-xl text-xs font-bold border border-purple-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Copy actual output counts from the previous shift date"
              >
                <Copy className="w-3.5 h-3.5 text-purple-600" />
                <span>Copy Prev Shift</span>
              </button>

              <button
                type="button"
                onClick={handleResetAllToZero}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center gap-1"
                title="Reset all actual output counts to 0"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Reset to 0</span>
              </button>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search style code..."
                className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Styles Output Entry Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Daily Style Production Inputs ({filteredStyles.length} Styles)
                </span>
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                  {liveMetrics.totalActualQty.toLocaleString()} Total Pcs Produced Today
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Click number to edit or use fast ± step buttons
              </span>
            </div>

            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Style Code & Specs</th>
                    <th className="p-3 text-right">CM Price</th>
                    <th className="p-3 text-right">Target (Plan)</th>
                    <th className="p-3 text-center bg-indigo-50/50 text-indigo-900">
                      Actual Daily Output (Pcs)
                    </th>
                    <th className="p-3 text-center">Achievement</th>
                    <th className="p-3 text-right font-black text-indigo-950">Daily CM Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredStyles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-sans text-xs">
                        No styles found matching "{searchFilter}".
                      </td>
                    </tr>
                  ) : (
                    filteredStyles.map(s => {
                      const actual = s.actualQty;
                      const isComplete = actual >= s.plannedQty && s.plannedQty > 0;

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition text-slate-800">
                          {/* Style Name */}
                          <td className="p-3 font-sans">
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{s.style}</span>
                              {actual > 0 && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Active Output" />
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                              <span>SMV: {s.smv || 10.0}m</span>
                              <span>•</span>
                              <span>Target: {s.plannedQty.toLocaleString()} pcs</span>
                            </div>
                          </td>

                          {/* CM Price */}
                          <td className="p-3 text-right text-slate-600">
                            <div className="font-bold">{currency} {s.cmPrice.toFixed(2)}</div>
                            <span className="text-[9px] text-slate-400">per piece</span>
                          </td>

                          {/* Target Plan */}
                          <td className="p-3 text-right text-slate-500">
                            <div className="font-semibold">{s.plannedQty.toLocaleString()}</div>
                            <span className="text-[9px] text-slate-400">
                              {currency} {s.expectedRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                            </span>
                          </td>

                          {/* Actual Daily Output Quick Editor */}
                          <td className="p-2.5 bg-indigo-50/30 text-center">
                            <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-indigo-300 shadow-2xs">
                              {/* Decrement step buttons */}
                              <button
                                type="button"
                                onClick={() => handleAdjustOutput(s.id, -50)}
                                className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                title="-50 pcs"
                              >
                                -50
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustOutput(s.id, -10)}
                                className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                title="-10 pcs"
                              >
                                -10
                              </button>

                              {/* Direct numeric input */}
                              <input
                                type="number"
                                min={0}
                                max={999999}
                                value={actual}
                                onChange={(e) => handleSetOutput(s.id, parseFloat(e.target.value) || 0)}
                                className="w-20 sm:w-24 text-center font-black text-slate-900 bg-transparent text-sm focus:outline-none focus:bg-indigo-50 rounded-lg"
                              />

                              {/* Increment step buttons */}
                              <button
                                type="button"
                                onClick={() => handleAdjustOutput(s.id, 10)}
                                className="px-1.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                title="+10 pcs"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustOutput(s.id, 50)}
                                className="px-1.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                title="+50 pcs"
                              >
                                +50
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustOutput(s.id, 100)}
                                className="px-1.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                                title="+100 pcs"
                              >
                                +100
                              </button>
                            </div>
                          </td>

                          {/* Achievement Gauge */}
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                                isComplete 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : actual > 0 
                                    ? 'bg-indigo-100 text-indigo-800' 
                                    : 'bg-slate-100 text-slate-500'
                              }`}>
                                {s.achievementPct.toFixed(0)}%
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isComplete ? 'bg-emerald-500' : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${Math.min(100, s.achievementPct)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Daily Realized Revenue for this Style */}
                          <td className="p-3 text-right font-black text-indigo-950 font-mono text-sm">
                            <div>{currency} {s.actualRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
                            <span className="text-[9px] text-slate-400 font-normal">
                              {s.actualQty > 0 ? `${((s.actualRevenue / (liveMetrics.totalRealizedRevenue || 1)) * 100).toFixed(0)}% of daily rev` : '0%'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="p-3 uppercase text-indigo-900 tracking-wider">
                      TOTALS ({liveMetrics.stylesMetrics.length} STYLES)
                    </td>
                    <td></td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {liveMetrics.totalPlannedQty.toLocaleString()} pcs
                    </td>
                    <td className="p-3 text-center font-mono text-indigo-950 font-black text-sm">
                      {liveMetrics.totalActualQty.toLocaleString()} PCS
                    </td>
                    <td className="p-3 text-center font-mono text-indigo-700">
                      {liveMetrics.overallAchievementPct.toFixed(0)}%
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-900 font-black text-base">
                      {currency} {liveMetrics.totalRealizedRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Daily Labour Cost & Revenue Reconciliation Insight Card */}
          <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md border border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                  Daily Labour Cost Coverage & Profitability Check
                </span>
              </div>
              <p className="text-[11px] text-indigo-200 leading-relaxed">
                With <strong>{liveMetrics.totalActualQty.toLocaleString()} pieces</strong> produced today, daily revenue of <strong>{currency} {liveMetrics.totalRealizedRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong> covers <strong>{currency} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong> factory labour wages and <strong>{currency} {overheadDaily.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong> daily overheads, yielding a net margin of <strong>{currency} {liveMetrics.netDailyIncome.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong> ({liveMetrics.profitMargin.toFixed(1)}%).
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 bg-white/10 p-3 rounded-xl border border-white/15">
              <div className="text-right">
                <div className="text-[10px] text-indigo-200 uppercase font-bold">Break-Even Point</div>
                <div className="text-sm font-black font-mono text-white">{liveMetrics.breakEvenUnits.toLocaleString()} pcs needed</div>
              </div>
              <div className={`p-2 rounded-xl text-xs font-black uppercase font-mono ${
                liveMetrics.breakEvenSurplus >= 0 ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
              }`}>
                {liveMetrics.breakEvenSurplus >= 0 ? `+${liveMetrics.breakEvenSurplus} Profitable` : `${liveMetrics.breakEvenSurplus} Deficit`}
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-slate-800">Logging Output For:</span>
            <span className="px-3 py-0.5 bg-white border border-slate-300 rounded-full font-mono text-xs font-bold text-indigo-900 shadow-2xs">
              {activeSheet.label}
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
              onClick={handleSaveOutputs}
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2 hover:scale-[1.01]"
            >
              <Check className="w-4 h-4" />
              <span>Save Daily Outputs & Revenue</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
