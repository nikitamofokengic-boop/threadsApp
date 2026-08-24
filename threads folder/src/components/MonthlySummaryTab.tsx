import React, { useState } from 'react';
import { SheetData, Overheads } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity, 
  BarChart3, 
  Calendar, 
  Package, 
  Award, 
  PieChart as PieIcon, 
  CheckCircle2, 
  Printer, 
  Filter,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  getAllPayCyclesFromSheets, 
  isDateInPayCycle, 
  getPayCycleForDate,
  getDayInfo,
  parseDateLabelToDate,
  calculateSheetLaborCostBreakdown
} from '../utils/payCycle';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  LineChart, 
  BarChart, 
  PieChart, 
  Pie, 
  Cell, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine, 
  AreaChart, 
  Area 
} from 'recharts';

interface MonthlySummaryTabProps {
  sheets: SheetData[];
  overheads: Overheads;
  currency: string;
}

export default function MonthlySummaryTab({ sheets, overheads, currency }: MonthlySummaryTabProps) {
  // Pay cycles generated dynamically from sheets
  const payCycles = getAllPayCyclesFromSheets(sheets || []);
  
  // Default selected cycle to the pay cycle containing the active shift sheets (e.g. 21 JUL - 20 AUG 2026)
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => {
    if (sheets && sheets.length > 0) {
      const activeCycle = getPayCycleForDate(sheets[0].label);
      if (activeCycle && payCycles.some(c => c.id === activeCycle.id)) {
        return activeCycle.id;
      }
    }
    const julAug = payCycles.find(c => c.id === 'JUL_AUG_2026');
    if (julAug) return julAug.id;
    return payCycles.length > 0 ? payCycles[0].id : 'ALL';
  });

  // Active cycle object
  const activeCycleInfo = payCycles.find(c => c.id === selectedCycleId);

  // Filter sheets for selected pay cycle and sort chronologically
  const cycleSheets = (sheets || [])
    .filter(s => {
      if (selectedCycleId === 'ALL') return true;
      return isDateInPayCycle(s.label, selectedCycleId);
    })
    .sort((a, b) => parseDateLabelToDate(a.label).getTime() - parseDateLabelToDate(b.label).getTime());

  // Amortized daily overhead (assumes 22 working days per month)
  const totalMonthlyOH = overheads ? (overheads.rent + overheads.utilities + overheads.admin + overheads.other) : 0;
  const overheadDaily = totalMonthlyOH / 22;

  // 1. Compute Expected Revenue & Planned Target Volume directly from Style Revenue specifications
  let totalExpectedRevenue = 0;
  let totalPlannedUnits = 0;

  if (selectedCycleId === 'ALL') {
    payCycles.forEach(cycle => {
      const sheetsInC = (sheets || []).filter(s => isDateInPayCycle(s.label, cycle.id));
      if (sheetsInC.length > 0) {
        const refEarnings = sheetsInC[0].earnings;
        refEarnings.forEach(e => {
          const defaultPlanned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
          const plannedQty = e.plannedQty ?? defaultPlanned;
          totalPlannedUnits += plannedQty;
          totalExpectedRevenue += (plannedQty * e.cmPrice);
        });
      }
    });
  } else {
    if (cycleSheets.length > 0) {
      const refEarnings = cycleSheets[0].earnings;
      refEarnings.forEach(e => {
        const defaultPlanned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
        const plannedQty = e.plannedQty ?? defaultPlanned;
        totalPlannedUnits += plannedQty;
        totalExpectedRevenue += (plannedQty * e.cmPrice);
      });
    }
  }

  // Process day-by-day aggregated metric data for charts and ledger
  let totalRevenue = 0;
  let totalLabourCost = 0;
  let totalUnits = 0;
  let totalSahEarned = 0;
  let totalSahCapacity = 0;

  const chartData = cycleSheets.map(s => {
    // 1. Revenue & Planned Volume
    let dayRevenue = 0;
    let dayExpectedRevenue = 0;
    let dayUnits = 0;
    let dayPlannedUnits = 0;

    s.earnings.forEach(e => {
      const defaultPlanned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
      dayUnits += e.qtyProduced;
      dayPlannedUnits += defaultPlanned;
      dayRevenue += (e.qtyProduced * e.cmPrice);
      dayExpectedRevenue += (defaultPlanned * e.cmPrice);
    });

    // 2. Labour Cost
    const sBreakdown = calculateSheetLaborCostBreakdown(s);
    const dayWages = sBreakdown.totalLaborCost;
    const dayHeadcount = sBreakdown.totalHeadcount;

    // 3. SAH & Efficiency
    const stdHrs = s.standardShiftHours || 9.0;
    let daySahEarned = 0;
    let daySahCapacity = 0;
    (s.sahData || []).forEach(r => {
      daySahEarned += (r.output * r.smv) / 60;
      daySahCapacity += r.mos * (r.shiftHours || stdHrs);
    });

    const dayNet = dayRevenue - dayWages - overheadDaily;
    const dayEfficiency = daySahCapacity > 0 ? (daySahEarned / daySahCapacity * 100) : 0;
    const dayMargin = dayRevenue > 0 ? (dayNet / dayRevenue * 100) : 0;
    const dayRevVariance = dayRevenue - dayExpectedRevenue;

    totalRevenue += dayRevenue;
    totalLabourCost += dayWages;
    totalUnits += dayUnits;
    totalSahEarned += daySahEarned;
    totalSahCapacity += daySahCapacity;

    // Short date label for x-axis chart (e.g. "21 JUL" from "21 JULY 2026")
    const dateParts = s.label.trim().split(' ');
    const shortLabel = dateParts.length >= 2 ? `${dateParts[0]} ${dateParts[1].slice(0, 3)}` : s.label;

    return {
      id: s.id,
      fullDate: s.label,
      shortDate: shortLabel,
      revenue: Math.round(dayRevenue),
      expectedRevenue: Math.round(dayExpectedRevenue),
      revenueVariance: Math.round(dayRevVariance),
      labourCost: Math.round(dayWages),
      overheads: Math.round(overheadDaily),
      totalExpenses: Math.round(dayWages + overheadDaily),
      netProfit: Math.round(dayNet),
      units: dayUnits,
      plannedUnits: dayPlannedUnits,
      targetEfficiency: 75.0,
      efficiency: parseFloat(dayEfficiency.toFixed(1)),
      sahEarned: parseFloat(daySahEarned.toFixed(1)),
      sahCapacity: parseFloat(daySahCapacity.toFixed(1)),
      headcount: dayHeadcount,
      margin: parseFloat(dayMargin.toFixed(1))
    };
  });

  const totalOverheads = overheadDaily * cycleSheets.length;
  const netProfit = totalRevenue - totalLabourCost - totalOverheads;
  const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
  const avgEfficiency = totalSahCapacity > 0 ? (totalSahEarned / totalSahCapacity * 100) : 0;
  const costPerUnit = totalUnits > 0 ? (totalLabourCost / totalUnits) : 0;
  const totalRevenueVariance = totalRevenue - totalExpectedRevenue;
  const revAttainment = totalExpectedRevenue > 0 ? (totalRevenue / totalExpectedRevenue * 100) : 0;
  const qtyAttainment = totalPlannedUnits > 0 ? (totalUnits / totalPlannedUnits * 100) : 0;

  // Aggregated data across all pay cycles for comparative trend analysis
  const payCycleComparisonData = payCycles.map(cycle => {
    const sheetsInCycle = (sheets || []).filter(s => isDateInPayCycle(s.label, cycle.id));
    const refEarnings = sheetsInCycle.length > 0 ? sheetsInCycle[0].earnings : [];
    
    let cycleExpectedRev = 0;
    let cyclePlannedUnits = 0;
    refEarnings.forEach(e => {
      const defaultPlanned = e.plannedQty ?? Math.round(e.qtyProduced > 0 ? e.qtyProduced * 1.15 : 500);
      const plannedQty = e.plannedQty ?? defaultPlanned;
      cyclePlannedUnits += plannedQty;
      cycleExpectedRev += (plannedQty * e.cmPrice);
    });

    let cycleActualRev = 0;
    let cycleActualUnits = 0;
    sheetsInCycle.forEach(s => {
      s.earnings.forEach(e => {
        cycleActualUnits += e.qtyProduced;
        cycleActualRev += (e.qtyProduced * e.cmPrice);
      });
    });

    const variance = cycleActualRev - cycleExpectedRev;
    const attainment = cycleExpectedRev > 0 ? (cycleActualRev / cycleExpectedRev * 100) : 0;

    return {
      cycleId: cycle.id,
      cycleLabel: cycle.shortLabel,
      fullLabel: cycle.label,
      expectedRevenue: Math.round(cycleExpectedRev),
      actualRevenue: Math.round(cycleActualRev),
      revenueVariance: Math.round(variance),
      attainment: parseFloat(attainment.toFixed(1)),
      shiftCount: sheetsInCycle.length,
      isSelected: cycle.id === selectedCycleId
    };
  });

  // Calculate totals across all cycles for comparative macro metrics
  let grandTotalExpectedRev = 0;
  let grandTotalActualRev = 0;
  let topPerformingCycleLabel = '';
  let topPerformingCycleRev = -1;

  payCycleComparisonData.forEach(p => {
    grandTotalExpectedRev += p.expectedRevenue;
    grandTotalActualRev += p.actualRevenue;
    if (p.actualRevenue > topPerformingCycleRev) {
      topPerformingCycleRev = p.actualRevenue;
      topPerformingCycleLabel = p.cycleLabel;
    }
  });

  const grandVariance = grandTotalActualRev - grandTotalExpectedRev;
  const grandAttainment = grandTotalExpectedRev > 0 ? (grandTotalActualRev / grandTotalExpectedRev * 100) : 0;

  // Pie chart data for expense distribution
  const pieExpenseData = [
    { name: 'Labour Wages', value: totalLabourCost, color: '#4f46e5' },
    { name: 'Factory Overheads', value: totalOverheads, color: '#f59e0b' },
    { name: 'Net Profit Margin', value: Math.max(0, netProfit), color: '#10b981' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header & Pay Cycle Selector */}
      <div className="bento-card p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-none shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h1 className="text-lg font-black uppercase tracking-wider text-white">
                Monthly Performance & Analytics Executive Dashboard
              </h1>
            </div>
            <p className="text-xs text-indigo-200 mt-1">
              {activeCycleInfo ? activeCycleInfo.label : 'Aggregated monthly financial analysis across 21st – 20th pay cycles'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pay Cycle Dropdown Selector */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
              <Calendar className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="text-[10px] uppercase font-extrabold text-indigo-200">Cycle:</span>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="text-slate-900">All Logged Pay Cycles</option>
                {payCycles.map(c => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.shortLabel} ({c.startMonthName.slice(0,3)}/{c.endMonthName.slice(0,3)})
                  </option>
                ))}
              </select>
            </div>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition border border-white/20 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-300" /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlights Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Expected Revenue Card */}
        <div className="bento-card p-4 border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Expected Revenue</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-xl font-black text-slate-900 font-mono mt-2">
            {currency} {totalExpectedRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            CM Price × Planned Target Qty
          </p>
        </div>

        {/* Actual CMT Revenue Card */}
        <div className="bento-card p-4 border-indigo-100 bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-900">Actual CMT Revenue</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-xl font-black text-indigo-950 font-mono mt-2">
            {currency} {totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[10px] mt-1 font-bold flex items-center gap-1">
            <span className={totalRevenueVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              {totalRevenueVariance >= 0 ? '+' : ''}{currency} {totalRevenueVariance.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-slate-500 font-medium">({revAttainment.toFixed(1)}% achieved)</span>
          </p>
        </div>

        {/* Production Volume Card */}
        <div className="bento-card p-4 border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Production Volume</span>
            <Package className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 font-mono mt-2">
            {totalUnits.toLocaleString('en-ZA')} pcs
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            Planned: {totalPlannedUnits.toLocaleString('en-ZA')} pcs ({qtyAttainment.toFixed(1)}%)
          </p>
        </div>

        {/* Labour Wages Card */}
        <div className="bento-card p-4 border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Labour Cost</span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 font-mono mt-2">
            {currency} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            {totalRevenue > 0 ? `${(totalLabourCost / totalRevenue * 100).toFixed(1)}% of revenue` : 'Direct wages'}
          </p>
        </div>

        {/* Net Profit Card */}
        <div className={`bento-card p-4 ${netProfit >= 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700">Net Profit</span>
            {netProfit >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <h3 className={`text-xl font-black font-mono mt-2 ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {currency} {netProfit.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </h3>
          <p className={`text-[10px] font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            Margin: {netProfitMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* MACRO SECTION: Comparative Pay Cycle Revenue Performance (Expected vs Actual Revenue Aggregated by Pay Cycle) */}
      <div className="bento-card p-6 bg-white space-y-4 border-indigo-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Pay Cycle Macro Performance: Expected Revenue vs Actual Revenue
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated comparative financial trends across 2026 pay cycles. Click any bar to filter the view to that period.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-black font-mono px-3 py-1 rounded-xl border ${
              grandVariance >= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              Overall Variance: {grandVariance >= 0 ? '+' : ''}{currency} {grandVariance.toLocaleString()}
            </span>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl">
              Overall Attainment: {grandAttainment.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Aggregated Comparative Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={payCycleComparisonData} 
                margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
                onClick={(data: any) => {
                  if (data && data.activePayload && data.activePayload[0]) {
                    const clickedCycleId = data.activePayload[0].payload.cycleId;
                    if (clickedCycleId) setSelectedCycleId(clickedCycleId);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="cycleLabel" 
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px', padding: '12px' }}
                  formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, '']}
                  labelFormatter={(label, items) => {
                    if (items && items[0]) {
                      const payload = items[0].payload;
                      return `${payload.fullLabel} (${payload.shiftCount} logged shifts)`;
                    }
                    return label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar 
                  dataKey="expectedRevenue" 
                  name="Expected Revenue (Style Target)" 
                  fill="#94a3b8" 
                  radius={[6, 6, 0, 0]} 
                  cursor="pointer"
                >
                  {payCycleComparisonData.map((entry, index) => (
                    <Cell 
                      key={`exp-cell-${index}`} 
                      fill={entry.isSelected ? '#64748b' : '#cbd5e1'} 
                      stroke={entry.isSelected ? '#0f172a' : 'none'}
                      strokeWidth={entry.isSelected ? 2 : 0}
                    />
                  ))}
                </Bar>
                <Bar 
                  dataKey="actualRevenue" 
                  name="Actual Realized Revenue" 
                  fill="#4f46e5" 
                  radius={[6, 6, 0, 0]} 
                  cursor="pointer"
                >
                  {payCycleComparisonData.map((entry, index) => (
                    <Cell 
                      key={`act-cell-${index}`} 
                      fill={entry.isSelected ? '#4338ca' : '#6366f1'} 
                      stroke={entry.isSelected ? '#1e1b4b' : 'none'}
                      strokeWidth={entry.isSelected ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Side Performance Insights */}
          <div className="space-y-3 flex flex-col justify-center">
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-indigo-800 tracking-wider">Multi-Period Expected Total</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-indigo-950">{currency} {grandTotalExpectedRev.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-indigo-700">Combined style target values</p>
            </div>

            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">Multi-Period Realized Total</span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-emerald-950">{currency} {grandTotalActualRev.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-emerald-700">{grandAttainment.toFixed(1)}% total attainment</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">Top Revenue Pay Cycle</span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-black text-slate-900">{topPerformingCycleLabel || 'N/A'}</span>
                <span className="text-xs font-mono font-bold text-indigo-700">{currency} {topPerformingCycleRev.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Planned Quantities & Expected vs Actual Revenue Analysis (For Viewers & Executives) */}
      <div className="bento-card p-6 bg-white space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Expected CMT Revenue vs Actual Realized Revenue Comparison
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison of planned production revenue against actual shift earnings (accessible for Viewers & Observers)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-black font-mono px-3 py-1 rounded-xl border ${
              totalRevenueVariance >= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              Variance: {totalRevenueVariance >= 0 ? '+' : ''}{currency} {totalRevenueVariance.toLocaleString()}
            </span>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl">
              Revenue Attainment: {revAttainment.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Expected vs Actual Revenue Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="shortDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="expectedRevenue" name="Expected Revenue (Planned)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="revenue" name="Actual Realized Revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Planned vs Actual Summary Cards */}
          <div className="space-y-3 flex flex-col justify-center">
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-indigo-800 tracking-wider">Planned Production Volume</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-indigo-950">{totalPlannedUnits.toLocaleString()} pcs</span>
                <span className="text-xs font-bold text-indigo-700">Target</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">Actual Output Produced</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-emerald-950">{totalUnits.toLocaleString()} pcs</span>
                <span className="text-xs font-bold text-emerald-700">{qtyAttainment.toFixed(1)}% Attained</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">Production Volume Deficit/Surplus</span>
              <div className="flex items-baseline justify-between">
                <span className={`text-lg font-black font-mono ${totalUnits >= totalPlannedUnits ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {totalUnits >= totalPlannedUnits ? '+' : ''}{(totalUnits - totalPlannedUnits).toLocaleString()} pcs
                </span>
                <span className="text-xs font-semibold text-slate-500">Target Difference</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Industrial Engineering (IE) Line Efficiency Command Center */}
      <div className="bento-card p-6 bg-white space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Industrial Engineering (IE) SAH Line Efficiency & Productivity Benchmarks
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Technical line efficiency analysis against the standard 75.0% target benchmark (for Industrial Engineers & Operations)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
              avgEfficiency >= 75 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              Cycle Efficiency: {avgEfficiency.toFixed(1)}% (Target: 75.0%)
            </span>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 rounded-xl">
              {totalSahEarned.toFixed(1)}h SAH / {totalSahCapacity.toFixed(1)}h Cap
            </span>
          </div>
        </div>

        {/* Line Efficiency Area Chart with 75% Reference Benchmark */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEffIE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="shortDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`${val}%`, 'Actual Line Efficiency']}
                />
                <ReferenceLine y={75} stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" label={{ value: '75% Target Benchmark', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                <ReferenceLine y={100} stroke="#6366f1" strokeWidth={1} strokeDasharray="2 2" label={{ value: '100% Full Capacity', fill: '#6366f1', fontSize: 9, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="efficiency" name="Actual Efficiency %" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorEffIE)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* IE Insights & Summary Panel */}
          <div className="space-y-3 flex flex-col justify-center">
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
              <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-1">Standard 9-Hr Shift Benchmark</h4>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                Line efficiency is calculated against a standardized 9.0-hour shift per operator: <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono font-bold text-indigo-950">(Output × SMV) / (MOS × Shift Hours × 60)</code>.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span>Total Capacity SAH Hours:</span>
                <span className="font-mono font-bold">{totalSahCapacity.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>Earned SAH Production:</span>
                <span className="font-mono font-bold text-indigo-700">{totalSahEarned.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 border-t border-slate-200 pt-2 font-bold">
                <span>Efficiency Variance vs 75%:</span>
                <span className={`font-mono ${avgEfficiency >= 75 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {avgEfficiency >= 75 ? '+' : ''}{(avgEfficiency - 75.0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row 3: Financial Composed Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Revenue, Labour Cost & Net Profit Trend (2 Columns wide) */}
        <div className="lg:col-span-2 bento-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" /> Daily Revenue, Expenses & Net Profit Trend
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Financial performance tracked shift by shift across the 21st to 20th billing cycle
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
              {cycleSheets.length} Shift Logs
            </span>
          </div>

          {chartData.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No shift logs found for this pay cycle. Select another cycle or create shift logs.
            </div>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="shortDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue" name="CMT Revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="labourCost" name="Labour Wages" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="overheads" name="Overheads" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Expense Distribution Pie Chart */}
        <div className="bento-card p-6 bg-white space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-600" /> Revenue & Expense Breakdown
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Proportional distribution of monthly earnings
            </p>
          </div>

          {totalRevenue === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs my-auto">
              No revenue logged in this pay cycle.
            </div>
          ) : (
            <div className="h-56 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieExpenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieExpenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    formatter={(val: any) => [`${currency} ${Number(val).toLocaleString()}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Total Revenue</span>
                <span className="text-xs font-black font-mono text-slate-800">
                  {currency} {totalRevenue.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span> Labour Wages
              </span>
              <span className="font-bold font-mono">{currency} {totalLabourCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Factory Overheads
              </span>
              <span className="font-bold font-mono">{currency} {totalOverheads.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Net Profit Margin
              </span>
              <span className="font-bold font-mono text-emerald-700">{currency} {Math.max(0, netProfit).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row 2: SAH Efficiency Trend & Output Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Line Efficiency Area Chart */}
        <div className="bento-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" /> Daily SAH Line Efficiency % Trend
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Line performance measured against standard target benchmark (75%)
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              avgEfficiency >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              Cycle Avg: {avgEfficiency.toFixed(1)}%
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="shortDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`${val}%`, 'Line Efficiency']}
                />
                <ReferenceLine y={75} stroke="#10b981" strokeDasharray="3 3" label={{ value: '75% Target', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="efficiency" name="Line Efficiency %" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorEff)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Daily Garment Unit Volume */}
        <div className="bento-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" /> Daily Garment Production Output (Pcs)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Physical garment units produced per shift day
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
              Total: {totalUnits.toLocaleString('en-ZA')} pcs
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="shortDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} pcs`, 'Output Units']}
                />
                <Bar dataKey="units" name="Garment Units (Pcs)" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comprehensive Day-by-Day Shift Ledger Table */}
      <div className="bento-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" /> Shift Operations Monthly Ledger (21st – 20th Cycle)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated shift results, headcount, CMT earnings, expenses, SAH hours, and line efficiencies
            </p>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
            {chartData.length} Operational Days
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-indigo-900 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3">Shift Date</th>
                <th className="p-3 text-right">Headcount</th>
                <th className="p-3 text-right">Planned (Pcs)</th>
                <th className="p-3 text-right">Actual (Pcs)</th>
                <th className="p-3 text-right">Expected Revenue</th>
                <th className="p-3 text-right">Actual CMT Revenue</th>
                <th className="p-3 text-right">Revenue Variance</th>
                <th className="p-3 text-right">Labour Wages</th>
                <th className="p-3 text-right">Overheads</th>
                <th className="p-3 text-right">Net Profit</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
              {chartData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    No logged shift data for this pay cycle.
                  </td>
                </tr>
              ) : (
                chartData.map((d) => {
                  const dayInfo = getDayInfo(d.fullDate);
                  return (
                    <tr key={d.id} className={`hover:bg-slate-50 transition ${dayInfo.isHoliday ? 'bg-purple-50/60 border-l-4 border-l-purple-500' : dayInfo.isOvertime ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{d.fullDate}</span>
                          {dayInfo.isHoliday ? (
                            <span className="text-[9px] font-black bg-purple-200 text-purple-950 border border-purple-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-2xs">
                              🇱🇸 {dayInfo.holidayName || 'PAID HOLIDAY'}
                            </span>
                          ) : dayInfo.isOvertime ? (
                            <span className="text-[9px] font-black bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-2xs">
                              ⚡ {dayInfo.badgeText}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                              {dayInfo.dayShort}
                            </span>
                          )}
                        </div>
                      </td>
                    <td className="p-3 text-right font-mono text-slate-700">{d.headcount} ops</td>
                    <td className="p-3 text-right font-mono text-slate-500">{d.plannedUnits.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-900">{d.units.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {currency} {d.expectedRevenue.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-900 font-bold">
                      {currency} {d.revenue.toLocaleString()}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${d.revenueVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {d.revenueVariance >= 0 ? '+' : ''}{currency} {d.revenueVariance.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {currency} {d.labourCost.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-amber-700">
                      {currency} {d.overheads.toLocaleString()}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${d.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {currency} {d.netProfit.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      {d.netProfit >= 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Surplus
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Loss
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
            {chartData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <td className="p-3 uppercase">PAY CYCLE TOTALS</td>
                  <td className="p-3 text-right font-mono">
                    {chartData.reduce((s, d) => s + d.headcount, 0)} ops sum
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600">{totalPlannedUnits.toLocaleString()} pcs</td>
                  <td className="p-3 text-right font-mono text-indigo-900">{totalUnits.toLocaleString()} pcs</td>
                  <td className="p-3 text-right font-mono text-slate-600">
                    {currency} {totalExpectedRevenue.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-900">
                    {currency} {totalRevenue.toLocaleString()}
                  </td>
                  <td className={`p-3 text-right font-mono font-black ${totalRevenueVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {totalRevenueVariance >= 0 ? '+' : ''}{currency} {totalRevenueVariance.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700">
                    {currency} {totalLabourCost.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700">
                    {currency} {totalOverheads.toLocaleString()}
                  </td>
                  <td className={`p-3 text-right font-mono font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {currency} {netProfit.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-bold text-indigo-900">
                    {netProfitMargin.toFixed(1)}% margin
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
