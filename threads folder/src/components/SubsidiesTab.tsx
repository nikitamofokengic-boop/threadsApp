import React, { useState, useMemo } from 'react';
import { SheetData, SubsidiaryAllocation, WageSubsidyProgram, SubsidiaryProfile, Department } from '../types';
import { 
  Building2, 
  Users, 
  DollarSign, 
  ArrowRightLeft, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Download, 
  Sparkles, 
  Filter, 
  Search, 
  Calendar, 
  FileSpreadsheet, 
  HelpCircle, 
  PieChart, 
  Layers, 
  Check, 
  X, 
  ShieldCheck, 
  Award, 
  Clock, 
  ExternalLink,
  ChevronDown,
  Building,
  Briefcase
} from 'lucide-react';
import { getDayInfo, parseDateLabelToDate, extractAndNormalizeDate } from '../utils/payCycle';
import { QUANTUM2_STANDARD_ROSTER } from '../data/initialData';

interface SubsidiesTabProps {
  sheet: SheetData;
  allSheets: SheetData[];
  subsidiaries: SubsidiaryProfile[];
  allocations: SubsidiaryAllocation[];
  subsidyPrograms: WageSubsidyProgram[];
  onUpdateAllocations: (newAllocations: SubsidiaryAllocation[]) => void;
  onUpdateSubsidiaries: (newSubsidiaries: SubsidiaryProfile[]) => void;
  onUpdateSubsidyPrograms: (newPrograms: WageSubsidyProgram[]) => void;
  canEdit: boolean;
  currency: string;
}

export default function SubsidiesTab({
  sheet,
  allSheets,
  subsidiaries,
  allocations,
  subsidyPrograms,
  onUpdateAllocations,
  onUpdateSubsidiaries,
  onUpdateSubsidyPrograms,
  canEdit,
  currency
}: SubsidiesTabProps) {
  // Navigation sub-view: 'daily' | 'cycle' | 'directory' | 'subsidies'
  const [activeSubView, setActiveSubView] = useState<'daily' | 'cycle' | 'directory' | 'subsidies'>('daily');
  
  // Filter & Search
  const [selectedSubFilter, setSelectedSubFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add/Edit Allocation Modal
  const [showAddAllocModal, setShowAddAllocModal] = useState<boolean>(false);
  const [editingAlloc, setEditingAlloc] = useState<SubsidiaryAllocation | null>(null);

  // Form State for Allocation
  const [formDate, setFormDate] = useState<string>(sheet.label);
  const [formSubCode, setFormSubCode] = useState<string>(subsidiaries[0]?.code || 'QUANTUM-1');
  const [formDeptName, setFormDeptName] = useState<string>(QUANTUM2_STANDARD_ROSTER[0].name);
  const [formPerm, setFormPerm] = useState<number>(1);
  const [formTemp, setFormTemp] = useState<number>(0);
  const [formWage, setFormWage] = useState<number>(QUANTUM2_STANDARD_ROSTER[0].wage || 146.00);
  const [formOtHours, setFormOtHours] = useState<number>(0);
  const [formOtCost, setFormOtCost] = useState<number>(0);
  const [formBillingStatus, setFormBillingStatus] = useState<SubsidiaryAllocation['billingStatus']>('Charged to Subsidiary');
  const [formProjectNote, setFormProjectNote] = useState<string>('');

  // Add/Edit Subsidiary Modal
  const [showAddSubModal, setShowAddSubModal] = useState<boolean>(false);
  const [newSubCode, setNewSubCode] = useState<string>('');
  const [newSubName, setNewSubName] = useState<string>('');
  const [newSubLocation, setNewSubLocation] = useState<string>('');
  const [newSubContact, setNewSubContact] = useState<string>('');
  const [newSubBilling, setNewSubBilling] = useState<SubsidiaryProfile['defaultBillingType']>('Charged to Subsidiary');

  // Add/Edit Subsidy Program Modal
  const [showAddProgModal, setShowAddProgModal] = useState<boolean>(false);
  const [newProgName, setNewProgName] = useState<string>('');
  const [newProgAgency, setNewProgAgency] = useState<string>('');
  const [newProgType, setNewProgType] = useState<WageSubsidyProgram['subsidyType']>('per_headcount_daily');
  const [newProgAmount, setNewProgAmount] = useState<number>(14.50);
  const [newProgCap, setNewProgCap] = useState<number>(100000);
  const [newProgDepts, setNewProgDepts] = useState<string>('Machine Operators, Cutting, Packing Employees');
  const [newProgNotes, setNewProgNotes] = useState<string>('');

  // Active Sheet Date Normalization
  const normalizedActiveDate = extractAndNormalizeDate(sheet.label);

  // Quantum 2 Gross Headcount & Cost for active sheet
  const q2GrossHeadcount = useMemo(() => {
    return sheet.departments.reduce((acc, d) => {
      const p = d.roles.reduce((s, r) => s + (r.perm || 0) + (r.temp || 0), 0);
      return acc + p;
    }, 0);
  }, [sheet]);

  const q2GrossLaborCost = useMemo(() => {
    return sheet.departments.reduce((acc, d) => {
      const c = d.roles.reduce((s, r) => s + (r.perm * (r.permWage || 140)) + (r.temp * (r.tempWage || 125.95)) + (r.otCost || 0), 0);
      return acc + c;
    }, 0);
  }, [sheet]);

  // Filtered allocations for Daily View
  const dailyAllocations = useMemo(() => {
    return allocations.filter(a => extractAndNormalizeDate(a.dateLabel) === normalizedActiveDate);
  }, [allocations, normalizedActiveDate]);

  // Active View allocations list (Daily vs Cycle)
  const currentViewAllocations = useMemo(() => {
    const list = activeSubView === 'daily' ? dailyAllocations : allocations;
    return list.filter(a => {
      if (selectedSubFilter !== 'ALL' && a.subsidiaryCode !== selectedSubFilter) return false;
      if (selectedStatusFilter !== 'ALL' && a.billingStatus !== selectedStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNote = (a.projectNote || '').toLowerCase().includes(q);
        const matchDept = a.deptName.toLowerCase().includes(q);
        const matchSub = a.subsidiaryName.toLowerCase().includes(q) || a.subsidiaryCode.toLowerCase().includes(q);
        if (!matchNote && !matchDept && !matchSub) return false;
      }
      return true;
    });
  }, [activeSubView, dailyAllocations, allocations, selectedSubFilter, selectedStatusFilter, searchQuery]);

  // Statistics for active daily allocations
  const dailyAllocatedHeadcount = useMemo(() => {
    return dailyAllocations.reduce((sum, a) => sum + (a.headcountPerm || 0) + (a.headcountTemp || 0), 0);
  }, [dailyAllocations]);

  const dailyAllocatedCost = useMemo(() => {
    return dailyAllocations.reduce((sum, a) => sum + (a.totalCost || 0) + (a.otCost || 0), 0);
  }, [dailyAllocations]);

  // Wage Subsidy Calculations for Active Date
  const dailySubsidyBenefits = useMemo(() => {
    let totalBenefit = 0;
    const details: { programName: string; agency: string; amount: number; description: string }[] = [];

    subsidyPrograms.filter(p => p.isActive).forEach(prog => {
      if (prog.subsidyType === 'custom_salaries_charged') {
        const hc = prog.targetHeadcount ?? 50;
        const rate = prog.salaryPerWorkerDaily ?? (prog.amountPerUnit || 140.00);
        const baseCost = hc * rate;
        const otCost = prog.otSalaryRateDaily || 0;
        const amount = baseCost + otCost;
        totalBenefit += amount;
        details.push({
          programName: prog.programName,
          agency: prog.agency,
          amount,
          description: `${hc} workers @ ${currency} ${rate.toFixed(2)} salary/day ${otCost > 0 ? `+ OT (${currency} ${otCost.toFixed(0)})` : ''}`
        });
      } else if (prog.subsidyType === 'per_headcount_daily') {
        // Count headcount in eligible departments
        let eligibleHc = 0;
        sheet.departments.forEach(dept => {
          const isEligible = prog.eligibleDepts.includes('All') || 
            prog.eligibleDepts.includes('All Departments') ||
            prog.eligibleDepts.some(e => e.toUpperCase() === dept.name.toUpperCase());
          if (isEligible) {
            dept.roles.forEach(r => {
              eligibleHc += (r.perm || 0);
            });
          }
        });
        const amount = eligibleHc * prog.amountPerUnit;
        totalBenefit += amount;
        details.push({
          programName: prog.programName,
          agency: prog.agency,
          amount,
          description: `${eligibleHc} eligible staff × ${currency} ${prog.amountPerUnit.toFixed(2)}/day`
        });
      } else if (prog.subsidyType === 'percentage_wage_bill') {
        let eligibleWages = 0;
        sheet.departments.forEach(dept => {
          const isEligible = prog.eligibleDepts.includes('All') || 
            prog.eligibleDepts.includes('All Departments') ||
            prog.eligibleDepts.some(e => e.toUpperCase() === dept.name.toUpperCase());
          if (isEligible) {
            dept.roles.forEach(r => {
              eligibleWages += (r.perm * (r.permWage || 140));
            });
          }
        });
        const amount = (eligibleWages * prog.amountPerUnit) / 100;
        totalBenefit += amount;
        details.push({
          programName: prog.programName,
          agency: prog.agency,
          amount,
          description: `${prog.amountPerUnit}% of eligible wages (${currency} ${eligibleWages.toFixed(0)})`
        });
      } else if (prog.subsidyType === 'fixed_monthly_grant') {
        // Daily amortized fraction (divided by 26 operating days)
        const dailyAmortized = (prog.amountPerUnit || 0) / 26;
        totalBenefit += dailyAmortized;
        details.push({
          programName: prog.programName,
          agency: prog.agency,
          amount: dailyAmortized,
          description: `Daily portion of ${currency} ${prog.amountPerUnit.toLocaleString('en-ZA')} monthly grant (/ 26 days)`
        });
      }
    });

    return { totalBenefit, details };
  }, [subsidyPrograms, sheet, currency]);

  // Net Quantum 2 Retained Figures
  const netQ2Headcount = Math.max(0, q2GrossHeadcount - dailyAllocatedHeadcount);
  const netQ2LaborCost = Math.max(0, q2GrossLaborCost - dailyAllocatedCost - dailySubsidyBenefits.totalBenefit);

  // Open Form to Add New Allocation
  const handleOpenAddAlloc = () => {
    setEditingAlloc(null);
    setFormDate(sheet.label);
    setFormSubCode(subsidiaries[0]?.code || 'QUANTUM-1');
    setFormDeptName(QUANTUM2_STANDARD_ROSTER[0].name);
    setFormPerm(1);
    setFormTemp(0);
    setFormWage(QUANTUM2_STANDARD_ROSTER[0].wage || 146.00);
    setFormOtHours(0);
    setFormOtCost(0);
    setFormBillingStatus('Charged to Subsidiary');
    setFormProjectNote('');
    setShowAddAllocModal(true);
  };

  // Open Form to Edit Allocation
  const handleOpenEditAlloc = (alloc: SubsidiaryAllocation) => {
    setEditingAlloc(alloc);
    setFormDate(alloc.dateLabel);
    setFormSubCode(alloc.subsidiaryCode);
    setFormDeptName(alloc.deptName);
    setFormPerm(alloc.headcountPerm);
    setFormTemp(alloc.headcountTemp);
    setFormWage(alloc.dailyWagePerPerson);
    setFormOtHours(alloc.otHours || 0);
    setFormOtCost(alloc.otCost || 0);
    setFormBillingStatus(alloc.billingStatus || 'Charged to Subsidiary');
    setFormProjectNote(alloc.projectNote || '');
    setShowAddAllocModal(true);
  };

  // Handle Dept Selection in Form to Auto-fill Wage
  const handleFormDeptChange = (deptTitle: string) => {
    setFormDeptName(deptTitle);
    const matched = QUANTUM2_STANDARD_ROSTER.find(r => r.name.toUpperCase() === deptTitle.toUpperCase());
    if (matched) {
      setFormWage(matched.wage || 140.00);
    }
  };

  // Save Allocation Handler
  const handleSaveAlloc = (e: React.FormEvent) => {
    e.preventDefault();
    const sub = subsidiaries.find(s => s.code === formSubCode) || {
      name: formSubCode
    };

    const totalBaseCost = (formPerm * formWage) + (formTemp * 125.95);
    const totalCost = totalBaseCost;

    if (editingAlloc) {
      const updated = allocations.map(a => {
        if (a.id === editingAlloc.id) {
          return {
            ...a,
            dateLabel: formDate,
            subsidiaryCode: formSubCode,
            subsidiaryName: sub.name,
            deptName: formDeptName,
            headcountPerm: Number(formPerm),
            headcountTemp: Number(formTemp),
            dailyWagePerPerson: Number(formWage),
            totalCost: Number(totalCost),
            otHours: Number(formOtHours),
            otCost: Number(formOtCost),
            billingStatus: formBillingStatus,
            projectNote: formProjectNote
          };
        }
        return a;
      });
      onUpdateAllocations(updated);
    } else {
      const newAlloc: SubsidiaryAllocation = {
        id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dateLabel: formDate,
        subsidiaryCode: formSubCode,
        subsidiaryName: sub.name,
        deptName: formDeptName,
        headcountPerm: Number(formPerm),
        headcountTemp: Number(formTemp),
        dailyWagePerPerson: Number(formWage),
        totalCost: Number(totalCost),
        otHours: Number(formOtHours),
        otCost: Number(formOtCost),
        billingStatus: formBillingStatus,
        projectNote: formProjectNote,
        createdAt: new Date().toISOString()
      };
      onUpdateAllocations([newAlloc, ...allocations]);
    }

    setShowAddAllocModal(false);
    setEditingAlloc(null);
  };

  // Delete Allocation
  const handleDeleteAlloc = (id: string) => {
    const next = allocations.filter(a => a.id !== id);
    onUpdateAllocations(next);
  };

  // Save New Subsidiary Profile
  const handleSaveSubsidiary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCode.trim() || !newSubName.trim()) return;

    const newSub: SubsidiaryProfile = {
      id: `sub_${Date.now()}`,
      code: newSubCode.trim().toUpperCase(),
      name: newSubName.trim(),
      location: newSubLocation.trim() || 'Maseru, Lesotho',
      contactPerson: newSubContact.trim(),
      defaultBillingType: newSubBilling
    };

    onUpdateSubsidiaries([...subsidiaries, newSub]);
    setNewSubCode('');
    setNewSubName('');
    setNewSubLocation('');
    setNewSubContact('');
    setShowAddSubModal(false);
  };

  // Delete Subsidiary Profile
  const handleDeleteSubsidiary = (id: string) => {
    const next = subsidiaries.filter(s => s.id !== id);
    onUpdateSubsidiaries(next);
  };

  // Toggle Subsidy Program Active Status
  const handleToggleProgram = (id: string) => {
    const next = subsidyPrograms.map(p => {
      if (p.id === id) return { ...p, isActive: !p.isActive };
      return p;
    });
    onUpdateSubsidyPrograms(next);
  };

  // Save New Subsidy Program
  const handleSaveSubsidyProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName.trim()) return;

    const deptsArray = newProgDepts.split(',').map(d => d.trim()).filter(d => d.length > 0);

    const newProg: WageSubsidyProgram = {
      id: `prog_${Date.now()}`,
      programName: newProgName.trim(),
      agency: newProgAgency.trim() || 'Government Agency',
      subsidyType: newProgType,
      amountPerUnit: Number(newProgAmount),
      monthlyCap: Number(newProgCap),
      eligibleDepts: deptsArray.length > 0 ? deptsArray : ['All Departments'],
      isActive: true,
      notes: newProgNotes.trim()
    };

    onUpdateSubsidyPrograms([...subsidyPrograms, newProg]);
    setNewProgName('');
    setNewProgAgency('');
    setNewProgAmount(14.50);
    setNewProgCap(100000);
    setNewProgDepts('Machine Operators, Cutting, Packing Employees');
    setNewProgNotes('');
    setShowAddProgModal(false);
  };

  // Export Allocations CSV
  const handleExportCSV = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += `QUANTUM 2 FACTORY - INTER-SUBSIDIARY HEADCOUNT ALLOCATION & SUBSIDIES REPORT\n`;
    csv += `Generated for: ${sheet.label},Export Date: ${new Date().toLocaleDateString()}\n\n`;

    csv += `SUMMARY OF LABOR COST & RECOVERY\n`;
    csv += `Metric,Headcount,Amount (${currency})\n`;
    csv += `Gross Quantum 2 Daily Labor,${q2GrossHeadcount},${q2GrossLaborCost.toFixed(2)}\n`;
    csv += `Allocated to Sister Subsidiaries,${dailyAllocatedHeadcount},${dailyAllocatedCost.toFixed(2)}\n`;
    csv += `Wage Subsidies Benefit Offset,0,${dailySubsidyBenefits.totalBenefit.toFixed(2)}\n`;
    csv += `Net Retained Quantum 2 Labor Expense,${netQ2Headcount},${netQ2LaborCost.toFixed(2)}\n\n`;

    csv += `INTER-SUBSIDIARY ALLOCATIONS DETAIL\n`;
    csv += `Date,Subsidiary Code,Subsidiary Name,Department / Role,Perm Count,Temp Count,Daily Wage Rate,Base Cost,OT Hours,OT Cost,Total Billable,Billing Status,Project Notes\n`;
    
    currentViewAllocations.forEach(a => {
      const grandTotal = (a.totalCost || 0) + (a.otCost || 0);
      csv += `"${a.dateLabel}","${a.subsidiaryCode}","${a.subsidiaryName}","${a.deptName}",${a.headcountPerm},${a.headcountTemp},${a.dailyWagePerPerson},${a.totalCost},${a.otHours || 0},${a.otCost || 0},${grandTotal.toFixed(2)},"${a.billingStatus}","${(a.projectNote || '').replace(/"/g, '""')}"\n`;
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Quantum2_Subsidiaries_Allocation_${sheet.label.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Quantum 2 Factory context */}
      <div className="bento-card p-6 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-700 text-white rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black tracking-wider uppercase">
              <Building2 className="w-3.5 h-3.5" />
              Source Plant: Quantum 2 Factory
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Subsidiaries & Cross-Factory Headcount Allocations
            </h2>
            <p className="text-pink-100 text-xs sm:text-sm font-medium leading-relaxed">
              Track and charge manpower headcount and daily labor wages transferred from <strong>Quantum 2</strong> to sister factories (Quantum 1, Quantum 3, Central Hub, Finishing, etc.) and calculate intercompany labor cost and overtime (OT) recoveries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer backdrop-blur-xs shadow-xs"
            >
              <Download className="w-4 h-4" /> Export Report CSV
            </button>

            {canEdit && (
              <button
                onClick={handleOpenAddAlloc}
                className="px-5 py-2.5 bg-white hover:bg-pink-50 text-pink-700 rounded-2xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4 text-pink-600" /> Allocate Headcount
              </button>
            )}
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="mt-6 pt-4 border-t border-white/20 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubView('daily')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'daily'
                ? 'bg-white text-pink-800 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Daily Shift ({sheet.label})
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-100 text-pink-900 font-mono">
              {dailyAllocations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubView('cycle')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'cycle'
                ? 'bg-white text-pink-800 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Pay-Cycle Allocations
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-100 text-pink-900 font-mono">
              {allocations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubView('directory')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'directory'
                ? 'bg-white text-pink-800 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Subsidiaries Directory ({subsidiaries.length})
          </button>

          <button
            onClick={() => setActiveSubView('subsidies')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'subsidies'
                ? 'bg-white text-pink-800 shadow-sm'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Wage Subsidies & Grants ({subsidyPrograms.filter(p => p.isActive).length} Active)
          </button>
        </div>
      </div>

      {/* 4 Bento KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Quantum 2 Headcount & Cost */}
        <div className="bento-card p-5 border-pink-100 bg-white rounded-3xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Quantum 2 Gross Labor</span>
            <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {currency} {q2GrossLaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              <strong className="text-slate-800 font-mono">{q2GrossHeadcount}</strong> total employees clocked in
            </p>
          </div>
        </div>

        {/* Card 2: Allocated to Other Subsidiaries */}
        <div className="bento-card p-5 border-rose-100 bg-rose-50/40 rounded-3xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">Transferred to Subsidiaries</span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-rose-700 font-mono">
              - {currency} {dailyAllocatedCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-rose-600 font-medium">
              <strong className="text-rose-800 font-mono">{dailyAllocatedHeadcount}</strong> staff loaned / charged out
            </p>
          </div>
        </div>

        {/* Card 3: Wage Subsidies Offset */}
        <div className="bento-card p-5 border-emerald-100 bg-emerald-50/40 rounded-3xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">Wage Subsidies Benefit</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-emerald-700 font-mono">
              - {currency} {dailySubsidyBenefits.totalBenefit.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">
              {dailySubsidyBenefits.details.length} active government/grant schemes
            </p>
          </div>
        </div>

        {/* Card 4: Net Retained Quantum 2 Labor Cost */}
        <div className="bento-card p-5 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900">Net Quantum 2 Retained Cost</span>
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-black text-purple-950 font-mono">
              {currency} {netQ2LaborCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-purple-700 font-medium">
              <strong className="text-purple-900 font-mono">{netQ2Headcount}</strong> net operating in Q2 plant
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Views */}
      {(activeSubView === 'daily' || activeSubView === 'cycle') && (
        <div className="space-y-4">
          
          {/* Controls & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-pink-100 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search project notes, role, or unit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-500 w-56 sm:w-64"
                />
              </div>

              {/* Subsidiary Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
                <Building className="w-3.5 h-3.5 text-pink-600" />
                <select
                  value={selectedSubFilter}
                  onChange={(e) => setSelectedSubFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Subsidiaries</option>
                  {subsidiaries.map(s => (
                    <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
                <Filter className="w-3.5 h-3.5 text-pink-600" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Billing Statuses</option>
                  <option value="Charged to Subsidiary">Charged to Subsidiary</option>
                  <option value="Cross-Subsidized">Cross-Subsidized</option>
                  <option value="Reimbursable">Reimbursable</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>

            {canEdit && (
              <button
                onClick={handleOpenAddAlloc}
                className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> New Allocation
              </button>
            )}
          </div>

          {/* Allocation Table */}
          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-pink-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-pink-600" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                  {activeSubView === 'daily' ? `Allocations for ${sheet.label}` : 'All Consolidated Inter-Subsidiary Headcount Allocations'}
                </h3>
                <span className="px-2 py-0.5 bg-pink-100 text-pink-800 rounded-full text-[10px] font-mono font-bold">
                  {currentViewAllocations.length} records
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total Allocated Value: <strong className="text-slate-900 font-mono font-bold">{currency} {currentViewAllocations.reduce((s, a) => s + (a.totalCost || 0) + (a.otCost || 0), 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong>
              </span>
            </div>

            {currentViewAllocations.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mx-auto">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">No Headcount Allocations Found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {activeSubView === 'daily' 
                    ? `No manpower from Quantum 2 has been allocated to other sister factories on ${sheet.label}.` 
                    : 'No subsidiary allocations match the current filters.'}
                </p>
                {canEdit && (
                  <button
                    onClick={handleOpenAddAlloc}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Allocation for {sheet.label}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 pl-4">Shift Date</th>
                      <th className="p-3">Target Subsidiary</th>
                      <th className="p-3">Department / Role</th>
                      <th className="p-3 text-center">Headcount</th>
                      <th className="p-3 text-right">Daily Wage Rate</th>
                      <th className="p-3 text-right">Base Cost</th>
                      <th className="p-3 text-right">OT (hrs/cost)</th>
                      <th className="p-3 text-right">Total Billable</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Project / Reason</th>
                      {canEdit && <th className="p-3 pr-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentViewAllocations.map((alloc, idx) => {
                      const grandTotal = (alloc.totalCost || 0) + (alloc.otCost || 0);
                      const totalHc = (alloc.headcountPerm || 0) + (alloc.headcountTemp || 0);

                      return (
                        <tr key={`${alloc.id || 'alloc'}_${idx}`} className="hover:bg-pink-50/40 transition">
                          <td className="p-3 pl-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {alloc.dateLabel}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-md font-mono text-[10px] font-black">
                                {alloc.subsidiaryCode}
                              </span>
                              <span className="font-bold text-slate-800">{alloc.subsidiaryName}</span>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                            {alloc.deptName}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap font-mono">
                            <span className="font-bold text-slate-900">{totalHc}</span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({alloc.headcountPerm}P{alloc.headcountTemp > 0 ? ` + ${alloc.headcountTemp}T` : ''})
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-700 whitespace-nowrap">
                            {currency} {alloc.dailyWagePerPerson.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {currency} {alloc.totalCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600 whitespace-nowrap">
                            {alloc.otHours && alloc.otHours > 0 ? (
                              <div>
                                <span className="font-bold text-amber-700">{alloc.otHours} hrs</span>
                                <span className="text-[10px] text-slate-500 block">+{currency} {(alloc.otCost || 0).toFixed(0)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-700 bg-rose-50/40 whitespace-nowrap">
                            {currency} {grandTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              alloc.billingStatus === 'Charged to Subsidiary'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : alloc.billingStatus === 'Cross-Subsidized'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : alloc.billingStatus === 'Reimbursable'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {alloc.billingStatus || 'Charged'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 text-xs max-w-xs truncate" title={alloc.projectNote}>
                            {alloc.projectNote || <span className="text-slate-300 italic">No notes</span>}
                          </td>
                          {canEdit && (
                            <td className="p-3 pr-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditAlloc(alloc)}
                                  className="p-1 text-slate-400 hover:text-pink-600 hover:bg-pink-100 rounded-lg transition cursor-pointer"
                                  title="Edit allocation"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAlloc(alloc.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                                  title="Delete allocation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Department Headcount Reconciliation Matrix for Active Shift Date */}
          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-pink-600" />
                  Quantum 2 Headcount Reconciliation Matrix ({sheet.label})
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Comparison between Quantum 2 present attendance, transferred headcount to sister units, and net retained operations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sheet.departments.slice(0, 9).map((d, idx) => {
                const totalPresent = d.roles.reduce((s, r) => s + (r.perm || 0) + (r.temp || 0), 0);
                const deptAlloc = dailyAllocations.filter(a => a.deptName.toUpperCase() === d.name.toUpperCase());
                const allocatedCount = deptAlloc.reduce((s, a) => s + (a.headcountPerm || 0) + (a.headcountTemp || 0), 0);
                const netRetained = Math.max(0, totalPresent - allocatedCount);

                return (
                  <div key={`${d.id || 'dept'}_${idx}`} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">{d.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">Cadre: {d.cadre || totalPresent}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center font-mono">
                      <div className="p-1.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-[9px] text-slate-400 block font-sans">Present</span>
                        <strong className="text-xs text-slate-800">{totalPresent}</strong>
                      </div>
                      <div className="p-1.5 bg-rose-50 rounded-xl border border-rose-200">
                        <span className="text-[9px] text-rose-500 block font-sans">Loaned</span>
                        <strong className="text-xs text-rose-700">{allocatedCount > 0 ? `-${allocatedCount}` : '0'}</strong>
                      </div>
                      <div className="p-1.5 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="text-[9px] text-emerald-600 block font-sans">Net in Q2</span>
                        <strong className="text-xs text-emerald-800">{netRetained}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* View 3: Subsidiaries Directory */}
      {activeSubView === 'directory' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-pink-600" />
                Sister Subsidiaries & Partner Units
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Registered factory units and subsidiary branches eligible for Quantum 2 headcount loans and labor transfers.
              </p>
            </div>

            {canEdit && (
              <button
                onClick={() => setShowAddSubModal(true)}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subsidiary Unit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subsidiaries.map((sub, idx) => {
              const subAllocations = allocations.filter(a => a.subsidiaryCode === sub.code);
              const totalBilled = subAllocations.reduce((s, a) => s + (a.totalCost || 0) + (a.otCost || 0), 0);
              const totalHcLoaned = subAllocations.reduce((s, a) => s + (a.headcountPerm || 0) + (a.headcountTemp || 0), 0);

              return (
                <div key={`${sub.id || 'sub'}_${idx}`} className="bento-card p-5 bg-white border-pink-100 rounded-3xl shadow-xs space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 bg-pink-100 text-pink-800 font-mono font-black text-xs rounded-lg">
                        {sub.code}
                      </span>
                      <h4 className="font-extrabold text-sm text-slate-900 mt-2">
                        {sub.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {sub.location}
                      </p>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => handleDeleteSubsidiary(sub.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                        title="Remove subsidiary profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Contact Person:</span>
                      <strong className="text-slate-800">{sub.contactPerson || 'N/A'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Default Terms:</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700">
                        {sub.defaultBillingType}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans block">Total Loaned</span>
                      <strong className="text-slate-800 font-bold">{totalHcLoaned} staff shifts</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-sans block">Total Billed</span>
                      <strong className="text-pink-600 font-black">{currency} {totalBilled.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View 4: Wage Subsidies & Grants Scheme Manager */}
      {activeSubView === 'subsidies' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                Wage Subsidies, Rebates & Grant Programs
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Government and industrial wage support programs configured for Quantum 2 to offset factory manpower costs.
              </p>
            </div>

            {canEdit && (
              <button
                onClick={() => setShowAddProgModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subsidy Scheme
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subsidyPrograms.map((prog, idx) => (
              <div 
                key={`${prog.id || 'prog'}_${idx}`} 
                className={`bento-card p-5 rounded-3xl shadow-xs space-y-4 border transition-all ${
                  prog.isActive ? 'bg-white border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      prog.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {prog.isActive ? 'Active Scheme' : 'Inactive'}
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 mt-2">
                      {prog.programName}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {prog.agency}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => handleToggleProgram(prog.id)}
                      className={`p-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        prog.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {prog.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Subsidy Rate:</span>
                    <strong className="text-emerald-800 font-mono font-bold">
                      {prog.subsidyType === 'per_headcount_daily' 
                        ? `${currency} ${prog.amountPerUnit.toFixed(2)} / worker / day`
                        : prog.subsidyType === 'percentage_wage_bill'
                          ? `${prog.amountPerUnit}% of eligible wages`
                          : `${currency} ${prog.amountPerUnit.toLocaleString('en-ZA')} / month fixed`}
                    </strong>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-600 shrink-0">Eligible:</span>
                    <span className="text-slate-800 font-medium text-right text-[11px]">
                      {prog.eligibleDepts.join(', ')}
                    </span>
                  </div>
                </div>

                {prog.notes && (
                  <p className="text-[11px] text-slate-500 italic">
                    "{prog.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Headcount Allocation */}
      {showAddAllocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-pink-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="w-5 h-5" />
                <h3 className="font-extrabold text-base">
                  {editingAlloc ? 'Edit Headcount Allocation' : 'Allocate Headcount to Subsidiary'}
                </h3>
              </div>
              <button 
                onClick={() => setShowAddAllocModal(false)}
                className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAlloc} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Shift Date:</label>
                <input
                  type="text"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Subsidiary:</label>
                  <select
                    value={formSubCode}
                    onChange={(e) => setFormSubCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-pink-500 cursor-pointer"
                  >
                    {subsidiaries.map(s => (
                      <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department / Role:</label>
                  <select
                    value={formDeptName}
                    onChange={(e) => handleFormDeptChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-pink-500 cursor-pointer"
                  >
                    {QUANTUM2_STANDARD_ROSTER.map(r => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Perm Headcount:</label>
                  <input
                    type="number"
                    min="0"
                    value={formPerm}
                    onChange={(e) => setFormPerm(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Temp Headcount:</label>
                  <input
                    type="number"
                    min="0"
                    value={formTemp}
                    onChange={(e) => setFormTemp(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Perm Wage/Day ({currency}):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formWage}
                    onChange={(e) => setFormWage(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Overtime Hours (OT):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formOtHours}
                    onChange={(e) => {
                      const h = parseFloat(e.target.value) || 0;
                      setFormOtHours(h);
                      // Estimate OT cost at 1.5x hourly rate
                      const hourly = formWage / 9;
                      setFormOtCost(Math.round(h * hourly * 1.5 * formPerm * 100) / 100);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">OT Cost ({currency}):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formOtCost}
                    onChange={(e) => setFormOtCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing Arrangement:</label>
                <select
                  value={formBillingStatus}
                  onChange={(e) => setFormBillingStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-pink-500 cursor-pointer"
                >
                  <option value="Charged to Subsidiary">Charged to Subsidiary (Direct Invoice)</option>
                  <option value="Cross-Subsidized">Cross-Subsidized (Absorbed / Internal Loan)</option>
                  <option value="Reimbursable">Reimbursable (Material & Labor Offset)</option>
                  <option value="Pending">Pending Audit Reconciliation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Project / Operational Reason:</label>
                <textarea
                  rows={2}
                  value={formProjectNote}
                  onChange={(e) => setFormProjectNote(e.target.value)}
                  placeholder="e.g. Line 4 rush fleece order, emergency maintenance, AQL inspection support..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="text-slate-600">
                  Total Billable: <strong className="text-pink-600 font-mono font-black">{currency} {(((formPerm * formWage) + (formTemp * 125.95)) + formOtCost).toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAllocModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-bold shadow-md hover:from-pink-700 hover:to-rose-700 transition cursor-pointer"
                  >
                    {editingAlloc ? 'Save Changes' : 'Confirm Allocation'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Subsidiary Profile */}
      {showAddSubModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-pink-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Building className="w-5 h-5" /> Add Sister Subsidiary Unit
              </h3>
              <button 
                onClick={() => setShowAddSubModal(false)}
                className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubsidiary} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subsidiary Code (e.g. QUANTUM-4):</label>
                <input
                  type="text"
                  value={newSubCode}
                  onChange={(e) => setNewSubCode(e.target.value)}
                  placeholder="e.g. QUANTUM-4"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 uppercase focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subsidiary Full Name:</label>
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Quantum 4 Sportswear Hub"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Location / Industrial Zone:</label>
                <input
                  type="text"
                  value={newSubLocation}
                  onChange={(e) => setNewSubLocation(e.target.value)}
                  placeholder="e.g. Maseru Industrial Park, Plant B"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Person / Plant Manager:</label>
                <input
                  type="text"
                  value={newSubContact}
                  onChange={(e) => setNewSubContact(e.target.value)}
                  placeholder="e.g. Lerato Mokhele (Plant Lead)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Billing Terms:</label>
                <select
                  value={newSubBilling}
                  onChange={(e) => setNewSubBilling(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-pink-500 cursor-pointer"
                >
                  <option value="Charged to Subsidiary">Charged to Subsidiary</option>
                  <option value="Cross-Subsidized">Cross-Subsidized</option>
                  <option value="Reimbursable">Reimbursable</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSubModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pink-600 text-white rounded-xl font-bold shadow-md hover:bg-pink-700 transition cursor-pointer"
                >
                  Add Subsidiary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Subsidy Program */}
      {showAddProgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-emerald-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Award className="w-5 h-5" /> Add Wage Subsidy Scheme
              </h3>
              <button 
                onClick={() => setShowAddProgModal(false)}
                className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubsidyProgram} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Program Name:</label>
                <input
                  type="text"
                  value={newProgName}
                  onChange={(e) => setNewProgName(e.target.value)}
                  placeholder="e.g. LNDC Garment Labor Support"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Grant Authority / Agency:</label>
                <input
                  type="text"
                  value={newProgAgency}
                  onChange={(e) => setNewProgAgency(e.target.value)}
                  placeholder="e.g. Lesotho National Development Corporation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subsidy Type:</label>
                  <select
                    value={newProgType}
                    onChange={(e) => setNewProgType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="per_headcount_daily">Rate Per Headcount/Day</option>
                    <option value="percentage_wage_bill">% of Eligible Wage Bill</option>
                    <option value="fixed_monthly_grant">Fixed Monthly Grant</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount / Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProgAmount}
                    onChange={(e) => setNewProgAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 14.50"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Eligible Departments (comma separated):</label>
                <input
                  type="text"
                  value={newProgDepts}
                  onChange={(e) => setNewProgDepts(e.target.value)}
                  placeholder="e.g. Machine Operators, Cutting, Iron Employees"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Program Terms:</label>
                <textarea
                  rows={2}
                  value={newProgNotes}
                  onChange={(e) => setNewProgNotes(e.target.value)}
                  placeholder="e.g. Government wage relief grant for textile sewing workforce..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProgModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition cursor-pointer"
                >
                  Save Scheme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
