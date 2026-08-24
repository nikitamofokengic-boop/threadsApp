import React, { useState } from 'react';
import { SheetData, Overheads, SubsidiaryAllocation } from '../types';
import ConfirmModal from './ConfirmModal';
import DailyOutputEntryModal from './DailyOutputEntryModal';
import { TrendingUp, Users, DollarSign, Activity, AlertTriangle, CheckCircle, Calendar, ChevronRight, Layers, BarChart3, Trash2, RotateCcw, Building2, Zap, Shirt, Plus } from 'lucide-react';
import { getAllPayCyclesFromSheets, isDateInPayCycle, getPayCycleForDate, getDayInfo, calculateSheetLaborCostBreakdown, extractAndNormalizeDate } from '../utils/payCycle';

interface SummaryTabProps {
  sheet: SheetData;
  allSheets: SheetData[];
  overheadDaily: number;
  monthlyOverheads: Overheads;
  currency: string;
  onUpdateSheet?: (updated: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  canEditEarnings?: boolean;
  onOpenSubsidiesPanel?: () => void;
  allocations?: SubsidiaryAllocation[];
}

export default function SummaryTab({
  sheet,
  allSheets,
  overheadDaily,
  monthlyOverheads,
  currency,
  onUpdateSheet,
  onUpdateAllSheets,
  canEditEarnings = true,
  onOpenSubsidiesPanel,
  allocations = []
}: SummaryTabProps) {
  const [summaryMode, setSummaryMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedCycle, setSelectedCycle] = useState<string>('JUL_AUG_2026');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showDailyOutputModal, setShowDailyOutputModal] = useState<boolean>(false);

  const handleResetShiftData = () => {
    if (!onUpdateSheet) return;
    setShowResetModal(true);
  };

  const executeResetShiftData = () => {
    if (!onUpdateSheet) return;
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

  // --- DAILY CALCULATIONS ---
  const sheetBreakdown = calculateSheetLaborCostBreakdown(sheet);
  const totalPerm = sheetBreakdown.permCount;
  const totalTemp = sheetBreakdown.tempCount;
  const totalLabourCost = sheetBreakdown.totalLaborCost;
  const totalOtCost = sheetBreakdown.otCost;
  const baseLabourCost = sheetBreakdown.baseLaborCost;

  const totalHeadcount = totalPerm + totalTemp;
  const earningsTotal = sheet.earnings.reduce((sum, e) => sum + (e.qtyProduced * e.cmPrice), 0);
  const expectedEarningsTotal = sheet.earnings.reduce((sum, e) => {
    const planned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
    return sum + (planned * e.cmPrice);
  }, 0);
  const plannedUnitsTotal = sheet.earnings.reduce((sum, e) => sum + (e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500)), 0);
  const totalUnits = sheet.earnings.reduce((sum, e) => sum + e.qtyProduced, 0);
  const dailyNet = earningsTotal - totalLabourCost - overheadDaily;
  
  // SAH Efficiency calculation based on standard shift hours (defaults to 9.0 hours)
  const stdHours = sheet.standardShiftHours || 9.0;
  const sahList = sheet.sahData || [];
  const dailySahEarned = sahList.reduce((sum, r) => sum + ((r.output * r.smv) / 60), 0);
  const dailySahCapacity = sahList.reduce((sum, r) => sum + (r.mos * (r.shiftHours || stdHours)), 0);
  const dailySahEfficiency = dailySahCapacity > 0 ? (dailySahEarned / dailySahCapacity * 100) : 0;

  const tempPct = totalHeadcount ? (totalTemp / totalHeadcount * 100).toFixed(1) : '0';
  const costPct = earningsTotal > 0 ? Math.min(100, (totalLabourCost / earningsTotal * 100)).toFixed(0) : '0';
  const cpu = totalUnits > 0 ? (totalLabourCost / totalUnits).toFixed(2) : '—';
  const marginPct = earningsTotal > 0 ? ((dailyNet / earningsTotal) * 100).toFixed(1) : '0';

  // Sort active departments by cost for Daily Breakdown
  const sortedDepts = [...sheet.departments]
    .map(d => {
      const hc = d.roles.reduce((s, r) => s + r.perm + r.temp, 0);
      const baseCost = d.roles.reduce((s, r) => s + ((r.cost && r.cost > 0) ? r.cost : (r.perm * r.permWage)) + (r.temp * r.tempWage), 0);
      const otHours = sheet.shiftOtHours || 0;
      const dayInfo = getDayInfo(sheet.label, 9.0 + otHours);
      const otMultiplier = (dayInfo.isWeekend || dayInfo.isHoliday) ? 2.0 : 1.5;
      const otCost = d.roles.reduce((s, r) => {
        const pHourly = r.permWage > 0 ? r.permWage / 9.0 : 0;
        const tHourly = r.tempWage > 0 ? r.tempWage / 9.0 : 0;
        return s + (r.perm * otHours * pHourly * otMultiplier) + (r.temp * otHours * tHourly * otMultiplier);
      }, 0);
      const cost = baseCost + otCost;
      return { ...d, totalHc: hc, totalCost: cost, baseCost, otCost };
    })
    .filter(d => d.totalHc > 0)
    .sort((a, b) => b.totalCost - a.totalCost);

  const maxDeptCost = Math.max(...sortedDepts.map(d => d.totalCost), 1);

  // --- MONTHLY PAY CYCLE CALCULATIONS (21st to 20th of every month) ---
  const detectedCycles = getAllPayCyclesFromSheets(allSheets || []);
  const PAY_CYCLES = [
    ...detectedCycles.map(c => ({
      id: c.id,
      label: c.label,
      matcher: (lbl: string) => isDateInPayCycle(lbl, c.id)
    })),
    {
      id: 'ALL_LOGS',
      label: 'All Logged Shift Sheets Across All Pay Cycles',
      matcher: () => true
    }
  ];

  const activeSheetCycle = getPayCycleForDate(sheet.label);
  const effectiveCycleId = PAY_CYCLES.some(c => c.id === selectedCycle)
    ? selectedCycle
    : activeSheetCycle.id;

  const currentCycleObj = PAY_CYCLES.find(c => c.id === effectiveCycleId) || PAY_CYCLES[0];
  const cycleSheets = (allSheets || []).filter(s => currentCycleObj ? currentCycleObj.matcher(s.label) : true);

  // Compute aggregated stats for the selected Monthly Pay Cycle
  let monthlyEarnings = 0;
  let monthlyExpectedEarnings = 0;
  let monthlyLabourCost = 0;
  let monthlyTotalUnits = 0;
  let monthlyPlannedUnits = 0;
  let monthlyHeadcountSum = 0;
  let monthlySahEarned = 0;
  let monthlySahCapacity = 0;

  const dailyCycleBreakdown = cycleSheets.map(s => {
    const sBreakdown = calculateSheetLaborCostBreakdown(s);
    const dayWages = sBreakdown.totalLaborCost;
    const dayHc = sBreakdown.totalHeadcount;

    const dayEarnings = s.earnings.reduce((sum, e) => sum + (e.qtyProduced * e.cmPrice), 0);
    const dayExpectedEarnings = s.earnings.reduce((sum, e) => {
      const planned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
      return sum + (planned * e.cmPrice);
    }, 0);
    const dayPlannedUnits = s.earnings.reduce((sum, e) => sum + (e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500)), 0);
    const dayUnits = s.earnings.reduce((sum, e) => sum + e.qtyProduced, 0);
    const dayNet = dayEarnings - dayWages - overheadDaily;

    // SAH for sheet day
    const sStdH = s.standardShiftHours || 9.0;
    let sSahEarned = 0;
    let sSahCapacity = 0;
    (s.sahData || []).forEach(r => {
      sSahEarned += (r.output * r.smv) / 60;
      sSahCapacity += r.mos * (r.shiftHours || sStdH);
    });

    monthlyEarnings += dayEarnings;
    monthlyExpectedEarnings += dayExpectedEarnings;
    monthlyLabourCost += dayWages;
    monthlyTotalUnits += dayUnits;
    monthlyPlannedUnits += dayPlannedUnits;
    monthlyHeadcountSum += dayHc;
    monthlySahEarned += sSahEarned;
    monthlySahCapacity += sSahCapacity;

    const dayEfficiency = sSahCapacity > 0 ? (sSahEarned / sSahCapacity * 100) : 0;

    return {
      dateLabel: s.label,
      headcount: dayHc,
      plannedUnits: dayPlannedUnits,
      units: dayUnits,
      expectedEarnings: dayExpectedEarnings,
      earnings: dayEarnings,
      wages: dayWages,
      overheads: overheadDaily,
      netProfit: dayNet,
      sahEarned: sSahEarned,
      sahCapacity: sSahCapacity,
      efficiency: dayEfficiency
    };
  });

  const loggedDaysCount = cycleSheets.length || 1;
  const avgMonthlyHeadcount = Math.round(monthlyHeadcountSum / loggedDaysCount);
  const totalMonthlyOverheads = (monthlyOverheads.rent + monthlyOverheads.utilities + monthlyOverheads.admin + monthlyOverheads.other);
  const monthlyAllocatedOH = overheadDaily * loggedDaysCount;
  const monthlyNetProfit = monthlyEarnings - monthlyLabourCost - monthlyAllocatedOH;
  const monthlyMarginPct = monthlyEarnings > 0 ? ((monthlyNetProfit / monthlyEarnings) * 100).toFixed(1) : '0';
  const monthlyCostPerUnit = monthlyTotalUnits > 0 ? (monthlyLabourCost / monthlyTotalUnits).toFixed(2) : '—';
  const monthlySahEfficiency = monthlySahCapacity > 0 ? (monthlySahEarned / monthlySahCapacity * 100) : 0;

  const maxDailyRevenueInCycle = Math.max(...dailyCycleBreakdown.map(d => d.earnings), ...dailyCycleBreakdown.map(d => d.wages), 100);

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Mode Selector Bar */}
      <div className="bento-card p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
              Executive Dashboard Mode
            </h2>
            <p className="text-xs text-slate-500">
              Toggle between single shift daily summary and monthly payroll cycle analytics (21st–20th).
            </p>
          </div>
        </div>

        {/* Segmented Switch */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto">
            <button
              onClick={() => setSummaryMode('daily')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                summaryMode === 'daily'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Daily Summary
            </button>
            <button
              onClick={() => setSummaryMode('monthly')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                summaryMode === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Monthly Pay Cycle (21st - 20th)
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDailyOutputModal(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer hover:scale-[1.02]"
              title="Log daily actual style outputs to calculate daily revenue and labour costs"
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Log Daily Output</span>
            </button>

            {onUpdateSheet && (
              <button
                type="button"
                onClick={handleResetShiftData}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer hover:scale-[1.01]"
                title="Delete all operational updates for this shift date"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">Delete Daily Updates</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODE 1: DAILY SUMMARY                      */}
      {/* ========================================== */}
      {summaryMode === 'daily' && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bento-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Workforce</p>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">{totalHeadcount}</h3>
                </div>
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>Permanent Staff: <span className="font-semibold text-slate-800">{totalPerm}</span></p>
                <p>Temporary Staff: <span className="font-semibold text-pink-700">+{totalTemp}</span> ({tempPct}% added)</p>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Labour + Overheads</p>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                    {currency} {(totalLabourCost + overheadDaily).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                  </h3>
                </div>
                <div className="p-2 bg-violet-50 border border-violet-100 rounded-xl text-violet-600">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>Daily Wages: <span className="font-semibold text-slate-800">{currency} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span></p>
                <p>Daily Overheads: <span className="font-semibold text-slate-800">{currency} {overheadDaily.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span></p>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Daily CMT Revenue</p>
                  <h3 className="text-3xl font-extrabold text-indigo-600 mt-2 font-mono">
                    {currency} {earningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                  </h3>
                </div>
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-xs space-y-1">
                <p className="text-slate-500 flex justify-between">
                  <span>Expected:</span>
                  <span className="font-semibold text-slate-800 font-mono">{currency} {expectedEarningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                </p>
                <div className="flex justify-between text-xs font-medium text-slate-500 pt-1">
                  <span>Wages Covered</span>
                  <span className="font-bold">{costPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${dailyNet >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, Number(costPct))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Daily Net Profit</p>
                  <h3 className={`text-3xl font-extrabold mt-2 font-mono ${dailyNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {currency} {dailyNet.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                  </h3>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>Margin: <span className={`font-extrabold ${dailyNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{marginPct}%</span></p>
                <p>Expected Rev: <span className="font-semibold text-slate-800">{currency} {expectedEarningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span></p>
              </div>
            </div>
          </div>

          {/* Subsidies & OT Recovery Summary Card */}
          {(() => {
            const normDate = extractAndNormalizeDate(sheet.label);
            const dailyAllocs = (allocations || []).filter(a => extractAndNormalizeDate(a.dateLabel) === normDate);
            const subPerm = dailyAllocs.reduce((s, a) => s + (a.headcountPerm || 0), 0);
            const subTemp = dailyAllocs.reduce((s, a) => s + (a.headcountTemp || 0), 0);
            const subHc = subPerm + subTemp;
            const subBaseCost = dailyAllocs.reduce((s, a) => s + (a.totalCost || 0), 0);
            const subOtCost = dailyAllocs.reduce((s, a) => s + (a.otCost || 0), 0);
            const subTotalRecovered = subBaseCost + subOtCost;

            return (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-700/80 text-amber-300 border border-purple-500/30">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-extrabold text-white tracking-wide">
                        SUBSIDIARY WORKFORCE ALLOCATIONS & OT RECOVERIES
                      </h4>
                      <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-black uppercase font-mono">
                        {subHc} HC Loaned Out
                      </span>
                    </div>
                    <p className="text-xs text-purple-200 mt-0.5">
                      {subHc > 0 
                        ? `${subHc} staff loaned out across ${dailyAllocs.length} sister subsidiaries recovering ${currency} ${subTotalRecovered.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Base: ${currency} ${subBaseCost.toFixed(0)} + OT: ${currency} ${subOtCost.toFixed(0)}).`
                        : 'No workforce loans or intercompany charges currently active for this shift date.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {onOpenSubsidiesPanel && (
                    <button
                      type="button"
                      onClick={onOpenSubsidiesPanel}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Open Subsidiaries Panel & OT</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Insight Banner */}
          {(() => {
            const dayInfo = getDayInfo(sheet.label);
            return (
              <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs sm:text-sm ${
                dayInfo.isOvertime 
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950' 
                  : dailyNet >= 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                {dayInfo.isOvertime ? (
                  <span className="p-1.5 bg-amber-200 text-amber-950 rounded-xl font-black text-xs shrink-0 mt-0.5">⚡ OT</span>
                ) : dailyNet >= 0 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-extrabold uppercase tracking-wide">{sheet.label} ({dayInfo.dayName})</span>
                        {dayInfo.isHoliday ? (
                          <span className="px-2 py-0.5 bg-purple-200 text-purple-950 border border-purple-300 font-black text-[10px] rounded-full uppercase tracking-wider shadow-2xs">
                            🇱🇸 LESOTHO PAID PUBLIC HOLIDAY ({dayInfo.holidayName})
                          </span>
                        ) : dayInfo.isOvertime ? (
                          <span className="px-2 py-0.5 bg-amber-300 text-amber-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                            ⚡ OVERTIME SHIFT ({dayInfo.badgeText})
                          </span>
                        ) : null}
                      </div>
                      <strong>{dailyNet >= 0 ? 'Profitable Shift Operations' : 'Shift Net Operational Loss'}</strong> · {' '}
                      Daily headcount of {totalHeadcount} generated {totalUnits.toLocaleString('en-ZA')} pcs output, resulting in total revenue of {currency} {earningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} against daily expenditure of {currency} {(totalLabourCost + overheadDaily).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}.
                    </div>
                    {dailySahCapacity > 0 && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/80 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 shrink-0 shadow-2xs">
                        <span className="text-[10px] text-slate-500 uppercase font-extrabold">Line Efficiency ({stdHours}h Std):</span>
                        <span className={`font-mono font-extrabold ${
                          dailySahEfficiency >= 75 ? 'text-emerald-700' : dailySahEfficiency >= 55 ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {dailySahEfficiency.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-400">({dailySahEarned.toFixed(1)}h / {dailySahCapacity.toFixed(1)}h)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Grid: Department Table & Fully Responsive Chart WITHOUT Horizontal Scrolling */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Departments Table */}
            <div className="bento-card p-5 sm:p-6">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">
                Department Performance & Cost breakdown
              </h3>
              <div className="overflow-x-auto max-w-full rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-indigo-800 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="p-3">Department</th>
                      <th className="p-3 text-right">Headcount</th>
                      <th className="p-3 text-right">Cost ({currency})</th>
                      <th className="p-3 text-right">% Wage Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {sortedDepts.map((d) => {
                      const share = totalLabourCost ? (d.totalCost / totalLabourCost * 100).toFixed(1) : '0';
                      return (
                        <tr key={d.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-bold text-slate-800">{d.name}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{d.totalHc}</td>
                          <td className="p-3 text-right font-mono text-slate-900 font-semibold">
                            {d.totalCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-12 sm:w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${share}%` }} />
                              </div>
                              <span className="font-mono text-slate-600 font-medium">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                      <td className="p-3">TOTAL ACTIVE</td>
                      <td className="p-3 text-right font-mono">{totalHeadcount}</td>
                      <td className="p-3 text-right font-mono">{currency} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                      <td className="p-3 text-right font-mono">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Fully Responsive Chart WITHOUT Horizontal Scrolling */}
            <div className="bento-card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest">
                    Daily Wage Allocation Distribution
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold border border-indigo-100">
                    Responsive View
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Comparative breakdown of direct labor expenditure per department.
                </p>
              </div>

              {/* Horizontal Bar Distribution Layout - Never overflows horizontally */}
              <div className="space-y-3 my-2">
                {sortedDepts.slice(0, 8).map((d) => {
                  const pctOfMax = (d.totalCost / maxDeptCost) * 100;
                  const shareOfTotal = totalLabourCost ? (d.totalCost / totalLabourCost * 100).toFixed(1) : '0';

                  return (
                    <div key={d.id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 truncate max-w-[160px] sm:max-w-[220px]">
                          {d.name}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-indigo-700 font-bold">{currency} {Math.round(d.totalCost).toLocaleString('en-ZA')}</span>
                          <span className="text-slate-400 text-[10px]">({shareOfTotal}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5 flex items-center">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500 shadow-xs"
                          style={{ width: `${Math.max(2, pctOfMax)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {sortedDepts.length > 8 && (
                  <p className="text-[10px] text-slate-500 text-center pt-2">
                    + {sortedDepts.length - 8} additional minor departments calculated in totals
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                <span>Peak Department Spend: <strong className="text-slate-800 font-mono">{currency}{Math.round(maxDeptCost).toLocaleString('en-ZA')}</strong></span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" /> Total Wages: <strong className="text-slate-800 font-mono">{currency}{Math.round(totalLabourCost).toLocaleString('en-ZA')}</strong>
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================== */}
      {/* MODE 2: MONTHLY PAY CYCLE (21st - 20th)    */}
      {/* ========================================== */}
      {summaryMode === 'monthly' && (
        <>
          {/* Pay Cycle Filter Header */}
          <div className="bento-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block">Pay Cycle Schedule</span>
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Monthly Summary (21st to 20th Cycle)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Payroll and total earnings computed strictly across the 21st of each month to the 20th of the following month.
              </p>
            </div>

            <div className="w-full md:w-auto">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select Pay Period</label>
              <select
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                className="w-full md:w-80 px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
              >
                {PAY_CYCLES.map(c => (
                  <option key={c.id} value={c.id} className="bg-white text-slate-800">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bento-card p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Logged Shift Days</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">{loggedDaysCount} days</h3>
              <p className="text-xs text-slate-500 mt-2">Avg Daily Headcount: <strong className="text-slate-800 font-mono">{avgMonthlyHeadcount} ops</strong></p>
            </div>

            <div className="bento-card p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Monthly CMT Revenue</p>
              <h3 className="text-3xl font-extrabold text-indigo-600 mt-2 font-mono">
                {currency} {monthlyEarnings.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Expected: <strong className="text-slate-800 font-mono">{currency} {monthlyExpectedEarnings.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Total Output: <strong className="text-slate-800 font-mono">{monthlyTotalUnits.toLocaleString('en-ZA')} pcs</strong> (Planned: {monthlyPlannedUnits.toLocaleString('en-ZA')} pcs)</p>
            </div>

            <div className="bento-card p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Monthly Labour Cost</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                {currency} {monthlyLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-xs text-slate-500 mt-2">Direct Factory Wages</p>
            </div>

            <div className="bento-card p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Monthly Net Margin</p>
              <h3 className={`text-3xl font-extrabold mt-2 font-mono ${monthlyNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {currency} {monthlyNetProfit.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-xs text-slate-500 mt-2">Pay Period Margin: <strong className={monthlyNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{monthlyMarginPct}%</strong></p>
            </div>
          </div>

          {/* Monthly Trend Chart (Fully Responsive, NO Horizontal Scroll) */}
          <div className="bento-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest">
                  Pay Cycle Daily Revenue vs Labour Spend
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparison of daily contract earnings (green) versus daily wage cost (indigo) for each shift sheet in cycle.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded-xs" /> Daily Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-indigo-500 rounded-xs" /> Daily Wages</span>
              </div>
            </div>

            {/* Fully responsive trend bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {dailyCycleBreakdown.map((d, i) => (
                <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 transition space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{d.dateLabel}</span>
                    <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      d.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {d.netProfit >= 0 ? '+' : ''}{currency}{Math.round(d.netProfit).toLocaleString('en-ZA')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Rev: {currency}{Math.round(d.earnings).toLocaleString('en-ZA')}</span>
                      <span>Output: {d.units} pcs</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (d.earnings / maxDailyRevenueInCycle) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Wages: {currency}{Math.round(d.wages).toLocaleString('en-ZA')}</span>
                      <span>HC: {d.headcount}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (d.wages / maxDailyRevenueInCycle) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Day-by-Day Pay Cycle Audit Table */}
          <div className="bento-card p-5 sm:p-6 space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest">
              Pay Cycle Day-by-Day Financial Breakdown ({currentCycleObj.label})
            </h3>

            <div className="overflow-x-auto max-w-full rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-indigo-800 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Shift Date</th>
                    <th className="p-3 text-right">Headcount</th>
                    <th className="p-3 text-right">Units Output</th>
                    <th className="p-3 text-right">Daily Earnings ({currency})</th>
                    <th className="p-3 text-right">Daily Wages ({currency})</th>
                    <th className="p-3 text-right">Daily Overheads ({currency})</th>
                    <th className="p-3 text-right">Daily Net Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {dailyCycleBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-slate-800">{row.dateLabel}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{row.headcount}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">{row.units.toLocaleString('en-ZA')} pcs</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700">{currency} {row.earnings.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                      <td className="p-3 text-right font-mono text-slate-800">{currency} {row.wages.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{currency} {row.overheads.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-full ${
                          row.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {currency} {row.netProfit.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                    <td className="p-3 text-indigo-700">PAY CYCLE TOTALS ({loggedDaysCount} Days)</td>
                    <td className="p-3 text-right font-mono text-slate-700">{avgMonthlyHeadcount} avg</td>
                    <td className="p-3 text-right font-mono text-indigo-700">{monthlyTotalUnits.toLocaleString('en-ZA')} pcs</td>
                    <td className="p-3 text-right font-mono text-indigo-700">{currency} {monthlyEarnings.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                    <td className="p-3 text-right font-mono text-slate-800">{currency} {monthlyLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{currency} {monthlyAllocatedOH.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={monthlyNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {currency} {monthlyNetProfit.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} ({monthlyMarginPct}%)
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reset Daily Operations Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={executeResetShiftData}
        title={`Reset Operations for "${sheet.label}"`}
        message={`Are you sure you want to reset all operational updates (cadre, headcount, style revenue, and SAH targets) for "${sheet.label}"?`}
        subMessage="This will reset cadre and attendance counts to 0 and clear style production and SAH targets for this date."
        confirmText="Yes, Reset Shift Data"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="reset"
      />

      {/* Daily Style Output & Revenue Logger Modal */}
      {onUpdateSheet && (
        <DailyOutputEntryModal
          isOpen={showDailyOutputModal}
          onClose={() => setShowDailyOutputModal(false)}
          currentSheet={sheet}
          allSheets={allSheets || [sheet]}
          onUpdateSheet={onUpdateSheet}
          onUpdateAllSheets={onUpdateAllSheets}
          currency={currency}
          canEditEarnings={canEditEarnings}
          overheadDaily={overheadDaily}
        />
      )}
    </div>
  );
}
