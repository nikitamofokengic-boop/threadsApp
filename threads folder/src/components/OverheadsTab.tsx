import React, { useState } from 'react';
import { Overheads } from '../types';
import ConfirmModal from './ConfirmModal';
import { Building, Zap, Clipboard, Package, DollarSign, Calendar, Trash2, RotateCcw } from 'lucide-react';

interface OverheadsTabProps {
  overheads: Overheads;
  onUpdateOverheads: (updated: Overheads) => void;
  canEditOverheads: boolean;
  currency: string;
}

export default function OverheadsTab({
  overheads,
  onUpdateOverheads,
  canEditOverheads,
  currency
}: OverheadsTabProps) {
  const [rent, setRent] = useState(overheads.rent);
  const [utilities, setUtilities] = useState(overheads.utilities);
  const [admin, setAdmin] = useState(overheads.admin);
  const [other, setOther] = useState(overheads.other);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateOverheads({ rent, utilities, admin, other });
  };

  const handleDeleteOverheads = () => {
    setShowResetModal(true);
  };

  const executeResetOverheads = () => {
    setRent(0);
    setUtilities(0);
    setAdmin(0);
    setOther(0);
    onUpdateOverheads({ rent: 0, utilities: 0, admin: 0, other: 0 });
  };

  const monthlyTotal = rent + utilities + admin + other;
  const dailyAmortized = monthlyTotal / 26; // 26 working days default

  return (
    <div className="space-y-6 text-slate-800">
      {/* Pay Cycle Standard Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3">
        <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
        <div className="text-xs text-indigo-900">
          <strong className="font-extrabold uppercase tracking-wider block">Monthly Overhead Allocation Period (21st – 20th Cycle):</strong>
          Fixed monthly expenditures are amortized across shift days within the 21st to 20th billing cycle.
        </div>
      </div>

      <div className="bento-card p-6">
        <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">
          Monthly Non-Labour Overheads (21st to 20th Billing Period)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overheads Input Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                  <Building className="w-3.5 h-3.5 text-indigo-600" /> Rent & Building Lease
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono text-sm">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    value={rent}
                    onChange={(e) => setRent(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!canEditOverheads}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" /> Electricity, Water & Fuel
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono text-sm">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    value={utilities}
                    onChange={(e) => setUtilities(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!canEditOverheads}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                  <Clipboard className="w-3.5 h-3.5 text-indigo-600" /> Admin & Secretarial Office
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono text-sm">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    value={admin}
                    onChange={(e) => setAdmin(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!canEditOverheads}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5 text-indigo-600" /> Freight, Logistics & Cleaning
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono text-sm">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    value={other}
                    onChange={(e) => setOther(Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={!canEditOverheads}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {canEditOverheads && (
              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleDeleteOverheads}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer hover:scale-[1.01] flex items-center gap-1"
                  title="Delete / Reset overhead expense entries"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Reset / Clear Overheads
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer hover:scale-[1.01]"
                >
                  Save Monthly Overheads
                </button>
              </div>
            )}
          </form>

          {/* Overheads breakdown visualization */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Projected Overheads</span>
                <h4 className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {currency} {monthlyTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} <span className="text-xs text-slate-500 font-normal">/month</span>
                </h4>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daily Amortization</span>
                <h4 className="text-xl font-extrabold text-indigo-700 font-mono mt-1">
                  {currency} {dailyAmortized.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} <span className="text-xs text-slate-500 font-normal">/day</span>
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Based on 26 operational days</p>
              </div>
            </div>

            {/* Overheads proportional breakdown bars */}
            <div className="space-y-2 mt-6">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Allocation share</span>
              <div className="w-full h-3.5 bg-slate-200 rounded-lg overflow-hidden flex border border-slate-300">
                <div 
                  className="h-full bg-indigo-600" 
                  title={`Rent: ${(rent/monthlyTotal*100).toFixed(0)}%`}
                  style={{ width: `${monthlyTotal > 0 ? (rent / monthlyTotal * 100) : 25}%` }} 
                />
                <div 
                  className="h-full bg-indigo-400" 
                  title={`Utilities: ${(utilities/monthlyTotal*100).toFixed(0)}%`}
                  style={{ width: `${monthlyTotal > 0 ? (utilities / monthlyTotal * 100) : 25}%` }} 
                />
                <div 
                  className="h-full bg-purple-500" 
                  title={`Admin: ${(admin/monthlyTotal*100).toFixed(0)}%`}
                  style={{ width: `${monthlyTotal > 0 ? (admin / monthlyTotal * 100) : 25}%` }} 
                />
                <div 
                  className="h-full bg-slate-400" 
                  title={`Other: ${(other/monthlyTotal*100).toFixed(0)}%`}
                  style={{ width: `${monthlyTotal > 0 ? (other / monthlyTotal * 100) : 25}%` }} 
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-600 pt-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full" /> Rent ({(monthlyTotal > 0 ? (rent/monthlyTotal*100) : 25).toFixed(0)}%)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full" /> Utilities ({(monthlyTotal > 0 ? (utilities/monthlyTotal*100) : 25).toFixed(0)}%)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full" /> Admin ({(monthlyTotal > 0 ? (admin/monthlyTotal*100) : 25).toFixed(0)}%)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full" /> Other ({(monthlyTotal > 0 ? (other/monthlyTotal*100) : 25).toFixed(0)}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Overheads Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={executeResetOverheads}
        title="Reset Monthly Overheads"
        message="Are you sure you want to reset all monthly non-labour overhead expenses to 0?"
        subMessage="This will clear Rent, Utilities, Admin, and Other operational overhead allocations."
        confirmText="Yes, Reset Overheads"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="reset"
      />
    </div>
  );
}
