import React, { useState } from 'react';
import { SheetData, Department, EmployeeRole } from '../types';
import { FolderPlus, Building2, CheckCircle2, X, Plus, AlertCircle } from 'lucide-react';

interface AddDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheet: SheetData;
  allSheets: SheetData[];
  onUpdateSheet: (updatedSheet: SheetData) => void;
  onUpdateAllSheets?: (updatedSheets: SheetData[]) => void;
  currency: string;
}

export default function AddDepartmentModal({
  isOpen,
  onClose,
  currentSheet,
  allSheets,
  onUpdateSheet,
  onUpdateAllSheets,
  currency
}: AddDepartmentModalProps) {
  const [deptName, setDeptName] = useState('');
  const [roleTitle, setRoleTitle] = useState('General Staff');
  const [permCount, setPermCount] = useState<number>(0);
  const [tempCount, setTempCount] = useState<number>(0);
  const [permWage, setPermWage] = useState<number>(139.25);
  const [tempWage, setTempWage] = useState<number>(125.95);
  const [applyScope, setApplyScope] = useState<'CURRENT_SHEET' | 'ALL_SHEETS'>('CURRENT_SHEET');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = deptName.trim();
    if (!cleanName) {
      setError('Please enter a valid department name.');
      return;
    }

    const cleanRoleTitle = roleTitle.trim();
    if (!cleanRoleTitle) {
      setError('Please enter an initial role title for this department.');
      return;
    }

    // Check duplicate department name
    const existing = currentSheet.departments.find(
      d => d.name.toUpperCase() === cleanName.toUpperCase()
    );
    if (existing) {
      setError(`A department named "${cleanName}" already exists on this sheet.`);
      return;
    }

    const newDeptId = `dept_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRole: EmployeeRole = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanRoleTitle,
      perm: Math.max(0, permCount),
      temp: Math.max(0, tempCount),
      permWage: Math.max(0, permWage),
      tempWage: Math.max(0, tempWage)
    };

    const newDept: Department = {
      id: newDeptId,
      name: cleanName.toUpperCase(),
      roles: [newRole]
    };

    if (applyScope === 'ALL_SHEETS' && onUpdateAllSheets) {
      const updatedSheets = allSheets.map(s => {
        // Only append if not already existing in that sheet
        if (s.departments.some(d => d.name.toUpperCase() === cleanName.toUpperCase())) {
          return s;
        }
        return {
          ...s,
          departments: [...s.departments, newDept]
        };
      });
      onUpdateAllSheets(updatedSheets);
      setSuccessMsg(`Department "${cleanName.toUpperCase()}" successfully added across all ${allSheets.length} date logs!`);
    } else {
      const updatedSheet: SheetData = {
        ...currentSheet,
        departments: [...currentSheet.departments, newDept]
      };
      onUpdateSheet(updatedSheet);
      setSuccessMsg(`Department "${cleanName.toUpperCase()}" successfully added to current sheet (${currentSheet.label})!`);
    }

    setTimeout(() => {
      setSuccessMsg(null);
      setDeptName('');
      setRoleTitle('General Staff');
      setPermCount(0);
      setTempCount(0);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-pink-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-2xl text-white shadow-md">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-wide">
                Add New Department
              </h2>
              <p className="text-xs text-pink-200/90 mt-0.5">
                Create a new organizational department under headcount staffing.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Department Name */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Department Name
            </label>
            <input
              type="text"
              required
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="e.g. PACKING & WAREHOUSE"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl font-bold uppercase focus:ring-2 focus:ring-pink-500 focus:outline-none text-sm shadow-2xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Common departments: CUTTING, SEWING / PRODUCTION, QC, PACKING, FINISHING, MAINTENANCE
            </p>
          </div>

          {/* Initial Role Config */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
              Initial Role Setup
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Primary Role Title
              </label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Packer / Machine Operator"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Perm Staff Count
                </label>
                <input
                  type="number"
                  min={0}
                  value={permCount}
                  onChange={(e) => setPermCount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Temp Staff Count
                </label>
                <input
                  type="number"
                  min={0}
                  value={tempCount}
                  onChange={(e) => setTempCount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Perm Daily Wage ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={permWage}
                  onChange={(e) => setPermWage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Temp Daily Wage ({currency})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={tempWage}
                  onChange={(e) => setTempWage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Scope Target */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Apply Department To
            </label>
            <select
              value={applyScope}
              onChange={(e) => setApplyScope(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs cursor-pointer"
            >
              <option value="CURRENT_SHEET">Current Shift Date Log Only ({currentSheet.label})</option>
              <option value="ALL_SHEETS">All {allSheets.length} Shift Date Logs across System</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition cursor-pointer hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
