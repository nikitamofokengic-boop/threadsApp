import React, { useState, useMemo } from 'react';
import { 
  SheetData, 
  SubsidiaryAllocation, 
  SubsidiaryProfile, 
  WageSubsidyProgram
} from '../types';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Building,
  Receipt,
  Truck,
  Sparkles,
  Download,
  Calendar
} from 'lucide-react';
import { getDayInfo, extractAndNormalizeDate } from '../utils/payCycle';

interface SubsidiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: SheetData;
  allSheets: SheetData[];
  subsidiaries: SubsidiaryProfile[];
  allocations: SubsidiaryAllocation[];
  subsidyPrograms?: WageSubsidyProgram[];
  onUpdateAllocations: (newAllocations: SubsidiaryAllocation[]) => void;
  onUpdateSubsidiaries?: (newSubsidiaries: SubsidiaryProfile[]) => void;
  onUpdateSubsidyPrograms?: (newPrograms: WageSubsidyProgram[]) => void;
  canEdit: boolean;
  currency: string;
}

export default function SubsidiesPanel({
  isOpen,
  onClose,
  sheet,
  subsidiaries,
  allocations,
  onUpdateAllocations,
  onUpdateSubsidiaries,
  canEdit,
  currency
}: SubsidiesPanelProps) {
  const normalizedActiveDate = extractAndNormalizeDate(sheet.label);

  // Day info for OT rate multiplier detection (1.5x weekdays vs 2.0x weekends/holidays)
  const dayInfo = useMemo(() => {
    return getDayInfo(sheet.label, 9.0 + (sheet.shiftOtHours || 0));
  }, [sheet.label, sheet.shiftOtHours]);

  const defaultMultiplier = (dayInfo.isWeekend || dayInfo.isHoliday) ? 2.0 : 1.5;

  // Active Daily Allocations for this shift date
  const dailyAllocations = useMemo(() => {
    return allocations.filter(a => extractAndNormalizeDate(a.dateLabel) === normalizedActiveDate);
  }, [allocations, normalizedActiveDate]);

  // Modal / Form state for Add or Edit
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingAllocId, setEditingAllocId] = useState<string | null>(null);
  
  // Simple Form Fields: Factory, Permanent, Temporary, Wage, OT, Total Cost
  const [factoryName, setFactoryName] = useState<string>(subsidiaries[0]?.name || 'Quantum 1 Apparel Facility');
  const [factoryCode, setFactoryCode] = useState<string>(subsidiaries[0]?.code || 'QUANTUM-1');
  const [headcountPerm, setHeadcountPerm] = useState<number>(10);
  const [headcountTemp, setHeadcountTemp] = useState<number>(0);
  const [dailyWagePerm, setDailyWagePerm] = useState<number>(146.00);
  const [dailyWageTemp, setDailyWageTemp] = useState<number>(125.95);
  const [otHours, setOtHours] = useState<number>(1.5);
  const [includeOt, setIncludeOt] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [isQ1Delay, setIsQ1Delay] = useState<boolean>(false);

  // Totals for this shift date
  const totals = useMemo(() => {
    let totalPerm = 0;
    let totalTemp = 0;
    let totalCost = 0;

    dailyAllocations.forEach(a => {
      const p = a.headcountPerm || 0;
      const t = a.tempWorkersHired ?? a.headcountTemp ?? 0;
      totalPerm += p;
      totalTemp += t;

      const pWage = a.dailyWagePerPerson || 146.00;
      const tWage = a.tempWorkersDailyWage || 125.95;
      const baseCost = a.totalCost ?? ((p * pWage) + (t * tWage));

      const otHrs = a.delayOtHours ?? a.otHours ?? 0;
      const otStaff = a.delayOtWorkersCount ?? (p + t);
      const hourly = pWage / 9.0;
      const otCost = a.delayOtCost ?? a.otCost ?? (otHrs > 0 ? (otStaff * otHrs * hourly * defaultMultiplier) : 0);

      const itemTotal = a.totalDelaySurcharge ?? (baseCost + otCost);
      totalCost += itemTotal;
    });

    return {
      totalPerm,
      totalTemp,
      totalHeadcount: totalPerm + totalTemp,
      totalCost,
      factoryCount: new Set(dailyAllocations.map(a => a.subsidiaryCode || a.subsidiaryName)).size
    };
  }, [dailyAllocations, defaultMultiplier]);

  // Open modal to add a new Factory row
  const handleOpenAdd = (defaultFactoryCode?: string) => {
    setEditingAllocId(null);
    const matched = subsidiaries.find(s => s.code === defaultFactoryCode) || subsidiaries[0];
    setFactoryCode(matched?.code || 'QUANTUM-1');
    setFactoryName(matched?.name || 'Quantum 1 Apparel Facility');
    setHeadcountPerm(matched?.defaultHeadcount || 10);
    setHeadcountTemp(0);
    setDailyWagePerm(matched?.defaultDailyWage || 146.00);
    setDailyWageTemp(125.95);
    setOtHours(matched?.defaultOtHours || 1.5);
    setIncludeOt(false);
    setNote('');
    setIsQ1Delay(false);
    setShowFormModal(true);
  };

  // Open modal for Q1 Raw Material Delay quick entry
  const handleOpenQ1Delay = () => {
    setEditingAllocId(null);
    const q1 = subsidiaries.find(s => s.code === 'QUANTUM-1') || { name: 'Quantum 1 (Raw Materials Dept)', code: 'QUANTUM-1' };
    setFactoryCode(q1.code);
    setFactoryName('Quantum 1 (Raw Materials Delay)');
    setHeadcountPerm(0);
    setHeadcountTemp(8);
    setDailyWagePerm(146.00);
    setDailyWageTemp(125.95);
    setOtHours(1.5);
    setIncludeOt(true);
    setNote('Late fabric & trims arrival from Q1 Raw Materials Dept');
    setIsQ1Delay(true);
    setShowFormModal(true);
  };

  // Open modal to edit existing row
  const handleOpenEdit = (alloc: SubsidiaryAllocation) => {
    setEditingAllocId(alloc.id);
    setFactoryCode(alloc.subsidiaryCode || 'QUANTUM-1');
    setFactoryName(alloc.subsidiaryName || alloc.subsidiaryCode);
    setHeadcountPerm(alloc.headcountPerm || 0);
    setHeadcountTemp(alloc.tempWorkersHired ?? alloc.headcountTemp ?? 0);
    setDailyWagePerm(alloc.dailyWagePerPerson || 146.00);
    setDailyWageTemp(alloc.tempWorkersDailyWage || 125.95);
    const hasOt = Boolean((alloc.otHours && alloc.otHours > 0) || (alloc.delayOtHours && alloc.delayOtHours > 0));
    setIncludeOt(hasOt);
    setOtHours(alloc.delayOtHours ?? alloc.otHours ?? 1.5);
    setNote(alloc.delayReason || alloc.projectNote || '');
    setIsQ1Delay(alloc.allocationType === 'q1_raw_material_delay' || Boolean(alloc.delayReason));
    setShowFormModal(true);
  };

  // Delete row
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this factory entry?")) {
      onUpdateAllocations(allocations.filter(a => a.id !== id));
    }
  };

  // Save row
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    const pCount = Number(headcountPerm) || 0;
    const tCount = Number(headcountTemp) || 0;
    const totalHc = pCount + tCount;

    if (totalHc <= 0) {
      alert("Please enter at least 1 Permanent or Temporary worker.");
      return;
    }

    const pWage = Number(dailyWagePerm) || 146.00;
    const tWage = Number(dailyWageTemp) || 125.95;
    const baseCost = (pCount * pWage) + (tCount * tWage);

    const otHrs = includeOt ? (Number(otHours) || 0) : 0;
    const hourly = pWage / 9.0;
    const otCost = otHrs > 0 ? (totalHc * otHrs * hourly * defaultMultiplier) : 0;
    const totalCostCalc = baseCost + otCost;

    const payload: SubsidiaryAllocation = {
      id: editingAllocId || `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dateLabel: sheet.label,
      subsidiaryCode: factoryCode || 'SUBSIDIARY',
      subsidiaryName: factoryName.trim() || factoryCode,
      deptName: isQ1Delay ? 'Raw Materials / Production' : 'Production Floor',
      headcountPerm: pCount,
      headcountTemp: tCount,
      dailyWagePerPerson: pWage,
      totalCost: baseCost,
      otHours: otHrs,
      otCost: otCost,
      allocationType: isQ1Delay ? 'q1_raw_material_delay' : 'workforce_loan',
      delayReason: isQ1Delay ? (note || 'Raw Materials Delay from Q1') : undefined,
      tempWorkersHired: isQ1Delay ? tCount : undefined,
      tempWorkersDailyWage: isQ1Delay ? tWage : undefined,
      delayOtWorkersCount: isQ1Delay && otHrs > 0 ? totalHc : undefined,
      delayOtHours: isQ1Delay && otHrs > 0 ? otHrs : undefined,
      delayOtCost: isQ1Delay && otHrs > 0 ? otCost : undefined,
      totalDelaySurcharge: isQ1Delay ? totalCostCalc : undefined,
      billingStatus: 'Charged to Subsidiary',
      projectNote: note.trim() || (isQ1Delay ? `Q1 Delay: ${tCount} Temp + ${pCount} Perm` : `Workforce loan: ${pCount} Perm + ${tCount} Temp`),
      createdAt: new Date().toISOString()
    };

    if (editingAllocId) {
      onUpdateAllocations(allocations.map(a => a.id === editingAllocId ? payload : a));
    } else {
      onUpdateAllocations([...allocations, payload]);
    }

    setShowFormModal(false);
  };

  // Export CSV of Simple Table
  const handleExportCSV = () => {
    const headers = ["Date", "Factory", "Headcount - Permanent", "Headcount - Temporary", "Total Headcount", "Total Cost (ZAR/LSL)", "Notes"];
    const rows = dailyAllocations.map(a => {
      const p = a.headcountPerm || 0;
      const t = a.tempWorkersHired ?? a.headcountTemp ?? 0;
      const pWage = a.dailyWagePerPerson || 146.00;
      const tWage = a.tempWorkersDailyWage || 125.95;
      const baseCost = a.totalCost ?? ((p * pWage) + (t * tWage));
      const otHrs = a.delayOtHours ?? a.otHours ?? 0;
      const otStaff = a.delayOtWorkersCount ?? (p + t);
      const hourly = pWage / 9.0;
      const otCost = a.delayOtCost ?? a.otCost ?? (otHrs > 0 ? (otStaff * otHrs * hourly * defaultMultiplier) : 0);
      const itemTotal = a.totalDelaySurcharge ?? (baseCost + otCost);

      return [
        `"${sheet.label}"`,
        `"${(a.subsidiaryName || a.subsidiaryCode).replace(/"/g, '""')}"`,
        p,
        t,
        p + t,
        itemTotal.toFixed(2),
        `"${(a.delayReason || a.projectNote || '').replace(/"/g, '""')}"`
      ];
    });

    // Add summary row
    rows.push([
      `"TOTAL"`,
      `"${totals.factoryCount} Factories"`,
      totals.totalPerm,
      totals.totalTemp,
      totals.totalHeadcount,
      totals.totalCost.toFixed(2),
      `"Grand Total"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Subsidiary_Headcount_${sheet.label.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-indigo-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header */}
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
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-white tracking-wide">
                    SUBSIDIARY HEADCOUNT & COSTS
                  </h2>
                  <span className="px-3 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-black uppercase font-mono">
                    {sheet.label}
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Simple breakdown of <strong>Factory</strong>, <strong>Permanent Headcount</strong>, <strong>Temporary Headcount</strong>, and <strong>Total Cost</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Export Simple CSV"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleOpenAdd()}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> + Add Factory
                </button>
              )}
            </div>
          </div>

          {/* 4 Clean Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] uppercase font-bold text-indigo-200">Factories</div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {totals.factoryCount}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] uppercase font-bold text-indigo-200">Permanent HC</div>
              <div className="text-xl font-black text-indigo-300 font-mono mt-0.5">
                {totals.totalPerm}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] uppercase font-bold text-amber-200">Temporary HC</div>
              <div className="text-xl font-black text-amber-300 font-mono mt-0.5">
                {totals.totalTemp}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <div className="text-[10px] uppercase font-bold text-emerald-200">Total Cost</div>
              <div className="text-xl font-black text-emerald-300 font-mono mt-0.5">
                {currency} {totals.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Panel Body: The Simple Format Table */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/60 space-y-4">
          
          {/* Quick Action Bar for Quantum 1 Raw Materials Delay */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-200">
            <div className="flex items-center gap-2 text-xs text-amber-950 font-medium">
              <Truck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Quantum 1 Raw Materials:</strong> Hired temporary workers or worked overtime due to Q1 material delay?
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenQ1Delay}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> + Q1 Material Delay Entry
              </button>
            )}
          </div>

          {/* THE SIMPLE TABLE: FACTORY | HEADCOUNT - PERMANENT | TEMPORARY | TOTAL COST */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase font-extrabold text-slate-600 bg-slate-100/80">
                    <th className="p-4">FACTORY</th>
                    <th className="p-4 text-center font-bold text-indigo-900 bg-indigo-50/50">HEADCOUNT - PERMANENT</th>
                    <th className="p-4 text-center font-bold text-amber-900 bg-amber-50/50">HEADCOUNT - TEMPORARY</th>
                    <th className="p-4 text-center font-bold text-slate-700">TOTAL HEADCOUNT</th>
                    <th className="p-4 text-right font-extrabold text-emerald-900 bg-emerald-50/60">TOTAL COST</th>
                    <th className="p-4 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {dailyAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 font-sans italic">
                        No subsidiary entries logged for {sheet.label}. Click <strong>"+ Add Factory"</strong> or <strong>"+ Q1 Material Delay Entry"</strong> above.
                      </td>
                    </tr>
                  ) : (
                    dailyAllocations.map(a => {
                      const p = a.headcountPerm || 0;
                      const t = a.tempWorkersHired ?? a.headcountTemp ?? 0;
                      const totalHc = p + t;

                      const pWage = a.dailyWagePerPerson || 146.00;
                      const tWage = a.tempWorkersDailyWage || 125.95;
                      const baseCost = a.totalCost ?? ((p * pWage) + (t * tWage));

                      const otHrs = a.delayOtHours ?? a.otHours ?? 0;
                      const otStaff = a.delayOtWorkersCount ?? (p + t);
                      const hourly = pWage / 9.0;
                      const otCost = a.delayOtCost ?? a.otCost ?? (otHrs > 0 ? (otStaff * otHrs * hourly * defaultMultiplier) : 0);

                      const itemTotalCost = a.totalDelaySurcharge ?? (baseCost + otCost);
                      const isDelay = a.allocationType === 'q1_raw_material_delay' || Boolean(a.delayReason);

                      return (
                        <tr key={a.id} className={`hover:bg-slate-50/80 transition ${isDelay ? 'bg-amber-50/30' : ''}`}>
                          {/* 1. FACTORY */}
                          <td className="p-4 font-sans">
                            <div className="flex items-center gap-2">
                              {isDelay ? (
                                <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                              ) : (
                                <Building className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                              <div>
                                <span className="font-extrabold text-slate-900 text-sm block">
                                  {a.subsidiaryName || a.subsidiaryCode}
                                </span>
                                {(a.delayReason || a.projectNote) && (
                                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                                    {a.delayReason || a.projectNote}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. HEADCOUNT - PERMANENT */}
                          <td className="p-4 text-center font-black text-indigo-900 bg-indigo-50/30 text-sm">
                            {p}
                          </td>

                          {/* 3. HEADCOUNT - TEMPORARY */}
                          <td className="p-4 text-center font-black text-amber-900 bg-amber-50/30 text-sm">
                            {t > 0 ? `+${t}` : '0'}
                          </td>

                          {/* TOTAL HEADCOUNT */}
                          <td className="p-4 text-center font-black text-slate-800 text-sm">
                            {totalHc}
                          </td>

                          {/* 4. TOTAL COST */}
                          <td className="p-4 text-right font-black text-emerald-700 bg-emerald-50/40 text-sm">
                            {currency} {itemTotalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {otCost > 0 && (
                              <span className="block text-[10px] text-amber-700 font-normal">
                                (incl. {currency} {otCost.toFixed(2)} OT)
                              </span>
                            )}
                          </td>

                          {/* ACTIONS */}
                          <td className="p-4 text-center font-sans">
                            {canEdit && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(a)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Edit entry"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(a.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* SUMMARY FOOTER ROW */}
                {dailyAllocations.length > 0 && (
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-mono text-xs">
                    <tr>
                      <td className="p-4 font-extrabold font-sans text-slate-900 text-sm uppercase">
                        TOTAL ({totals.factoryCount} Factories)
                      </td>
                      <td className="p-4 text-center font-black text-indigo-950 bg-indigo-100/60 text-sm">
                        {totals.totalPerm} Perm
                      </td>
                      <td className="p-4 text-center font-black text-amber-950 bg-amber-100/60 text-sm">
                        {totals.totalTemp} Temp
                      </td>
                      <td className="p-4 text-center font-black text-slate-900 text-sm">
                        {totals.totalHeadcount} Staff
                      </td>
                      <td className="p-4 text-right font-black text-emerald-900 bg-emerald-100/80 text-base">
                        {currency} {totals.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>

        {/* MODAL: SIMPLE ADD / EDIT FACTORY ROW */}
        {showFormModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-md w-full border border-indigo-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              
              <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Building2 className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold">
                      {editingAllocId ? 'Edit Factory Entry' : 'Add Factory Entry'}
                    </h3>
                    <p className="text-xs text-indigo-200">
                      Enter factory, permanent & temporary headcount, and cost.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-indigo-100 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs">
                
                {/* 1. FACTORY */}
                <div>
                  <label className="block font-extrabold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                    1. Factory Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <select
                      value={factoryCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setFactoryCode(code);
                        const matched = subsidiaries.find(s => s.code === code);
                        if (matched) setFactoryName(matched.name);
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                    >
                      {subsidiaries.map(s => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                      <option value="CUSTOM">Custom Factory / Plant...</option>
                    </select>
                    <input
                      type="text"
                      value={factoryName}
                      onChange={(e) => setFactoryName(e.target.value)}
                      placeholder="e.g. Quantum 1 Apparel Facility"
                      required
                      className="w-full p-2 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* 2. HEADCOUNT - PERMANENT & TEMPORARY */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block font-extrabold text-indigo-950 mb-1 uppercase tracking-wider text-[10px]">
                      2. Headcount - Permanent
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={headcountPerm}
                      onChange={(e) => setHeadcountPerm(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2.5 border border-indigo-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-extrabold text-amber-950 mb-1 uppercase tracking-wider text-[10px]">
                      3. Headcount - Temporary
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={headcountTemp}
                      onChange={(e) => setHeadcountTemp(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2.5 border border-amber-300 rounded-xl font-mono font-black text-slate-900 bg-white text-sm"
                    />
                  </div>
                </div>

                {/* WAGE RATES & OPTIONAL OVERTIME */}
                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[10px]">
                        Perm Daily Salary ({currency}):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={dailyWagePerm}
                        onChange={(e) => setDailyWagePerm(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[10px]">
                        Temp Daily Salary ({currency}):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={dailyWageTemp}
                        onChange={(e) => setDailyWageTemp(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Overtime Checkbox */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer text-xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Include Overtime (OT)?
                      </label>
                      <input
                        type="checkbox"
                        checked={includeOt}
                        onChange={(e) => setIncludeOt(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                      />
                    </div>

                    {includeOt && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          value={otHours}
                          onChange={(e) => setOtHours(parseFloat(e.target.value) || 0)}
                          className="w-24 p-1.5 border border-amber-300 rounded-xl font-mono font-bold text-slate-900 bg-white text-xs"
                        />
                        <span className="text-[11px] text-slate-600 font-medium">
                          hours @ {defaultMultiplier}x rate
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. TOTAL COST PREVIEW */}
                {(() => {
                  const pCount = Number(headcountPerm) || 0;
                  const tCount = Number(headcountTemp) || 0;
                  const totalHc = pCount + tCount;
                  const pWage = Number(dailyWagePerm) || 146.00;
                  const tWage = Number(dailyWageTemp) || 125.95;
                  const baseCost = (pCount * pWage) + (tCount * tWage);
                  const otHrs = includeOt ? (Number(otHours) || 0) : 0;
                  const hourly = pWage / 9.0;
                  const otCost = otHrs > 0 ? (totalHc * otHrs * hourly * defaultMultiplier) : 0;
                  const totalCostPreview = baseCost + otCost;

                  return (
                    <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-indigo-200">
                          4. Total Cost Calculated:
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {pCount} Perm + {tCount} Temp ({totalHc} total workers)
                        </div>
                      </div>
                      <div className="text-lg font-black font-mono text-emerald-300">
                        {currency} {totalCostPreview.toFixed(2)}
                      </div>
                    </div>
                  );
                })()}

                {/* Optional Note */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                    Notes / Reference (Optional):
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Q1 Raw Material Delay or Export line loan"
                    className="w-full p-2 border border-slate-300 rounded-xl text-slate-800 text-xs"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Save Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
