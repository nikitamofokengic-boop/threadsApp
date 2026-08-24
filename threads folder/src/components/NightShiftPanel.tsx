import React, { useState, useEffect } from 'react';
import { Moon, Sun, Sparkles, Clock, ShieldCheck, Zap, X, Users, Edit3, Check } from 'lucide-react';

interface NightShiftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isNightShift: boolean;
  onToggleNightShift: (active: boolean) => void;
  nightDifferential: number;
  onUpdateNightDifferential?: (rate: number) => void;
  nightStart?: string;
  nightEnd?: string;
  onUpdateNightHours?: (start: string, end: string) => void;
  activeHeadcount: number;
  currency: string;
}

export default function NightShiftPanel({
  isOpen,
  onClose,
  isNightShift,
  onToggleNightShift,
  nightDifferential,
  onUpdateNightDifferential,
  nightStart = '18:30',
  nightEnd = '05:00',
  onUpdateNightHours,
  activeHeadcount,
  currency
}: NightShiftPanelProps) {
  const [localStart, setLocalStart] = useState(nightStart);
  const [localEnd, setLocalEnd] = useState(nightEnd);
  const [isEditingHours, setIsEditingHours] = useState(false);

  useEffect(() => {
    setLocalStart(nightStart);
    setLocalEnd(nightEnd);
  }, [nightStart, nightEnd]);

  if (!isOpen) return null;

  const calculateHoursDuration = (sTime: string, eTime: string) => {
    const [sH, sM] = sTime.split(':').map(Number);
    const [eH, eM] = eTime.split(':').map(Number);
    if (isNaN(sH) || isNaN(eH)) return 10.5;
    let startMins = sH * 60 + (sM || 0);
    let endMins = eH * 60 + (eM || 0);
    if (endMins <= startMins) {
      endMins += 24 * 60; // crosses midnight
    }
    const diff = (endMins - startMins) / 60;
    return Math.round(diff * 10) / 10;
  };

  const currentDuration = calculateHoursDuration(localStart, localEnd);

  const handleSaveHours = () => {
    if (onUpdateNightHours) {
      onUpdateNightHours(localStart, localEnd);
    }
    setIsEditingHours(false);
  };

  const presets = [
    { start: '18:30', end: '05:00', label: '10.5h (18:30-05:00) [Default Auto]' },
    { start: '18:00', end: '06:00', label: '12h (18:00-06:00)' },
    { start: '19:00', end: '07:00', label: '12h (19:00-07:00)' },
    { start: '20:00', end: '05:00', label: '9h (20:00-05:00)' },
    { start: '22:00', end: '06:00', label: '8h (22:00-06:00)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-purple-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Lighter Elegant Violet Header */}
        <div className="p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl text-amber-300 shadow-md">
              <Moon className="w-6 h-6 fill-amber-300/30" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white tracking-wide">
                  Night Shift Control Panel
                </h2>
                <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-black uppercase font-mono">
                  {nightStart} - {nightEnd}
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Customize night operational hours and toggle the Lighter Purple Theme.
              </p>
            </div>
          </div>
        </div>

        {/* Panel Body */}
        <div className="p-6 space-y-5 bg-purple-50/30">

          {/* Master Toggle Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isNightShift 
              ? 'bg-purple-100/90 border-purple-300 ring-2 ring-purple-400/40 shadow-sm' 
              : 'bg-white border-purple-100'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isNightShift ? 'bg-purple-700 text-amber-300 shadow-sm' : 'bg-purple-100 text-purple-700'}`}>
                  {isNightShift ? <Sparkles className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-purple-950 flex items-center gap-2">
                    Night Shift Purple Theme
                    {isNightShift && (
                      <span className="px-2 py-0.5 bg-purple-700 text-white text-[9px] font-bold rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-purple-800/80 mt-0.5">
                    {isNightShift 
                      ? 'Lighter purple theme active for high-contrast, comfortable night shift monitoring.' 
                      : 'Toggle on to activate the crisp light purple dashboard theme.'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => onToggleNightShift(!isNightShift)}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isNightShift ? 'bg-purple-700' : 'bg-slate-300'
                }`}
              >
                <span className="sr-only">Toggle Night Shift</span>
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[10px] ${
                    isNightShift ? 'translate-x-6 text-purple-900' : 'translate-x-0 text-slate-400'
                  }`}
                >
                  {isNightShift ? '🌙' : '☀️'}
                </span>
              </button>
            </div>
          </div>

          {/* EDITABLE NIGHT SHIFT HOURS SECTION */}
          <div className="p-4 bg-white border border-purple-200 rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-700" /> Editable Shift Operating Hours
              </label>
              {!isEditingHours ? (
                <button
                  type="button"
                  onClick={() => setIsEditingHours(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> Edit Hours
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveHours}
                  className="px-2.5 py-1 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Check className="w-3 h-3" /> Save Hours
                </button>
              )}
            </div>

            {!isEditingHours ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Shift Cycle</span>
                  <p className="text-sm font-extrabold text-purple-950 font-mono mt-0.5">
                    {nightStart} – {nightEnd}
                  </p>
                </div>
                <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Duration</span>
                  <p className="text-sm font-extrabold text-purple-950 font-mono mt-0.5">
                    {currentDuration} Hours / Cycle
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 mb-1">
                      Night Shift Start Time
                    </label>
                    <input
                      type="time"
                      value={localStart}
                      onChange={(e) => setLocalStart(e.target.value)}
                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-300 rounded-xl text-xs font-mono font-bold text-purple-950 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 mb-1">
                      Night Shift End Time
                    </label>
                    <input
                      type="time"
                      value={localEnd}
                      onChange={(e) => setLocalEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-300 rounded-xl text-xs font-mono font-bold text-purple-950 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Hour Presets */}
                <div>
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block mb-1.5">
                    Quick Preset Cycles:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLocalStart(p.start);
                          setLocalEnd(p.end);
                          if (onUpdateNightHours) onUpdateNightHours(p.start, p.end);
                          setIsEditingHours(false);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg transition cursor-pointer border border-purple-200"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white border border-purple-200 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-purple-800 text-xs font-bold mb-1">
                <Clock className="w-4 h-4 text-purple-600" /> Shift Active
              </div>
              <p className="text-sm font-extrabold text-purple-950 font-mono">{nightStart} - {nightEnd}</p>
              <p className="text-[10px] text-purple-600 font-medium mt-0.5">{currentDuration}-Hour Night Rotation</p>
            </div>

            <div className="p-3.5 bg-white border border-purple-200 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-purple-800 text-xs font-bold mb-1">
                <Users className="w-4 h-4 text-purple-600" /> Active Night Crew
              </div>
              <p className="text-sm font-extrabold text-purple-950 font-mono">{activeHeadcount} Operators</p>
              <p className="text-[10px] text-purple-600 font-medium mt-0.5">On Factory Duty</p>
            </div>
          </div>

          {/* Night Shift Differential Rate Adjustment */}
          <div className="p-4 bg-white border border-purple-200 rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-700 fill-current" /> Night Allowance Differential
              </label>
              <span className="text-xs font-mono font-bold text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-300">
                +{nightDifferential}% Rate
              </span>
            </div>
            <p className="text-[11px] text-purple-800/80">
              Additional percentage wage differential added for night shift workers.
            </p>
            {onUpdateNightDifferential && (
              <div className="flex items-center gap-2 pt-1">
                {[10, 15, 20, 25].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onUpdateNightDifferential(rate)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      nightDifferential === rate
                        ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                        : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    +{rate}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Night Shift Operational Safety Checklist */}
          <div className="p-4 bg-purple-100/60 border border-purple-200 rounded-2xl space-y-2">
            <h4 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Night Shift Protocol Checklist
            </h4>
            <ul className="text-xs space-y-1.5 text-purple-900 pl-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Night Supervisor & First Aid Officer on Duty
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Machine Safety Guards & Lighting Inspection Cleared
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" /> Clock-In Biometric Scanner set to Night Shift Rotation
              </li>
            </ul>
          </div>

          {/* Footer Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (isEditingHours) handleSaveHours();
                onClose();
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Done
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
