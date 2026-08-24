import React, { useState } from 'react';
import { SheetData, StyleEarning } from '../types';
import EditableCell from './EditableCell';
import ExcelStyleUploader from './ExcelStyleUploader';
import ConfirmModal from './ConfirmModal';
import DailyOutputEntryModal from './DailyOutputEntryModal';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Calendar, 
  Layers, 
  RefreshCw,
  Shirt,
  Zap,
  Target,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Calculator,
  Percent
} from 'lucide-react';
import { getPayCycleForDate, isDateInPayCycle } from '../utils/payCycle';

interface EarningsTabProps {
  sheet: SheetData;
  sheets?: SheetData[];
  onUpdateSheet: (updated: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  canEditEarnings: boolean;
  totalLabourCost: number;
  overheadDaily: number;
  currency: string;
}

export default function EarningsTab({
  sheet,
  sheets,
  onUpdateSheet,
  onUpdateAllSheets,
  canEditEarnings,
  totalLabourCost,
  overheadDaily,
  currency
}: EarningsTabProps) {
  const [syncWithCycle, setSyncWithCycle] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showDailyOutputModal, setShowDailyOutputModal] = useState<boolean>(false);

  const payCycleInfo = getPayCycleForDate(sheet.label);

  const earningsTotal = sheet.earnings.reduce((sum, e) => sum + (e.qtyProduced * e.cmPrice), 0);
  const totalUnits = sheet.earnings.reduce((sum, e) => sum + e.qtyProduced, 0);
  const totalPlannedUnits = sheet.earnings.reduce((sum, e) => sum + (e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500)), 0);
  const expectedEarningsTotal = sheet.earnings.reduce((sum, e) => {
    const planned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
    return sum + (planned * e.cmPrice);
  }, 0);

  const totalSpent = totalLabourCost + overheadDaily;
  const netProfit = earningsTotal - totalSpent;
  const profitMargin = earningsTotal > 0 ? ((netProfit / earningsTotal) * 100).toFixed(1) : '0';
  const labourCostRatio = earningsTotal > 0 ? ((totalLabourCost / earningsTotal) * 100).toFixed(1) : '0';
  const costPerUnit = totalUnits > 0 ? (totalLabourCost / totalUnits).toFixed(2) : '—';
  const overallTargetAchievement = totalPlannedUnits > 0 ? ((totalUnits / totalPlannedUnits) * 100).toFixed(0) : '0';

  // Sort styles by qty produced to display active ones first
  const activeStyles = sheet.earnings.filter(e => e.qtyProduced > 0).length;

  const updateEarningsState = (newEarnings: StyleEarning[]) => {
    // Ensure all items in newEarnings have strictly unique IDs
    const seenNewIds = new Set<string>();
    const sanitizedNewEarnings = newEarnings.map((ne, idx) => {
      let earnId = ne.id;
      if (!earnId || seenNewIds.has(earnId)) {
        earnId = `style_${(sheet.id || 'sh').replace(/[^a-zA-Z0-9_-]/g, '')}_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      }
      seenNewIds.add(earnId);
      return { ...ne, id: earnId };
    });

    if (syncWithCycle && sheets && onUpdateAllSheets) {
      // Sync style list & prices/plannedQty across all shift sheets in this same 21st-20th pay cycle
      const nextSheets = sheets.map(s => {
        if (!isDateInPayCycle(s.label, payCycleInfo.id)) return s;

        if (s.id === sheet.id) {
          return {
            ...s,
            earnings: sanitizedNewEarnings
          };
        }

        const existingList = [...(s.earnings || [])];
        const usedExistingIds = new Set<string>();
        const seenMergedIds = new Set<string>();

        const mergedEarnings: StyleEarning[] = sanitizedNewEarnings.map((newStyle, idx) => {
          const key = newStyle.style.trim().toUpperCase();
          const existing = existingList.find(e => !usedExistingIds.has(e.id) && e.style.trim().toUpperCase() === key);

          if (existing) {
            usedExistingIds.add(existing.id);
            let finalId = existing.id;
            if (seenMergedIds.has(finalId)) {
              finalId = `style_${s.id}_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            }
            seenMergedIds.add(finalId);

            return {
              ...existing,
              id: finalId,
              style: newStyle.style,
              cmPrice: newStyle.cmPrice,
              smv: newStyle.smv,
              plannedQty: newStyle.plannedQty ?? existing.plannedQty,
              qtyProduced: existing.qtyProduced
            };
          } else {
            const freshId = `style_${s.id}_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            seenMergedIds.add(freshId);
            return {
              ...newStyle,
              id: freshId,
              qtyProduced: 0
            };
          }
        });

        return {
          ...s,
          earnings: mergedEarnings
        };
      });

      onUpdateAllSheets(nextSheets);
    } else {
      onUpdateSheet({ ...sheet, earnings: sanitizedNewEarnings });
    }
  };

  const handleUpdateEarning = (earningId: string, field: keyof StyleEarning, value: any) => {
    const updatedEarnings = sheet.earnings.map((e) => {
      if (e.id !== earningId) return e;
      return { ...e, [field]: value };
    });
    updateEarningsState(updatedEarnings);
  };

  // Quick increment/decrement for actual output piece counts
  const handleAdjustOutput = (earningId: string, delta: number) => {
    if (!canEditEarnings) return;
    const updatedEarnings = sheet.earnings.map((e) => {
      if (e.id !== earningId) return e;
      const current = e.qtyProduced || 0;
      return { ...e, qtyProduced: Math.max(0, current + delta) };
    });
    onUpdateSheet({ ...sheet, earnings: updatedEarnings });
  };

  const handleDeleteEarning = (earningId: string) => {
    const updatedEarnings = sheet.earnings.filter(e => e.id !== earningId);
    updateEarningsState(updatedEarnings);
  };

  const handleAddEarning = () => {
    const newStyle: StyleEarning = {
      id: `style_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      style: "NEW STYLE",
      cmPrice: 10.0,
      smv: 10.0, // Default Standard Minute Value
      plannedQty: 500,
      qtyProduced: 0
    };
    updateEarningsState([...sheet.earnings, newStyle]);
  };

  const handleApplyExcelStyles = (importedStyles: StyleEarning[], mode: 'replace' | 'merge') => {
    const uniqueImported = importedStyles.map((item, idx) => ({
      ...item,
      id: `imported_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`
    }));
    const updated = mode === 'replace' 
      ? uniqueImported 
      : [...sheet.earnings, ...uniqueImported];
    updateEarningsState(updated);
  };

  const handleDeleteTabUpdates = () => {
    setShowDeleteModal(true);
  };

  const executeDeleteTabUpdates = () => {
    updateEarningsState([]);
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Financial Cycle Rule Notice Banner */}
      <div className="bento-card p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md border border-indigo-800/40">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
              Financial Period Context (21st – 20th Basis)
            </span>
            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-mono font-bold">
              Cycle: {payCycleInfo.shortLabel}
            </span>
          </div>
          <p className="text-[11px] text-indigo-200/90 leading-relaxed">
            💡 <strong>Financial Period Rule:</strong> Addition of styles is assumed to be done for the <strong>New Month ({payCycleInfo.shortLabel})</strong> unless done after our financial period has ended (cutoff: 20th). Quantities & revenues are aggregated as totals strictly from the 21st to the 20th.
          </p>
        </div>

        {canEditEarnings && sheets && onUpdateAllSheets && (
          <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-2 rounded-xl border border-white/20 transition cursor-pointer shrink-0">
            <input
              type="checkbox"
              id="syncCycleCheckbox"
              checked={syncWithCycle}
              onChange={(e) => setSyncWithCycle(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
            <label htmlFor="syncCycleCheckbox" className="text-xs font-bold text-white cursor-pointer select-none">
              Sync styles across all shift dates in {payCycleInfo.startMonthName.slice(0,3)}/{payCycleInfo.endMonthName.slice(0,3)} cycle
            </label>
          </div>
        )}
      </div>

      {/* RBAC Status & Daily Output Shortcut */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold ${
        canEditEarnings 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-slate-100 border border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          {canEditEarnings ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>UNLOCKED: Industrial Engineers & Managers can log daily actual style outputs, add new styles, adjust CM prices, and edit planned targets.</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
              <span>READ-ONLY: Style revenue data is locked. Only Industrial Engineers and General Managers can make changes here.</span>
            </>
          )}
        </div>

        {canEditEarnings && (
          <button
            type="button"
            onClick={() => setShowDailyOutputModal(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] shrink-0 self-start sm:self-auto"
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>⚡ Log Daily Output</span>
          </button>
        )}
      </div>

      {/* Financial Overview Cards: Daily Revenue vs Daily Labour Costs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Total Daily Realized CM Earnings */}
        <div className="bento-card p-4.5 flex flex-col justify-between space-y-2 bg-gradient-to-br from-white to-indigo-50/30 border-indigo-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest">Total CM Revenue Today</span>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-mono font-bold px-2 py-0.2 rounded-full">
              {totalUnits.toLocaleString()} pcs
            </span>
          </div>
          <div className="mt-1">
            <h4 className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono">
              {currency} {earningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>{activeStyles} active styles</span>
              <span className="text-indigo-700 font-bold">{overallTargetAchievement}% target</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            Realized daily revenue from completed style outputs
          </p>
        </div>

        {/* 2. Total Daily Labour Costs */}
        <div className="bento-card p-4.5 flex flex-col justify-between space-y-2 bg-gradient-to-br from-white to-rose-50/30 border-rose-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Total Daily Labour Cost</span>
            <span className="text-[10px] bg-rose-100 text-rose-800 font-mono font-bold px-2 py-0.2 rounded-full">
              Wages
            </span>
          </div>
          <div className="mt-1">
            <h4 className="text-2xl sm:text-3xl font-black text-rose-950 font-mono">
              {currency} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>CPU: {currency} {costPerUnit}/pc</span>
              <span>+ OH: {currency} {overheadDaily.toFixed(0)}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            Total wages (Perm + Temp + OT) for this shift
          </p>
        </div>

        {/* 3. Labour % of Revenue Ratio */}
        <div className="bento-card p-4.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Labour % of Revenue</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded-full ${
              parseFloat(labourCostRatio) <= 45 
                ? 'bg-emerald-100 text-emerald-800' 
                : parseFloat(labourCostRatio) <= 65 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-rose-100 text-rose-800'
            }`}>
              {parseFloat(labourCostRatio) <= 45 ? 'Optimal' : parseFloat(labourCostRatio) <= 65 ? 'Moderate' : 'High Cost'}
            </span>
          </div>
          <div className="mt-1">
            <h4 className={`text-2xl sm:text-3xl font-black font-mono ${
              parseFloat(labourCostRatio) <= 45 
                ? 'text-emerald-700' 
                : parseFloat(labourCostRatio) <= 65 
                  ? 'text-amber-700' 
                  : 'text-rose-700'
            }`}>
              {earningsTotal > 0 ? `${labourCostRatio}%` : '—'}
            </h4>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 mt-2">
              <div 
                className={`h-full rounded-full ${
                  parseFloat(labourCostRatio) <= 45 ? 'bg-emerald-500' : parseFloat(labourCostRatio) <= 65 ? 'bg-amber-500' : 'bg-rose-500'
                }`} 
                style={{ width: `${Math.min(100, Math.max(0, parseFloat(labourCostRatio)))}%` }} 
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            Target benchmark: &lt; 45% of daily revenue
          </p>
        </div>

        {/* 4. Daily Operating Net Margin */}
        <div className="bento-card p-4.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Daily Operating Margin</span>
            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full flex items-center gap-0.5 ${
              netProfit >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {netProfit >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {profitMargin}%
            </span>
          </div>
          <div className="mt-1">
            <h4 className={`text-2xl sm:text-3xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {currency} {netProfit.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>Rev − Labour − OH</span>
              <span className="font-bold">{netProfit >= 0 ? 'Profitable' : 'Deficit'}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            Net income after daily wages and overhead
          </p>
        </div>
      </div>

      {/* Main Styles Table */}
      <div className="bento-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-4 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
              Style Specifications & Daily Production Outputs
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3" /> SMVs Included
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" /> Daily Output Active
            </span>
          </div>
          {canEditEarnings && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowDailyOutputModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-lg transition cursor-pointer shadow-xs hover:scale-[1.02]"
                title="Launch Daily Style Output Logger tool"
              >
                <Shirt className="w-3.5 h-3.5" /> Fast Output Logger
              </button>
              <ExcelStyleUploader
                currentEarnings={sheet.earnings}
                onApplyStyles={handleApplyExcelStyles}
                currency={currency}
                payCycleLabel={payCycleInfo.shortLabel}
              />
              <button
                onClick={handleAddEarning}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Style Line
              </button>
              <button
                onClick={handleDeleteTabUpdates}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition cursor-pointer shadow-2xs"
                title="Delete all style revenue entries for this tab"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Clear
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[700px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-indigo-800 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3">Style Code / Name</th>
                <th className="p-3 text-right">CM Contract Price</th>
                <th className="p-3 text-right">Target Planned Qty</th>
                <th className="p-3 text-right bg-indigo-50/70 text-indigo-950 font-black">
                  <div className="flex items-center justify-end gap-1">
                    <span>Actual Qty Produced</span>
                    {canEditEarnings && (
                      <button
                        type="button"
                        onClick={() => setShowDailyOutputModal(true)}
                        className="p-1 rounded-md bg-indigo-200 hover:bg-indigo-300 text-indigo-950 transition cursor-pointer"
                        title="Open Fast Daily Output Logger"
                      >
                        <Shirt className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
                <th className="p-3 text-right">Expected Revenue</th>
                <th className="p-3 text-right font-black text-indigo-950">Daily Realized Revenue</th>
                {canEditEarnings && <th className="p-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {sheet.earnings.map((e, idx) => {
                const defaultPlanned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
                const plannedQty = e.plannedQty ?? defaultPlanned;
                const expectedLineRevenue = plannedQty * e.cmPrice;
                const actualLineRevenue = e.qtyProduced * e.cmPrice;
                const achievementPct = plannedQty > 0 ? ((e.qtyProduced / plannedQty) * 100) : 0;

                return (
                  <tr key={`${e.id || 'style'}_${idx}`} className="hover:bg-slate-50 transition text-slate-800">
                    <td className="p-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <EditableCell
                          value={e.style}
                          onSave={(val) => handleUpdateEarning(e.id, 'style', val)}
                          isEditable={canEditEarnings}
                          placeholder="e.g. NWJ1492/A"
                        />
                        {e.qtyProduced > 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Output Active Today" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        SMV: {e.smv || 10.0} min
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <EditableCell
                        value={e.cmPrice}
                        type="number"
                        min={0}
                        step={0.01}
                        prefix={`${currency} `}
                        onSave={(val) => handleUpdateEarning(e.id, 'cmPrice', val)}
                        isEditable={canEditEarnings}
                        className="text-right font-mono font-bold text-slate-800"
                      />
                    </td>
                    <td className="p-3 text-right font-medium text-slate-600 bg-slate-50/30">
                      <EditableCell
                        value={plannedQty}
                        type="number"
                        min={0}
                        max={999999}
                        onSave={(val) => handleUpdateEarning(e.id, 'plannedQty', val)}
                        isEditable={canEditEarnings}
                        className="text-right font-mono text-slate-600"
                      />
                    </td>
                    
                    {/* Actual Qty Produced with inline step quick actions */}
                    <td className="p-3 text-right bg-indigo-50/40 font-bold text-slate-900">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditEarnings && (
                          <div className="flex items-center gap-0.5 mr-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustOutput(e.id, -10)}
                              className="px-1 py-0.5 bg-white hover:bg-slate-100 text-slate-600 rounded text-[9px] font-mono font-bold border border-slate-200 transition cursor-pointer"
                              title="-10 pcs"
                            >
                              -10
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustOutput(e.id, 10)}
                              className="px-1 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded text-[9px] font-mono font-bold transition cursor-pointer"
                              title="+10 pcs"
                            >
                              +10
                            </button>
                          </div>
                        )}
                        <EditableCell
                          value={e.qtyProduced}
                          type="number"
                          min={0}
                          max={999999}
                          onSave={(val) => handleUpdateEarning(e.id, 'qtyProduced', val)}
                          isEditable={canEditEarnings}
                          className="text-right font-mono font-black text-indigo-950 text-sm"
                        />
                      </div>

                      {/* Mini Target Achievement Bar */}
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${achievementPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, achievementPct)}%` }}
                          />
                        </div>
                        <span className={`text-[9px] font-mono font-bold ${achievementPct >= 100 ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {achievementPct.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/50 font-medium">
                      {currency} {expectedLineRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-indigo-950 text-sm">
                      {currency} {actualLineRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                    {canEditEarnings && (
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteEarning(e.id)}
                          title="Delete Style"
                          className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const totalPlanned = sheet.earnings.reduce((sum, e) => sum + (e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500)), 0);
                const totalExpectedRev = sheet.earnings.reduce((sum, e) => sum + (e.cmPrice * (e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500))), 0);

                return (
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                    <td className="p-3 text-indigo-800 uppercase tracking-wider">TOTALS TODAY</td>
                    <td></td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {totalPlanned.toLocaleString('en-ZA')} units
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-950 font-black text-sm bg-indigo-100/50">
                      {totalUnits.toLocaleString('en-ZA')} units
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600 font-bold">
                      {currency} {totalExpectedRev.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-950 font-black text-base">
                      {currency} {earningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                    {canEditEarnings && <td></td>}
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Structured Profit and Loss Statement with Labour Cost Coverage */}
      {(() => {
        const totalExpectedRev = sheet.earnings.reduce((sum, e) => sum + (e.cmPrice * (e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500))), 0);
        const revVariance = earningsTotal - totalExpectedRev;

        return (
          <div className="bento-card p-6">
            <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-widest mb-4 border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                <span>Factory Daily Profit & Loss Statement (CMT Revenue vs Labour Cost)</span>
              </span>
              <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${revVariance >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                Revenue Variance: {revVariance >= 0 ? '+' : ''}{currency} {revVariance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Planned Target Revenue (CM Price × Planned Target Qty)</span>
                <span className="font-mono text-sm font-semibold text-slate-600">
                  {currency} {totalExpectedRev.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-800 font-medium">
                <span>Actual Realized Revenue (CM Price × Actual Output Produced Today)</span>
                <span className="font-mono text-sm font-black text-indigo-950">
                  + {currency} {earningsTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span>Less: Factory Labour Costs (Permanent, Temporary & Overtime Wages)</span>
                  <span className="text-[10px] text-slate-400 font-mono">({labourCostRatio}% of revenue)</span>
                </div>
                <span className="font-mono text-sm font-bold text-rose-600">
                  − {currency} {totalLabourCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 border-b border-slate-200 pb-3">
                <span>Less: Allocated Daily Overheads (Rent, Utilities, Admin per Day)</span>
                <span className="font-mono text-sm text-rose-600">
                  − {currency} {overheadDaily.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-extrabold text-slate-900">Daily Operational Net Income</span>
                <span className={`font-mono text-lg font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {netProfit >= 0 ? '+' : ''} {currency} {netProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete / Clear Style Revenue Entries Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={executeDeleteTabUpdates}
        title={`Clear Style Revenue Entries for "${sheet.label}"`}
        message={`Are you sure you want to delete all style revenue and production entries for "${sheet.label}"?`}
        subMessage="This will clear all style entries and set style production figures to 0 for this date."
        confirmText="Yes, Clear Style Data"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="trash"
      />

      {/* Daily Style Output & Revenue Logger Modal */}
      <DailyOutputEntryModal
        isOpen={showDailyOutputModal}
        onClose={() => setShowDailyOutputModal(false)}
        currentSheet={sheet}
        allSheets={sheets || [sheet]}
        onUpdateSheet={onUpdateSheet}
        onUpdateAllSheets={onUpdateAllSheets}
        currency={currency}
        canEditEarnings={canEditEarnings}
        overheadDaily={overheadDaily}
      />
    </div>
  );
}
