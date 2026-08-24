import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with auto-detect long polling to prevent webchannel / gRPC connection errors in web sandboxes
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch (e) {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
}

export const db = firestoreDb;
export const auth = getAuth(app);

// Helper collection references
export const sheetsCol = collection(db, 'sheets');
export const rolesCol = collection(db, 'roles');
export const usersCol = collection(db, 'users');
export const appDataCol = collection(db, 'app_data');
export const settingsCol = collection(db, 'settings');

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error Handled: ', JSON.stringify(errInfo));
  return errInfo;
}

// Quota & Rate limiting protections
const QUOTA_STORAGE_KEY = 'ph_fs_quota_exceeded_ts';
const QUOTA_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown when quota is exhausted

function getStoredQuotaTs(): number {
  try {
    const val = sessionStorage.getItem(QUOTA_STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

let quotaExceededTimestamp = getStoredQuotaTs();

export function isFirestoreQuotaExceeded(): boolean {
  if (quotaExceededTimestamp === 0) return false;
  if (Date.now() - quotaExceededTimestamp > QUOTA_COOLDOWN_MS) {
    quotaExceededTimestamp = 0;
    try { sessionStorage.removeItem(QUOTA_STORAGE_KEY); } catch (e) {}
    return false;
  }
  return true;
}

export function markQuotaExceeded() {
  quotaExceededTimestamp = Date.now();
  try { sessionStorage.setItem(QUOTA_STORAGE_KEY, quotaExceededTimestamp.toString()); } catch (e) {}
  console.info("Firestore daily free tier write quota reached. Switched gracefully to instant Local & Cross-Tab persistence.");
}

/**
 * Safe wrapper around setDoc that respects quota limits and catches quota/resource-exhausted errors cleanly
 */
export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }
  try {
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
    return true;
  } catch (error: any) {
    const errorStr = String(error?.message || error?.code || error);
    if (error?.code === 'resource-exhausted' || errorStr.includes('Quota limit exceeded') || errorStr.includes('resource-exhausted')) {
      markQuotaExceeded();
      return false;
    }
    console.warn("safeSetDoc notice:", errorStr);
    return false;
  }
}

/**
 * Safe wrapper around getDoc
 */
export async function safeGetDoc(docRef: any): Promise<any | null> {
  if (isFirestoreQuotaExceeded()) {
    return null;
  }
  try {
    const snap = await getDoc(docRef);
    return snap;
  } catch (error: any) {
    const errorStr = String(error?.message || error?.code || error);
    if (error?.code === 'resource-exhausted' || errorStr.includes('Quota limit exceeded') || errorStr.includes('resource-exhausted')) {
      markQuotaExceeded();
      return null;
    }
    console.warn("safeGetDoc notice:", errorStr);
    return null;
  }
}

/**
 * Safe wrapper around onSnapshot
 */
export function safeOnSnapshot(docRef: any, onNext: (snap: any) => void, onError?: (err: any) => void): () => void {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }
  try {
    const unsub = onSnapshot(docRef, onNext, (err) => {
      const errorStr = String(err?.message || err?.code || err);
      if (err?.code === 'resource-exhausted' || errorStr.includes('Quota limit exceeded') || errorStr.includes('resource-exhausted')) {
        markQuotaExceeded();
      }
      if (onError) onError(err);
    });
    return unsub;
  } catch (err: any) {
    const errorStr = String(err?.message || err?.code || err);
    if (err?.code === 'resource-exhausted' || errorStr.includes('Quota limit exceeded') || errorStr.includes('resource-exhausted')) {
      markQuotaExceeded();
    }
    if (onError) onError(err);
    return () => {};
  }
}

export { doc, setDoc, getDoc, getDocs, onSnapshot };

