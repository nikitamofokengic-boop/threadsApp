import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Download, 
  Upload, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  Database, 
  ShieldCheck,
  Clock,
  RotateCcw,
  Sparkles,
  Trash2,
  PieChart,
  FileSpreadsheet,
  Users,
  Shield,
  X
} from 'lucide-react';
import { 
  getRollingBackups, 
  getPendingSync, 
  flushPendingSyncToCloud, 
  RollingBackup,
  getLastLocalModifiedTs,
  getStorageUsageInfo,
  deleteRollingBackup,
  StorageUsageInfo,
  FullSystemBackupPayload,
  formatBytes
} from '../lib/offlineStorage';
import { SheetData, Overheads, PayrollParams, SubsidiaryProfile, SubsidiaryAllocation, WageSubsidyProgram, User, RolePermissions } from '../types';

interface StorageBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  firebaseConnected: boolean;
  lastSyncTime: number;
  lastSyncAuthor: string;
  onTriggerSync: (silent?: boolean) => Promise<void>;
  onRestoreSnapshot: (snapshot: any) => void;
  onRestoreFullSystem?: (fullData: FullSystemBackupPayload) => void;
  currentSheets: SheetData[];
  currentOverheads: Overheads;
  currentPayroll: PayrollParams;
  currentSubsidiaries: SubsidiaryProfile[];
  currentAllocations: SubsidiaryAllocation[];
  currentPrograms: WageSubsidyProgram[];
  currentHiddenIds?: string[];
  currentNightShift?: { start: string; end: string; differential: number };
  currentUsers?: (User & { password?: string })[];
  currentRoles?: Record<string, RolePermissions>;
}

export default function StorageBackupModal({
  isOpen,
  onClose,
  isOnline,
  firebaseConnected,
  lastSyncTime,
  lastSyncAuthor,
  onTriggerSync,
  onRestoreSnapshot,
  onRestoreFullSystem,
  currentSheets,
  currentOverheads,
  currentPayroll,
  currentSubsidiaries,
  currentAllocations,
  currentPrograms,
  currentHiddenIds = [],
  currentNightShift,
  currentUsers = [],
  currentRoles = {}
}: StorageBackupModalProps) {
  const [backups, setBackups] = useState<RollingBackup[]>([]);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pendingSync, setPendingSync] = useState(getPendingSync());
  const [storageInfo, setStorageInfo] = useState<StorageUsageInfo>(getStorageUsageInfo());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshState = () => {
    setBackups(getRollingBackups());
    setPendingSync(getPendingSync());
    setStorageInfo(getStorageUsageInfo());
  };

  useEffect(() => {
    if (isOpen) {
      refreshState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasPending = Boolean(pendingSync && (pendingSync.workspace || pendingSync.users || pendingSync.roles));
  const lastLocalTs = getLastLocalModifiedTs();

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setSyncFeedback({ text, type });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleManualFlush = async () => {
    setIsSyncingNow(true);
    try {
      const res = await flushPendingSyncToCloud();
      await onTriggerSync(false);
      refreshState();
      if (res.success) {
        showFeedback("All offline data has been synced to Cloud Firestore successfully!", 'success');
      } else {
        showFeedback(res.error || "Sync deferred. Data is safely protected in local storage.", 'info');
      }
    } catch (e: any) {
      showFeedback("Network error. Your changes remain 100% saved on this device.", 'error');
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleExportFullSystemJson = () => {
    const exportData: FullSystemBackupPayload = {
      version: "2026.2",
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      workspace: {
        sheets: currentSheets,
        overheads: currentOverheads,
        payrollParams: currentPayroll,
        subsidiaries: currentSubsidiaries,
        subsidiaryAllocations: currentAllocations,
        subsidyPrograms: currentPrograms,
        hiddenSheetIds: currentHiddenIds,
        nightShift: currentNightShift,
        lastUpdated: Date.now(),
        updatedBy: 'Backup Export'
      },
      users: currentUsers,
      roles: currentRoles
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threads_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback("Full system backup exported successfully!", 'success');
  };

  const handleExportSingleBackupJson = (bk: RollingBackup) => {
    const exportData = {
      version: "2026.2",
      exportedAt: new Date().toISOString(),
      timestamp: bk.timestamp,
      dateLabel: bk.dateStr,
      workspace: bk.snapshot
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threads_snapshot_${bk.dateStr.replace(/[\/\:\s,]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(`Exported snapshot from ${bk.dateStr}`, 'success');
  };

  const handleDeleteSingleBackup = (id: string, dateStr: string) => {
    if (window.confirm(`Delete rolling backup snapshot from ${dateStr}?`)) {
      deleteRollingBackup(id);
      refreshState();
      showFeedback(`Removed backup snapshot from ${dateStr}`, 'info');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Check if full system backup or workspace snapshot
        const isFullSystem = Boolean(parsed.workspace && (parsed.users || parsed.roles));
        const workspaceData = parsed.workspace || parsed;

        if (workspaceData && Array.isArray(workspaceData.sheets)) {
          const shiftCount = workspaceData.sheets.length;
          const promptMsg = isFullSystem
            ? `Restore FULL SYSTEM backup with ${shiftCount} shift dates, user accounts, and security roles? This will update your active workspace and database.`
            : `Restore workspace snapshot with ${shiftCount} shift dates? This will update your active workspace.`;

          if (window.confirm(promptMsg)) {
            if (isFullSystem && onRestoreFullSystem) {
              onRestoreFullSystem(parsed as FullSystemBackupPayload);
            } else {
              onRestoreSnapshot(workspaceData);
            }
            refreshState();
            showFeedback("Backup successfully restored to workspace!", 'success');
            setTimeout(() => {
              onClose();
            }, 1200);
          }
        } else {
          showFeedback("Invalid backup structure: missing sheets array.", 'error');
        }
      } catch (err) {
        showFeedback("Failed to parse backup JSON file. Please ensure it is valid JSON.", 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-pink-500 to-rose-500 text-white rounded-2xl shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-wide uppercase flex items-center gap-2">
                Storage, Backup & Cloud Sync Manager
              </h2>
              <p className="text-xs text-slate-500">
                Multi-layer storage: Persistent local cache, rolling snapshots, and real-time Cloud Firestore synchronization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {syncFeedback && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn border ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : syncFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}>
            {syncFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {syncFeedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {syncFeedback.type === 'info' && <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />}
            <span>{syncFeedback.text}</span>
          </div>
        )}

        {/* Storage Health & Capacity Meter */}
        <div className="p-4 bg-gradient-to-r from-slate-50 to-pink-50/40 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-pink-600" />
              Browser Storage Capacity & Health
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {storageInfo.usedFormatted} used of ~{storageInfo.capacityFormatted} ({storageInfo.percentageUsed}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                storageInfo.percentageUsed > 80 
                  ? 'bg-rose-500' 
                  : storageInfo.percentageUsed > 50 
                  ? 'bg-amber-500' 
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(4, storageInfo.percentageUsed)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Shift Dates</span>
              <span className="text-sm font-black text-slate-800 font-mono">{storageInfo.sheetsCount}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Rolling Snapshots</span>
              <span className="text-sm font-black text-slate-800 font-mono">{storageInfo.backupsCount} / 5</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Cached Keys</span>
              <span className="text-sm font-black text-slate-800 font-mono">{storageInfo.itemCount}</span>
            </div>
          </div>
        </div>

        {/* Live Storage & Cloud Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Local Device Storage Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-slate-800" />
                  Local Device Storage
                </span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  Zero Loss Safe
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Last saved locally: <strong className="font-mono text-slate-900">{lastLocalTs ? new Date(lastLocalTs).toLocaleTimeString('en-ZA') : 'Just now'}</strong>
              </p>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>All edits written instantly to persistent device storage</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200 font-mono">
              Auto-pruning active • Quota protection enabled
            </div>
          </div>

          {/* Cloud Firestore Status Card */}
          <div className={`p-4 rounded-2xl border space-y-2.5 flex flex-col justify-between ${
            hasPending 
              ? 'bg-amber-50/90 border-amber-300' 
              : firebaseConnected && isOnline
                ? 'bg-emerald-50/70 border-emerald-200' 
                : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-800 flex items-center gap-1.5">
                  {hasPending ? (
                    <Cloud className="w-4 h-4 text-amber-600 animate-pulse" />
                  ) : firebaseConnected && isOnline ? (
                    <Cloud className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <CloudOff className="w-4 h-4 text-slate-500" />
                  )}
                  Cloud Firestore
                </span>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                  hasPending 
                    ? 'bg-amber-200 text-amber-900' 
                    : firebaseConnected && isOnline 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-200 text-slate-700'
                }`}>
                  {hasPending ? 'Pending Push' : firebaseConnected && isOnline ? 'Synced & Live' : 'Offline Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {hasPending 
                  ? <span className="text-amber-900 font-bold">Unsynced offline edits waiting in device queue</span>
                  : <>Last synced: <strong className="font-mono text-slate-800">{new Date(lastSyncTime).toLocaleTimeString('en-ZA')}</strong> by <em>{lastSyncAuthor}</em></>
                }
              </p>
            </div>

            <button
              type="button"
              onClick={handleManualFlush}
              disabled={isSyncingNow}
              className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-700 ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span>{isSyncingNow ? 'Syncing to Cloud...' : 'Force Cloud Push & Pull'}</span>
            </button>
          </div>
        </div>

        {/* Automatic Rolling Local Backups */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-pink-600" />
              Automatic Rolling Local Snapshots ({backups.length} / 5)
            </h3>
            <span className="text-[10px] text-slate-400">Auto-captured on every change</span>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {backups.length === 0 ? (
              <div className="text-center py-5 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Snapshots are automatically created as you edit shift sheets.
              </div>
            ) : (
              backups.map((bk) => (
                <div 
                  key={bk.id} 
                  className="p-3 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">{bk.dateStr}</span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        {bk.totalSheets} shift dates • {bk.totalHeadcount} total workers
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExportSingleBackupJson(bk)}
                      title="Download this snapshot as a JSON file"
                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Restore local snapshot from ${bk.dateStr}? This will update your active workspace.`)) {
                          onRestoreSnapshot(bk.snapshot);
                          refreshState();
                          showFeedback(`Restored workspace snapshot from ${bk.dateStr}`, 'success');
                          setTimeout(() => onClose(), 1200);
                        }
                      }}
                      className="px-3 py-1 text-[11px] font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSingleBackup(bk.id, bk.dateStr)}
                      title="Delete this snapshot"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Manual Export & Import Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportFullSystemJson}
              className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Download Full Backup (JSON)</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportJson} 
              accept=".json" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs border border-slate-200"
            >
              <Upload className="w-3.5 h-3.5 text-slate-700" />
              <span>Import Backup JSON</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
