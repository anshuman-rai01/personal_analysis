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
  UserCheck,
} from 'lucide-react';
import { useAuth } from './AuthContext.tsx';

interface AuthViewProps {
  onNavigateToDashboard?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onNavigateToDashboard }) => {
  const {
    authError,
    clearAuthError,
    loginWithGoogle,
    registerWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
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
      } else {
        await registerWithEmail(email.trim(), password, displayName.trim() || undefined);
      }
      if (onNavigateToDashboard) {
        onNavigateToDashboard();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAction = async () => {
    setLocalError(null);
    clearAuthError();
    setSuccessMessage(null);
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await loginWithGoogle();
      } else {
        result = await registerWithGoogle();
      }

      if (result.success && onNavigateToDashboard) {
        onNavigateToDashboard();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setLocalError('Please enter your email address to receive password reset instructions.');
      return;
    }
    setLoading(true);
    setLocalError(null);
    clearAuthError();
    try {
      await resetPassword(email.trim());
      setSuccessMessage('Password reset link sent to your email! Check your inbox.');
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-purple-200/50 overflow-hidden relative">
        {/* Glow Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-pink-600" />
              <span>OmniLife Studio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-purple-950">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h1>
            <p className="text-xs text-slate-500">
              {mode === 'login'
                ? 'Sign in to access your personal analytics and forecasting.'
                : 'Register a clean account to start tracking your life data.'}
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
              className={`py-2 rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white text-purple-950 shadow-sm'
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
              className={`py-2 rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-white text-purple-950 shadow-sm'
                  : 'text-purple-700 hover:text-purple-950'
              }`}
            >
              Register
            </button>
          </div>

          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleAction}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl border border-purple-200 bg-white hover:bg-purple-50/60 text-slate-700 text-xs font-bold flex items-center justify-center gap-2.5 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
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
            <span>{mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-purple-100" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">or with email</span>
            <div className="flex-1 h-px bg-purple-100" />
          </div>

          {/* Alerts */}
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

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                    maxLength={80}
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
                  <span>Register Account</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
