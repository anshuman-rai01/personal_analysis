import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../../services/firebase.ts';
import { onUnauthenticated } from '../../services/apiClient.ts';

// Clean legacy localStorage keys immediately on script evaluation
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('omnilife_guest_uid');
    localStorage.removeItem('omnilife_demo_user');
    localStorage.removeItem('omnilife_local_accounts');
  } catch (_e) {
    // Ignore storage access errors
  }
}

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  isRegistered: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  registerWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isPopupInProgress = useRef(false);

  // Subscribe to apiClient unauthenticated signals (401 refresh failure or 403 NOT_REGISTERED)
  useEffect(() => {
    const unsubscribe = onUnauthenticated(() => {
      setUser(null);
      setIdToken(null);
      setIsRegistered(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for auth state & token refresh via onIdTokenChanged
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          // Verify registration with backend session endpoint
          const sessionRes = await fetch('/api/auth/session', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (sessionRes.ok) {
            setUser(currentUser);
            setIdToken(token);
            setIsRegistered(true);
          } else {
            // Not registered or invalid session -> force sign out
            await signOut(auth).catch(() => {});
            setUser(null);
            setIdToken(null);
            setIsRegistered(false);
          }
        } catch (err) {
          console.error('Session validation error:', err);
          setUser(null);
          setIdToken(null);
          setIsRegistered(false);
        }
      } else {
        setUser(null);
        setIdToken(null);
        setIsRegistered(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  /**
   * Sign In with Google (Login tab)
   * Requires an existing registration, otherwise rejects and signs out.
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (isPopupInProgress.current) {
      return { success: false, error: 'Sign-in window already active. Please check your browser popup or wait.' };
    }

    isPopupInProgress.current = true;
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();

      const sessionRes = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (sessionRes.status === 403) {
        await signOut(auth);
        setUser(null);
        setIdToken(null);
        setIsRegistered(false);
        const msg = 'This Google account is not registered. Use Register > Sign up with Google first.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      if (!sessionRes.ok) {
        await signOut(auth);
        setUser(null);
        setIdToken(null);
        setIsRegistered(false);
        const msg = 'Failed to verify account session.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      setUser(result.user);
      setIdToken(token);
      setIsRegistered(true);
      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Sign-in window was closed.' };
      }
      if (code === 'auth/popup-blocked') {
        const msg = 'Pop-up was blocked by your browser. Please allow pop-ups for this site.';
        setAuthError(msg);
        return { success: false, error: msg };
      }
      if (code === 'auth/unauthorized-domain') {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const msg = `Domain "${currentHost}" is not authorized for Google Sign-In in Firebase Console.`;
        setAuthError(msg);
        return { success: false, error: msg };
      }
      const msg = err?.message || 'Google Sign-in failed. Please try again.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      isPopupInProgress.current = false;
    }
  };

  /**
   * Sign Up with Google (Register tab)
   * Calls POST /api/auth/register after popup to register the user.
   */
  const registerWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (isPopupInProgress.current) {
      return { success: false, error: 'Sign-in window already active. Please check your browser popup or wait.' };
    }

    isPopupInProgress.current = true;
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken(true);

      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: result.user.displayName || null }),
      });

      if (!regRes.ok) {
        const errData = await regRes.json().catch(() => ({}));
        await result.user.delete().catch(() => signOut(auth));
        setUser(null);
        setIdToken(null);
        setIsRegistered(false);
        const msg = errData?.error || 'Registration failed on server.';
        setAuthError(msg);
        return { success: false, error: msg };
      }

      setUser(result.user);
      setIdToken(token);
      setIsRegistered(true);
      return { success: true };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Sign-in window was closed.' };
      }
      if (code === 'auth/popup-blocked') {
        const msg = 'Pop-up was blocked by your browser. Please allow pop-ups for this site.';
        setAuthError(msg);
        return { success: false, error: msg };
      }
      const msg = err?.message || 'Google registration failed. Please try again.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      isPopupInProgress.current = false;
    }
  };

  /**
   * Sign In with Email & Password
   * Enforces strict session verification. No fallback.
   */
  const loginWithEmail = async (email: string, password: string): Promise<void> => {
    setAuthError(null);
    let userCred;
    try {
      userCred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        const genericErr: any = new Error('Invalid email or password.');
        genericErr.code = 'auth/invalid-credential';
        throw genericErr;
      }
      if (code === 'auth/operation-not-allowed') {
        const devErr: any = new Error(
          'Email/Password sign-in is disabled in the Firebase console: enable it under Authentication > Sign-in method'
        );
        devErr.code = 'auth/operation-not-allowed';
        throw devErr;
      }
      throw err;
    }

    // Verify registration with backend
    const token = await userCred.user.getIdToken();
    const sessionRes = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (sessionRes.status === 403) {
      await signOut(auth);
      setUser(null);
      setIdToken(null);
      setIsRegistered(false);
      const notRegErr: any = new Error('No account found for this email. Please register first.');
      notRegErr.code = 'NOT_REGISTERED';
      throw notRegErr;
    }

    if (!sessionRes.ok) {
      await signOut(auth);
      setUser(null);
      setIdToken(null);
      setIsRegistered(false);
      throw new Error('Failed to verify session profile.');
    }

    setUser(userCred.user);
    setIdToken(token);
    setIsRegistered(true);
  };

  /**
   * Register with Email & Password
   * Creates Firebase user, updates profile, calls POST /api/auth/register.
   * If server call fails, rolls back the Firebase user.
   */
  const registerWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> => {
    setAuthError(null);
    let createdUser: User | null = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCredential.user;

      if (displayName && createdUser) {
        await updateProfile(createdUser, { displayName });
      }

      const token = await createdUser.getIdToken(true);
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: displayName || null }),
      });

      if (!regRes.ok) {
        const errData = await regRes.json().catch(() => ({}));
        throw new Error(errData?.error || 'Registration failed on server.');
      }

      setUser(createdUser);
      setIdToken(token);
      setIsRegistered(true);
    } catch (err: any) {
      if (createdUser) {
        try {
          await createdUser.delete();
        } catch (_delErr) {
          await signOut(auth).catch(() => {});
        }
      }
      setUser(null);
      setIdToken(null);
      setIsRegistered(false);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign-out failed:', err);
    }
    setUser(null);
    setIdToken(null);
    setIsRegistered(false);
  };

  /**
   * Synchronous auth headers getter for legacy callers.
   * Feeds directly from current idToken. No guest fallback.
   */
  const getAuthHeaders = (): Record<string, string> => {
    if (idToken) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };
    }
    return {
      'Content-Type': 'application/json',
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        isRegistered,
        loading,
        authError,
        clearAuthError,
        loginWithGoogle,
        registerWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
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
