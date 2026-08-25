import { SheetData, Overheads, PayrollParams, SubsidiaryProfile, SubsidiaryAllocation, WageSubsidyProgram, User, RolePermissions } from '../types';
import { safeSetDoc, doc, appDataCol, usersCol, rolesCol, isFirestoreQuotaExceeded } from './firebase';

export interface WorkspaceSnapshot {
  sheets: SheetData[];
  overheads: Overheads;
  payrollParams: PayrollParams;
  subsidiaries?: SubsidiaryProfile[];
  subsidiaryAllocations?: SubsidiaryAllocation[];
  subsidyPrograms?: WageSubsidyProgram[];
  hiddenSheetIds?: string[];
  nightShift?: {
    start: string;
    end: string;
    differential: number;
  };
  lastUpdated: number;
  updatedBy: string;
}

export interface FullSystemBackupPayload {
  version: string;
  exportedAt: string;
  timestamp: number;
  workspace: WorkspaceSnapshot;
  users?: (User & { password?: string })[];
  roles?: Record<string, RolePermissions>;
}

export interface PendingSyncPayload {
  workspace?: WorkspaceSnapshot;
  users?: (User & { password?: string })[];
  roles?: Record<string, RolePermissions>;
  timestamp: number;
  attempts: number;
}

export interface RollingBackup {
  id: string;
  timestamp: number;
  dateStr: string;
  totalSheets: number;
  totalHeadcount: number;
  snapshot: WorkspaceSnapshot;
}

export interface StorageUsageInfo {
  usedBytes: number;
  usedFormatted: string;
  totalCapacityBytes: number;
  capacityFormatted: string;
  percentageUsed: number;
  itemCount: number;
  sheetsCount: number;
  backupsCount: number;
}

export const STORAGE_KEYS = {
  PENDING_SYNC: 'ph_offline_pending_sync',
  LAST_LOCAL_MODIFIED: 'ph_last_local_modified_ts',
  ROLLING_BACKUPS: 'ph_rolling_backups_v1',
  SHEETS: 'ph_factory_sheets',
  OVERHEADS: 'ph_factory_overheads',
  PAYROLL: 'ph_factory_payroll_params',
  SUBSIDIARIES: 'ph_factory_subsidiaries',
  SUBSIDIARY_ALLOCATIONS: 'ph_factory_subsidiary_allocations',
  SUBSIDY_PROGRAMS: 'ph_factory_subsidy_programs',
  HIDDEN_SHEETS: 'ph_hidden_sheet_ids',
  USERS_LIST: 'ph_users_list',
  ROLE_PERMISSIONS: 'ph_role_permissions',
  USER: 'ph_auth_user',
  ACTIVE_TAB: 'ph_active_tab',
  ACTIVE_SHEET: 'ph_active_sheet',
  NIGHT_START: 'ph_night_start',
  NIGHT_END: 'ph_night_end',
  NIGHT_SHIFT: 'ph_night_shift',
  NIGHT_MANUAL_OVERRIDE: 'ph_night_manual_override'
};

const MAX_ROLLING_BACKUPS = 5;
const ESTIMATED_STORAGE_CAPACITY_BYTES = 5 * 1024 * 1024; // 5MB standard browser localStorage limit

/**
 * Format bytes into human readable KB / MB
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Safe wrapper around localStorage.setItem with automatic quota error handling and backup pruning
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    console.warn(`LocalStorage write error on key "${key}":`, error);
    // If quota exceeded, prune rolling backups to free up space
    try {
      const rawBackups = localStorage.getItem(STORAGE_KEYS.ROLLING_BACKUPS);
      if (rawBackups) {
        let backups: RollingBackup[] = JSON.parse(rawBackups);
        if (Array.isArray(backups) && backups.length > 1) {
          // Keep only the most recent 1 backup
          backups = backups.slice(0, 1);
          localStorage.setItem(STORAGE_KEYS.ROLLING_BACKUPS, JSON.stringify(backups));
          // Retry write
          localStorage.setItem(key, value);
          return true;
        } else {
          // Remove rolling backups completely to make room for active sheet data
          localStorage.removeItem(STORAGE_KEYS.ROLLING_BACKUPS);
          localStorage.setItem(key, value);
          return true;
        }
      }
    } catch (e2) {
      console.error("Critical storage quota error. Could not free space:", e2);
    }
    return false;
  }
}

/**
 * Calculate detailed storage usage and health telemetry
 */
export function getStorageUsageInfo(): StorageUsageInfo {
  let usedBytes = 0;
  let itemCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || '';
        // 2 bytes per UTF-16 character
        usedBytes += (key.length + val.length) * 2;
        itemCount++;
      }
    }
  } catch (e) {
    usedBytes = 0;
  }

  const rolling = getRollingBackups();
  let sheetsCount = 0;
  try {
    const rawSheets = localStorage.getItem(STORAGE_KEYS.SHEETS);
    if (rawSheets) {
      const parsed = JSON.parse(rawSheets);
      sheetsCount = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch (e) {}

  const percentageUsed = Math.min(100, Math.round((usedBytes / ESTIMATED_STORAGE_CAPACITY_BYTES) * 100));

  return {
    usedBytes,
    usedFormatted: formatBytes(usedBytes),
    totalCapacityBytes: ESTIMATED_STORAGE_CAPACITY_BYTES,
    capacityFormatted: formatBytes(ESTIMATED_STORAGE_CAPACITY_BYTES),
    percentageUsed,
    itemCount,
    sheetsCount,
    backupsCount: rolling.length
  };
}

/**
 * Get the latest local modification timestamp
 */
export function getLastLocalModifiedTs(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.LAST_LOCAL_MODIFIED);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Set the latest local modification timestamp
 */
export function setLastLocalModifiedTs(ts: number = Date.now()): void {
  safeLocalStorageSetItem(STORAGE_KEYS.LAST_LOCAL_MODIFIED, ts.toString());
}

/**
 * Get pending sync payload if any
 */
export function getPendingSync(): PendingSyncPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Check if there is pending unsynced data
 */
export function hasPendingChanges(): boolean {
  const pending = getPendingSync();
  return Boolean(pending && (pending.workspace || pending.users || pending.roles));
}

/**
 * Record a pending sync item in localStorage
 */
export function recordPendingSync(update: Partial<PendingSyncPayload>): void {
  try {
    const current = getPendingSync() || {
      timestamp: Date.now(),
      attempts: 0
    };

    const merged: PendingSyncPayload = {
      ...current,
      ...update,
      timestamp: Date.now(),
      attempts: current.attempts || 0
    };

    safeLocalStorageSetItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(merged));
  } catch (e) {
    console.warn("Could not record pending sync:", e);
  }
}

/**
 * Clear pending sync once Cloud has confirmed save
 */
export function clearPendingSync(type?: 'workspace' | 'users' | 'roles'): void {
  try {
    if (!type) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
      return;
    }

    const current = getPendingSync();
    if (!current) return;

    delete current[type];
    if (!current.workspace && !current.users && !current.roles) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
    } else {
      safeLocalStorageSetItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(current));
    }
  } catch (e) {
    console.warn("Could not clear pending sync:", e);
  }
}

/**
 * Save a rolling backup in localStorage
 */
export function saveRollingBackup(snapshot: WorkspaceSnapshot): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLLING_BACKUPS);
    let backups: RollingBackup[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(backups)) backups = [];

    // Calculate total headcount across all shift sheets
    let totalHc = 0;
    if (Array.isArray(snapshot.sheets)) {
      snapshot.sheets.forEach(s => {
        s.departments?.forEach(d => {
          d.roles?.forEach(r => {
            totalHc += (r.perm || 0) + (r.temp || 0);
          });
        });
      });
    }

    const newBackup: RollingBackup = {
      id: 'bk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'medium' }),
      totalSheets: snapshot.sheets?.length || 0,
      totalHeadcount: totalHc,
      snapshot
    };

    // Avoid duplicate backups within 5 seconds of identical snapshot
    if (backups.length > 0 && Math.abs(backups[0].timestamp - newBackup.timestamp) < 5000) {
      backups[0] = newBackup;
    } else {
      backups.unshift(newBackup);
    }

    // Keep last N backups
    if (backups.length > MAX_ROLLING_BACKUPS) {
      backups = backups.slice(0, MAX_ROLLING_BACKUPS);
    }

    safeLocalStorageSetItem(STORAGE_KEYS.ROLLING_BACKUPS, JSON.stringify(backups));
  } catch (e) {
    console.warn("Rolling backup error:", e);
  }
}

/**
 * Delete a specific rolling backup by ID
 */
export function deleteRollingBackup(id: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLLING_BACKUPS);
    if (!raw) return;
    const backups: RollingBackup[] = JSON.parse(raw);
    if (Array.isArray(backups)) {
      const filtered = backups.filter(b => b.id !== id);
      safeLocalStorageSetItem(STORAGE_KEYS.ROLLING_BACKUPS, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn("Delete rolling backup error:", e);
  }
}

/**
 * Get all rolling local backups
 */
export function getRollingBackups(): RollingBackup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLLING_BACKUPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Determine if local data is strictly newer than cloud data
 */
export function isLocalNewerThanCloud(cloudLastUpdatedTs: number): boolean {
  const pending = getPendingSync();

  if (pending?.workspace) {
    return pending.workspace.lastUpdated > (cloudLastUpdatedTs || 0) + 500;
  }

  // A persisted timestamp without a pending payload is only a historical marker.
  return false;
}

/**
 * Flush all pending offline changes to Cloud Firestore
 */
export async function flushPendingSyncToCloud(): Promise<{ success: boolean; error?: string }> {
  const pending = getPendingSync();
  if (!pending || (!pending.workspace && !pending.users && !pending.roles)) {
    return { success: true };
  }

  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Cloud quota cooldown active. Preserved safely in device storage.' };
  }

  let allSucceeded = true;

  // 1. Sync Workspace
  if (pending.workspace) {
    try {
      const ok = await safeSetDoc(doc(appDataCol, 'workspace'), pending.workspace, { merge: true });
      if (ok) {
        const latestPending = getPendingSync();
        if (latestPending?.workspace?.lastUpdated === pending.workspace.lastUpdated) {
          clearPendingSync('workspace');
        }
      } else {
        allSucceeded = false;
      }
    } catch (e: any) {
      allSucceeded = false;
      console.warn("Flush workspace error:", e);
    }
  }

  // 2. Sync Users
  if (pending.users) {
    try {
      const ok = await safeSetDoc(doc(usersCol, 'app_users'), { users: pending.users });
      if (ok) {
        const latestPending = getPendingSync();
        if (JSON.stringify(latestPending?.users) === JSON.stringify(pending.users)) {
          clearPendingSync('users');
        }
      } else {
        allSucceeded = false;
      }
    } catch (e: any) {
      allSucceeded = false;
      console.warn("Flush users error:", e);
    }
  }

  // 3. Sync Roles
  if (pending.roles) {
    try {
      const ok = await safeSetDoc(doc(rolesCol, 'permissions_matrix'), { matrix: pending.roles });
      if (ok) {
        const latestPending = getPendingSync();
        if (JSON.stringify(latestPending?.roles) === JSON.stringify(pending.roles)) {
          clearPendingSync('roles');
        }
      } else {
        allSucceeded = false;
      }
    } catch (e: any) {
      allSucceeded = false;
      console.warn("Flush roles error:", e);
    }
  }

  return { success: allSucceeded };
}

/**
 * Save complete workspace locally and queue for cloud sync
 */
export function saveWorkspaceLocallyAndQueue(
  snapshot: WorkspaceSnapshot,
  broadcastChannel?: BroadcastChannel | null
): void {
  const now = Date.now();
  setLastLocalModifiedTs(now);

  // 1. Write immediately to localStorage keys
  safeLocalStorageSetItem(STORAGE_KEYS.SHEETS, JSON.stringify(snapshot.sheets));
  safeLocalStorageSetItem(STORAGE_KEYS.OVERHEADS, JSON.stringify(snapshot.overheads));
  safeLocalStorageSetItem(STORAGE_KEYS.PAYROLL, JSON.stringify(snapshot.payrollParams));
  if (snapshot.subsidiaries) {
    safeLocalStorageSetItem(STORAGE_KEYS.SUBSIDIARIES, JSON.stringify(snapshot.subsidiaries));
  }
  if (snapshot.subsidiaryAllocations) {
    safeLocalStorageSetItem(STORAGE_KEYS.SUBSIDIARY_ALLOCATIONS, JSON.stringify(snapshot.subsidiaryAllocations));
  }
  if (snapshot.subsidyPrograms) {
    safeLocalStorageSetItem(STORAGE_KEYS.SUBSIDY_PROGRAMS, JSON.stringify(snapshot.subsidyPrograms));
  }
  if (snapshot.hiddenSheetIds) {
    safeLocalStorageSetItem(STORAGE_KEYS.HIDDEN_SHEETS, JSON.stringify(snapshot.hiddenSheetIds));
  }
  if (snapshot.nightShift) {
    if (snapshot.nightShift.start) safeLocalStorageSetItem(STORAGE_KEYS.NIGHT_START, snapshot.nightShift.start);
    if (snapshot.nightShift.end) safeLocalStorageSetItem(STORAGE_KEYS.NIGHT_END, snapshot.nightShift.end);
  }

  // 2. Queue for offline sync
  recordPendingSync({
    workspace: {
      ...snapshot,
      lastUpdated: now
    }
  });

  // 3. Save rolling backup
  saveRollingBackup({
    ...snapshot,
    lastUpdated: now
  });

  // 4. Broadcast across local tabs immediately
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'WORKSPACE_SYNC',
        author: snapshot.updatedBy,
        payload: snapshot
      });
    } catch (e) {}
  }
}
