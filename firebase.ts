import { initializeApp } from 'firebase/app';
import { getAuth, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence enabled
// We use a simpler persistence setup to avoid potential iframe/cross-tab restrictions in AI Studio
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export async function logStaffActivity(uid: string, restaurantId: string, action: 'LOGIN' | 'LOGOUT' | 'ORDER_SUBMIT') {
  try {
    await addDoc(collection(db, 'staff_activity'), {
      uid,
      restaurantId,
      action,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Error logging activity", error);
  }
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
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
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const loginWithEmailAndPin = async (email: string, pin: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pin);
    // Logging will be handled by the auth state change listener to catch all login types
    return result.user;
  } catch (error) {
    console.error("Error signing in with Email/PIN", error);
    throw error;
  }
};

export const createStaffAccount = async (email: string, pin: string) => {
  // We use a secondary app instance to create the user without logging out the current admin
  const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const result = await createUserWithEmailAndPassword(secondaryAuth, email, pin);
    await signOut(secondaryAuth);
    return result.user.uid;
  } catch (error) {
    console.error("Error creating staff account", error);
    throw error;
  }
};

export const logout = async (uid: string, restaurantId: string) => {
  try {
    await logStaffActivity(uid, restaurantId, 'LOGOUT');
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

