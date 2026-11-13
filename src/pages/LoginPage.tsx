import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';

interface LoginPageProps {
  sessionExpiredMessage?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ sessionExpiredMessage }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(sessionExpiredMessage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Countdown timer if rate limited
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (lockoutSeconds && lockoutSeconds > 0) {
      setError(`Account temporarily locked. Please wait ${lockoutSeconds} seconds.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await login(email, password);
    setIsLoading(false);

    if (!result.success) {
      const errMsg = result.error || 'Authentication failed.';
      setError(errMsg);
      // Check if lockout error with seconds
      const match = errMsg.match(/locked for (\d+) seconds/i);
      if (match && match[1]) {
        setLockoutSeconds(parseInt(match[1], 10));
      }
    }
  };

  const handleQuickSelectEmail = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword(quickEmail.includes('admin') ? 'vault147admin' : 'vault147staff');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 sm:p-6 text-zinc-900 font-sans select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-black border border-zinc-200 shadow-lg p-2.5 flex items-center justify-center overflow-hidden">
              <img
                src="/vault-logo-square.png"
                alt="VAULT 147"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-2xs text-red-600 font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200">
              STAFF POS TERMINAL
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium">
            Staff Access Control & Business Terminal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-zinc-200/60 space-y-5">
          {/* Error / Session Expired Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{error}</span>
                {lockoutSeconds && lockoutSeconds > 0 && (
                  <p className="font-mono font-bold mt-1 text-red-600">
                    Retry available in: {lockoutSeconds}s
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-700 uppercase tracking-wider font-mono">
                Staff Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@vaultgaming.in"
                  required
                  autoFocus
                  disabled={Boolean(lockoutSeconds && lockoutSeconds > 0)}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-300 focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-700 uppercase tracking-wider font-mono">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={Boolean(lockoutSeconds && lockoutSeconds > 0)}
                  className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-300 focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading || Boolean(lockoutSeconds && lockoutSeconds > 0)}
              className="w-full py-3 rounded-xl font-bold gap-2 text-sm bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md shadow-red-500/25"
            >
              {isLoading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to POS</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Admin Selector */}
          <div className="pt-4 border-t border-zinc-100 space-y-2.5">
            <p className="text-3xs font-semibold text-zinc-400 uppercase tracking-wider font-mono text-center">
              Quick Admin Access (Pre-fill Email)
            </p>
            <button
              type="button"
              onClick={() => handleQuickSelectEmail('admin@vaultgaming.in')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Admin: Ruwaidh (admin@vaultgaming.in)</span>
            </button>
          </div>
        </div>

        {/* Security Footer */}
        <div className="text-center space-y-1">
          <p className="text-3xs text-zinc-400 font-mono">
            VAULT 147 • SHA-256 Salted Hashing • Immutable Audit Logging
          </p>
          <p className="text-3xs text-zinc-400">
            Unauthorized access attempts are monitored and recorded.
          </p>
        </div>
      </div>
    </div>
  );
};

