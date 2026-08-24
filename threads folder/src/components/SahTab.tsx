import React, { useState } from 'react';
import { SheetData, SahRecord } from '../types';
import EditableCell from './EditableCell';
import { Plus, Trash2, HelpCircle, ShieldAlert, ShieldCheck, Clock, Layers, Sparkles, CheckCircle2 } from 'lucide-react';

interface SahTabProps {
  sheet: SheetData;
  onUpdateSheet: (updated: SheetData) => void;
  canEditSAH: boolean;
}

export default function SahTab({
  sheet,
  onUpdateSheet,
  canEditSAH
}: SahTabProps) {
  const [newLine, setNewLine] = useState('');
  const [newStyle, setNewStyle] = useState('');
  const [newMos, setNewMos] = useState(25);
  const [newOutput, setNewOutput] = useState(0);
  const [newSmv, setNewSmv] = useState(10.0);
  const [newShiftHours, setNewShiftHours] = useState(9.0);
  const [showAddForm, setShowAddForm] = useState(false);

  // Active SAH mode and standard shift duration (defaults to 9.0 hours)
  const currentMode = sheet.sahMode || 'standard_9hrs';
  const standardHours = sheet.standardShiftHours || 9.0;

  const handleUpdateSahMode = (mode: 'standard_9hrs' | 'piece_rate') => {
    onUpdateSheet({
      ...sheet,
      sahMode: mode
    });
  };

  const handleUpdateStandardHours = (hrs: number) => {
    const valid = Math.max(1, Math.min(24, hrs));
    onUpdateSheet({
      ...sheet,
      standardShiftHours: valid
    });
  };

  const handleUpdateRecord = (id: string, field: keyof SahRecord, value: any) => {
    const updatedSah = (sheet.sahData || []).map((record) => {
      if (record.id !== id) return record;
      return { ...record, [field]: value };
    });
    onUpdateSheet({ ...sheet, sahData: updatedSah });
  };

  const handleDeleteRecord = (id: string) => {
    const updatedSah = (sheet.sahData || []).filter((record) => record.id !== id);
    onUpdateSheet({ ...sheet, sahData: updatedSah });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLine.trim()) return;

    const newRecord: SahRecord = {
      id: `sah_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      line: newLine.trim(),
      style: newStyle.trim() || 'General CMT',
      mos: Math.max(1, newMos),
      output: Math.max(0, newOutput),
      smv: Math.max(0.1, newSmv),
      shiftHours: Math.max(1, newShiftHours || standardHours)
    };

    onUpdateSheet({
      ...sheet,
      sahData: [...(sheet.sahData || []), newRecord]
    });

    setNewLine('');
    setNewStyle('');
    setNewMos(25);
    setNewOutput(0);
    setNewSmv(10.0);
    setNewShiftHours(standardHours);
    setShowAddForm(false);
  };

  // Grand stats calculation
  const list = sheet.sahData || [];
  const totalMos = list.reduce((sum, r) => sum + r.mos, 0);
  const totalOutput = list.reduce((sum, r) => sum + r.output, 0);
  const totalSahHrs = list.reduce((sum, r) => sum + (r.output * r.smv) / 60, 0);
  
  // Shift hours capacity: using line custom shift hours or standard shift hours (default 9.0 hrs)
  const totalCapacityHours = list.reduce((sum, r) => sum + (r.mos * (r.shiftHours || standardHours)), 0);
  const avgEfficiency = totalCapacityHours > 0 ? (totalSahHrs / totalCapacityHours * 100) : 0;

  // Real-time preview for form
  const targetOutput100 = newSmv > 0 ? Math.round((newMos * newShiftHours * 60) / newSmv) : 0;

  return (
    <div className="space-y-6 text-slate-800">
      {/* RBAC Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
        canEditSAH 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-slate-100 border border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          {canEditSAH ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>UNLOCKED: Industrial Engineers can set SAH calculation options, adjust shift hours, log production line outputs, and track line efficiency.</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
              <span>READ-ONLY VIEW: Line SAH details are locked. Only Industrial Engineers can modify shift logs or change calculation modes.</span>
            </>
          )}
        </div>
      </div>

      {/* Production System & Shift Duration Mode Selector */}
      <div className="bento-card p-5 space-y-4 border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-white to-pink-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
          <div>
            <h3 className="text-xs font-extrabold text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" /> Factory System & Shift Hours Configuration
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Choose your factory operational model — standard 9-hour shift system vs piece-rate system.
            </p>
          </div>

          {/* Standard Shift Duration Configurator */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase">Standard Shift:</span>
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              disabled={!canEditSAH}
              value={standardHours}
              onChange={(e) => handleUpdateStandardHours(parseFloat(e.target.value) || 9.0)}
              className="w-14 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg text-center focus:outline-none"
            />
            <span className="text-xs font-bold text-slate-700">Hours</span>
            {standardHours !== 9.0 && canEditSAH && (
              <button
                type="button"
                onClick={() => handleUpdateStandardHours(9.0)}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                Reset to 9.0h
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Mode 1: Standardized 9-Hour Shift System (Non Piece-Rate) */}
          <div 
            onClick={() => canEditSAH && handleUpdateSahMode('standard_9hrs')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              currentMode === 'standard_9hrs'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                : 'bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${currentMode === 'standard_9hrs' ? 'text-indigo-200' : 'text-indigo-600'}`} />
                <span className="text-xs font-extrabold uppercase tracking-wider">
                  Standardized 9-Hour Shift Mode
                </span>
              </div>
              {currentMode === 'standard_9hrs' && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-white text-indigo-800 font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" /> ACTIVE
                </span>
              )}
            </div>
            <p className={`text-[11px] mt-2 leading-relaxed ${currentMode === 'standard_9hrs' ? 'text-indigo-100' : 'text-slate-500'}`}>
              Designed for non-piece-rate factories running a standard <strong>{standardHours} Hour Shift</strong>. Computes efficiency based on fixed operator working hours (<span className="font-mono">MOS × {standardHours}h</span>).
            </p>
          </div>

          {/* Mode 2: Piece-Rate / Dynamic Volume System */}
          <div 
            onClick={() => canEditSAH && handleUpdateSahMode('piece_rate')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              currentMode === 'piece_rate'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                : 'bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Layers className={`w-4 h-4 ${currentMode === 'piece_rate' ? 'text-indigo-200' : 'text-indigo-600'}`} />
                <span className="text-xs font-extrabold uppercase tracking-wider">
                  Piece-Rate / Flexible Mode
                </span>
              </div>
              {currentMode === 'piece_rate' && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-white text-indigo-800 font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" /> ACTIVE
                </span>
              )}
            </div>
            <p className={`text-[11px] mt-2 leading-relaxed ${currentMode === 'piece_rate' ? 'text-indigo-100' : 'text-slate-500'}`}>
              For piece-rate factories where workers earn based on unit production volume. SAH is evaluated dynamically directly against piece output SMVs.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Operators (MOS)</p>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">{totalMos}</h4>
          <p className="text-[10px] text-slate-500 mt-1">Allocated across {list.length} lines</p>
        </div>

        <div className="bento-card p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Available Shift Capacity</p>
          <h4 className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">{totalCapacityHours.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} hrs</h4>
          <p className="text-[10px] text-slate-500 mt-1">
            {currentMode === 'standard_9hrs' ? `MOS × ${standardHours} Std Shift Hours` : 'Piece-rate capacity'}
          </p>
        </div>

        <div className="bento-card p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Standard Allowed Hours (SAH)</p>
          <h4 className="text-2xl font-extrabold text-indigo-700 mt-2 font-mono">{totalSahHrs.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} hrs</h4>
          <p className="text-[10px] text-slate-500 mt-1">(Actual Output × SMV) ÷ 60 mins</p>
        </div>

        <div className="bento-card p-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Line Efficiency Avg</p>
          <h4 className={`text-2xl font-extrabold mt-2 font-mono ${
            avgEfficiency >= 75 ? 'text-emerald-600' : avgEfficiency >= 55 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {avgEfficiency.toFixed(1)}%
          </h4>
          <p className="text-[10px] text-slate-500 mt-1">
            SAH Earned ÷ ({standardHours}h Capacity) × 100
          </p>
        </div>
      </div>

      {/* Main SAH Table */}
      <div className="bento-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-4 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              Standard Allowed Hours (SAH) & Shift Performance
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                {currentMode === 'standard_9hrs' ? `Set ${standardHours}h Shift Mode` : 'Piece Rate System'}
              </span>
            </h2>
          </div>
          {canEditSAH && !showAddForm && (
            <button
              onClick={() => {
                setNewShiftHours(standardHours);
                setShowAddForm(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Log Shift Line
            </button>
          )}
        </div>

        {/* Add Record Form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" /> Log Production Line Output ({standardHours}h Shift)
              </h3>
              {newSmv > 0 && newMos > 0 && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  Target for 100% Efficiency: <strong className="font-mono text-slate-900">{targetOutput100.toLocaleString()} pcs</strong> / shift
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Line Name</label>
                <input
                  type="text"
                  required
                  value={newLine}
                  onChange={(e) => setNewLine(e.target.value)}
                  placeholder="e.g. Line 1"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Style Code</label>
                <input
                  type="text"
                  value={newStyle}
                  onChange={(e) => setNewStyle(e.target.value)}
                  placeholder="e.g. NWJ1492/A"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operators (MOS)</label>
                <input
                  type="number"
                  min={1}
                  value={newMos}
                  onChange={(e) => setNewMos(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shift Hours</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={newShiftHours}
                  onChange={(e) => setNewShiftHours(parseFloat(e.target.value) || standardHours)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Units Produced Today</label>
                <input
                  type="number"
                  min={0}
                  value={newOutput}
                  onChange={(e) => setNewOutput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Style SMV (Mins)</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={newSmv}
                  onChange={(e) => setNewSmv(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer"
              >
                Save Shift Log
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-indigo-800 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3">Production Line</th>
                <th className="p-3">Style Reference</th>
                <th className="p-3 text-right">Operators (MOS)</th>
                <th className="p-3 text-right">Shift Hours</th>
                <th className="p-3 text-right">Target 100% (pcs)</th>
                <th className="p-3 text-right">Actual Output (pcs)</th>
                <th className="p-3 text-right">Style SMV (mins)</th>
                <th className="p-3 text-right">SAH Generated</th>
                <th className="p-3 text-right">
                  <div className="flex flex-col items-end">
                    <span>Line Efficiency</span>
                    {canEditSAH && (
                      <span className="text-[8px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 normal-case">
                        IE Editable (Auto-updates output)
                      </span>
                    )}
                  </div>
                </th>
                {canEditSAH && <th className="p-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={canEditSAH ? 10 : 9} className="p-8 text-center text-slate-500 font-medium bg-slate-50/50">
                    No production line output has been logged for this date.
                    {canEditSAH && (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="text-indigo-600 underline font-semibold ml-1 hover:text-indigo-800 cursor-pointer"
                      >
                        Create the first shift log
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                list.map((r) => {
                  const lineShiftHrs = r.shiftHours || standardHours;
                  const lineSah = (r.output * r.smv) / 60;
                  const shiftWorkHrs = r.mos * lineShiftHrs;
                  const lineEff = shiftWorkHrs > 0 ? (lineSah / shiftWorkHrs * 100) : 0;
                  const target100Pcs = r.smv > 0 ? Math.round((shiftWorkHrs * 60) / r.smv) : 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition text-slate-800">
                      <td className="p-3 font-semibold text-slate-900">
                        <EditableCell
                          value={r.line}
                          onSave={(val) => handleUpdateRecord(r.id, 'line', val)}
                          isEditable={canEditSAH}
                        />
                      </td>
                      <td className="p-3">
                        <EditableCell
                          value={r.style}
                          onSave={(val) => handleUpdateRecord(r.id, 'style', val)}
                          isEditable={canEditSAH}
                          placeholder="e.g. style name"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <EditableCell
                          value={r.mos}
                          type="number"
                          min={1}
                          max={999}
                          onSave={(val) => handleUpdateRecord(r.id, 'mos', val)}
                          isEditable={canEditSAH}
                          className="text-right font-mono"
                        />
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 font-bold">
                        <EditableCell
                          value={lineShiftHrs}
                          type="number"
                          min={1}
                          max={24}
                          step={0.5}
                          suffix=" hrs"
                          onSave={(val) => handleUpdateRecord(r.id, 'shiftHours', val)}
                          isEditable={canEditSAH}
                          className="text-right font-mono font-bold text-slate-700"
                        />
                        {lineShiftHrs > 9.0 && (
                          <div className="text-[9px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-0.5 inline-block font-sans">
                            ⚡ +{(lineShiftHrs - 9.0).toFixed(1)}h OT (after 5 PM @ 1.5x)
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400 font-medium">
                        {target100Pcs.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <EditableCell
                          value={r.output}
                          type="number"
                          min={0}
                          max={999999}
                          onSave={(val) => handleUpdateRecord(r.id, 'output', val)}
                          isEditable={canEditSAH}
                          className="text-right font-mono font-bold"
                        />
                      </td>
                      <td className="p-3 text-right bg-indigo-50/30">
                        <EditableCell
                          value={r.smv}
                          type="number"
                          min={0.1}
                          step={0.1}
                          suffix=" min"
                          onSave={(val) => handleUpdateRecord(r.id, 'smv', val)}
                          isEditable={canEditSAH}
                          className="text-right font-mono text-indigo-700 font-bold"
                        />
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-600 bg-slate-50/50 border-l border-r border-slate-200">
                        {lineSah.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} hrs
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {canEditSAH ? (
                            <EditableCell
                              value={parseFloat(lineEff.toFixed(1))}
                              type="number"
                              min={1}
                              max={200}
                              step={0.5}
                              suffix="%"
                              onSave={(desiredEff) => {
                                const lineShiftHrs = r.shiftHours || standardHours;
                                const capacityShiftMins = r.mos * lineShiftHrs * 60;
                                if (r.smv > 0) {
                                  const calculatedOutput = Math.round((desiredEff / 100 * capacityShiftMins) / r.smv);
                                  handleUpdateRecord(r.id, 'output', calculatedOutput);
                                }
                              }}
                              isEditable={canEditSAH}
                              className={`text-right font-mono font-bold ${
                                lineEff >= 75 
                                  ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' 
                                  : lineEff >= 55 
                                    ? 'text-amber-800 bg-amber-50 border border-amber-200' 
                                    : 'text-rose-800 bg-rose-50 border border-rose-200'
                              } px-2.5 py-1 rounded-lg text-xs hover:ring-2 hover:ring-indigo-400 cursor-pointer`}
                            />
                          ) : (
                            <span className={`font-mono font-bold ${
                              lineEff >= 75 
                                ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' 
                                : lineEff >= 55 
                                  ? 'text-amber-800 bg-amber-50 border border-amber-200' 
                                  : 'text-rose-800 bg-rose-50 border border-rose-200'
                            } px-2.5 py-0.5 rounded-full text-[10px]`}>
                              {lineEff.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>
                      {canEditSAH && (
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteRecord(r.id)}
                            title="Delete log row"
                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <td className="p-3 text-indigo-800 uppercase tracking-wider">TOTAL ACTIVE LINES</td>
                  <td></td>
                  <td className="p-3 text-right font-mono text-indigo-700">{totalMos} ops</td>
                  <td className="p-3 text-right font-mono text-slate-600">{standardHours}h std</td>
                  <td className="p-3 text-right font-mono text-slate-400">
                    {list.reduce((sum, r) => sum + (r.smv > 0 ? Math.round((r.mos * (r.shiftHours || standardHours) * 60) / r.smv) : 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right font-mono text-indigo-700">{totalOutput.toLocaleString('en-ZA')} pcs</td>
                  <td></td>
                  <td className="p-3 text-right font-mono text-indigo-700">{totalSahHrs.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} hrs</td>
                  <td className="p-3 text-right font-mono">
                    <span className={`px-2.5 py-0.5 rounded-full ${
                      avgEfficiency >= 75 
                        ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' 
                        : avgEfficiency >= 55 
                          ? 'text-amber-800 bg-amber-50 border border-amber-200' 
                          : 'text-rose-800 bg-rose-50 border border-rose-200'
                    }`}>
                      {avgEfficiency.toFixed(1)}% Avg
                    </span>
                  </td>
                  {canEditSAH && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Standardized 9-Hour System Operational Guide */}
      <div className="p-5 bg-indigo-50 border border-indigo-100 text-slate-700 rounded-2xl text-xs space-y-2">
        <h4 className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-900">
          <HelpCircle className="w-4 h-4 text-indigo-700" /> Standardized {standardHours}-Hour Shift & Weekday Overtime Guide
        </h4>
        <p>In factories operating on a <strong>Standardized {standardHours}-Hour Shift</strong> (without piece-rate system), line efficiency and overtime are calculated as follows:</p>
        <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600">
          <li><strong>Standard Weekday Shift</strong> = 08:00 to 17:00 (5:00 PM / {standardHours}.0 hours regular capacity).</li>
          <li><strong>Weekday Overtime</strong> = Any shift duration exceeding 9.0 hours (past 5:00 PM) is accounted as Weekday Overtime @ 1.5× hourly rate.</li>
          <li><strong>Available Capacity Hours</strong> = Operators (MOS) × {standardHours}.0 Shift Hours.</li>
          <li><strong>Target Output @ 100% Efficiency</strong> = (MOS × {standardHours}.0 Hours × 60 Mins) ÷ Style SMV.</li>
          <li><strong>SAH Earned</strong> = (Actual Output Quantity × Style SMV) ÷ 60 Minutes.</li>
          <li><strong>Line Efficiency %</strong> = SAH Earned ÷ Available Capacity Hours × 100.</li>
          <li>Target Efficiency Thresholds: <span className="text-emerald-700 font-semibold">Green (≥ 75%)</span>, <span className="text-amber-700 font-semibold">Amber (55% - 75%)</span>, and <span className="text-rose-700 font-semibold">Red (&lt; 55%)</span>.</li>
        </ul>
      </div>
    </div>
  );
}

