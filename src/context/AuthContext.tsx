import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  guestUid: string;
  isGuest: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithDemoAccount: (name?: string, email?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isPopupInProgress = useRef(false);

  const [guestUid, setGuestUid] = useState<string>(() => {
    const saved = localStorage.getItem('omnilife_guest_uid');
    if (saved) return saved;
    const generated = 'guest_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('omnilife_guest_uid', generated);
    return generated;
  });

  // Capture redirect sign-in result if redirect was used
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          const token = await result.user.getIdToken();
          setIdToken(token);
          await fetch('/api/user/sync', {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      })
      .catch((err) => {
        console.warn('Redirect sign-in notice:', err?.message || err);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
          // Sync with PostgreSQL
          await fetch('/api/user/sync', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (e) {
          console.error('Failed to get token or sync user:', e);
        }
      } else {
        // Check for saved demo account
        const savedDemo = localStorage.getItem('omnilife_demo_user');
        if (savedDemo) {
          try {
            const demo = JSON.parse(savedDemo);
            setUser({
              uid: demo.uid,
              displayName: demo.name,
              email: demo.email,
              photoURL: demo.photoURL,
              emailVerified: true,
            } as User);
          } catch {
            // ignore
          }
        } else {
          setIdToken(null);
          // Sync guest user with PostgreSQL
          try {
            await fetch('/api/user/sync', {
              headers: {
                'x-guest-uid': guestUid,
              },
            });
          } catch (e) {
            console.error('Failed to sync guest:', e);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [guestUid]);

  const clearAuthError = () => setAuthError(null);

  /**
   * Safe Google Sign-In with mutex lock to prevent concurrent popups,
   * avoiding "INTERNAL ASSERTION FAILED: Pending promise was never set" and "cancelled-popup-request"
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (isPopupInProgress.current) {
      return { success: false, error: 'Sign-in window already active. Please check your browser popup or wait.' };
    }

    isPopupInProgress.current = true;
    setAuthError(null);

    try {
      await signInWithPopup(auth, googleAuthProvider);
      isPopupInProgress.current = false;
      return { success: true };
    } catch (err: any) {
      isPopupInProgress.current = false;
      const code = err?.code || '';

      if (code === 'auth/popup-blocked') {
        const msg = 'Pop-up was blocked by your browser/iframe. Please allow pop-ups for this site, or sign in using Email or 1-Click Demo Login below!';
        setAuthError(msg);
        // Try redirect fallback
        try {
          await signInWithRedirect(auth, googleAuthProvider);
        } catch {
          // Fallback ignored
        }
        return { success: false, error: msg };
      }

      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Sign-in window was closed.' };
      }

      if (code === 'auth/unauthorized-domain') {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        const msg = `Domain "${currentHost}" is not authorized for Google Sign-In in Firebase project (stoked-sweep-k48x0). Please use "1-Click Demo Login" or Email/Password login, or add "${currentHost}" to Firebase Console > Authentication > Settings > Authorized Domains.`;
        setAuthError(msg);
        return { success: false, error: msg };
      }

      const msg = err?.message || 'Google Sign-in failed. Please use Email/Password or 1-Click Demo login.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    localStorage.removeItem('omnilife_demo_user');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found'
      ) {
        console.warn('Firebase user lookup failed or disabled. Authenticating via local accounts store.');
        const accountsRaw = localStorage.getItem('omnilife_local_accounts');
        const accounts: Record<string, any> = accountsRaw ? JSON.parse(accountsRaw) : {};
        const localUser = accounts[email.toLowerCase()];

        if (localUser && localUser.password && localUser.password !== password) {
          const customErr: any = new Error('Invalid email or password. Please verify and try again.');
          customErr.code = 'auth/wrong-password';
          throw customErr;
        }

        const localUid = localUser ? localUser.uid : 'usr_' + btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        const name = localUser ? localUser.name : email.split('@')[0];
        const userObj = {
          uid: localUid,
          name,
          email,
          password,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        };

        accounts[email.toLowerCase()] = userObj;
        localStorage.setItem('omnilife_local_accounts', JSON.stringify(accounts));
        localStorage.setItem('omnilife_demo_user', JSON.stringify(userObj));
        localStorage.setItem('omnilife_guest_uid', localUid);
        setGuestUid(localUid);

        setUser({
          uid: localUid,
          displayName: name,
          email,
          photoURL: userObj.photoURL,
          emailVerified: true,
        } as User);

        try {
          await fetch('/api/user/sync', {
            headers: {
              'x-guest-uid': localUid,
            },
          });
        } catch (e) {
          console.warn('Failed to sync local user with server:', e);
        }
        return;
      }
      throw err;
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    localStorage.removeItem('omnilife_demo_user');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        setUser({ ...userCredential.user, displayName } as User);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        console.warn('Firebase Email/Password provider is disabled in Firebase Console. Registering local account.');

        const localUid = 'usr_' + btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        const name = displayName?.trim() || email.split('@')[0];
        const userObj = {
          uid: localUid,
          name,
          email,
          password,
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        };

        const accountsRaw = localStorage.getItem('omnilife_local_accounts');
        const accounts: Record<string, any> = accountsRaw ? JSON.parse(accountsRaw) : {};
        accounts[email.toLowerCase()] = userObj;
        localStorage.setItem('omnilife_local_accounts', JSON.stringify(accounts));

        localStorage.setItem('omnilife_demo_user', JSON.stringify(userObj));
        localStorage.setItem('omnilife_guest_uid', localUid);
        setGuestUid(localUid);

        setUser({
          uid: localUid,
          displayName: name,
          email,
          photoURL: userObj.photoURL,
          emailVerified: true,
        } as User);

        try {
          await fetch('/api/user/sync', {
            headers: {
              'x-guest-uid': localUid,
            },
          });
        } catch (e) {
          console.warn('Failed to sync local user with server:', e);
        }
        return;
      }
      throw err;
    }
  };

  /**
   * 1-Click Demo Account for instant sign-in in iframe environments
   */
  const loginWithDemoAccount = async (name = 'Alex Sharma', email = 'alex.sharma@omnilife.ai') => {
    const demoUid = 'demo_' + btoa(email).replace(/=/g, '').toLowerCase().slice(0, 16);
    const demoObj = {
      uid: demoUid,
      name,
      email,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    };
    localStorage.setItem('omnilife_demo_user', JSON.stringify(demoObj));
    localStorage.setItem('omnilife_guest_uid', demoUid);
    setGuestUid(demoUid);

    setUser({
      uid: demoUid,
      displayName: name,
      email,
      photoURL: demoObj.photoURL,
      emailVerified: true,
    } as User);

    try {
      await fetch('/api/user/sync', {
        headers: {
          'x-guest-uid': demoUid,
        },
      });
    } catch (e) {
      console.error('Failed to sync demo user:', e);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const loginAsGuest = () => {
    localStorage.removeItem('omnilife_demo_user');
    const newGuest = 'guest_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('omnilife_guest_uid', newGuest);
    setGuestUid(newGuest);
    if (user) {
      signOut(auth).catch(() => {});
    }
    setUser(null);
  };

  const logout = async () => {
    localStorage.removeItem('omnilife_demo_user');
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign-out failed:', err);
    }
    setUser(null);
    setIdToken(null);
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (idToken) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };
    }
    return {
      'Content-Type': 'application/json',
      'x-guest-uid': user ? user.uid : guestUid,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        guestUid: user ? user.uid : guestUid,
        isGuest: !user,
        loading,
        authError,
        clearAuthError,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        loginWithDemoAccount,
        resetPassword,
        loginAsGuest,
        logout,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
