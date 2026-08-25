import React, { useState, useEffect, useRef } from 'react';
import { User, SheetData, Overheads, PayrollParams, Department, RolePermissions, SubsidiaryAllocation, SubsidiaryProfile, WageSubsidyProgram } from './types';
import { 
  buildInitialSheets, 
  buildDefaultEarnings, 
  buildDefaultSah, 
  ensureAllPayCycleDates, 
  buildStandardCleanSlateDepartments,
  DEFAULT_SUBSIDIARIES,
  DEFAULT_SUBSIDIARY_ALLOCATIONS,
  DEFAULT_SUBSIDY_PROGRAMS
} from './data/initialData';
import { ROLE_PERMISSIONS, USERS } from './data/users';
import LoginScreen from './components/LoginScreen';
import SummaryTab from './components/SummaryTab';
import MonthlySummaryTab from './components/MonthlySummaryTab';
import HeadcountTab from './components/HeadcountTab';
import SubsidiesTab from './components/SubsidiesTab';
import EarningsTab from './components/EarningsTab';
import PayrollTab from './components/PayrollTab';
import SahTab from './components/SahTab';
import OverheadsTab from './components/OverheadsTab';
import ChangesTab from './components/ChangesTab';
import AdminTab from './components/AdminTab';
import ClockInUploadModal from './components/ClockInUploadModal';
import NightShiftPanel from './components/NightShiftPanel';
import SubsidiesPanel from './components/SubsidiesPanel';
import ConfirmModal from './components/ConfirmModal';
import StorageBackupModal from './components/StorageBackupModal';
import { getAllPayCyclesFromSheets, isDateInPayCycle, getPayCycleForDate, getSampleDatesForPayCycle, getDayInfo, parseDateLabelToDate, checkIsNightShiftTime, isDateOnOrAfterCutoff, sortSheetsChronologically, extractAndNormalizeDate } from './utils/payCycle';
import { doc, setDoc, getDoc, onSnapshot, sheetsCol, rolesCol, usersCol, appDataCol, safeSetDoc, safeGetDoc, safeOnSnapshot, isFirestoreQuotaExceeded, markQuotaExceeded } from './lib/firebase';
import { 
  saveWorkspaceLocallyAndQueue, 
  getLastLocalModifiedTs, 
  setLastLocalModifiedTs, 
  getPendingSync, 
  hasPendingChanges, 
  flushPendingSyncToCloud, 
  clearPendingSync, 
  recordPendingSync, 
  isLocalNewerThanCloud, 
  saveRollingBackup,
  FullSystemBackupPayload
} from './lib/offlineStorage';

function getEarningsForNewDate(dateLabel: string, existingSheets: SheetData[]): SheetData['earnings'] {
  const targetDate = parseDateLabelToDate(dateLabel).getTime();
  const previousSheet = [...existingSheets]
    .filter(s => parseDateLabelToDate(s.label).getTime() < targetDate)
    .sort((a, b) => parseDateLabelToDate(a.label).getTime() - parseDateLabelToDate(b.label).getTime())
    .at(-1);

  if (!previousSheet || getPayCycleForDate(previousSheet.label).id !== getPayCycleForDate(dateLabel).id) {
    return [];
  }

  return previousSheet.earnings.map(earning => ({
    ...earning,
    qtyProduced: 0
  }));
}

import { 
  LogOut, 
  Printer, 
  Download, 
  RotateCcw, 
  Check, 
  CalendarDays, 
  Plus, 
  Trash2, 
  ShieldAlert,
  Users,
  DollarSign,
  Briefcase,
  Shirt,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Smartphone,
  Filter,
  X,
  Sparkles,
  Moon,
  Building2,
  Building,
  Cloud,
  CloudOff,
  RefreshCw,
  Wifi,
  WifiOff,
  HardDrive,
  Database
} from 'lucide-react';

const STORAGE_KEYS = {
  USER: 'ph_auth_user',
  SHEETS: 'ph_factory_sheets',
  OVERHEADS: 'ph_factory_overheads',
  PAYROLL: 'ph_factory_payroll_params',
  SUBSIDIARIES: 'ph_factory_subsidiaries',
  SUBSIDIARY_ALLOCATIONS: 'ph_factory_subsidiary_allocations',
  SUBSIDY_PROGRAMS: 'ph_factory_subsidy_programs',
  ACTIVE_TAB: 'ph_active_tab',
  ACTIVE_SHEET: 'ph_active_sheet',
  ROLE_PERMISSIONS: 'ph_role_permissions',
  USERS_LIST: 'ph_users_list',
  HIDDEN_SHEETS: 'ph_hidden_sheet_ids'
};

const DEFAULT_OVERHEADS: Overheads = {
  rent: 15000,
  utilities: 8500,
  admin: 12000,
  other: 5000
};

const DEFAULT_PAYROLL_PARAMS: PayrollParams = {
  monthDays: 26,
  weekendDays: 4,
  otHours: 5
};

const CURRENCY = 'M'; // Lesotho Loti

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [overheads, setOverheads] = useState<Overheads>(DEFAULT_OVERHEADS);
  const [payrollParams, setPayrollParams] = useState<PayrollParams>(DEFAULT_PAYROLL_PARAMS);
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryProfile[]>(DEFAULT_SUBSIDIARIES);
  const [subsidiaryAllocations, setSubsidiaryAllocations] = useState<SubsidiaryAllocation[]>(DEFAULT_SUBSIDIARY_ALLOCATIONS);
  const [subsidyPrograms, setSubsidyPrograms] = useState<WageSubsidyProgram[]>(DEFAULT_SUBSIDY_PROGRAMS);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, RolePermissions>>(ROLE_PERMISSIONS);
  const [usersList, setUsersList] = useState<(User & { password?: string })[]>(USERS);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(() => hasPendingChanges());
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [lastSyncAuthor, setLastSyncAuthor] = useState<string>('Cloud');
  const [cloudSyncToast, setCloudSyncToast] = useState<{ message: string; author: string; time: number } | null>(null);
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const [undoStack, setUndoStack] = useState<{ sheets: SheetData[]; overheads: Overheads; payrollParams: PayrollParams }[]>([]);
  const [showNewDateModal, setShowNewDateModal] = useState(false);
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [newDateLabel, setNewDateLabel] = useState('');

  // Ref to track broadcast channel & cloud debouncing
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const localChangeTimestampRef = useRef<number>(Date.now());
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Date Visibility & Focus Filter State
  const [hiddenSheetIds, setHiddenSheetIds] = useState<string[]>([]);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [showManageHiddenModal, setShowManageHiddenModal] = useState<boolean>(false);
  const [sheetToReset, setSheetToReset] = useState<{ id: string; label: string } | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<{ id: string; label: string } | null>(null);

  // PWA Mobile / Desktop Installation State
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  // Night Shift & Purple Theme State
  const [nightStart, setNightStart] = useState<string>(() => {
    return localStorage.getItem('ph_night_start') || '18:30';
  });
  const [nightEnd, setNightEnd] = useState<string>(() => {
    return localStorage.getItem('ph_night_end') || '05:00';
  });
  const [isNightShift, setIsNightShift] = useState<boolean>(() => {
    const start = localStorage.getItem('ph_night_start') || '18:30';
    const end = localStorage.getItem('ph_night_end') || '05:00';
    const autoActive = checkIsNightShiftTime(start, end);
    const saved = localStorage.getItem('ph_night_shift');
    return saved !== null ? saved === 'true' : autoActive;
  });
  const [isAutoNightActive, setIsAutoNightActive] = useState<boolean>(false);
  const [nightDifferential, setNightDifferential] = useState<number>(15);
  const [showNightShiftPanel, setShowNightShiftPanel] = useState<boolean>(false);
  const [showSubsidiesPanel, setShowSubsidiesPanel] = useState<boolean>(false);

  // Automated Night Shift Scheduler: automatically activates at 6:30pm (18:30) and deactivates at 5:00am (05:00)
  useEffect(() => {
    const checkSchedule = () => {
      const autoActive = checkIsNightShiftTime(nightStart, nightEnd);
      setIsAutoNightActive(autoActive);

      if (autoActive) {
        setIsNightShift(true);
        localStorage.setItem('ph_night_shift', 'true');
      } else {
        const manualOverride = localStorage.getItem('ph_night_manual_override');
        if (manualOverride !== 'true') {
          setIsNightShift(false);
          localStorage.setItem('ph_night_shift', 'false');
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [nightStart, nightEnd]);

  const handleToggleNightShift = (active: boolean) => {
    setIsNightShift(active);
    localStorage.setItem('ph_night_shift', String(active));
    localStorage.setItem('ph_night_manual_override', 'true');
  };

  const handleUpdateNightHours = (start: string, end: string) => {
    setNightStart(start);
    setNightEnd(end);
    localStorage.setItem('ph_night_start', start);
    localStorage.setItem('ph_night_end', end);
    const autoActive = checkIsNightShiftTime(start, end);
    setIsAutoNightActive(autoActive);
    if (autoActive) {
      setIsNightShift(true);
      localStorage.setItem('ph_night_shift', 'true');
    }
  };

  // 1. Initial State Load
  useEffect(() => {
    // Load Hidden Date Sheet IDs
    const savedHidden = localStorage.getItem(STORAGE_KEYS.HIDDEN_SHEETS);
    if (savedHidden) {
      try {
        setHiddenSheetIds(JSON.parse(savedHidden));
      } catch (e) {}
    }

    // Listen for PWA Install Prompt Event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    // Load Role Permissions
    const savedRoles = localStorage.getItem(STORAGE_KEYS.ROLE_PERMISSIONS);
    let activeRoles: Record<string, RolePermissions> = { ...ROLE_PERMISSIONS };
    if (savedRoles) {
      try {
        const parsedRoles = JSON.parse(savedRoles);
        const sanitizedRoles: Record<string, RolePermissions> = { ...ROLE_PERMISSIONS };
        Object.keys(parsedRoles).forEach(rk => {
          const rObj = parsedRoles[rk];
          if (rObj && typeof rObj === 'object') {
            const allowed = Array.isArray(rObj.allowedTabs) ? [...rObj.allowedTabs] : ['summary'];
            if (!allowed.includes('monthly_summary')) {
              allowed.push('monthly_summary');
            }
            if (!allowed.includes('subsidies')) {
              allowed.push('subsidies');
            }
            sanitizedRoles[rk] = {
              ...rObj,
              allowedTabs: allowed
            };
          }
        });
        activeRoles = sanitizedRoles;
      } catch (e) {}
    }
    setRolePermissionsMap(activeRoles);

    // Load Authentication
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) {
      try {
        const parsedUser: User = JSON.parse(savedUser);
        if (!activeRoles[parsedUser.role]) {
          parsedUser.role = 'super_admin';
          parsedUser.roleName = 'Super Administrator';
        }
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    }

    // Load Users List
    const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
    if (savedUsers) {
      try {
        const parsedUsers: (User & { password?: string })[] = JSON.parse(savedUsers);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          const sanitizedUsers = parsedUsers.map(u => {
            if (!activeRoles[u.role]) {
              return {
                ...u,
                role: 'super_admin',
                roleName: activeRoles['super_admin']?.roleName || 'Super Administrator'
              };
            }
            return u;
          });

          const hasSuper = sanitizedUsers.some(u => u.username === 'superadmin');
          if (!hasSuper) {
            const superUser = USERS.find(u => u.username === 'superadmin') || {
              username: 'superadmin',
              password: 'superadmin123',
              name: 'Super Admin (Root)',
              role: 'super_admin',
              roleName: 'Super Administrator'
            };
            setUsersList([superUser, ...sanitizedUsers]);
          } else {
            setUsersList(sanitizedUsers);
          }
        } else {
          setUsersList(USERS);
        }
      } catch (e) {
        setUsersList(USERS);
      }
    } else {
      setUsersList(USERS);
    }

    // Load Overheads
    const savedOH = localStorage.getItem(STORAGE_KEYS.OVERHEADS);
    if (savedOH) {
      try {
        setOverheads(JSON.parse(savedOH));
      } catch (e) {}
    }

    // Load Payroll Params
    const savedPR = localStorage.getItem(STORAGE_KEYS.PAYROLL);
    if (savedPR) {
      try {
        setPayrollParams(JSON.parse(savedPR));
      } catch (e) {}
    }

    // Load Subsidiaries
    const savedSubs = localStorage.getItem(STORAGE_KEYS.SUBSIDIARIES);
    if (savedSubs) {
      try {
        const parsed = JSON.parse(savedSubs);
        if (Array.isArray(parsed) && parsed.length > 0) setSubsidiaries(parsed);
      } catch (e) {}
    }

    // Load Subsidiary Allocations
    const savedAllocs = localStorage.getItem(STORAGE_KEYS.SUBSIDIARY_ALLOCATIONS);
    if (savedAllocs) {
      try {
        const parsed = JSON.parse(savedAllocs);
        if (Array.isArray(parsed) && parsed.length > 0) setSubsidiaryAllocations(parsed);
      } catch (e) {}
    }

    // Load Subsidy Programs
    const savedProgs = localStorage.getItem(STORAGE_KEYS.SUBSIDY_PROGRAMS);
    if (savedProgs) {
      try {
        const parsed = JSON.parse(savedProgs);
        if (Array.isArray(parsed) && parsed.length > 0) setSubsidyPrograms(parsed);
      } catch (e) {}
    }

    // Load Sheets
    const savedSheets = localStorage.getItem(STORAGE_KEYS.SHEETS);
    if (savedSheets) {
      try {
        const parsed = JSON.parse(savedSheets);
        if (parsed && parsed.length > 0) {
          const fullSheets = sortSheetsChronologically(ensureAllPayCycleDates(parsed));
          setSheets(fullSheets);
          const savedActiveSheet = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHEET);
          if (savedActiveSheet && fullSheets.some((s: any) => s.id === savedActiveSheet)) {
            setActiveSheetId(savedActiveSheet);
          } else {
            setActiveSheetId(fullSheets[0].id);
          }
          if (fullSheets.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(fullSheets));
          }
        } else {
          initializeDefaultSheets();
        }
      } catch (e) {
        initializeDefaultSheets();
      }
    } else {
      initializeDefaultSheets();
    }

    // Load Active Tab
    const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // 1b. Multi-tab BroadcastChannel & Network connectivity listeners with Auto Offline Push
  useEffect(() => {
    // Network online/offline status
    const handleOnline = async () => {
      setIsOnline(true);
      setFirebaseConnected(true);
      const res = await flushPendingSyncToCloud();
      setHasPendingSync(hasPendingChanges());
      if (res.success && !hasPendingChanges()) {
        handleManualSync(true); // Silent sync on reconnect
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Visibility change / Window Focus: auto-sync and push pending data when user returns to app
    const handleVisibilityOrFocus = async () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        const res = await flushPendingSyncToCloud();
        setHasPendingSync(hasPendingChanges());
        if (res.success && !hasPendingChanges()) {
          handleManualSync(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Background Periodic Sync: checks every 15 seconds to push pending offline edits if online
    const autoSyncInterval = setInterval(async () => {
      if (navigator.onLine && hasPendingChanges()) {
        const res = await flushPendingSyncToCloud();
        setHasPendingSync(hasPendingChanges());
        if (res.success) {
          setFirebaseConnected(true);
        }
      }
    }, 15000);

    // BeforeUnload hook: ensure local modification timestamp is marked
    const handleBeforeUnload = () => {
      setLastLocalModifiedTs(Date.now());
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cross-tab BroadcastChannel for 0ms instant multi-tab sync
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('ph_workspace_live_sync');
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          if (!event.data) return;
          const { type, payload, author } = event.data;

          if (type === 'WORKSPACE_SYNC' && payload) {
            if (Array.isArray(payload.sheets) && payload.sheets.length > 0) {
              setSheets(sortSheetsChronologically(ensureAllPayCycleDates(payload.sheets)));
            }
            if (payload.overheads) setOverheads(payload.overheads);
            if (payload.payrollParams) setPayrollParams(payload.payrollParams);
            if (Array.isArray(payload.subsidiaries)) setSubsidiaries(payload.subsidiaries);
            if (Array.isArray(payload.subsidiaryAllocations)) setSubsidiaryAllocations(payload.subsidiaryAllocations);
            if (Array.isArray(payload.subsidyPrograms)) setSubsidyPrograms(payload.subsidyPrograms);
            if (Array.isArray(payload.hiddenSheetIds)) setHiddenSheetIds(payload.hiddenSheetIds);

            setLastSyncTime(Date.now());
            setLastSyncAuthor(author || 'Other Tab');
            setCloudSyncToast({
              message: 'Live sync updated from active tab',
              author: author || 'Local Tab',
              time: Date.now()
            });
            setTimeout(() => setCloudSyncToast(null), 3000);
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel not supported in this browser:", e);
    }

    return () => {
      clearInterval(autoSyncInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // 1c. Real-time Cloud Firestore Sync for Users and Role Permissions across all devices
  useEffect(() => {
    if (isFirestoreQuotaExceeded()) {
      setFirebaseConnected(false);
      return;
    }

    const unsubUsers = safeOnSnapshot(doc(usersCol, 'app_users'), (snapshot) => {
      const pending = getPendingSync();
      if (pending && pending.users) {
        flushPendingSyncToCloud();
        return;
      }

      if (snapshot && snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.users)) {
          const cloudUsers: (User & { password?: string })[] = data.users;

          // Clean and structure cloud users as authoritative source of truth
          const userMap = new Map<string, User & { password?: string }>();

          cloudUsers.forEach(u => {
            if (u && u.username) {
              const key = u.username.trim().toLowerCase();
              userMap.set(key, {
                username: key,
                name: u.name || key,
                password: u.password || 'password123',
                role: u.role || 'viewer',
                roleName: u.roleName || 'Viewer',
                deptAccess: u.deptAccess || ''
              });
            }
          });

          // Ensure superadmin root user is always present
          if (!userMap.has('superadmin')) {
            const superUser = USERS.find(u => u.username === 'superadmin') || {
              username: 'superadmin',
              password: 'superadmin123',
              name: 'Super Admin (Root)',
              role: 'super_admin',
              roleName: 'Super Administrator',
              deptAccess: ''
            };
            userMap.set('superadmin', superUser);
          }

          const synchronizedUsers = Array.from(userMap.values());

          setUsersList(synchronizedUsers);
          localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(synchronizedUsers));
          setFirebaseConnected(true);
        }
      } else if (!isFirestoreQuotaExceeded()) {
        const storedLocalUsers = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
        let currentLocal: (User & { password?: string })[] = USERS;
        if (storedLocalUsers) {
          try {
            const parsed = JSON.parse(storedLocalUsers);
            if (Array.isArray(parsed) && parsed.length > 0) currentLocal = parsed;
          } catch (e) {}
        }

        const sanitizedInitial = currentLocal.map(u => ({
          username: (u.username || '').trim().toLowerCase(),
          name: u.name || '',
          password: u.password || 'password123',
          role: u.role || 'viewer',
          roleName: u.roleName || 'Viewer',
          deptAccess: u.deptAccess || ''
        }));

        safeSetDoc(doc(usersCol, 'app_users'), { users: sanitizedInitial }).catch(err => {
          console.warn("Firestore user initial save status:", err);
        });
      }
    }, (err) => {
      console.warn("Firestore user sync status:", err.message || err);
      setFirebaseConnected(false);
    });

    const unsubRoles = safeOnSnapshot(doc(rolesCol, 'permissions_matrix'), (snapshot) => {
      const pending = getPendingSync();
      if (pending && pending.roles) {
        flushPendingSyncToCloud();
        return;
      }

      if (snapshot && snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.matrix && typeof data.matrix === 'object') {
          const cloudMatrix = data.matrix as Record<string, RolePermissions>;
          setRolePermissionsMap(cloudMatrix);
          localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(cloudMatrix));
          setFirebaseConnected(true);
        }
      } else if (!isFirestoreQuotaExceeded()) {
        const storedRoles = localStorage.getItem(STORAGE_KEYS.ROLE_PERMISSIONS);
        let currentRoles: Record<string, RolePermissions> = ROLE_PERMISSIONS;
        if (storedRoles) {
          try {
            const parsed = JSON.parse(storedRoles);
            if (parsed && typeof parsed === 'object') currentRoles = parsed;
          } catch (e) {}
        }
        safeSetDoc(doc(rolesCol, 'permissions_matrix'), { matrix: currentRoles }).catch(err => {
          console.warn("Firestore role initial save status:", err);
        });
      }
    }, (err) => {
      console.warn("Firestore role sync status:", err.message || err);
      setFirebaseConnected(false);
    });

    return () => {
      unsubUsers();
      unsubRoles();
    };
  }, []);

  // 1d. Real-time Cloud Firestore Sync for Workspace App Data (Conflict resolution protected)
  useEffect(() => {
    if (isFirestoreQuotaExceeded()) {
      setFirebaseConnected(false);
      return;
    }

    const unsubAppData = safeOnSnapshot(doc(appDataCol, 'workspace'), (snapshot) => {
      if (snapshot && snapshot.exists()) {
        const data = snapshot.data();
        const updateTimestamp = data?.lastUpdated || 0;

        // Conflict Resolution: If we have pending local changes or local is strictly newer than cloud, do not overwrite!
        if (hasPendingChanges() || isLocalNewerThanCloud(updateTimestamp)) {
          flushPendingSyncToCloud().then(res => {
            if (res.success) {
              setHasPendingSync(false);
              setFirebaseConnected(true);
            }
          });
          return;
        }

        if (data && Array.isArray(data.sheets) && data.sheets.length > 0) {
          const fullSheets = sortSheetsChronologically(ensureAllPayCycleDates(data.sheets));
          setSheets(fullSheets);
          localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(fullSheets));

          if (data.overheads) {
            setOverheads(data.overheads);
            localStorage.setItem(STORAGE_KEYS.OVERHEADS, JSON.stringify(data.overheads));
          }
          if (data.payrollParams) {
            setPayrollParams(data.payrollParams);
            localStorage.setItem(STORAGE_KEYS.PAYROLL, JSON.stringify(data.payrollParams));
          }
          if (Array.isArray(data.subsidiaries) && data.subsidiaries.length > 0) {
            setSubsidiaries(data.subsidiaries);
            localStorage.setItem(STORAGE_KEYS.SUBSIDIARIES, JSON.stringify(data.subsidiaries));
          }
          if (Array.isArray(data.subsidiaryAllocations)) {
            setSubsidiaryAllocations(data.subsidiaryAllocations);
            localStorage.setItem(STORAGE_KEYS.SUBSIDIARY_ALLOCATIONS, JSON.stringify(data.subsidiaryAllocations));
          }
          if (Array.isArray(data.subsidyPrograms) && data.subsidyPrograms.length > 0) {
            setSubsidyPrograms(data.subsidyPrograms);
            localStorage.setItem(STORAGE_KEYS.SUBSIDY_PROGRAMS, JSON.stringify(data.subsidyPrograms));
          }
          if (Array.isArray(data.hiddenSheetIds)) {
            setHiddenSheetIds(data.hiddenSheetIds);
            localStorage.setItem(STORAGE_KEYS.HIDDEN_SHEETS, JSON.stringify(data.hiddenSheetIds));
          }
          if (data.nightShift && typeof data.nightShift === 'object') {
            if (data.nightShift.start) {
              setNightStart(data.nightShift.start);
              localStorage.setItem('ph_night_start', data.nightShift.start);
            }
            if (data.nightShift.end) {
              setNightEnd(data.nightShift.end);
              localStorage.setItem('ph_night_end', data.nightShift.end);
            }
            if (typeof data.nightShift.differential === 'number') {
              setNightDifferential(data.nightShift.differential);
            }
          }

          setActiveSheetId(prev => {
            if (prev && fullSheets.some(s => s.id === prev)) return prev;
            return fullSheets[0]?.id || '';
          });

          const authorName = data.updatedBy || 'Remote Device';

          setLastSyncTime(updateTimestamp);
          setLastSyncAuthor(authorName);
          setFirebaseConnected(true);
          setHasPendingSync(false);

          // If change originated from another device / user, show a smooth toast notification
          if (authorName && authorName !== user?.name && authorName !== user?.username && (updateTimestamp - localChangeTimestampRef.current > 1500)) {
            setCloudSyncToast({
              message: `Workspace updated by ${authorName}`,
              author: authorName,
              time: updateTimestamp
            });
            setTimeout(() => setCloudSyncToast(null), 3500);
          }
        }
      } else if (!isFirestoreQuotaExceeded()) {
        const storedSheets = localStorage.getItem(STORAGE_KEYS.SHEETS);
        let initialSheets: SheetData[] = [];
        if (storedSheets) {
          try {
            const parsed = JSON.parse(storedSheets);
            if (Array.isArray(parsed) && parsed.length > 0) initialSheets = parsed;
          } catch (e) {}
        }
        if (initialSheets.length === 0) {
          initialSheets = sortSheetsChronologically(buildInitialSheets());
        }

        const storedOH = localStorage.getItem(STORAGE_KEYS.OVERHEADS);
        let initialOH = DEFAULT_OVERHEADS;
        if (storedOH) {
          try { initialOH = JSON.parse(storedOH); } catch (e) {}
        }

        const storedPR = localStorage.getItem(STORAGE_KEYS.PAYROLL);
        let initialPR = DEFAULT_PAYROLL_PARAMS;
        if (storedPR) {
          try { initialPR = JSON.parse(storedPR); } catch (e) {}
        }

        safeSetDoc(doc(appDataCol, 'workspace'), {
          sheets: initialSheets,
          overheads: initialOH,
          payrollParams: initialPR,
          subsidiaries: DEFAULT_SUBSIDIARIES,
          subsidiaryAllocations: DEFAULT_SUBSIDIARY_ALLOCATIONS,
          subsidyPrograms: DEFAULT_SUBSIDY_PROGRAMS,
          nightShift: { start: nightStart, end: nightEnd, differential: nightDifferential },
          lastUpdated: Date.now(),
          updatedBy: user?.name || user?.username || 'Initial Setup'
        }).catch(err => {
          console.warn("Firestore appData initial save status:", err);
        });
      }
    }, (err) => {
      console.warn("Firestore appData sync status:", err.message || err);
      setFirebaseConnected(false);
    });

    return () => {
      unsubAppData();
    };
  }, [user]);

  // Manual Force Cloud Synchronization function
  const handleManualSync = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const localSyncStartedAt = getLastLocalModifiedTs();
      if (hasPendingChanges()) {
        const flushResult = await flushPendingSyncToCloud();
        setHasPendingSync(hasPendingChanges());
        if (!flushResult.success || hasPendingChanges()) return;
      }

      const workspaceSnap = await safeGetDoc(doc(appDataCol, 'workspace'));
      if (workspaceSnap && workspaceSnap.exists()) {
        const data = workspaceSnap.data();
        if (hasPendingChanges() || getLastLocalModifiedTs() > localSyncStartedAt) return;
        if (data && Array.isArray(data.sheets) && data.sheets.length > 0) {
          const fullSheets = sortSheetsChronologically(ensureAllPayCycleDates(data.sheets));
          setSheets(fullSheets);
          localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(fullSheets));

          if (data.overheads) {
            setOverheads(data.overheads);
            localStorage.setItem(STORAGE_KEYS.OVERHEADS, JSON.stringify(data.overheads));
          }
          if (data.payrollParams) {
            setPayrollParams(data.payrollParams);
            localStorage.setItem(STORAGE_KEYS.PAYROLL, JSON.stringify(data.payrollParams));
          }
          if (Array.isArray(data.subsidiaries)) {
            setSubsidiaries(data.subsidiaries);
            localStorage.setItem(STORAGE_KEYS.SUBSIDIARIES, JSON.stringify(data.subsidiaries));
          }
          if (Array.isArray(data.subsidiaryAllocations)) {
            setSubsidiaryAllocations(data.subsidiaryAllocations);
            localStorage.setItem(STORAGE_KEYS.SUBSIDIARY_ALLOCATIONS, JSON.stringify(data.subsidiaryAllocations));
          }
          if (Array.isArray(data.subsidyPrograms)) {
            setSubsidyPrograms(data.subsidyPrograms);
            localStorage.setItem(STORAGE_KEYS.SUBSIDY_PROGRAMS, JSON.stringify(data.subsidyPrograms));
          }
          if (Array.isArray(data.hiddenSheetIds)) {
            setHiddenSheetIds(data.hiddenSheetIds);
            localStorage.setItem(STORAGE_KEYS.HIDDEN_SHEETS, JSON.stringify(data.hiddenSheetIds));
          }
        }
      }

      const usersSnap = await safeGetDoc(doc(usersCol, 'app_users'));
      if (usersSnap && usersSnap.exists()) {
        const data = usersSnap.data();
        if (data && Array.isArray(data.users)) {
          setUsersList(data.users);
          localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(data.users));
        }
      }

      const rolesSnap = await safeGetDoc(doc(rolesCol, 'permissions_matrix'));
      if (rolesSnap && rolesSnap.exists()) {
        const data = rolesSnap.data();
        if (data && data.matrix) {
          setRolePermissionsMap(data.matrix);
          localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(data.matrix));
        }
      }

      setFirebaseConnected(true);
      setLastSyncTime(Date.now());
      if (!silent) {
        setCloudSyncToast({
          message: 'All devices synchronized with Cloud',
          author: 'Live Cloud',
          time: Date.now()
        });
        setTimeout(() => setCloudSyncToast(null), 2500);
      }
    } catch (e) {
      console.warn("Manual sync error:", e);
    } finally {
      if (!silent) {
        setTimeout(() => setIsSyncing(false), 400);
      }
    }
  };

  // Tab protection for non-superadmin users
  useEffect(() => {
    if (user && user.role !== 'super_admin' && activeTab === 'admin') {
      setActiveTab('summary');
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'summary');
    }
  }, [user, activeTab]);

  const initializeDefaultSheets = () => {
    const initial = sortSheetsChronologically(buildInitialSheets());
    setSheets(initial);
    setActiveSheetId(initial[0].id);
    localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(initial));
  };

  // 2. State Syncing & Auto Saving to Local Storage and Cloud Firestore
  const triggerAutoSave = (
    updatedSheets: SheetData[], 
    updatedOverheads: Overheads, 
    updatedPayroll: PayrollParams,
    updatedSubsidiaries?: SubsidiaryProfile[],
    updatedAllocations?: SubsidiaryAllocation[],
    updatedPrograms?: WageSubsidyProgram[],
    updatedHiddenIds?: string[]
  ) => {
    const currentSubs = updatedSubsidiaries !== undefined ? updatedSubsidiaries : subsidiaries;
    const currentAllocs = updatedAllocations !== undefined ? updatedAllocations : subsidiaryAllocations;
    const currentProgs = updatedPrograms !== undefined ? updatedPrograms : subsidyPrograms;
    const currentHidden = updatedHiddenIds !== undefined ? updatedHiddenIds : hiddenSheetIds;

    const now = Date.now();
    localChangeTimestampRef.current = now;
    const authorName = user?.name || user?.username || 'You';

    const snapshot = {
      sheets: updatedSheets,
      overheads: updatedOverheads,
      payrollParams: updatedPayroll,
      subsidiaries: currentSubs,
      subsidiaryAllocations: currentAllocs,
      subsidyPrograms: currentProgs,
      hiddenSheetIds: currentHidden,
      nightShift: { start: nightStart, end: nightEnd, differential: nightDifferential },
      lastUpdated: now,
      updatedBy: authorName
    };

    // Save locally, record in pending sync queue, save rolling backup, and broadcast across tabs
    saveWorkspaceLocallyAndQueue(snapshot, broadcastChannelRef.current);
    setHasPendingSync(true);

    // Debounce Cloud Firestore workspace dataset persistence
    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    cloudSaveTimerRef.current = setTimeout(async () => {
      try {
        const success = await safeSetDoc(doc(appDataCol, 'workspace'), snapshot, { merge: true });

        if (success) {
          clearPendingSync('workspace');
          setHasPendingSync(hasPendingChanges());
          setFirebaseConnected(true);
          setLastSyncTime(now);
          setLastSyncAuthor(authorName);
        } else {
          setFirebaseConnected(!isFirestoreQuotaExceeded());
          setHasPendingSync(hasPendingChanges());
        }
      } catch (e) {
        console.warn("Workspace cloud sync postponed:", e);
        setHasPendingSync(true);
      }
    }, 1200);

    setShowSavedBadge(true);
    const t = setTimeout(() => setShowSavedBadge(false), 1500);
    return () => clearTimeout(t);
  };

  // Record a step for undo
  const saveToHistory = () => {
    setUndoStack(prev => {
      const copy = [...prev, {
        sheets: JSON.parse(JSON.stringify(sheets)),
        overheads: { ...overheads },
        payrollParams: { ...payrollParams }
      }];
      // Clamp undo states to 40 records
      if (copy.length > 40) copy.shift();
      return copy;
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    const sortedPrevSheets = sortSheetsChronologically(previous.sheets);
    setSheets(sortedPrevSheets);
    setOverheads(previous.overheads);
    setPayrollParams(previous.payrollParams);

    triggerAutoSave(sortedPrevSheets, previous.overheads, previous.payrollParams);
  };

  // Ctrl+Z Undo hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, sheets, overheads, payrollParams]);

  // Handle Authentication Changes
  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));

    // Reset tab to something permitted by their role if the current one is restricted
    const activeRolePerms = rolePermissionsMap[newUser.role] || ROLE_PERMISSIONS[newUser.role];
    if (activeRolePerms && !activeRolePerms.allowedTabs.includes(activeTab)) {
      const fallback = activeRolePerms.allowedTabs[0] || 'summary';
      setActiveTab(fallback);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, fallback);
    }
  };

  const handleUpdateRolePermissions = async (newMap: Record<string, RolePermissions>) => {
    setRolePermissionsMap(newMap);
    localStorage.setItem(STORAGE_KEYS.ROLE_PERMISSIONS, JSON.stringify(newMap));
    recordPendingSync({ roles: newMap });
    setHasPendingSync(true);
    try {
      const ok = await safeSetDoc(doc(rolesCol, 'permissions_matrix'), { matrix: newMap }, { merge: true });
      if (ok) {
        clearPendingSync('roles');
        setHasPendingSync(hasPendingChanges());
      }
    } catch (e) {
      console.warn("Could not sync role permissions to Cloud Firestore:", e);
    }
  };

  const handleUpdateUsersList = async (newUsers: (User & { password?: string })[]) => {
    const sanitizedUsers = newUsers.map(u => ({
      username: (u.username || '').trim().toLowerCase(),
      name: u.name || '',
      password: u.password || 'password123',
      role: u.role || 'viewer',
      roleName: u.roleName || 'Viewer',
      deptAccess: u.deptAccess || ''
    }));

    setUsersList(sanitizedUsers);
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(sanitizedUsers));
    recordPendingSync({ users: sanitizedUsers });
    setHasPendingSync(true);
    try {
      const ok = await safeSetDoc(doc(usersCol, 'app_users'), { users: sanitizedUsers }, { merge: true });
      if (ok) {
        clearPendingSync('users');
        setHasPendingSync(hasPendingChanges());
      }
    } catch (e) {
      console.warn("Failed to update users list:", e);
    }
  };

  // Restore snapshot from rolling backup or JSON file
  const handleRestoreSnapshot = (snapshot: any) => {
    saveToHistory();
    if (!snapshot) return;

    let nextSheets = sheets;
    if (Array.isArray(snapshot.sheets) && snapshot.sheets.length > 0) {
      nextSheets = sortSheetsChronologically(ensureAllPayCycleDates(snapshot.sheets));
      setSheets(nextSheets);
      setActiveSheetId(nextSheets[0].id);
    }
    const nextOH = snapshot.overheads || overheads;
    const nextPR = snapshot.payrollParams || payrollParams;
    const nextSubs = Array.isArray(snapshot.subsidiaries) ? snapshot.subsidiaries : subsidiaries;
    const nextAllocs = Array.isArray(snapshot.subsidiaryAllocations) ? snapshot.subsidiaryAllocations : subsidiaryAllocations;
    const nextProgs = Array.isArray(snapshot.subsidyPrograms) ? snapshot.subsidyPrograms : subsidyPrograms;
    const nextHidden = Array.isArray(snapshot.hiddenSheetIds) ? snapshot.hiddenSheetIds : hiddenSheetIds;

    setOverheads(nextOH);
    setPayrollParams(nextPR);
    setSubsidiaries(nextSubs);
    setSubsidiaryAllocations(nextAllocs);
    setSubsidyPrograms(nextProgs);
    setHiddenSheetIds(nextHidden);

    if (snapshot.nightShift) {
      if (snapshot.nightShift.start) {
        setNightStart(snapshot.nightShift.start);
        localStorage.setItem('ph_night_start', snapshot.nightShift.start);
      }
      if (snapshot.nightShift.end) {
        setNightEnd(snapshot.nightShift.end);
        localStorage.setItem('ph_night_end', snapshot.nightShift.end);
      }
      if (typeof snapshot.nightShift.differential === 'number') {
        setNightDifferential(snapshot.nightShift.differential);
      }
    }

    triggerAutoSave(
      nextSheets,
      nextOH,
      nextPR,
      nextSubs,
      nextAllocs,
      nextProgs,
      nextHidden
    );

    setCloudSyncToast({
      message: 'Workspace snapshot restored successfully',
      author: user?.name || 'Local Restore',
      time: Date.now()
    });
    setTimeout(() => setCloudSyncToast(null), 3000);
  };

  // Restore full system backup (workspace, users, roles)
  const handleRestoreFullSystem = (fullData: FullSystemBackupPayload) => {
    if (!fullData) return;
    if (fullData.workspace) {
      handleRestoreSnapshot(fullData.workspace);
    }
    if (Array.isArray(fullData.users) && fullData.users.length > 0) {
      handleUpdateUsersList(fullData.users);
    }
    if (fullData.roles && typeof fullData.roles === 'object') {
      handleUpdateRolePermissions(fullData.roles);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  // Switch sheet logs
  const handleSwitchSheet = (id: string) => {
    setActiveSheetId(id);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SHEET, id);
  };

  // Switch dashboard tabs
  const handleSwitchTab = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
  };

  // Sheet Updates
  const handleUpdateSheet = (updatedSheet: SheetData) => {
    saveToHistory();
    const nextSheets = sortSheetsChronologically(sheets.map(s => s.id === updatedSheet.id ? updatedSheet : s));
    setSheets(nextSheets);
    triggerAutoSave(nextSheets, overheads, payrollParams);
  };

  // Overhead Updates
  const handleUpdateOverheads = (updatedOH: Overheads) => {
    saveToHistory();
    setOverheads(updatedOH);
    triggerAutoSave(sheets, updatedOH, payrollParams);
  };

  // Payroll updates
  const handleUpdatePayrollParams = (updatedPR: PayrollParams) => {
    saveToHistory();
    setPayrollParams(updatedPR);
    triggerAutoSave(sheets, overheads, updatedPR);
  };

  // Subsidiary Allocations Updates
  const handleUpdateAllocations = (newAllocations: SubsidiaryAllocation[]) => {
    setSubsidiaryAllocations(newAllocations);
    triggerAutoSave(sheets, overheads, payrollParams, subsidiaries, newAllocations, subsidyPrograms);
  };

  // Subsidiaries Directory Updates
  const handleUpdateSubsidiaries = (newSubs: SubsidiaryProfile[]) => {
    setSubsidiaries(newSubs);
    triggerAutoSave(sheets, overheads, payrollParams, newSubs, subsidiaryAllocations, subsidyPrograms);
  };

  // Wage Subsidy Programs Updates
  const handleUpdateSubsidyPrograms = (newProgs: WageSubsidyProgram[]) => {
    setSubsidyPrograms(newProgs);
    triggerAutoSave(sheets, overheads, payrollParams, subsidiaries, subsidiaryAllocations, newProgs);
  };

  // Create new Date Sheet
  const handleCreateDateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newDateLabel.trim().toUpperCase();
    if (!formatted) return;

    if (!isDateOnOrAfterCutoff(formatted)) {
      alert("App operational dates must start from 21 July 2026. Dates prior to 21 July 2026 are not permitted.");
      return;
    }

    if (sheets.some(s => s.label === formatted)) {
      alert("This operational date already exists inside the spreadsheet listings.");
      return;
    }

    saveToHistory();
    // Copy the department roster structures from last sheet, but zero out daily counts or duplicate them
    const lastSheet = sheets[sheets.length - 1];
    const copiedDepts = JSON.parse(JSON.stringify(lastSheet.departments));
    const copiedEarnings = getEarningsForNewDate(formatted, sheets);

    const newSheet: SheetData = {
      id: `sheet_${Date.now()}`,
      label: formatted,
      departments: copiedDepts,
      earnings: copiedEarnings,
      sahData: []
    };

    const nextSheets = sortSheetsChronologically([...sheets, newSheet]);
    setSheets(nextSheets);
    setActiveSheetId(newSheet.id);
    setShowNewDateModal(false);
    setNewDateLabel('');
    triggerAutoSave(nextSheets, overheads, payrollParams);
  };

  // Apply Clock-In Headcount Data from CSV upload (Single Date)
  const handleApplyClockInHeadcount = (updatedDepts: Department[], importedDate?: string) => {
    saveToHistory();
    if (importedDate) {
      const normImported = extractAndNormalizeDate(importedDate);
      const existingIdx = sheets.findIndex(s => extractAndNormalizeDate(s.label) === normImported);
      if (existingIdx !== -1) {
        const nextSheets = sortSheetsChronologically(ensureAllPayCycleDates(sheets.map((s, idx) => {
          if (idx !== existingIdx) return s;
          return { ...s, label: normImported, departments: updatedDepts };
        })));
        setSheets(nextSheets);
        const matchingUpdatedSheet = nextSheets.find(s => extractAndNormalizeDate(s.label) === normImported);
        if (matchingUpdatedSheet) {
          setActiveSheetId(matchingUpdatedSheet.id);
        } else {
          setActiveSheetId(sheets[existingIdx].id);
        }
        triggerAutoSave(nextSheets, overheads, payrollParams);
      } else {
        const newSheet: SheetData = {
          id: `sheet_${normImported.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
          label: normImported,
          departments: updatedDepts,
          earnings: getEarningsForNewDate(normImported, sheets),
          sahData: []
        };
        newSheet.sahData = newSheet.earnings.length > 0 ? buildDefaultSah(newSheet.earnings) : [];
        const nextSheets = sortSheetsChronologically(ensureAllPayCycleDates([...sheets, newSheet]));
        setSheets(nextSheets);
        const matchingNewSheet = nextSheets.find(s => extractAndNormalizeDate(s.label) === normImported);
        if (matchingNewSheet) {
          setActiveSheetId(matchingNewSheet.id);
        } else {
          setActiveSheetId(newSheet.id);
        }
        triggerAutoSave(nextSheets, overheads, payrollParams);
      }
    } else {
      const nextSheets = sortSheetsChronologically(ensureAllPayCycleDates(sheets.map((s) => {
        if (s.id !== activeSheetId) return s;
        return { ...s, departments: updatedDepts };
      })));
      setSheets(nextSheets);
      triggerAutoSave(nextSheets, overheads, payrollParams);
    }
  };

  // Apply Multi-Date Clock-In Headcount Data across multiple date sheets simultaneously
  const handleApplyMultiDateClockInHeadcount = (dateUpdates: { dateLabel: string; departments: Department[] }[]) => {
    saveToHistory();
    let updatedSheetsList = [...sheets];
    let targetActiveDate = dateUpdates.length > 0 ? extractAndNormalizeDate(dateUpdates[0].dateLabel) : '';

    dateUpdates.forEach(({ dateLabel, departments }) => {
      const normDate = extractAndNormalizeDate(dateLabel);
      const existingIdx = updatedSheetsList.findIndex(
        s => extractAndNormalizeDate(s.label) === normDate
      );

      if (existingIdx !== -1) {
        updatedSheetsList[existingIdx] = {
          ...updatedSheetsList[existingIdx],
          label: normDate,
          departments: departments
        };
      } else {
        const newSheet: SheetData = {
          id: `sheet_${normDate.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          label: normDate,
          departments: departments,
          earnings: getEarningsForNewDate(normDate, updatedSheetsList),
          sahData: []
        };
        newSheet.sahData = newSheet.earnings.length > 0 ? buildDefaultSah(newSheet.earnings) : [];
        updatedSheetsList.push(newSheet);
      }
    });

    const nextSheets = sortSheetsChronologically(ensureAllPayCycleDates(updatedSheetsList));
    setSheets(nextSheets);
    if (targetActiveDate) {
      const matchingActiveSheet = nextSheets.find(s => extractAndNormalizeDate(s.label) === targetActiveDate);
      if (matchingActiveSheet) {
        setActiveSheetId(matchingActiveSheet.id);
      }
    }
    triggerAutoSave(nextSheets, overheads, payrollParams);
  };

  // Hide Date Sheet (for focus on specific month / date range)
  const handleHideDateSheet = (id: string, label: string) => {
    const nextHidden = hiddenSheetIds.includes(id) ? hiddenSheetIds : [...hiddenSheetIds, id];
    setHiddenSheetIds(nextHidden);
    triggerAutoSave(sheets, overheads, payrollParams, subsidiaries, subsidiaryAllocations, subsidyPrograms, nextHidden);
    
    // Switch active sheet if current active sheet is hidden
    const remainingVisible = sheets.filter(s => !nextHidden.includes(s.id));
    if (activeSheetId === id && remainingVisible.length > 0) {
      setActiveSheetId(remainingVisible[0].id);
    }
  };

  // Unhide single Date Sheet
  const handleUnhideDateSheet = (id: string) => {
    const nextHidden = hiddenSheetIds.filter(hId => hId !== id);
    setHiddenSheetIds(nextHidden);
    triggerAutoSave(sheets, overheads, payrollParams, subsidiaries, subsidiaryAllocations, subsidyPrograms, nextHidden);
  };

  // Unhide ALL Date Sheets
  const handleUnhideAllDates = () => {
    setHiddenSheetIds([]);
    triggerAutoSave(sheets, overheads, payrollParams, subsidiaries, subsidiaryAllocations, subsidyPrograms, []);
  };

  // Permanent Delete Date Sheet
  const handleDeleteDateSheet = (id: string, label: string) => {
    const isSysAdmin = user?.role === 'super_admin' || user?.role === 'sys_admin';
    const canDelete = isSysAdmin || perms.canAddDeleteDates;
    if (!canDelete) {
      alert("You do not have permission to delete date sheets.");
      return;
    }
    if (sheets.length <= 1) {
      alert("A minimum of one date sheet must be retained inside the system.");
      return;
    }
    setSheetToDelete({ id, label });
  };

  const executeDeleteDateSheet = (id: string) => {
    saveToHistory();
    const nextSheets = sortSheetsChronologically(sheets.filter(s => s.id !== id));
    setSheets(nextSheets);
    if (hiddenSheetIds.includes(id)) {
      handleUnhideDateSheet(id);
    }
    if (activeSheetId === id) {
      const remaining = nextSheets.filter(s => !hiddenSheetIds.includes(s.id));
      if (remaining.length > 0) {
        setActiveSheetId(remaining[0].id);
      } else if (nextSheets.length > 0) {
        setActiveSheetId(nextSheets[0].id);
      }
    }
    triggerAutoSave(nextSheets, overheads, payrollParams);
  };

  // Reset Date Sheet to Clean Slate
  const handleResetDateSheetToCleanSlate = (id: string, label: string) => {
    const isSysAdmin = user?.role === 'super_admin' || user?.role === 'sys_admin';
    const canReset = isSysAdmin || perms.canEditHeadcount;
    if (!canReset) {
      alert("You do not have permission to reset headcount data.");
      return;
    }
    setSheetToReset({ id, label });
  };

  const executeResetDateSheetToCleanSlate = (id: string) => {
    saveToHistory();
    const nextSheets = sortSheetsChronologically(sheets.map(s => {
      if (s.id !== id) return s;
      const resetDepts = (s.departments && s.departments.length > 0)
        ? s.departments.map(d => ({
            ...d,
            cadre: 0,
            absent: 0,
            cost: 0,
            roles: d.roles.map(r => ({
              ...r,
              cadre: 0,
              perm: 0,
              temp: 0,
              absent: 0,
              cost: 0,
              otHeadcount: 0,
              otCost: 0
            }))
          }))
        : buildStandardCleanSlateDepartments(`reset_${s.label.replace(/\s+/g, '_').toLowerCase()}`);
      return {
        ...s,
        departments: resetDepts,
        earnings: [],
        sahData: [],
        shiftOtHours: 0
      };
    }));
    setSheets(nextSheets);
    triggerAutoSave(nextSheets, overheads, payrollParams);
  };

  // Trigger PWA Installation
  const handleTriggerInstall = async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
        }
        setDeferredInstallPrompt(null);
      } catch (e) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // Generate CSV download
  const handleExportCSV = () => {
    const currentSheet = sheets.find(s => s.id === activeSheetId);
    if (!currentSheet) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Title
    csvContent += `PINK HARMONY FACTORY REPORT,${currentSheet.label}\n\n`;

    // Overheads & totals
    const dailyOH = (overheads.rent + overheads.utilities + overheads.admin + overheads.other) / 26;
    let totalLabourCost = 0;
    currentSheet.departments.forEach(d => {
      d.roles.forEach(r => {
        totalLabourCost += (r.perm * r.permWage) + (r.temp * r.tempWage);
      });
    });
    const earningsTotal = currentSheet.earnings.reduce((sum, e) => sum + (e.qtyProduced * e.cmPrice), 0);

    csvContent += `FINANCIAL SUMMARY\n`;
    csvContent += `Metric,Value (${CURRENCY})\n`;
    csvContent += `Total Daily Labor Costs,${totalLabourCost.toFixed(2)}\n`;
    csvContent += `Daily Allocated Overheads,${dailyOH.toFixed(2)}\n`;
    csvContent += `Daily Contract Earnings,${earningsTotal.toFixed(2)}\n`;
    csvContent += `Daily Operational Net Income,${(earningsTotal - totalLabourCost - dailyOH).toFixed(2)}\n\n`;

    // Headcount
    csvContent += `ROSTER & LABOR DEPLOYMENT\n`;
    csvContent += `Department,Role Title,Permanent headcount,Temporary headcount,Perm Wage/Day,Temp Wage/Day,Estimated Daily Cost\n`;
    currentSheet.departments.forEach(d => {
      d.roles.forEach(r => {
        const cost = (r.perm * r.permWage) + (r.temp * r.tempWage);
        csvContent += `"${d.name}","${r.title}",${r.perm},${r.temp},${r.permWage},${r.tempWage},${cost.toFixed(2)}\n`;
      });
    });
    csvContent += `\n`;

    // Earnings
    csvContent += `STYLE PRODUCTION REVENUE\n`;
    csvContent += `Style Code,CM contract Price,Style SMV (minutes),Qty Produced Today,Line Revenue Today,SAH generated (hrs)\n`;
    currentSheet.earnings.forEach(e => {
      const lineRev = e.qtyProduced * e.cmPrice;
      const lineSah = (e.qtyProduced * e.smv) / 60;
      csvContent += `"${e.style}",${e.cmPrice},${e.smv},${e.qtyProduced},${lineRev.toFixed(2)},${lineSah.toFixed(2)}\n`;
    });
    csvContent += `\n`;

    // SAH record
    csvContent += `LINE EFFICIENCIES\n`;
    csvContent += `Shift Line,Style reference,Operators (MOS),Output pcs,Style SMV (mins),SAH hours,Efficiency%\n`;
    (currentSheet.sahData || []).forEach(r => {
      const sah = (r.output * r.smv) / 60;
      const eff = (r.mos * 9) > 0 ? (sah / (r.mos * 9) * 100) : 0;
      csvContent += `"${r.line}","${r.style}",${r.mos},${r.output},${r.smv},${sah.toFixed(2)},${eff.toFixed(1)}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pink_Harmony_Report_${currentSheet.label.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Extract available 21st-20th pay cycles for focus filtering
  const availablePayCycles = getAllPayCyclesFromSheets(sheets);

  // Compute visible sheets based on hidden IDs and active 21st-20th pay cycle filter
  const visibleSheets = sheets
    .filter(s => {
      if (hiddenSheetIds.includes(s.id)) return false;
      if (selectedMonthFilter !== 'ALL') {
        return isDateInPayCycle(s.label, selectedMonthFilter);
      }
      return true;
    })
    .sort((a, b) => parseDateLabelToDate(a.label).getTime() - parseDateLabelToDate(b.label).getTime());

  // Auto-switch active sheet when cycle filter changes or active sheet is hidden
  useEffect(() => {
    if (visibleSheets.length > 0 && !visibleSheets.some(s => s.id === activeSheetId)) {
      setActiveSheetId(visibleSheets[0].id);
    }
  }, [selectedMonthFilter, hiddenSheetIds, sheets]);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} usersList={usersList} />;
  }

  // Pre-calculations for active state
  const activeSheet = sheets.find(s => s.id === activeSheetId);
  const isSuperAdmin = user.role === 'super_admin';
  const rawPerms = rolePermissionsMap[user.role] || ROLE_PERMISSIONS[user.role] || {
    roleId: user.role,
    roleName: user.roleName || user.role,
    allowedTabs: ['summary', 'monthly_summary'],
    canEditHeadcount: false,
    canEditWages: false,
    canEditEarnings: false,
    canEditSAH: false,
    canEditOverheads: false,
    canAddDeleteDates: false,
    canManageRoles: false
  };
  const perms = {
    ...rawPerms,
    allowedTabs: (rawPerms.allowedTabs || ['summary', 'monthly_summary']).filter(t => t !== 'admin' || isSuperAdmin)
  };
  const overheadDaily = (overheads.rent + overheads.utilities + overheads.admin + overheads.other) / 26;

  let totalLabourCost = 0;
  let totalHeadcount = 0;
  if (activeSheet) {
    activeSheet.departments.forEach((d) => {
      d.roles.forEach((r) => {
        totalHeadcount += r.perm + r.temp;
        totalLabourCost += (r.perm * r.permWage) + (r.temp * r.tempWage);
      });
    });
  }

  const activeNormalizedDate = activeSheet ? extractAndNormalizeDate(activeSheet.label) : '';
  const activeDailyAllocs = subsidiaryAllocations.filter(a => extractAndNormalizeDate(a.dateLabel) === activeNormalizedDate);
  const activeDailySubsidizedHeadcount = activeDailyAllocs.reduce((sum, a) => sum + (a.headcountPerm || 0) + (a.headcountTemp || 0), 0);
  const activeDailySubsidizedCost = activeDailyAllocs.reduce((sum, a) => sum + (a.totalCost || 0) + (a.otCost || 0), 0);

  const earningsTotal = activeSheet ? activeSheet.earnings.reduce((sum, e) => sum + (e.qtyProduced * e.cmPrice), 0) : 0;

  const handleSeedPayCycleSheets = (cycleId: string) => {
    const cycleInfo = availablePayCycles.find(c => c.id === cycleId);
    if (!cycleInfo) return;
    const dateLabels = getSampleDatesForPayCycle(cycleInfo);
    
    saveToHistory();
    const newSheets: SheetData[] = dateLabels.map((dateLabel, idx) => {
      const departments = buildInitialSheets()[0] ? JSON.parse(JSON.stringify(sheets[sheets.length - 1].departments)) : [];
      const earnings = buildDefaultEarnings(idx);
      const sahData = buildDefaultSah(earnings);
      return {
        id: `sheet_${Date.now()}_${idx}`,
        label: dateLabel,
        departments,
        earnings,
        sahData
      };
    });

    const nextSheets = sortSheetsChronologically([...sheets, ...newSheets]);
    setSheets(nextSheets);
    if (newSheets.length > 0) {
      setActiveSheetId(newSheets[0].id);
    }
    triggerAutoSave(nextSheets, overheads, payrollParams);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
      isNightShift ? 'night-shift-theme bg-purple-50/60 text-purple-950' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Top Banner Header */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 print:hidden shadow-xs transition-colors duration-300 ${
        isNightShift ? 'bg-white/95 border-purple-200' : 'bg-white/90 border-pink-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl text-white shadow-sm ${
              isNightShift 
                ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-800 shadow-purple-200' 
                : 'bg-gradient-to-tr from-pink-500 to-rose-500'
            }`}>
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-extrabold tracking-tight leading-none ${isNightShift ? 'text-purple-950' : 'text-slate-900'}`}>
                  THREADS
                </h1>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full font-mono border ${
                  isNightShift 
                    ? 'bg-purple-100 text-purple-900 border-purple-300' 
                    : 'bg-pink-100 text-pink-800 border-pink-200'
                }`}>
                  Factory Intelligence
                </span>
                {isNightShift && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-purple-700 text-amber-300 rounded-full font-mono flex items-center gap-1 shadow-2xs">
                    <Moon className="w-3 h-3 fill-amber-300 text-amber-300" /> Night ({nightStart}-{nightEnd})
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-medium mt-1 ${isNightShift ? 'text-purple-800/80' : 'text-slate-500'}`}>
                Total Headcount, Revenue, Efficiency & Apparel Dashboard • Shift: <strong className={isNightShift ? 'text-purple-900 font-mono' : 'text-pink-700 font-mono'}>{activeSheet?.label || 'None'}</strong>
              </p>
            </div>
          </div>



          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Night Shift Toggle & Panel Button */}
            <button
              onClick={() => setShowNightShiftPanel(true)}
              title={`Night Shift Panel (${nightStart} - ${nightEnd})`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs border ${
                isNightShift
                  ? 'bg-purple-700 hover:bg-purple-800 text-amber-300 border-purple-600 shadow-sm'
                  : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900'
              }`}
            >
              <Moon className={`w-3.5 h-3.5 ${isNightShift ? 'fill-amber-300 text-amber-300' : 'text-purple-700'}`} />
              <span className="hidden sm:inline font-mono">Night ({nightStart}-{nightEnd})</span>
              {isNightShift && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            {/* Subsidiaries & OT Panel Launcher Button */}
            <button
              onClick={() => setShowSubsidiesPanel(true)}
              title="Open Subsidiary Workforce Allocations & Overtime Calculation Panel"
              className="px-3 py-1.5 bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950 hover:from-purple-900 hover:to-indigo-950 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs border border-purple-700/50"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Subsidiaries Panel & OT</span>
              {activeDailySubsidizedHeadcount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 rounded-full text-[10px] font-black font-mono">
                  {activeDailySubsidizedHeadcount} HC
                </span>
              )}
            </button>

            {/* Install / Download App Button */}
            <button
              onClick={handleTriggerInstall}
              title="Install downloadable App on Mobile (Android/iOS) or Desktop (Windows/Mac)"
              className="px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Smartphone className="w-3 h-3 text-pink-100" />
              <span className="hidden sm:inline">{isAppInstalled ? 'App Installed' : 'Download App'}</span>
            </button>

            {/* Storage & Backup Manager Launcher Button */}
            <button
              onClick={() => setShowStorageModal(true)}
              title={`Storage & Backup Manager\nDevice Storage: Protected\nCloud Sync: ${firebaseConnected ? 'Active' : 'Offline'}\nClick to view storage health, backups & export/import`}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs relative"
            >
              <Database className="w-3.5 h-3.5 text-pink-600" />
              <span className="hidden sm:inline">Storage & Backups</span>
              {hasPendingSync && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Pending offline sync" />
              )}
            </button>

            {/* Cloud Real-Time Multi-Device Sync Indicator & Manual Sync Trigger */}
            <button
              onClick={() => handleManualSync(false)}
              disabled={isSyncing}
              title={`Cloud Multi-Device Sync: ${firebaseConnected ? 'Connected & Live' : 'Offline / Reconnecting'}\nLast updated: ${new Date(lastSyncTime).toLocaleTimeString()} by ${lastSyncAuthor}\nClick to force re-sync across all devices`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border shadow-xs ${
                isSyncing 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : firebaseConnected && isOnline
                  ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              ) : firebaseConnected && isOnline ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="hidden md:inline font-mono">
                {isSyncing ? 'Syncing...' : isOnline && firebaseConnected ? 'Live Cloud Synced' : 'Offline Mode'}
              </span>
              <RefreshCw className={`w-3 h-3 opacity-60 hover:opacity-100 transition ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Quick Clock-In Upload Button */}
            <button
              onClick={() => setShowClockInModal(true)}
              title="Upload Headcount CSV from Clock-In System"
              className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-pink-600" />
              <span className="hidden sm:inline">Clock-In Import</span>
            </button>

            {/* Saved state badge */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 rounded-full transition-opacity duration-300 ${showSavedBadge ? 'opacity-100' : 'opacity-0'}`}>
              <Check className="w-3.5 h-3.5" /> Saved
            </span>

            {/* General Utilities button group */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo last modification (Ctrl+Z)"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => window.print()}
                title="Print Dashboard Report"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportCSV}
                title="Export CMT spreadsheet details to CSV"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Sign-out card */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right">
                <span className="text-xs font-extrabold text-slate-800 block truncate max-w-[120px]">{user.name}</span>
                <span className="text-[9px] font-bold text-pink-700 uppercase tracking-wider block leading-none mt-0.5">{user.roleName}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Logout from session"
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100/80 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sheet Dates Navigation list */}
      <section className="bg-pink-50/50 border-b border-pink-100 print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-pink-700 uppercase tracking-wider shrink-0 mr-1">
              <CalendarDays className="w-3.5 h-3.5 text-pink-600" /> Shift Dates:
            </span>

            {visibleSheets.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium italic">
                  No active dates match current month filter. {hiddenSheetIds.length > 0 && 'Check Hidden Dates.'}
                </span>
                {selectedMonthFilter !== 'ALL' && perms.canAddDeleteDates && (
                  <button
                    onClick={() => handleSeedPayCycleSheets(selectedMonthFilter)}
                    className="px-2.5 py-0.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-full text-[11px] transition cursor-pointer shadow-2xs"
                  >
                    + Generate Pay Cycle Shift Dates
                  </button>
                )}
              </div>
            ) : (
              visibleSheets.map((s) => {
                const isActive = s.id === activeSheetId;
                const isSysAdmin = user?.role === 'sys_admin';
                const dayInfo = getDayInfo(s.label);
                return (
                  <div 
                    key={s.id} 
                    className={`flex items-center shrink-0 rounded-full border transition font-mono text-[11px] font-bold ${
                      isActive 
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 border-rose-600 text-white shadow-xs' 
                        : dayInfo.isHoliday
                        ? 'bg-purple-100/90 border-purple-300 text-purple-950 hover:bg-purple-200 hover:border-purple-400'
                        : dayInfo.isOvertime
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950 hover:bg-amber-100 hover:border-amber-400'
                        : 'bg-white border-pink-200 text-slate-700 hover:bg-pink-100/60 hover:border-pink-300 hover:text-pink-900'
                    }`}
                  >
                    <button
                      onClick={() => handleSwitchSheet(s.id)}
                      className="px-3 py-1 rounded-full cursor-pointer flex items-center gap-1.5"
                      title={`${s.label} (${dayInfo.dayName})${dayInfo.isHoliday ? ` - 🇱🇸 Lesotho Statutory Paid Public Holiday: ${dayInfo.holidayName}` : dayInfo.isOvertime ? ` - ${dayInfo.badgeText}` : ''}`}
                    >
                      <span>{s.label}</span>
                      {dayInfo.isHoliday ? (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          isActive 
                            ? 'bg-purple-300 text-purple-950 shadow-2xs' 
                            : 'bg-purple-200 text-purple-950 border border-purple-300'
                        }`}>
                          🇱🇸 HOLIDAY
                        </span>
                      ) : dayInfo.isOvertime ? (
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          isActive 
                            ? 'bg-amber-400 text-amber-950 shadow-2xs' 
                            : 'bg-amber-200 text-amber-950 border border-amber-300'
                        }`}>
                          ⚡ {dayInfo.dayShort} OT
                        </span>
                      ) : (
                        <span className={`text-[9px] font-semibold ${isActive ? 'text-pink-200' : 'text-slate-400'}`}>
                          {dayInfo.dayShort}
                        </span>
                      )}
                    </button>

                    {/* Reset Date to Clean Slate Button */}
                    {(isSysAdmin || perms.canEditHeadcount) && (
                      <button
                        onClick={() => handleResetDateSheetToCleanSlate(s.id, s.label)}
                        title="Reset all attendance figures for this date to 0 (clean slate)"
                        className={`px-1 py-1 rounded-full hover:scale-110 transition-all text-xs font-bold shrink-0 ${
                          isActive ? 'text-pink-200 hover:text-white' : 'text-slate-400 hover:text-amber-600'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}

                    {/* Hide Date Button (Available to all users to focus view) */}
                    <button
                      onClick={() => handleHideDateSheet(s.id, s.label)}
                      title="Hide date from active workspace view to focus on specific dates"
                      className={`px-1.5 py-1 rounded-full hover:scale-110 transition-all text-xs font-bold shrink-0 ${
                        isActive ? 'text-pink-200 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <EyeOff className="w-3 h-3" />
                    </button>

                    {/* Permanent Delete Date Tab Button */}
                    {(isSysAdmin || perms.canAddDeleteDates) && sheets.length > 1 && (
                      <button
                        onClick={() => handleDeleteDateSheet(s.id, s.label)}
                        title="Permanently delete date sheet tab and its data"
                        className={`pr-2.5 pl-0.5 py-1 rounded-full hover:scale-110 transition-all text-xs font-bold shrink-0 ${
                          isActive ? 'text-rose-200 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {perms.canAddDeleteDates && (
              <button
                onClick={() => setShowNewDateModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-dashed border-pink-300 hover:border-pink-500 hover:bg-pink-100/60 text-pink-800 text-[11px] font-bold rounded-full transition shrink-0 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> New Date
              </button>
            )}
          </div>

          {/* Month Focus Filter & Manage Hidden Dates Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Month/Pay Cycle Filter Dropdown */}
            {availablePayCycles.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-pink-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs">
                <Filter className="w-3 h-3 text-pink-600" />
                <span className="text-[10px] uppercase text-slate-400 font-extrabold hidden md:inline">Cycle Focus:</span>
                <select
                  value={selectedMonthFilter}
                  onChange={(e) => setSelectedMonthFilter(e.target.value)}
                  className="bg-transparent font-mono text-xs focus:outline-none cursor-pointer text-slate-800 font-bold"
                >
                  <option value="ALL">All Pay Cycles</option>
                  {availablePayCycles.map(c => (
                    <option key={c.id} value={c.id}>{c.shortLabel}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Hidden Dates Counter & Unhide Button */}
            {hiddenSheetIds.length > 0 && (
              <button
                onClick={() => setShowManageHiddenModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-[11px] font-bold transition cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>Hidden Dates ({hiddenSheetIds.length})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Tab bar navigation */}
      <nav className="bg-white border-b border-pink-100 print:hidden shadow-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin py-2 px-1 touch-pan-x flex-nowrap md:flex-wrap">
            {perms.allowedTabs.map((tab) => {
              const isActive = activeTab === tab;
              const meta: Record<string, { label: string; icon: string }> = {
                summary: { label: 'Daily Operations', icon: '📋' },
                monthly_summary: { label: 'Monthly Analytics', icon: '📈' },
                headcount: { label: 'Labor Headcount', icon: '👥' },
                subsidies: { label: 'Subsidiaries & Loans', icon: '🏢' },
                earnings: { label: 'Style Revenue', icon: '💵' },
                payroll: { label: 'Monthly Payroll', icon: '💰' },
                overheads: { label: 'Factory Overheads', icon: '🏭' },
                changes: { label: 'Audit Changes', icon: '🔀' },
                admin: { label: 'Admin Security', icon: '🛡️' }
              };
              const item = meta[tab] || { label: tab, icon: '⚙️' };
              return (
                <button
                  key={tab}
                  onClick={() => handleSwitchTab(tab)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive 
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs font-extrabold scale-[1.02]' 
                      : 'text-slate-600 hover:text-pink-900 hover:bg-pink-50/70'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Dashboard Core Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeSheet ? (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Sticky summary statistics side panel - ONLY shown on Summary tab */}
            {activeTab === 'summary' && (
              <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 space-y-4 print:hidden">
                <div className="bento-card p-5 space-y-4 border-pink-100">
                  <h3 className="text-[10px] font-bold text-pink-700 uppercase tracking-widest border-b border-pink-100 pb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Operational Side-Stats
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Headcount ops</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{totalHeadcount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Daily Wages cost</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{CURRENCY} {totalLabourCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Amortized Overheads</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{CURRENCY} {overheadDaily.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Daily CMT Earnings</span>
                      <span className="text-xs font-extrabold text-rose-600 font-mono">{CURRENCY} {earningsTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="border-t border-dashed border-pink-100 pt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-700 font-bold">Daily Margin</span>
                      <span className={`text-xs font-black font-mono ${earningsTotal - totalLabourCost - overheadDaily >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {CURRENCY} {(earningsTotal - totalLabourCost - overheadDaily).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Night Shift Quick Control Card */}
                  <div className={`p-3.5 rounded-2xl border transition-all ${
                    isNightShift 
                      ? 'bg-purple-100/80 border-purple-300 text-purple-950' 
                      : 'bg-purple-50/70 border-purple-200 text-purple-950'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Moon className={`w-4 h-4 ${isNightShift ? 'text-purple-800 fill-purple-300' : 'text-purple-700'}`} />
                        <span className="text-xs font-extrabold uppercase tracking-wide">Night Shift Mode</span>
                      </div>
                      <button
                        onClick={() => setShowNightShiftPanel(true)}
                        className="text-[10px] font-extrabold text-purple-800 underline hover:text-purple-950 transition cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] font-medium flex items-center justify-between">
                      <span>Hours: <strong className="font-mono font-bold">{nightStart}-{nightEnd}</strong> (+{nightDifferential}%)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        isNightShift 
                          ? 'bg-purple-700 text-amber-300' 
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        {isNightShift ? 'PURPLE THEME' : 'DAY SHIFT'}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-pink-100 pt-4 space-y-2">
                    <span className="text-[9px] font-bold text-pink-700 uppercase tracking-wider block">Active Departments Roster</span>
                    <div className="max-h-52 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                      {activeSheet.departments.filter(d => d.roles.some(r => r.perm > 0 || r.temp > 0)).map(d => {
                        const deptHc = d.roles.reduce((s, r) => s + r.perm + r.temp, 0);
                        return (
                          <div 
                            key={d.id}
                            className="flex items-center justify-between text-[11px] font-medium py-1 px-1.5 hover:bg-pink-50/50 rounded-lg transition"
                          >
                            <span className="text-slate-600">{d.name}</span>
                            <span className="font-mono text-slate-800 font-bold">{deptHc} ops</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </aside>
            )}

            {/* Interactive content based on active tab */}
            <div className="flex-1 w-full min-w-0">
              {activeTab === 'summary' && (
                <SummaryTab 
                  sheet={activeSheet} 
                  allSheets={sheets}
                  overheadDaily={overheadDaily} 
                  monthlyOverheads={overheads}
                  currency={CURRENCY} 
                  onUpdateSheet={handleUpdateSheet}
                  onUpdateAllSheets={(nextSheets) => {
                    saveToHistory();
                    const sorted = sortSheetsChronologically(nextSheets);
                    setSheets(sorted);
                    triggerAutoSave(sorted, overheads, payrollParams);
                  }}
                  canEditEarnings={perms.canEditEarnings}
                  onOpenSubsidiesPanel={() => setShowSubsidiesPanel(true)}
                  allocations={subsidiaryAllocations}
                />
              )}
              {activeTab === 'monthly_summary' && (
                <MonthlySummaryTab
                  sheets={sheets}
                  overheads={overheads}
                  currency={CURRENCY}
                />
              )}
              {activeTab === 'headcount' && (
                <HeadcountTab 
                  sheet={activeSheet} 
                  sheets={sheets}
                  onUpdateSheet={handleUpdateSheet} 
                  onUpdateAllSheets={(nextSheets) => {
                    saveToHistory();
                    const sorted = sortSheetsChronologically(nextSheets);
                    setSheets(sorted);
                    triggerAutoSave(sorted, overheads, payrollParams);
                  }}
                  canEditHeadcount={perms.canEditHeadcount} 
                  canEditWages={Boolean(isSuperAdmin || perms.canEditWages || perms.canEditHeadcount)} 
                  currency={CURRENCY} 
                  onOpenClockInModal={() => setShowClockInModal(true)}
                  onOpenSubsidiesPanel={() => setShowSubsidiesPanel(true)}
                  subsidizedHeadcount={activeDailySubsidizedHeadcount}
                  subsidizedCost={activeDailySubsidizedCost}
                />
              )}
              {activeTab === 'subsidies' && (
                <SubsidiesTab 
                  sheet={activeSheet} 
                  allSheets={sheets}
                  subsidiaries={subsidiaries}
                  allocations={subsidiaryAllocations}
                  subsidyPrograms={subsidyPrograms}
                  onUpdateAllocations={handleUpdateAllocations}
                  onUpdateSubsidiaries={handleUpdateSubsidiaries}
                  onUpdateSubsidyPrograms={handleUpdateSubsidyPrograms}
                  canEdit={Boolean(isSuperAdmin || perms.canEditHeadcount || perms.canEditWages)}
                  currency={CURRENCY}
                />
              )}
              {activeTab === 'earnings' && (
                <EarningsTab 
                  sheet={activeSheet} 
                  sheets={sheets}
                  onUpdateSheet={handleUpdateSheet} 
                  onUpdateAllSheets={(nextSheets) => {
                    saveToHistory();
                    const sorted = sortSheetsChronologically(nextSheets);
                    setSheets(sorted);
                    triggerAutoSave(sorted, overheads, payrollParams);
                  }}
                  canEditEarnings={perms.canEditEarnings} 
                  totalLabourCost={totalLabourCost} 
                  overheadDaily={overheadDaily} 
                  currency={CURRENCY} 
                />
              )}
              {activeTab === 'payroll' && (
                <PayrollTab 
                  sheet={activeSheet} 
                  sheets={sheets}
                  onUpdateSheet={handleUpdateSheet}
                  onUpdateAllSheets={(nextSheets) => {
                    saveToHistory();
                    const sorted = sortSheetsChronologically(nextSheets);
                    setSheets(sorted);
                    triggerAutoSave(sorted, overheads, payrollParams);
                  }}
                  payrollParams={payrollParams} 
                  onUpdatePayrollParams={handleUpdatePayrollParams} 
                  canEditOverheads={perms.canEditOverheads} 
                  canEditWages={perms.canEditWages}
                  currency={CURRENCY} 
                />
              )}
              {activeTab === 'overheads' && (
                <OverheadsTab 
                  overheads={overheads} 
                  onUpdateOverheads={handleUpdateOverheads} 
                  canEditOverheads={perms.canEditOverheads} 
                  currency={CURRENCY} 
                />
              )}
              {activeTab === 'changes' && (
                <ChangesTab 
                  sheets={sheets} 
                  currency={CURRENCY} 
                  overheads={overheads}
                />
              )}
              {activeTab === 'admin' && (
                <AdminTab 
                  currentUser={user}
                  usersList={usersList}
                  rolePermissionsMap={rolePermissionsMap}
                  onUpdateRolePermissions={handleUpdateRolePermissions}
                  onUpdateUsersList={handleUpdateUsersList}
                  firebaseConnected={firebaseConnected}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-12 bg-white border border-pink-100 rounded-3xl shadow-xs">
            <p className="text-sm text-slate-500">Retrieving operational spreadsheet specifications...</p>
          </div>
        )}
      </main>

      {/* Clock-In Upload Modal */}
      {activeSheet && (
        <ClockInUploadModal
          isOpen={showClockInModal}
          onClose={() => setShowClockInModal(false)}
          activeSheet={activeSheet}
          allSheets={sheets}
          onApplyHeadcount={handleApplyClockInHeadcount}
          onApplyMultiDateHeadcount={handleApplyMultiDateClockInHeadcount}
          currency={CURRENCY}
        />
      )}

      {/* Create Date Modal Popover */}
      {showNewDateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-pink-200 p-6 rounded-3xl shadow-2xl max-w-sm w-full space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Log New Operational Date</h3>
              <p className="text-xs text-slate-500 mt-1">Specify an operational date on or after 21 July 2026. The existing department roster structure will be duplicated cleanly.</p>
            </div>
            
            <form onSubmit={handleCreateDateSheet} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Stamp Label (Must be on/after 21 July 2026)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 21 JULY 2026"
                  value={newDateLabel}
                  onChange={(e) => setNewDateLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-pink-50/50 border border-pink-300 rounded-xl focus:ring-2 focus:ring-pink-500 text-sm focus:outline-none font-mono font-bold uppercase text-slate-800"
                />
              </div>

              {newDateLabel.trim().length > 3 && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-0.5">
                  <div className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">Pay Cycle Mapping (21st–20th Standard):</div>
                  <div className="font-mono font-bold">{getPayCycleForDate(newDateLabel).label}</div>
                </div>
              )}

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewDateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  Confirm Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Hidden Dates Modal */}
      {showManageHiddenModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-pink-200 p-6 rounded-3xl shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Manage Hidden Shift Dates</h3>
                  <p className="text-[11px] text-slate-500">Unhide dates anytime to show them in your workspace.</p>
                </div>
              </div>
              <button
                onClick={() => setShowManageHiddenModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {hiddenSheetIds.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hidden dates found.</p>
              ) : (
                sheets.filter(s => hiddenSheetIds.includes(s.id)).map(s => (
                  <div 
                    key={s.id} 
                    className="flex items-center justify-between p-2.5 bg-pink-50/50 rounded-xl border border-pink-100"
                  >
                    <span className="font-mono text-xs font-bold text-slate-800">{s.label}</span>
                    <button
                      onClick={() => handleUnhideDateSheet(s.id)}
                      className="px-3 py-1 bg-white hover:bg-pink-100 border border-pink-200 text-pink-800 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-pink-600" /> Unhide
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-pink-100 pt-3">
              <button
                onClick={handleUnhideAllDates}
                className="text-xs font-bold text-pink-700 hover:text-pink-900 cursor-pointer underline"
              >
                Unhide All Dates
              </button>
              <button
                onClick={() => setShowManageHiddenModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download / Install App Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-pink-200 p-6 rounded-3xl shadow-2xl max-w-md w-full space-y-5">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-2xl text-white shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Install THREAD App</h3>
                  <p className="text-[11px] text-slate-500">Download for Mobile (Android/iOS) & Desktop</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deferredInstallPrompt && (
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 p-4 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-pink-900 block">Instant Native Installation Ready</span>
                  <span className="text-[11px] text-pink-700">Click to install directly on this device.</span>
                </div>
                <button
                  onClick={handleTriggerInstall}
                  className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-xs font-bold hover:scale-105 transition cursor-pointer shrink-0 shadow-xs"
                >
                  Install Now
                </button>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Installation Instructions by Device:</h4>
              
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-base">📱</span> Android Phones & Tablets (Chrome / Edge):
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px] pl-5">
                  Tap the menu button (<strong>⋮</strong>) in your browser top right corner, then select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-base">🍎</span> iPhone & iPad (Safari):
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px] pl-5">
                  Tap the <strong>Share button</strong> (square with up arrow) in Safari bottom bar, scroll down the options list and tap <strong>"Add to Home Screen"</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-base">💻</span> Windows, Mac & Chromebook (Chrome / Edge / Brave):
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px] pl-5">
                  Look for the <strong>Install icon</strong> (⊕) in the right corner of your browser address bar, or open browser menu and select <strong>"Install Pink Harmony..."</strong>.
                </p>
              </div>
            </div>

            <div className="text-right border-t border-pink-100 pt-3">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Night Shift Control Panel Modal */}
      <NightShiftPanel
        isOpen={showNightShiftPanel}
        onClose={() => setShowNightShiftPanel(false)}
        isNightShift={isNightShift}
        onToggleNightShift={handleToggleNightShift}
        nightDifferential={nightDifferential}
        onUpdateNightDifferential={setNightDifferential}
        nightStart={nightStart}
        nightEnd={nightEnd}
        onUpdateNightHours={handleUpdateNightHours}
        activeHeadcount={totalHeadcount}
        currency={CURRENCY}
      />

      {/* Subsidies & Overtime Calculations Control Panel */}
      {activeSheet && (
        <SubsidiesPanel
          isOpen={showSubsidiesPanel}
          onClose={() => setShowSubsidiesPanel(false)}
          sheet={activeSheet}
          allSheets={sheets}
          subsidiaries={subsidiaries}
          allocations={subsidiaryAllocations}
          subsidyPrograms={subsidyPrograms}
          onUpdateAllocations={handleUpdateAllocations}
          onUpdateSubsidiaries={handleUpdateSubsidiaries}
          onUpdateSubsidyPrograms={handleUpdateSubsidyPrograms}
          canEdit={Boolean(isSuperAdmin || perms.canEditHeadcount || perms.canEditWages)}
          currency={CURRENCY}
        />
      )}

      {/* Reset Date to Clean Slate Confirmation Modal */}
      {sheetToReset && (
        <ConfirmModal
          isOpen={!!sheetToReset}
          onClose={() => setSheetToReset(null)}
          onConfirm={() => executeResetDateSheetToCleanSlate(sheetToReset.id)}
          title={`Reset "${sheetToReset.label}" to Clean Slate`}
          message={`Are you sure you want to completely reset all data for "${sheetToReset.label}" to a clean slate?`}
          subMessage="This will clear all daily data on this date: Cadre and attendance figures (cadre, present, temp, absent, overtime to 0), Style production revenue & output (cleared to 0), and SAH efficiency targets. Role and department structures remain intact."
          confirmText="Yes, Clear All Data"
          cancelText="Cancel"
          confirmVariant="danger"
          icon="reset"
        />
      )}

      {/* Delete Date Tab Confirmation Modal */}
      {sheetToDelete && (
        <ConfirmModal
          isOpen={!!sheetToDelete}
          onClose={() => setSheetToDelete(null)}
          onConfirm={() => executeDeleteDateSheet(sheetToDelete.id)}
          title={`Delete Shift Date "${sheetToDelete.label}"`}
          message={`Are you sure you want to PERMANENTLY DELETE the shift date tab and all logs for "${sheetToDelete.label}"?`}
          subMessage="This will permanently erase all data entered for this day. To temporarily remove it from your workspace view without losing data, use the Hide button instead."
          confirmText="Yes, Delete Date Tab"
          cancelText="Cancel"
          confirmVariant="danger"
          icon="trash"
        />
      )}

      {/* Floating Real-Time Cloud Sync Notification Toast */}
      {cloudSyncToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce-short">
          <div className="bg-slate-900/95 text-white backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-pink-500/30 flex items-center gap-3">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100">{cloudSyncToast.message}</p>
              <p className="text-[10px] text-pink-300/80 font-mono">
                {cloudSyncToast.author} • {new Date(cloudSyncToast.time).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => setCloudSyncToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Simple Footer details */}
      <footer className={`border-t text-center py-6 text-xs print:hidden transition-colors duration-300 ${
        isNightShift ? 'bg-white border-purple-200 text-purple-900' : 'bg-white border-pink-100 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-[11px] mb-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono font-bold ${
              firebaseConnected && isOnline ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${firebaseConnected && isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {firebaseConnected && isOnline ? 'Cloud Sync Active (Multi-Device)' : 'Local Mode'}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              Last synced: <strong className="text-slate-600 font-mono">{new Date(lastSyncTime).toLocaleTimeString()}</strong> ({lastSyncAuthor})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStorageModal(true)}
              className="text-pink-700 hover:text-pink-900 font-bold underline transition cursor-pointer flex items-center gap-1"
            >
              <Database className="w-3 h-3" />
              Storage, Backups & Cloud Sync
            </button>

            <button
              onClick={() => handleManualSync(false)}
              disabled={isSyncing}
              className="text-pink-700 hover:text-pink-900 font-bold underline transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Force Re-sync Devices
            </button>
          </div>
        </div>
        <p className={`font-bold ${isNightShift ? 'text-purple-950' : 'text-slate-700'}`}>THREAD — Total Headcount, Revenue, Efficiency & Apparel Dashboard (2026)</p>
        <p className="mt-1 text-[11px]">Role-Based Access Control (RBAC) & Monthly Pay Cycle Tracking (Starting July 21st)</p>
      </footer>

      {/* Storage, Offline Protection & Cloud Sync Modal */}
      <StorageBackupModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        isOnline={isOnline}
        firebaseConnected={firebaseConnected}
        lastSyncTime={lastSyncTime}
        lastSyncAuthor={lastSyncAuthor}
        onTriggerSync={handleManualSync}
        onRestoreSnapshot={handleRestoreSnapshot}
        onRestoreFullSystem={handleRestoreFullSystem}
        currentSheets={sheets}
        currentOverheads={overheads}
        currentPayroll={payrollParams}
        currentSubsidiaries={subsidiaries}
        currentAllocations={subsidiaryAllocations}
        currentPrograms={subsidyPrograms}
        currentHiddenIds={hiddenSheetIds}
        currentNightShift={{ start: nightStart, end: nightEnd, differential: nightDifferential }}
        currentUsers={usersList}
        currentRoles={rolePermissionsMap}
      />
    </div>
  );
}
