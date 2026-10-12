import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ShieldCheck,
  Database,
  UserCheck,
  Zap
} from 'lucide-react';
import { useAuth } from './AuthContext.tsx';

interface AuthViewProps {
  onNavigateToDashboard: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onNavigateToDashboard }) => {
  const {
    user,
    isGuest,
    authError,
    clearAuthError,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    loginWithDemoAccount,
    resetPassword,
    logout,
    loginAsGuest,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const error = localError || authError;

  const getFriendlyErrorMessage = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Please verify and try again.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Pop-up window was blocked by your browser. Please allow popups or use Email / 1-Click Demo Login below.';
    }
    if (code === 'auth/cancelled-popup-request') {
      return 'Sign-in window was closed.';
    }
    if (code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      return `Domain "${currentHost}" is not authorized for Google Sign-In in Firebase Console. Please use "1-Click Demo Login" below or add "${currentHost}" to Firebase Console > Authentication > Settings > Authorized Domains.`;
    }
    return err?.message || 'Authentication failed. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Please provide both email and password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
        setSuccessMessage('Signed in successfully! Redirecting...');
        setTimeout(() => onNavigateToDashboard(), 600);
      } else {
        await registerWithEmail(email.trim(), password, displayName.trim());
        setSuccessMessage('Account created successfully! Welcome to OmniLife Studio.');
        setTimeout(() => onNavigateToDashboard(), 600);
      }
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    clearAuthError();
    setLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        onNavigateToDashboard();
      } else if (res.error) {
        setLocalError(res.error);
      }
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setLocalError(null);
    clearAuthError();
    setLoading(true);
    try {
      await loginWithDemoAccount('Anshuman Rai', '');
      setSuccessMessage('Signed in with Demo Account! Redirecting...');
      setTimeout(() => onNavigateToDashboard(), 500);
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnshumanSignIn = async () => {
    setLocalError(null);
    clearAuthError();
    setLoading(true);
    try {
      await loginWithDemoAccount('Anshuman Rai', 'anshumanr699@gmail.com');
      setSuccessMessage('Signed in as Anshuman Rai! Redirecting...');
      setTimeout(() => onNavigateToDashboard(), 500);
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setLocalError('Please enter your email address above to receive a password reset link.');
      return;
    }
    setLocalError(null);
    clearAuthError();
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccessMessage(`Password reset link sent to ${email.trim()}. Check your inbox.`);
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // If user is already authenticated with a real account or demo account
  if (user && !isGuest) {
    return (
      <div className="max-w-xl mx-auto py-8 sm:py-12 animate-fadeIn">
        <div className="bg-white border border-purple-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-950/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 bg-pink-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-purple-100/40 rounded-full blur-3xl pointer-events-none" />

          <div className="relative text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 p-1 shadow-lg shadow-pink-500/20">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-white text-purple-900 font-black text-2xl flex items-center justify-center">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active Account</span>
              </div>
              <h2 className="text-2xl font-black text-purple-950">
                {user.displayName || 'OmniLife Member'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">{user.email}</p>
            </div>

            {/* Account Details Box */}
            <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-left space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-900">User ID (PostgreSQL Sync)</span>
                <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-purple-200">
                  {user.uid.slice(0, 16)}...
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-900">Database Storage</span>
                <span className="inline-flex items-center gap-1 text-purple-700 font-bold">
                  <Database className="w-3 h-3 text-purple-600" /> Cloud SQL PostgreSQL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-900">Currency Standard</span>
                <span className="font-bold text-pink-700">₹ Indian Rupees (INR)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onNavigateToDashboard}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold text-sm shadow-md shadow-pink-500/20 transition-all hover:scale-[1.01]"
              >
                Go to Dashboard
              </button>

              <button
                onClick={async () => {
                  await logout();
                }}
                className="py-3 px-4 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration & Login Form
  return (
    <div className="max-w-md mx-auto py-6 sm:py-10 animate-fadeIn">
      <div className="bg-white border border-purple-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-purple-950/5 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-pink-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-purple-300/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-5">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-pink-600" />
              <span>OmniLife Studio Account</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-purple-950">
              {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'login'
                ? 'Sign in to access your PostgreSQL synced records in Indian Rupees (₹).'
                : 'Register to unlock your personal database analytics and ML models.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-purple-50/70 border border-purple-100 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                clearAuthError();
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-xl transition-all ${mode === 'login'
                  ? 'bg-white text-purple-950 shadow-xs'
                  : 'text-purple-700 hover:text-purple-950'
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLocalError(null);
                clearAuthError();
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-xl transition-all ${mode === 'register'
                  ? 'bg-white text-purple-950 shadow-xs'
                  : 'text-purple-700 hover:text-purple-950'
                }`}
            >
              Register (Sign Up)
            </button>
          </div>

          {/* Quick 1-Click Instant Sign-In Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAnshumanSignIn}
              disabled={loading}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 text-purple-950 text-xs font-bold border border-purple-300 flex items-center justify-center gap-1.5 shadow-2xs transition-all hover:scale-[1.01]"
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-700" />
              <span>Sign In: Anshuman Rai</span>
            </button>
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={loading}
              className="w-full py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 flex items-center justify-center gap-1.5 shadow-2xs transition-all hover:scale-[1.01]"
            >
              <Zap className="w-3.5 h-3.5 text-pink-600" />
              <span>Demo: Anshuman Rai</span>
            </button>
          </div>

          {/* Google One-Click Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2 px-4 rounded-xl border border-purple-200 bg-white hover:bg-purple-50/60 text-slate-700 text-xs font-bold flex items-center justify-center gap-2.5 shadow-2xs transition-all hover:scale-[1.01]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-purple-100" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">or with email</span>
            <div className="flex-1 h-px bg-purple-100" />
          </div>

          {/* Notification Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-purple-950 mb-1">
                  Full Name / Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Anshuman Rai"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-purple-950 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-purple-950">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-bold text-pink-600 hover:text-pink-700"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-purple-950 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-pink-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Processing...</span>
              ) : mode === 'login' ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Guest Mode Option */}
          <div className="pt-2 text-center border-t border-purple-100">
            <button
              type="button"
              onClick={() => {
                loginAsGuest();
                onNavigateToDashboard();
              }}
              className="text-xs text-slate-500 hover:text-purple-700 font-semibold"
            >
              Want to test first? <span className="underline">Continue in Guest Preview Mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
