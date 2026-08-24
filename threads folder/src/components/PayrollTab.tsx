import React, { useState } from 'react';
import { SheetData, PayrollParams } from '../types';
import { Calendar, Percent, PiggyBank, Briefcase, Calculator, Users, Zap, Clock } from 'lucide-react';
import { PRODUCTION_WAGE_BENCHMARKS } from '../data/initialData';
import BatchWageUpdateModal from './BatchWageUpdateModal';

interface PayrollTabProps {
  sheet: SheetData;
  sheets?: SheetData[];
  onUpdateSheet?: (updated: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  payrollParams: PayrollParams;
  onUpdatePayrollParams: (params: PayrollParams) => void;
  canEditOverheads: boolean; // Finance and Admin can edit
  canEditWages?: boolean;
  currency: string;
}

const OT_MULTIPLIER = 1.5;
const WEEKEND_MULTIPLIER = 2.0;

export default function PayrollTab({
  sheet,
  sheets = [],
  onUpdateSheet,
  onUpdateAllSheets,
  payrollParams,
  onUpdatePayrollParams,
  canEditOverheads,
  canEditWages = true,
  currency
}: PayrollTabProps) {
  const [mDays, setMDays] = useState(payrollParams.monthDays);
  const [wDays, setWDays] = useState(payrollParams.weekendDays);
  const [otHours, setOtHours] = useState(payrollParams.otHours);
  const [showBatchWageModal, setShowBatchWageModal] = useState(false);

  const regDays = Math.max(0, mDays - wDays);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePayrollParams({
      monthDays: mDays,
      weekendDays: wDays,
      otHours: otHours
    });
  };

  // Calculate Monthly Wage for a Role
  const calculateRolePayroll = (perm: number, temp: number, permWage: number, tempWage: number) => {
    // Perm: Regular Days + Weekend Days (2.0x) + OT hours (1.5x of daily hourly rate, assuming 9 hour day)
    // Daily hourly rate = Daily Wage / 9
    const permHourly = permWage / 9;
    const tempHourly = tempWage / 9;

    const permReg = perm * permWage * regDays;
    const permWkend = perm * permWage * WEEKEND_MULTIPLIER * wDays;
    const permOt = perm * permHourly * OT_MULTIPLIER * otHours;

    const tempReg = temp * tempWage * regDays;
    const tempWkend = temp * tempWage * WEEKEND_MULTIPLIER * wDays;
    const tempOt = temp * tempHourly * OT_MULTIPLIER * otHours;

    return {
      permMonthly: permReg + permWkend + permOt,
      tempMonthly: tempReg + tempWkend + tempOt
    };
  };

  let totalPermMonthly = 0;
  let totalTempMonthly = 0;
  let totalPayroll = 0;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Pay Cycle Standard Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3">
        <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
        <div className="text-xs text-indigo-900">
          <strong className="font-extrabold uppercase tracking-wider block">Standardized Monthly Pay Cycle (21st – 20th):</strong>
          Payroll projections and wage allocations run from the 21st of each month through the 20th of the following month.
        </div>
      </div>

      {/* Production Department Calculated Wage Benchmark Summary */}
      <div className="bento-card p-5 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 border-emerald-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b border-emerald-200/60 pb-2 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Production Department Wage Benchmarks (From 41 Staff Dataset)
              </h3>
              <p className="text-[10px] text-emerald-700">Calculated overall average daily wage and role breakdowns</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEditWages && onUpdateSheet && (
              <button
                type="button"
                onClick={() => setShowBatchWageModal(true)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                <span>Batch Increase Base Wages (% Adjust)</span>
              </button>
            )}
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-full font-mono">
              Overall Avg: {currency} {PRODUCTION_WAGE_BENCHMARKS.OVERALL_AVG.toFixed(2)} / day
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Dept Overall Avg</span>
            <span className="text-sm font-extrabold text-emerald-800 font-mono mt-0.5 block">
              {currency} {PRODUCTION_WAGE_BENCHMARKS.OVERALL_AVG.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-400">41 staff total</span>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Machine Operators (MO)</span>
            <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block">
              {currency} {PRODUCTION_WAGE_BENCHMARKS.MO_AVG.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-400">32 MOs (25 @ R158.15, 7 @ R152.30)</span>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Supervisors</span>
            <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block">
              {currency} {PRODUCTION_WAGE_BENCHMARKS.SUPERVISOR_AVG.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-400">1 Supervisor</span>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Checking Staff</span>
            <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block">
              {currency} {PRODUCTION_WAGE_BENCHMARKS.CHECKING_AVG.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-400">3 Checkers</span>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Iron / Pack / Score</span>
            <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block">
              {currency} {PRODUCTION_WAGE_BENCHMARKS.GENERAL_AVG.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-400">7 Auxiliary staff</span>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Daily Wage Bill</span>
            <span className="text-sm font-extrabold text-indigo-700 font-mono mt-0.5 block">
              {currency} {PRODUCTION_WAGE_BENCHMARKS.TOTAL_DAILY_WAGE.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-slate-400">Sum for 41 staff</span>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bento-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Monthly Payroll Projection & Weekday Overtime Parameters
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Standard weekday shift: <strong>08:00 to 17:00 (5:00 PM)</strong> = 9.0 Hours Regular. <strong>Overtime starts after 5:00 PM</strong> at 1.5× rate.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-amber-900 text-xs font-bold shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-current" />
            <span>Weekday OT: After 5 PM @ 1.5×</span>
          </div>
        </div>

        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Total Calendar Days</label>
              <input
                type="number"
                value={mDays}
                onChange={(e) => setMDays(Math.max(1, Math.min(31, parseInt(e.target.value) || 26)))}
                disabled={!canEditOverheads}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Weekend Overtime Days (2.0×)</label>
              <input
                type="number"
                value={wDays}
                onChange={(e) => setWDays(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                disabled={!canEditOverheads}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">
                  Weekday OT Hrs/Worker (After 5 PM @ 1.5×)
                </label>
              </div>
              <input
                type="number"
                value={otHours}
                onChange={(e) => setOtHours(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                disabled={!canEditOverheads}
                placeholder="e.g. 44 hrs"
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 text-slate-900 font-bold rounded-xl font-mono focus:ring-2 focus:ring-amber-500 text-sm focus:outline-none"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={!canEditOverheads}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-bold transition h-[38px] shadow-xs cursor-pointer text-white"
              >
                Apply Projection
              </button>
            </div>
          </div>

          {/* Weekday OT Quick Presets & Guidance */}
          {canEditOverheads && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  <strong>Quick Estimator:</strong> Weekdays past 5:00 PM (e.g., 5 PM – 7 PM = 2 hrs/day OT).
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Presets:</span>
                <button
                  type="button"
                  onClick={() => setOtHours(22)} // 1 hr/day for 22 days
                  className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 rounded-lg text-[10px] font-bold font-mono cursor-pointer transition"
                >
                  +1h/day (22 hrs/mo)
                </button>
                <button
                  type="button"
                  onClick={() => setOtHours(44)} // 2 hrs/day for 22 days
                  className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 rounded-lg text-[10px] font-bold font-mono cursor-pointer transition"
                >
                  +2h/day (44 hrs/mo)
                </button>
                <button
                  type="button"
                  onClick={() => setOtHours(66)} // 3 hrs/day for 22 days
                  className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 rounded-lg text-[10px] font-bold font-mono cursor-pointer transition"
                >
                  +3h/day (66 hrs/mo)
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Computed KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pre-calculate totals for KPIs */}
        {sheet.departments.forEach(d => {
          d.roles.forEach(r => {
            const { permMonthly, tempMonthly } = calculateRolePayroll(r.perm, r.temp, r.permWage, r.tempWage);
            totalPermMonthly += permMonthly;
            totalTempMonthly += tempMonthly;
          });
        })}
        {(() => {
          totalPayroll = totalPermMonthly + totalTempMonthly;
          return null;
        })()}

        <div className="bento-card p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Projected Monthly Wages</p>
          <h4 className="text-2xl font-extrabold text-indigo-700 mt-2 font-mono">
            {currency} {totalPayroll.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[10px] text-slate-500 mt-1">Regular + Weekday OT + Weekend</p>
        </div>

        <div className="bento-card p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Regular Base Shift Days</p>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            {regDays} days
          </h4>
          <p className="text-[10px] text-slate-500 mt-1">08:00 – 17:00 (1.0× Std Rate)</p>
        </div>

        <div className="bento-card p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Weekend Overtime Days</p>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            {payrollParams.weekendDays} days
          </h4>
          <p className="text-[10px] text-slate-500 mt-1">Double-time multiplier (2.0×)</p>
        </div>

        <div className="bento-card p-4 bg-amber-50/40 border-amber-200">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-600 fill-current" /> Weekday OT (After 5 PM)
          </p>
          <h4 className="text-2xl font-extrabold text-amber-950 mt-2 font-mono">
            {payrollParams.otHours} hours
          </h4>
          <p className="text-[10px] text-amber-800 mt-1">Time-and-a-half (1.5× past 17:00)</p>
        </div>
      </div>

      {/* Main Breakdown Table */}
      <div className="bento-card p-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">
          Wages Projection Breakdown by Department
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-indigo-800 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3">Role Code</th>
                <th className="p-3 text-right">Perm headcount</th>
                <th className="p-3 text-right">Temp headcount</th>
                <th className="p-3 text-right">Perm Wages / month</th>
                <th className="p-3 text-right">Temp Wages / month</th>
                <th className="p-3 text-right">Total Payroll / month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {sheet.departments.map((d) => {
                const activeRoles = d.roles.filter(r => r.perm > 0 || r.temp > 0);
                if (activeRoles.length === 0) return null;

                let deptSum = 0;

                return (
                  <React.Fragment key={d.id}>
                    {/* Department Subheader */}
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <td className="p-2.5 font-extrabold text-indigo-900 uppercase text-[11px]" colSpan={6}>
                        📁 {d.name}
                      </td>
                    </tr>
                    {activeRoles.map((r) => {
                      const { permMonthly, tempMonthly } = calculateRolePayroll(r.perm, r.temp, r.permWage, r.tempWage);
                      const rowTotal = permMonthly + tempMonthly;
                      deptSum += rowTotal;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition text-slate-800 font-medium">
                          <td className="p-3 pl-6 font-semibold text-slate-900">{r.title}</td>
                          <td className="p-3 text-right font-mono text-slate-700">{r.perm}</td>
                          <td className="p-3 text-right font-mono text-slate-700">{r.temp}</td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            {currency} {permMonthly.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            {currency} {tempMonthly.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {currency} {rowTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                <td className="p-3 text-indigo-800 uppercase tracking-wider">GRAND TOTAL PROJECTED</td>
                <td colSpan={2}></td>
                <td className="p-3 text-right font-mono text-slate-700">{currency} {totalPermMonthly.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                <td className="p-3 text-right font-mono text-slate-700">{currency} {totalTempMonthly.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</td>
                <td className="p-3 text-right font-mono text-indigo-700 font-bold">
                  {currency} {totalPayroll.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Batch Wage Adjustment Modal */}
      {onUpdateSheet && (
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
      )}
    </div>
  );
}
