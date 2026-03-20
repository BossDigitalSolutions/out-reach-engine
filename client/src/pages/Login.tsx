import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password, requiresTwoFactor ? totpCode : undefined);
        if (result?.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          toast('Enter your 2FA code to continue', { icon: '🔐' });
        } else {
          toast.success('Welcome back!');
        }
      } else {
        await register(email, password, name);
        toast.success('Account created!');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">OutreachEngine</h1>
          <p className="text-slate-500 text-sm mt-1">Lead scraping & email outreach</p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">
            {requiresTwoFactor
              ? 'Two-Factor Authentication'
              : mode === 'login'
              ? 'Sign in to your account'
              : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {requiresTwoFactor ? (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 rounded-lg p-3 mb-2">
                  <Shield size={14} className="text-blue-400 flex-shrink-0" />
                  Enter the 6-digit code from your authenticator app
                </div>
                <div>
                  <label className="label">Authentication Code</label>
                  <input
                    type="text"
                    className="input text-center tracking-widest font-mono text-xl"
                    placeholder="000000"
                    maxLength={8}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">You can also use a backup code</p>
                </div>
              </>
            ) : (
              <>
                {mode === 'register' && (
                  <div>
                    <label className="label">Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder={mode === 'register' ? 'Min 10 chars, upper, lower, number, symbol' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {mode === 'register' && (
                    <p className="text-xs text-slate-600 mt-1">
                      Must be 10+ characters with uppercase, lowercase, number & special character
                    </p>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-2"
              disabled={loading || (requiresTwoFactor && totpCode.length < 6)}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {requiresTwoFactor ? 'Verifying...' : mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : requiresTwoFactor ? (
                'Verify & Sign in'
              ) : mode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>

            {requiresTwoFactor && (
              <button
                type="button"
                className="w-full text-sm text-slate-500 hover:text-slate-300 py-1"
                onClick={() => { setRequiresTwoFactor(false); setTotpCode(''); }}
              >
                Back to login
              </button>
            )}
          </form>

          {!requiresTwoFactor && (
            <p className="text-center text-sm text-slate-500 mt-4">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                className="text-blue-400 hover:text-blue-300 font-medium"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
