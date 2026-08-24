import React, { useState } from 'react';
import { SheetData, Overheads } from '../types';
import { calculateSheetLaborCostBreakdown } from '../utils/payCycle';
import { 
  GitCompare, 
  Calendar, 
  ArrowRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Users, 
  Activity, 
  Layers, 
  Clock, 
  Minus,
  Sparkles,
  PieChart
} from 'lucide-react';

interface ChangesTabProps {
  sheets: SheetData[];
  currency: string;
  overheads?: Overheads;
}

export default function ChangesTab({ sheets, currency, overheads }: ChangesTabProps) {
  const [fromSheetId, setFromSheetId] = useState(sheets[0]?.id || '');
  const [toSheetId, setToSheetId] = useState(sheets[sheets.length - 1]?.id || '');

  // Calculate comprehensive operational & financial figures for any given sheet
  const getSheetMetrics = (sheet: SheetData) => {
    if (!sheet) return null;

    const labor = calculateSheetLaborCostBreakdown(sheet);
    
    const totalRevenue = (sheet.earnings || []).reduce((s, e) => s + (e.qtyProduced || 0) * (e.cmPrice || 0), 0);
    const totalUnits = (sheet.earnings || []).reduce((s, e) => s + (e.qtyProduced || 0), 0);
    const totalSAH = (sheet.earnings || []).reduce((s, e) => s + ((e.qtyProduced || 0) * (e.smv || 0)) / 60, 0);

    const totalAbsent = (sheet.departments || []).reduce((s, d) => 
      s + d.roles.reduce((ss, r) => ss + (r.absent ?? (r.cadre ? Math.max(0, r.cadre - r.perm) : 0)), 0), 0
    );
    
    const totalCadre = (sheet.departments || []).reduce((s, d) => 
      s + d.roles.reduce((ss, r) => ss + (r.cadre ?? (r.perm + (r.absent || 0))), 0), 0
    );

    const dailyOverhead = overheads 
      ? (overheads.rent + overheads.utilities + overheads.admin + overheads.other) / 30
      : 15000;

    const totalCost = labor.totalLaborCost + dailyOverhead;
    const netMargin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

    const standardHours = sheet.standardShiftHours || 9.0;
    const totalWorkedHours = (labor.totalHeadcount * standardHours) + (labor.otHeadcountTotal * labor.otHours);
    const efficiency = totalWorkedHours > 0 ? (totalSAH / totalWorkedHours) * 100 : 0;

    return {
      label: sheet.label,
      totalHeadcount: labor.totalHeadcount,
      permCount: labor.permCount,
      tempCount: labor.tempCount,
      totalAbsent,
      totalCadre,
      otHeadcount: labor.otHeadcountTotal,
      otHours: labor.otHours,
      baseLaborCost: labor.baseLaborCost,
      otCost: labor.otCost,
      totalLaborCost: labor.totalLaborCost,
      dailyOverhead,
      totalCost,
      totalRevenue,
      totalUnits,
      totalSAH,
      netMargin,
      marginPercent,
      efficiency,
      totalWorkedHours
    };
  };

  const fromSheet = sheets.find(s => s.id === fromSheetId) || sheets[0];
  const toSheet = sheets.find(s => s.id === toSheetId) || sheets[sheets.length - 1];

  const fromMetrics = fromSheet ? getSheetMetrics(fromSheet) : null;
  const toMetrics = toSheet ? getSheetMetrics(toSheet) : null;

  // Department headcount diffs
  const diffDepts = (fDepts: any[], tDepts: any[]) => {
    const diffs: { type: 'add' | 'remove' | 'change' | 'role_add' | 'role_remove'; desc: string; isPositive: boolean; delta: number }[] = [];
    const fMap = new Map(fDepts.map(d => [d.name, d]));
    const tMap = new Map(tDepts.map(d => [d.name, d]));

    const allNames = Array.from(new Set([...fMap.keys(), ...tMap.keys()]));

    allNames.forEach(name => {
      const fDept = fMap.get(name);
      const tDept = tMap.get(name);

      const getDeptHC = (d: any) => d ? d.roles.reduce((s: number, r: any) => s + r.perm + r.temp, 0) : 0;

      if (!fDept && tDept) {
        const hc = getDeptHC(tDept);
        diffs.push({ type: 'add', desc: `Department ${name} introduced with ${hc} workers`, isPositive: true, delta: hc });
        return;
      }
      if (fDept && !tDept) {
        const hc = getDeptHC(fDept);
        diffs.push({ type: 'remove', desc: `Department ${name} removed (${hc} workers affected)`, isPositive: false, delta: -hc });
        return;
      }

      if (fDept && tDept) {
        const hf = getDeptHC(fDept);
        const ht = getDeptHC(tDept);
        if (hf !== ht) {
          const delta = ht - hf;
          diffs.push({
            type: 'change',
            desc: `Department ${name}: Headcount changed from ${hf} to ${ht} (${delta >= 0 ? '+' : ''}${delta} ops)`,
            isPositive: delta >= 0,
            delta
          });
        }

        // Compare roles inside dept
        const fRoles = new Map<string, any>(fDept.roles.map((r: any) => [r.title.toUpperCase(), r]));
        const tRoles = new Map<string, any>(tDept.roles.map((r: any) => [r.title.toUpperCase(), r]));

        const allRoleTitles = Array.from(new Set([...fRoles.keys(), ...tRoles.keys()]));

        allRoleTitles.forEach(title => {
          const fRole = fRoles.get(title);
          const tRole = tRoles.get(title);

          if (!fRole && tRole) {
            const rHc = tRole.perm + tRole.temp;
            diffs.push({ type: 'role_add', desc: `${name} Dept: New role "${title}" introduced (+${rHc} ops)`, isPositive: true, delta: rHc });
          } else if (fRole && !tRole) {
            const rHc = fRole.perm + fRole.temp;
            diffs.push({ type: 'role_remove', desc: `${name} Dept: Role "${title}" removed (-${rHc} ops)`, isPositive: false, delta: -rHc });
          } else if (fRole && tRole) {
            const rfTotal = fRole.perm + fRole.temp;
            const rtTotal = tRole.perm + tRole.temp;
            if (rfTotal !== rtTotal) {
              const delta = rtTotal - rfTotal;
              diffs.push({
                type: 'change',
                desc: `${name} (${title}): Staffing adjusted from ${rfTotal} to ${rtTotal} (${delta >= 0 ? '+' : ''}${delta})`,
                isPositive: delta >= 0,
                delta
              });
            }
          }
        });
      }
    });

    return diffs;
  };

  // Compare earnings/styles
  const diffEarnings = (fEarns: any[], tEarns: any[]) => {
    const diffs: { desc: string; isPositive: boolean; deltaVal: number }[] = [];
    const fMap = new Map<string, any>((fEarns || []).map(e => [e.style, e]));
    const tMap = new Map<string, any>((tEarns || []).map(e => [e.style, e]));

    const allStyles = Array.from(new Set([...fMap.keys(), ...tMap.keys()]));

    allStyles.forEach(style => {
      const fE = fMap.get(style);
      const tE = tMap.get(style);

      if (!fE && tE) {
        const rev = tE.qtyProduced * tE.cmPrice;
        diffs.push({ desc: `Style ${style} added to contract run (+${tE.qtyProduced.toLocaleString()} pcs, +${currency} ${rev.toLocaleString()})`, isPositive: true, deltaVal: rev });
        return;
      }
      if (fE && !tE) {
        const rev = fE.qtyProduced * fE.cmPrice;
        diffs.push({ desc: `Style ${style} completed/removed (-${fE.qtyProduced.toLocaleString()} pcs, -${currency} ${rev.toLocaleString()})`, isPositive: false, deltaVal: -rev });
        return;
      }

      if (fE && tE) {
        if (fE.qtyProduced !== tE.qtyProduced) {
          const deltaQty = tE.qtyProduced - fE.qtyProduced;
          const revDelta = deltaQty * tE.cmPrice;
          diffs.push({
            desc: `Style ${style}: Output volume changed from ${fE.qtyProduced.toLocaleString()} to ${tE.qtyProduced.toLocaleString()} pcs (${deltaQty >= 0 ? '+' : ''}${deltaQty.toLocaleString()} pcs, ${revDelta >= 0 ? '+' : ''}${currency} ${Math.abs(revDelta).toLocaleString()})`,
            isPositive: deltaQty >= 0,
            deltaVal: revDelta
          });
        }
        if (fE.cmPrice !== tE.cmPrice) {
          const delta = tE.cmPrice - fE.cmPrice;
          diffs.push({
            desc: `Style ${style}: CM price rate updated from ${currency}${fE.cmPrice} to ${currency}${tE.cmPrice} per unit`,
            isPositive: delta >= 0,
            deltaVal: delta * tE.qtyProduced
          });
        }
      }
    });

    return diffs;
  };

  // Analyze reasons for Improvement vs Shortfalls between 2 metrics
  const analyzeReasons = (from: any, to: any, fSheet: SheetData, tSheet: SheetData) => {
    if (!from || !to) return { improvements: [], shortfalls: [] };

    const improvements: { title: string; detail: string; figure: string }[] = [];
    const shortfalls: { title: string; detail: string; figure: string }[] = [];

    // 1. CM Revenue
    const revDelta = to.totalRevenue - from.totalRevenue;
    if (revDelta > 0) {
      const pct = from.totalRevenue > 0 ? ((revDelta / from.totalRevenue) * 100).toFixed(1) : '100';
      improvements.push({
        title: 'CM Contract Revenue Gain',
        detail: `CM earnings increased from ${currency} ${from.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} to ${currency} ${to.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} due to higher production output.`,
        figure: `+${currency} ${revDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (+${pct}%)`
      });
    } else if (revDelta < 0) {
      const pct = from.totalRevenue > 0 ? ((Math.abs(revDelta) / from.totalRevenue) * 100).toFixed(1) : '0';
      shortfalls.push({
        title: 'CM Contract Revenue Drop',
        detail: `CM earnings dropped from ${currency} ${from.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} to ${currency} ${to.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} due to volume shortfalls on active styles.`,
        figure: `-${currency} ${Math.abs(revDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (-${pct}%)`
      });
    }

    // 2. Net Shift Margin
    const marginDelta = to.netMargin - from.netMargin;
    if (marginDelta > 0) {
      improvements.push({
        title: 'Net Profit Margin Expansion',
        detail: `Net shift profitability expanded from ${currency} ${from.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (${from.marginPercent.toFixed(1)}%) to ${currency} ${to.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (${to.marginPercent.toFixed(1)}%).`,
        figure: `+${currency} ${marginDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
      });
    } else if (marginDelta < 0) {
      shortfalls.push({
        title: 'Net Margin Shortfall / Cost Compression',
        detail: `Net shift margin compressed from ${currency} ${from.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (${from.marginPercent.toFixed(1)}%) down to ${currency} ${to.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (${to.marginPercent.toFixed(1)}%).`,
        figure: `-${currency} ${Math.abs(marginDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
      });
    }

    // 3. Units Output
    const unitsDelta = to.totalUnits - from.totalUnits;
    if (unitsDelta > 0) {
      improvements.push({
        title: 'Higher Finished Production Output',
        detail: `Factory output volume increased from ${from.totalUnits.toLocaleString()} pcs to ${to.totalUnits.toLocaleString()} pcs.`,
        figure: `+${unitsDelta.toLocaleString()} pcs`
      });
    } else if (unitsDelta < 0) {
      shortfalls.push({
        title: 'Production Volume Deficit',
        detail: `Factory output volume fell from ${from.totalUnits.toLocaleString()} pcs to ${to.totalUnits.toLocaleString()} pcs.`,
        figure: `-${Math.abs(unitsDelta).toLocaleString()} pcs`
      });
    }

    // 4. Overtime Payroll Drag
    const otCostDelta = to.otCost - from.otCost;
    if (otCostDelta > 0) {
      shortfalls.push({
        title: 'Overtime Payroll Cost Variance',
        detail: `Overtime expenditure increased from ${currency} ${from.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} to ${currency} ${to.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} (${to.otHeadcount} OT staff @ ${to.otHours}h).`,
        figure: `+${currency} ${otCostDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
      });
    } else if (otCostDelta < 0) {
      improvements.push({
        title: 'Overtime Payroll Optimization',
        detail: `Overtime expenditure reduced from ${currency} ${from.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} to ${currency} ${to.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}.`,
        figure: `-${currency} ${Math.abs(otCostDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
      });
    }

    // 5. Total Labour Cost Variance
    const laborDelta = to.totalLaborCost - from.totalLaborCost;
    if (laborDelta > 0 && revDelta <= 0) {
      shortfalls.push({
        title: 'Labour Payroll Cost Drag',
        detail: `Daily total labour cost rose from ${currency} ${from.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} to ${currency} ${to.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} without proportional revenue growth.`,
        figure: `+${currency} ${laborDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
      });
    } else if (laborDelta < 0) {
      improvements.push({
        title: 'Labour Payroll Cost Efficiency',
        detail: `Total labour cost reduced from ${currency} ${from.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} to ${currency} ${to.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}.`,
        figure: `-${currency} ${Math.abs(laborDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
      });
    }

    // 6. Absenteeism
    const absentDelta = to.totalAbsent - from.totalAbsent;
    if (absentDelta > 0) {
      shortfalls.push({
        title: 'Absenteeism Capacity Spike',
        detail: `Unplanned absentees increased from ${from.totalAbsent} to ${to.totalAbsent} workers, impacting floor output capacity.`,
        figure: `+${absentDelta} absentees`
      });
    } else if (absentDelta < 0) {
      improvements.push({
        title: 'Line Attendance & Workforce Reliability',
        detail: `Absenteeism dropped from ${from.totalAbsent} down to ${to.totalAbsent} workers, restoring direct labour capacity.`,
        figure: `-${Math.abs(absentDelta)} absentees`
      });
    }

    // 7. Efficiency
    const effDelta = to.efficiency - from.efficiency;
    if (effDelta > 1.0) {
      improvements.push({
        title: 'Plant Operating Efficiency Gain',
        detail: `Overall factory efficiency improved from ${from.efficiency.toFixed(1)}% to ${to.efficiency.toFixed(1)}%.`,
        figure: `+${effDelta.toFixed(1)}%`
      });
    } else if (effDelta < -1.0) {
      shortfalls.push({
        title: 'Operating Efficiency Drop',
        detail: `Factory operating efficiency declined from ${from.efficiency.toFixed(1)}% to ${to.efficiency.toFixed(1)}%.`,
        figure: `${effDelta.toFixed(1)}%`
      });
    }

    return { improvements, shortfalls };
  };

  const { improvements, shortfalls } = analyzeReasons(fromMetrics, toMetrics, fromSheet, toSheet);
  const hcDiffs = fromSheet && toSheet ? diffDepts(fromSheet.departments, toSheet.departments) : [];
  const earnsDiffs = fromSheet && toSheet ? diffEarnings(fromSheet.earnings, toSheet.earnings) : [];

  // Day-over-day timeline entries for ALL chronological dates
  const timelineLogs: any[] = [];
  for (let i = 1; i < sheets.length; i++) {
    const fS = sheets[i - 1];
    const tS = sheets[i];
    const fM = getSheetMetrics(fS);
    const tM = getSheetMetrics(tS);

    if (fM && tM) {
      const marginDelta = tM.netMargin - fM.netMargin;
      const revDelta = tM.totalRevenue - fM.totalRevenue;
      const laborDelta = tM.totalLaborCost - fM.totalLaborCost;
      const unitsDelta = tM.totalUnits - fM.totalUnits;
      const absentDelta = tM.totalAbsent - fM.totalAbsent;
      const otCostDelta = tM.otCost - fM.otCost;

      const { improvements: dayImps, shortfalls: dayShorts } = analyzeReasons(fM, tM, fS, tS);

      const hcD = diffDepts(fS.departments, tS.departments);
      const earnD = diffEarnings(fS.earnings, tS.earnings);

      timelineLogs.push({
        label: tS.label,
        fromLabel: fS.label,
        fromMetrics: fM,
        toMetrics: tM,
        marginDelta,
        revDelta,
        laborDelta,
        unitsDelta,
        absentDelta,
        otCostDelta,
        isImprovement: marginDelta >= 0,
        dayImps,
        dayShorts,
        itemizedLogs: [...hcD, ...earnD]
      });
    }
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* HEADER COMPARISON WIDGET */}
      <div className="bento-card p-5 sm:p-6 bg-white border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-indigo-600" /> Operational & Data Figures Audit Analysis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare any two shift dates to analyze net profit drivers, revenue shifts, labour cost variances, and production shortfalls.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase">From:</span>
              <select
                value={fromSheetId}
                onChange={(e) => setFromSheetId(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
              >
                {sheets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

            <div className="flex items-center gap-1.5 px-2">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase">To:</span>
              <select
                value={toSheetId}
                onChange={(e) => setToSheetId(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
              >
                {sheets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {fromSheetId === toSheetId ? (
          <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">Select Two Different Shift Dates</p>
            <p className="text-[11px] text-slate-500 mt-1">Choose a starting date and comparison date above to display figures and root cause analysis.</p>
          </div>
        ) : (
          fromMetrics && toMetrics && (
            <div className="space-y-6">
              {/* KEY DATA FIGURES HIGHLIGHT GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Net Shift Margin */}
                {(() => {
                  const mDelta = toMetrics.netMargin - fromMetrics.netMargin;
                  const isPos = mDelta >= 0;
                  return (
                    <div className={`p-3.5 rounded-2xl border ${isPos ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'}`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>Net Shift Margin</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono ${isPos ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                          {isPos ? '+' : ''}{currency} {Math.abs(mDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className={`text-base sm:text-lg font-black font-mono ${isPos ? 'text-emerald-950' : 'text-rose-950'}`}>
                        {currency} {toMetrics.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        From: {currency} {fromMetrics.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} ({fromMetrics.marginPercent.toFixed(1)}%)
                      </div>
                    </div>
                  );
                })()}

                {/* CM Contract Revenue */}
                {(() => {
                  const rDelta = toMetrics.totalRevenue - fromMetrics.totalRevenue;
                  const isPos = rDelta >= 0;
                  return (
                    <div className={`p-3.5 rounded-2xl border ${isPos ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>CM Revenue</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono ${isPos ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                          {isPos ? '+' : ''}{currency} {Math.abs(rDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-indigo-950">
                        {currency} {toMetrics.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        From: {currency} {fromMetrics.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  );
                })()}

                {/* Total Labour Cost */}
                {(() => {
                  const lDelta = toMetrics.totalLaborCost - fromMetrics.totalLaborCost;
                  const isPosCost = lDelta > 0;
                  return (
                    <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>Labour Cost</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono ${isPosCost ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                          {isPosCost ? '+' : ''}{currency} {Math.abs(lDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                        {currency} {toMetrics.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Base: {currency} {toMetrics.baseLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} | OT: {currency} {toMetrics.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  );
                })()}

                {/* Finished Volume & Efficiency */}
                {(() => {
                  const uDelta = toMetrics.totalUnits - fromMetrics.totalUnits;
                  const isPos = uDelta >= 0;
                  return (
                    <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>Production Output</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono ${isPos ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                          {isPos ? '+' : ''}{uDelta.toLocaleString()} pcs
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black font-mono text-slate-900">
                        {toMetrics.totalUnits.toLocaleString()} pcs
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Plant Efficiency: <strong className="text-indigo-900">{toMetrics.efficiency.toFixed(1)}%</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* REASONS FOR IMPROVEMENT & SHORTFALLS SIDE-BY-SIDE PANELS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* IMPROVEMENTS PANEL */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                    <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" /> Key Reasons for Improvement ({improvements.length})
                    </h3>
                    <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full">
                      Positive Drivers
                    </span>
                  </div>

                  {improvements.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-2">No primary revenue or operational gains recorded between these dates.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {improvements.map((imp, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {imp.title}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-mono text-[10px] font-black rounded-md">
                              {imp.figure}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium pl-4 leading-relaxed">
                            {imp.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SHORTFALLS & COST DRAG PANEL */}
                <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
                    <h3 className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-rose-600" /> Shortfalls & Cost Drag Factors ({shortfalls.length})
                    </h3>
                    <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 bg-rose-100 text-rose-900 rounded-full">
                      Shortfall Drivers
                    </span>
                  </div>

                  {shortfalls.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-2">No operational shortfalls or cost drag factors identified between these dates.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {shortfalls.map((sft, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-rose-200/80 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-rose-950">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              {sft.title}
                            </span>
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-900 font-mono text-[10px] font-black rounded-md">
                              {sft.figure}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium pl-4 leading-relaxed">
                            {sft.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SIDE-BY-SIDE DATA FIGURES VARIANCE TABLE */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pt-2">
                  <Activity className="w-4 h-4 text-indigo-600" /> Data Figures Variance Breakdown
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs bg-white">
                  <table className="w-full min-w-[620px] text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-indigo-950 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="p-3 font-sans">Operational Metric</th>
                        <th className="p-3 text-right font-sans">{fromMetrics.label}</th>
                        <th className="p-3 text-right font-sans">{toMetrics.label}</th>
                        <th className="p-3 text-right font-sans">Variance ($\Delta$)</th>
                        <th className="p-3 text-left font-sans">Impact Direction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {/* CM Revenue */}
                      <tr className="hover:bg-slate-50 font-bold">
                        <td className="p-3 font-sans text-slate-900">CM Contract Revenue</td>
                        <td className="p-3 text-right">{currency} {fromMetrics.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right">{currency} {toMetrics.totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className={`p-3 text-right font-black ${toMetrics.totalRevenue >= fromMetrics.totalRevenue ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {toMetrics.totalRevenue >= fromMetrics.totalRevenue ? '+' : ''}{currency} {(toMetrics.totalRevenue - fromMetrics.totalRevenue).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 font-sans">
                          {toMetrics.totalRevenue >= fromMetrics.totalRevenue ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Revenue Growth</span>
                          ) : (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Revenue Deficit</span>
                          )}
                        </td>
                      </tr>

                      {/* Base Labour Cost */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-sans text-slate-700">Base Labour Cost (Perm + Temp)</td>
                        <td className="p-3 text-right">{currency} {fromMetrics.baseLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right">{currency} {toMetrics.baseLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right text-slate-800">
                          {(toMetrics.baseLaborCost - fromMetrics.baseLaborCost) >= 0 ? '+' : ''}{currency} {(toMetrics.baseLaborCost - fromMetrics.baseLaborCost).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 font-sans text-slate-500">
                          {toMetrics.baseLaborCost > fromMetrics.baseLaborCost ? 'Higher Base Wages' : 'Base Cost Neutral/Saved'}
                        </td>
                      </tr>

                      {/* Overtime Cost */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-sans text-slate-700">Overtime Payroll Cost</td>
                        <td className="p-3 text-right">{currency} {fromMetrics.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right">{currency} {toMetrics.otCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className={`p-3 text-right font-bold ${toMetrics.otCost > fromMetrics.otCost ? 'text-amber-700' : 'text-emerald-600'}`}>
                          {(toMetrics.otCost - fromMetrics.otCost) >= 0 ? '+' : ''}{currency} {(toMetrics.otCost - fromMetrics.otCost).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 font-sans">
                          {toMetrics.otCost > fromMetrics.otCost ? (
                            <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">OT Cost Drag</span>
                          ) : (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">OT Optimization</span>
                          )}
                        </td>
                      </tr>

                      {/* Total Labour Cost */}
                      <tr className="hover:bg-slate-50 font-bold bg-slate-50/50">
                        <td className="p-3 font-sans text-slate-900">Total Labour Expenditure</td>
                        <td className="p-3 text-right">{currency} {fromMetrics.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right">{currency} {toMetrics.totalLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right text-slate-900">
                          {(toMetrics.totalLaborCost - fromMetrics.totalLaborCost) >= 0 ? '+' : ''}{currency} {(toMetrics.totalLaborCost - fromMetrics.totalLaborCost).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 font-sans text-slate-500">
                          Combined Base & OT Shift Cost
                        </td>
                      </tr>

                      {/* Net Shift Margin */}
                      <tr className="hover:bg-slate-50 font-black bg-indigo-50/30">
                        <td className="p-3 font-sans text-indigo-950">Net Shift Margin</td>
                        <td className="p-3 text-right text-indigo-950">{currency} {fromMetrics.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className="p-3 text-right text-indigo-950">{currency} {toMetrics.netMargin.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                        <td className={`p-3 text-right ${toMetrics.netMargin >= fromMetrics.netMargin ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {toMetrics.netMargin >= fromMetrics.netMargin ? '+' : ''}{currency} {(toMetrics.netMargin - fromMetrics.netMargin).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 font-sans">
                          {toMetrics.netMargin >= fromMetrics.netMargin ? (
                            <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">Margin Improved</span>
                          ) : (
                            <span className="text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded">Margin Shortfall</span>
                          )}
                        </td>
                      </tr>

                      {/* Total Working Headcount */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-sans text-slate-700">Present Staff (Perm + Temp)</td>
                        <td className="p-3 text-right">{fromMetrics.totalHeadcount} ops</td>
                        <td className="p-3 text-right">{toMetrics.totalHeadcount} ops</td>
                        <td className="p-3 text-right text-slate-800">
                          {(toMetrics.totalHeadcount - fromMetrics.totalHeadcount) >= 0 ? '+' : ''}{toMetrics.totalHeadcount - fromMetrics.totalHeadcount} ops
                        </td>
                        <td className="p-3 font-sans text-slate-500">
                          Perm: {toMetrics.permCount} | Temp: {toMetrics.tempCount}
                        </td>
                      </tr>

                      {/* Absenteeism */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-sans text-slate-700">Absenteeism</td>
                        <td className="p-3 text-right">{fromMetrics.totalAbsent} absentees</td>
                        <td className="p-3 text-right">{toMetrics.totalAbsent} absentees</td>
                        <td className={`p-3 text-right font-bold ${toMetrics.totalAbsent <= fromMetrics.totalAbsent ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {(toMetrics.totalAbsent - fromMetrics.totalAbsent) >= 0 ? '+' : ''}{toMetrics.totalAbsent - fromMetrics.totalAbsent}
                        </td>
                        <td className="p-3 font-sans text-slate-500">
                          {toMetrics.totalAbsent > fromMetrics.totalAbsent ? 'Higher Absent Shortfall' : 'Attendance Improved'}
                        </td>
                      </tr>

                      {/* Production Volume (Pcs) */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-sans text-slate-700">Finished Output Units</td>
                        <td className="p-3 text-right">{fromMetrics.totalUnits.toLocaleString()} pcs</td>
                        <td className="p-3 text-right">{toMetrics.totalUnits.toLocaleString()} pcs</td>
                        <td className={`p-3 text-right font-bold ${toMetrics.totalUnits >= fromMetrics.totalUnits ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {(toMetrics.totalUnits - fromMetrics.totalUnits) >= 0 ? '+' : ''}{(toMetrics.totalUnits - fromMetrics.totalUnits).toLocaleString()} pcs
                        </td>
                        <td className="p-3 font-sans text-slate-500">
                          Total contract output produced
                        </td>
                      </tr>

                      {/* Plant Efficiency */}
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-sans text-slate-700">Plant Operating Efficiency</td>
                        <td className="p-3 text-right">{fromMetrics.efficiency.toFixed(1)}%</td>
                        <td className="p-3 text-right">{toMetrics.efficiency.toFixed(1)}%</td>
                        <td className={`p-3 text-right font-bold ${(toMetrics.efficiency - fromMetrics.efficiency) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {(toMetrics.efficiency - fromMetrics.efficiency) >= 0 ? '+' : ''}{(toMetrics.efficiency - fromMetrics.efficiency).toFixed(1)}%
                        </td>
                        <td className="p-3 font-sans text-slate-500">
                          SAH Earned vs Worked Hours
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ITEMIZED ROSTER & CONTRACT ADJUSTMENTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Roster / Headcount changes */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" /> Department Staffing Adjustments ({hcDiffs.length})
                  </h4>
                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs bg-white">
                    {hcDiffs.length === 0 ? (
                      <p className="p-4 text-slate-400 italic text-[11px]">No headcount or role changes between these two shift dates.</p>
                    ) : (
                      hcDiffs.map((diff: any, idx: number) => (
                        <div key={idx} className="p-2.5 flex items-start gap-2 hover:bg-slate-50">
                          {diff.isPositive ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                          )}
                          <span className="text-slate-700 font-medium text-[11px]">{diff.desc}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* CMT Earnings / Production shifts */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" /> CMT Contract Output Adjustments ({earnsDiffs.length})
                  </h4>
                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs bg-white">
                    {earnsDiffs.length === 0 ? (
                      <p className="p-4 text-slate-400 italic text-[11px]">No style output, CM rates, or SMVs changed between these dates.</p>
                    ) : (
                      earnsDiffs.map((diff: any, idx: number) => (
                        <div key={idx} className="p-2.5 flex items-start gap-2 hover:bg-slate-50">
                          {diff.isPositive ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                          )}
                          <span className="text-slate-700 font-medium text-[11px]">{diff.desc}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* DAY-OVER-DAY SHIFT AUDIT TIMELINE (ALL DATES) */}
      <div className="bento-card p-5 sm:p-6 bg-white border border-slate-200 rounded-3xl shadow-xs">
        <div className="border-b border-slate-200/80 pb-3 mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Day-Over-Day Shift Audit Logs (2026 Timeline)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log tracking performance improvements, shortfalls, revenue changes, and staffing adjustments across consecutive dates.
            </p>
          </div>
          <span className="text-[10px] font-extrabold font-mono px-2.5 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-full">
            {timelineLogs.length} Consecutive Transitions
          </span>
        </div>

        <div className="relative border-l-2 border-indigo-200 pl-4 sm:pl-6 ml-2 space-y-6">
          {timelineLogs.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No consecutive operational dates loaded yet.</p>
          ) : (
            timelineLogs.map((log: any, idx: number) => (
              <div key={idx} className="relative group">
                {/* Timeline Dot */}
                <div className={`absolute -left-[23px] sm:-left-[31px] top-1.5 h-4 w-4 rounded-full border-2 bg-white ${
                  log.isImprovement ? 'border-emerald-500 group-hover:bg-emerald-600' : 'border-rose-500 group-hover:bg-rose-600'
                } transition-colors shadow-2xs`} />

                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{log.label}</span>
                      <span className="text-[10px] font-mono text-slate-500">vs {log.fromLabel}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono flex items-center gap-1 ${
                        log.isImprovement 
                          ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' 
                          : 'bg-rose-100 text-rose-950 border border-rose-300'
                      }`}>
                        {log.isImprovement ? (
                          <>
                            <TrendingUp className="w-3 h-3 text-emerald-700" /> IMPROVEMENT (+{currency} {log.marginDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })})
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3 text-rose-700" /> SHORTFALL (-{currency} {Math.abs(log.marginDelta).toLocaleString('en-ZA', { maximumFractionDigits: 0 })})
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-sans font-bold text-slate-400 block uppercase">CM Revenue Shift</span>
                      <span className={`font-bold ${log.revDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {log.revDelta >= 0 ? '+' : ''}{currency} {log.revDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-sans font-bold text-slate-400 block uppercase">Labour Cost Shift</span>
                      <span className={`font-bold ${log.laborDelta > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                        {log.laborDelta >= 0 ? '+' : ''}{currency} {log.laborDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-sans font-bold text-slate-400 block uppercase">Net Profit Margin</span>
                      <span className={`font-bold ${log.marginDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {log.marginDelta >= 0 ? '+' : ''}{currency} {log.marginDelta.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[9px] font-sans font-bold text-slate-400 block uppercase">Finished Output</span>
                      <span className={`font-bold ${log.unitsDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {log.unitsDelta >= 0 ? '+' : ''}{log.unitsDelta.toLocaleString()} pcs
                      </span>
                    </div>
                  </div>

                  {/* Primary Reasons / Drivers List */}
                  {(log.dayImps.length > 0 || log.dayShorts.length > 0) && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Key Data Figures & Operational Drivers:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {log.dayImps.map((imp: any, iIdx: number) => (
                          <span key={`imp_${iIdx}`} className="text-[10.5px] px-2.5 py-1 rounded-lg font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <strong>{imp.title}:</strong> {imp.figure}
                          </span>
                        ))}
                        {log.dayShorts.map((sft: any, sIdx: number) => (
                          <span key={`sft_${sIdx}`} className="text-[10.5px] px-2.5 py-1 rounded-lg font-semibold bg-rose-50 text-rose-900 border border-rose-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <strong>{sft.title}:</strong> {sft.figure}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Itemized changes summary */}
                  {log.itemizedLogs.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Itemized Changes ({log.itemizedLogs.length}):</span>
                        {log.itemizedLogs.slice(0, 3).map((item: any, itemIdx: number) => (
                          <span key={itemIdx} className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            {item.desc}
                          </span>
                        ))}
                        {log.itemizedLogs.length > 3 && (
                          <span className="text-[10px] font-bold text-indigo-700">
                            +{log.itemizedLogs.length - 3} more adjustments
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
