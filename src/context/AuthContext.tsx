import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { BLUEPRINT_LIMITS, clampText } from '../lib/validation';
import type { UserProfile } from '../types/domain';

const BOOTSTRAP_ADMIN_EMAIL = 'abdullahjavaid0307@gmail.com';

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubAdminDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubAdminDoc) {
        unsubAdminDoc();
        unsubAdminDoc = null;
      }

      setUser(firebaseUser);
      setAuthError(null);

      if (!firebaseUser) {
        setUserProfile(null);
        setHasAdminDoc(false);
        setAuthReady(true);
        return;
      }

      try {
        const userDocPath = `users/${firebaseUser.uid}`;
        const userRef = doc(db, 'users', firebaseUser.uid);
        const existingSnap = await getDoc(userRef);

        const isBootstrap =
          (firebaseUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

        if (!existingSnap.exists()) {
          const email = clampText(
            firebaseUser.email || '',
            BLUEPRINT_LIMITS.maxEmailLength,
          );
          const displayName =
            clampText(
              firebaseUser.displayName || email.split('@')[0] || 'Client User',
              BLUEPRINT_LIMITS.maxDisplayNameLength,
            ) || 'Client User';
          const photoURL = clampText(
            firebaseUser.photoURL || '',
            BLUEPRINT_LIMITS.maxPhotoUrlLength,
          );

          const initialProfile = {
            uid: firebaseUser.uid,
            email,
            displayName,
            photoURL,
            role: isBootstrap ? 'admin' : 'user',
            status: 'active',
            companyName: isBootstrap ? 'ACME Corp HQ' : 'Apex Roofing',
            industry: isBootstrap ? 'Growth Agency' : 'Local Home Services',
            phone: '',
            planTier: isBootstrap ? 'Enterprise' : 'Growth Audit',
            projectedRevenue: 48500,
            inboundCallsGrowth: 142,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          try {
            await setDoc(userRef, initialProfile);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, userDocPath);
          }
        }

        // Verify token with Express backend
        try {
          const token = await firebaseUser.getIdToken();
          await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Non-fatal if network blip occurs during initial verification
        }

        unsubProfile = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data() as UserProfile);
            }
            setAuthReady(true);
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, userDocPath);
          },
        );

        const adminRef = doc(db, 'admins', firebaseUser.uid);
        unsubAdminDoc = onSnapshot(
          adminRef,
          (snap) => {
            setHasAdminDoc(snap.exists());
          },
          () => {
            setHasAdminDoc(false);
          },
        );
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Unable to initialize your Firebase profile.',
        );
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubAdminDoc) unsubAdminDoc();
    };
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google sign-in was cancelled.';
      setAuthError(msg);
      return null;
    } finally {
      setAuthBusy(false);
    }
  };

  const signOutUser = async (): Promise<void> => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setUserProfile(null);
      setHasAdminDoc(false);
    } finally {
      setAuthBusy(false);
    }
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!auth.currentUser) {
      throw new Error('Authentication required.');
    }
    const token = await auth.currentUser.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const isBootstrapAdmin =
    Boolean(user?.email) &&
    user!.email!.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
    user!.emailVerified;

  const isAdmin = isBootstrapAdmin || hasAdminDoc;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        authReady,
        authBusy,
        authError,
        signInWithGoogle,
        signOutUser,
        getAuthHeaders,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return ctx;
}
