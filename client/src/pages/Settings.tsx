import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key,
  Mail,
  Clock,
  Zap,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart2,
  MessageCircle,
  Shield,
  Smartphone,
  Monitor,
  Trash2,
  Lock,
  LogIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { settingsApi, twoFactorApi, sessionsApi, emailsApi } from '../lib/api';
import { Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const INDUSTRY_LIST = [
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'gyms', label: 'Gyms & Fitness' },
  { key: 'salons', label: 'Salons & Barbershops' },
  { key: 'dental', label: 'Dental Offices' },
  { key: 'contractors', label: 'Contractors' },
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'auto_repair', label: 'Auto Repair' },
  { key: 'med_spa', label: 'Med Spa / Spa' },
];

interface Settings {
  senderName?: string;
  senderEmail?: string;
  emailSignature?: string;
  dailySendLimit: number;
  smsDailyLimit?: number;
  unsubscribeUrl?: string;
  warmupMode: boolean;
  warmupDay: number;
  followupsEnabled: boolean;
  followupInterval1: number;
  followupInterval2: number;
  followupInterval3: number;
  industryWeights?: Record<string, number>;
  hasGoogleApiKey: boolean;
  hasAnthropicApiKey: boolean;
  hasSendgridApiKey: boolean;
  hasFirecrawlApiKey: boolean;
  hasWhatsAppToken: boolean;
  whatsAppPhoneId?: string;
  hasGhlApiKey: boolean;
  ghlLocationId?: string;
  ghlPhoneNumber?: string;
  ghlPhoneNumberUS?: string;
  ghlPhoneNumberZA?: string;
}

const API_KEY_FIELDS = [
  { key: 'googleApiKey', label: 'Google Places API Key', placeholder: 'AIza...' },
  { key: 'anthropicApiKey', label: 'Anthropic (Claude) API Key', placeholder: 'sk-ant-...' },
  { key: 'sendgridApiKey', label: 'SendGrid API Key', placeholder: 'SG...' },
  { key: 'firecrawlApiKey', label: 'Firecrawl API Key', placeholder: 'fc-...' },
];

export default function Settings() {
  const qc = useQueryClient();
  const { user, isAdmin, refreshUser } = useAuth();

  // API key & integration state (admin only)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [whatsAppPhoneId, setWhatsAppPhoneId] = useState('');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [ghlPhoneNumber, setGhlPhoneNumber] = useState('');
  const [ghlPhoneNumberUS, setGhlPhoneNumberUS] = useState('');
  const [ghlPhoneNumberZA, setGhlPhoneNumberZA] = useState('');

  // General settings state
  const [form, setForm] = useState({
    senderName: '',
    senderEmail: '',
    emailSignature: '',
    dailySendLimit: 30,
    smsDailyLimit: 150,
    unsubscribeUrl: '',
    warmupMode: false,
    followupsEnabled: true,
    followupInterval1: 3,
    followupInterval2: 5,
    followupInterval3: 7,
  });
  const [industryWeights, setIndustryWeights] = useState<Record<string, number>>(
    Object.fromEntries(INDUSTRY_LIST.map((i) => [i.key, 20]))
  );

  // 2FA state
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [totpData, setTotpData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  // Test email state
  const [testEmail, setTestEmail] = useState({ to: '', subject: '', body: '' });
  const [sendingTest, setSendingTest] = useState(false);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list().then((r) => r.data),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        senderName: settings.senderName || '',
        senderEmail: settings.senderEmail || '',
        emailSignature: settings.emailSignature || '',
        dailySendLimit: settings.dailySendLimit || 30,
        smsDailyLimit: settings.smsDailyLimit || 150,
        unsubscribeUrl: settings.unsubscribeUrl || '',
        warmupMode: settings.warmupMode || false,
        followupsEnabled: settings.followupsEnabled ?? true,
        followupInterval1: settings.followupInterval1 || 3,
        followupInterval2: settings.followupInterval2 || 5,
        followupInterval3: settings.followupInterval3 || 7,
      });
      if (settings.industryWeights) {
        setIndustryWeights({ ...Object.fromEntries(INDUSTRY_LIST.map((i) => [i.key, 20])), ...settings.industryWeights });
      }
      if (settings.whatsAppPhoneId) setWhatsAppPhoneId(settings.whatsAppPhoneId);
      if (settings.ghlLocationId) setGhlLocationId(settings.ghlLocationId);
      if (settings.ghlPhoneNumber) setGhlPhoneNumber(settings.ghlPhoneNumber);
      if (settings.ghlPhoneNumberUS) setGhlPhoneNumberUS(settings.ghlPhoneNumberUS);
      if (settings.ghlPhoneNumberZA) setGhlPhoneNumberZA(settings.ghlPhoneNumberZA);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved');
      setApiKeys({});
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save settings';
      toast.error(msg);
    },
  });

  const setup2FAMutation = useMutation({
    mutationFn: () => twoFactorApi.setup(),
    onSuccess: (res) => setTotpData(res.data),
    onError: () => toast.error('Failed to start 2FA setup'),
  });

  const verify2FAMutation = useMutation({
    mutationFn: () => twoFactorApi.verify(verifyCode),
    onSuccess: (res) => {
      setBackupCodes(res.data.backupCodes);
      setVerifyCode('');
      refreshUser();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid code';
      toast.error(msg);
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: () => twoFactorApi.disable(disableCode),
    onSuccess: () => {
      toast.success('2FA disabled');
      setShowDisable(false);
      setDisableCode('');
      setShowSetup2FA(false);
      setTotpData(null);
      setBackupCodes(null);
      refreshUser();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid code';
      toast.error(msg);
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked');
    },
    onError: () => toast.error('Failed to revoke session'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => sessionsApi.revokeAll(false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Other sessions revoked');
    },
    onError: () => toast.error('Failed to revoke sessions'),
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = { industryWeights };
    // All users can update non-admin fields
    Object.assign(payload, {
      senderName: form.senderName,
      emailSignature: form.emailSignature,
      dailySendLimit: form.dailySendLimit,
      smsDailyLimit: form.smsDailyLimit,
      unsubscribeUrl: form.unsubscribeUrl,
      warmupMode: form.warmupMode,
      followupsEnabled: form.followupsEnabled,
      followupInterval1: form.followupInterval1,
      followupInterval2: form.followupInterval2,
      followupInterval3: form.followupInterval3,
    });
    // Admin-only fields
    if (isAdmin) {
      if (form.senderEmail) payload.senderEmail = form.senderEmail;
      if (whatsAppPhoneId.trim()) payload.whatsAppPhoneId = whatsAppPhoneId.trim();
      if (ghlLocationId.trim()) payload.ghlLocationId = ghlLocationId.trim();
      if (ghlPhoneNumber.trim()) payload.ghlPhoneNumber = ghlPhoneNumber.trim();
      if (ghlPhoneNumberUS.trim()) payload.ghlPhoneNumberUS = ghlPhoneNumberUS.trim();
      if (ghlPhoneNumberZA.trim()) payload.ghlPhoneNumberZA = ghlPhoneNumberZA.trim();
      for (const [key, value] of Object.entries(apiKeys)) {
        if (value.trim()) payload[key] = value.trim();
      }
    }
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure your account and preferences</p>
      </div>

      {/* Last Login Info */}
      {user?.lastLoginAt && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2">
          <LogIn size={13} className="text-slate-600" />
          Last login: {new Date(user.lastLoginAt).toLocaleString()}
          {user.lastLoginIp && ` from ${user.lastLoginIp}`}
        </div>
      )}

      {/* Non-admin notice for API sections */}
      {!isAdmin && (
        <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-900/20 border border-amber-800/30 rounded-lg px-4 py-3">
          <Shield size={16} className="flex-shrink-0" />
          API keys, sender email, and integrations are managed by the admin.
        </div>
      )}

      {/* API Keys — admin only */}
      {isAdmin && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Key size={18} className="text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">API Keys</h2>
            <span className="text-xs bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded ml-1">Admin only</span>
          </div>
          <p className="text-xs text-slate-500">
            Keys are encrypted in the database and never exposed in the UI. Enter a new value to update.
          </p>

          {API_KEY_FIELDS.map(({ key, label, placeholder }) => {
            const hasKey = `has${key.charAt(0).toUpperCase() + key.slice(1)}`;
            const isSet = settings?.[hasKey as keyof Settings] as boolean;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">{label}</label>
                  {isSet ? (
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle size={12} /> Configured
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <XCircle size={12} /> Not set
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showKeys[key] ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder={isSet ? '••••••••' : placeholder}
                    value={apiKeys[key] || ''}
                    onChange={(e) => setApiKeys((k) => ({ ...k, [key]: e.target.value }))}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    onClick={() => setShowKeys((s) => ({ ...s, [key]: !s[key] }))}
                  >
                    {showKeys[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sender Settings */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">Sender Settings</h2>
        </div>

        <div className={isAdmin ? 'grid grid-cols-2 gap-4' : ''}>
          <div>
            <label className="label">Sender Name</label>
            <input
              type="text"
              className="input"
              placeholder="Your name"
              value={form.senderName}
              onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))}
            />
          </div>
          {isAdmin && (
            <div>
              <label className="label">
                Sender Email
                <span className="ml-1 text-xs text-slate-500">(locked)</span>
              </label>
              <input
                type="email"
                className="input opacity-60 cursor-not-allowed"
                value="info@bossdigitalsolutions.tech"
                readOnly
              />
              <p className="text-xs text-slate-500 mt-1">All emails are sent from this verified address.</p>
            </div>
          )}
        </div>

        <div>
          <label className="label">Email Signature</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="-- &#10;Your Name&#10;Your Website | Your Phone"
            value={form.emailSignature}
            onChange={(e) => setForm((f) => ({ ...f, emailSignature: e.target.value }))}
          />
        </div>

        {isAdmin && (
          <div>
            <label className="label">Unsubscribe Page URL</label>
            <input
              type="url"
              className="input"
              placeholder="https://yoursite.com/unsubscribe (or leave blank to use built-in)"
              value={form.unsubscribeUrl}
              onChange={(e) => setForm((f) => ({ ...f, unsubscribeUrl: e.target.value }))}
            />
          </div>
        )}
      </div>

      {/* Send Test Email */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Send size={18} className="text-green-400" />
          <h2 className="text-base font-semibold text-slate-100">Send Test Email</h2>
        </div>
        <p className="text-xs text-slate-400">
          Manually compose and send an email from info@bossdigitalsolutions.tech for testing.
        </p>

        <div>
          <label className="label">To (recipient email)</label>
          <input
            type="email"
            className="input"
            placeholder="recipient@example.com"
            value={testEmail.to}
            onChange={(e) => setTestEmail((t) => ({ ...t, to: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Subject</label>
          <input
            type="text"
            className="input"
            placeholder="Test email subject"
            value={testEmail.subject}
            onChange={(e) => setTestEmail((t) => ({ ...t, subject: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Body</label>
          <textarea
            className="input resize-none"
            rows={6}
            placeholder="Type your email body here..."
            value={testEmail.body}
            onChange={(e) => setTestEmail((t) => ({ ...t, body: e.target.value }))}
          />
        </div>
        <button
          className="btn btn-primary flex items-center gap-2"
          disabled={sendingTest || !testEmail.to || !testEmail.subject || !testEmail.body}
          onClick={async () => {
            setSendingTest(true);
            try {
              await emailsApi.testSend(testEmail.to, testEmail.subject, testEmail.body);
              toast.success('Test email sent!');
              setTestEmail({ to: '', subject: '', body: '' });
            } catch (err: unknown) {
              const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send';
              toast.error(msg);
            } finally {
              setSendingTest(false);
            }
          }}
        >
          <Send size={16} />
          {sendingTest ? 'Sending...' : 'Send Test Email'}
        </button>
      </div>

      {/* Send Limits */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">Send Limits</h2>
        </div>

        <div>
          <label className="label">Daily Send Limit</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input w-24"
              min={1}
              max={500}
              value={form.dailySendLimit}
              onChange={(e) => setForm((f) => ({ ...f, dailySendLimit: Number(e.target.value) }))}
            />
            <span className="text-sm text-slate-400">emails per day</span>
          </div>
        </div>

        <div>
          <label className="label">SMS Daily Limit</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input w-24"
              min={1}
              max={500}
              value={form.smsDailyLimit}
              onChange={(e) => setForm((f) => ({ ...f, smsDailyLimit: Number(e.target.value) }))}
            />
            <span className="text-sm text-slate-400">SMS per day (GHL tier: 50 → 250 → 500)</span>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-slate-200">Warm-up Mode</h3>
                {settings?.warmupMode && (
                  <span className="badge bg-yellow-900/40 text-yellow-300 text-xs">
                    Active — Day {settings.warmupDay}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gradually increases send volume to build sender reputation.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-auto">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.warmupMode}
                onChange={(e) => setForm((f) => ({ ...f, warmupMode: e.target.checked }))}
              />
              <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>
        </div>
      </div>

      {/* Follow-Up Settings */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">Follow-Up Automation</h2>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">Enable Follow-Ups</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically send follow-up emails to leads that haven't replied
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.followupsEnabled}
              onChange={(e) => setForm((f) => ({ ...f, followupsEnabled: e.target.checked }))}
            />
            <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </div>

        {form.followupsEnabled && (
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <p className="text-xs text-slate-500">Days to wait before each follow-up (after no reply)</p>
            <div className="grid grid-cols-3 gap-4">
              {([1, 2, 3] as const).map((n) => (
                <div key={n}>
                  <label className="label">Follow-up {n}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input w-20"
                      min={1}
                      max={30}
                      value={form[`followupInterval${n}` as keyof typeof form] as number}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [`followupInterval${n}`]: Number(e.target.value) }))
                      }
                    />
                    <span className="text-xs text-slate-400">days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Industry Weights */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">Lead Scoring — Industry Weights</h2>
        </div>
        <div className="space-y-3">
          {INDUSTRY_LIST.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm text-slate-300 w-44 shrink-0">{label}</span>
              <input
                type="range"
                min={0}
                max={25}
                value={industryWeights[key] ?? 20}
                onChange={(e) =>
                  setIndustryWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
                }
                className="flex-1 accent-blue-500"
              />
              <span className="text-sm text-slate-400 w-6 text-right">{industryWeights[key] ?? 20}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GoHighLevel — admin only */}
      {isAdmin && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs leading-none">G</span>
            </div>
            <h2 className="text-base font-semibold text-slate-100">GoHighLevel</h2>
            <span className="text-xs text-amber-400 ml-1">(admin only)</span>
            {settings?.hasGhlApiKey && (
              <div className="flex items-center gap-1 text-xs text-green-400 ml-auto">
                <CheckCircle size={12} /> Connected
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">GHL API Key</label>
              {settings?.hasGhlApiKey ? (
                <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Configured</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-500"><XCircle size={12} /> Not set</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showKeys['ghlApiKey'] ? 'text' : 'password'}
                className="input pr-10"
                placeholder={settings?.hasGhlApiKey ? '••••••••' : 'eyJhbGci...'}
                value={apiKeys['ghlApiKey'] || ''}
                onChange={(e) => setApiKeys((k) => ({ ...k, ghlApiKey: e.target.value }))}
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => setShowKeys((s) => ({ ...s, ghlApiKey: !s['ghlApiKey'] }))}
              >
                {showKeys['ghlApiKey'] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Location ID</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. ABCDEFGhijklm12345"
              value={ghlLocationId}
              onChange={(e) => setGhlLocationId(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Default SMS Phone Number</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. +27760518635"
              value={ghlPhoneNumber}
              onChange={(e) => setGhlPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">Fallback number if no country-specific number is set.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">UK Phone Number</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. +447911123456"
                value={ghlPhoneNumberUS}
                onChange={(e) => setGhlPhoneNumberUS(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">For leads in the United Kingdom.</p>
            </div>
            <div>
              <label className="label">South Africa Phone Number</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. +27760518635"
                value={ghlPhoneNumberZA}
                onChange={(e) => setGhlPhoneNumberZA(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">For leads in South Africa.</p>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp — admin only */}
      {isAdmin && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle size={18} className="text-green-400" />
            <h2 className="text-base font-semibold text-slate-100">WhatsApp Business API</h2>
            <span className="text-xs text-amber-400 ml-1">(admin only)</span>
          </div>
          <div>
            <label className="label">Phone Number ID</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. 123456789012345"
              value={whatsAppPhoneId}
              onChange={(e) => setWhatsAppPhoneId(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Access Token</label>
              {settings?.hasWhatsAppToken ? (
                <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Configured</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-500"><XCircle size={12} /> Not set</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showKeys['whatsAppToken'] ? 'text' : 'password'}
                className="input pr-10"
                placeholder={settings?.hasWhatsAppToken ? '••••••••' : 'EAAxxxxxxx...'}
                value={apiKeys['whatsAppToken'] || ''}
                onChange={(e) => setApiKeys((k) => ({ ...k, whatsAppToken: e.target.value }))}
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => setShowKeys((s) => ({ ...s, whatsAppToken: !s['whatsAppToken'] }))}
              >
                {showKeys['whatsAppToken'] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="btn-primary flex items-center gap-2 px-6"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save size={16} />
            Save Settings
          </>
        )}
      </button>

      {/* Two-Factor Authentication */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">Two-Factor Authentication</h2>
          {user?.twoFactorEnabled && (
            <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded ml-auto">Enabled</span>
          )}
        </div>

        {!user?.twoFactorEnabled ? (
          <>
            <p className="text-xs text-slate-500">
              Add an extra layer of security. You'll need your authenticator app at every login.
            </p>
            {!showSetup2FA ? (
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  setShowSetup2FA(true);
                  setup2FAMutation.mutate();
                }}
              >
                <Shield size={15} />
                Enable 2FA
              </button>
            ) : (
              <div className="space-y-4">
                {setup2FAMutation.isPending && (
                  <p className="text-sm text-slate-400">Generating...</p>
                )}
                {totpData && !backupCodes && (
                  <>
                    <p className="text-sm text-slate-300">
                      Scan this QR code with Google Authenticator, Authy, or any TOTP app:
                    </p>
                    <div className="flex justify-center p-4 bg-white rounded-lg w-fit">
                      <QRCodeSVG value={totpData.otpauthUrl} size={180} />
                    </div>
                    <p className="text-xs text-slate-500">
                      Or enter manually: <code className="text-blue-400 break-all">{totpData.secret}</code>
                    </p>
                    <div>
                      <label className="label">Enter the 6-digit code from your app</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input w-36 tracking-widest font-mono text-center"
                          placeholder="000000"
                          maxLength={6}
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        />
                        <button
                          className="btn-primary"
                          onClick={() => verify2FAMutation.mutate()}
                          disabled={verifyCode.length !== 6 || verify2FAMutation.isPending}
                        >
                          {verify2FAMutation.isPending ? 'Verifying...' : 'Verify & Enable'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {backupCodes && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={16} />
                      <span className="text-sm font-medium">2FA enabled!</span>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-200 mb-2">Save your backup codes</p>
                      <p className="text-xs text-slate-500 mb-3">
                        Store these somewhere safe. Each code can only be used once.
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {backupCodes.map((code, i) => (
                          <code key={i} className="text-sm text-blue-300 font-mono">{code}</code>
                        ))}
                      </div>
                    </div>
                    <button className="btn-secondary" onClick={() => setBackupCodes(null)}>
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              2FA is active. You'll need your authenticator app at every login.
            </p>
            {!showDisable ? (
              <button
                className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
                onClick={() => setShowDisable(true)}
              >
                <Lock size={14} />
                Disable 2FA
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Enter your current TOTP or a backup code:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input w-40 font-mono"
                    placeholder="Code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                  />
                  <button
                    className="btn-primary bg-red-600 hover:bg-red-500"
                    onClick={() => disable2FAMutation.mutate()}
                    disabled={!disableCode || disable2FAMutation.isPending}
                  >
                    Disable
                  </button>
                  <button className="btn-secondary" onClick={() => { setShowDisable(false); setDisableCode(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Active Sessions */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor size={18} className="text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Active Sessions</h2>
          </div>
          {(sessions as unknown[]).length > 1 && (
            <button
              className="text-xs text-slate-400 hover:text-red-400"
              onClick={() => {
                if (confirm('Log out all other sessions?')) revokeAllMutation.mutate();
              }}
            >
              Log out all others
            </button>
          )}
        </div>

        <div className="space-y-2">
          {(sessions as { id: string; ipAddress?: string; userAgent?: string; lastActiveAt: string; createdAt: string }[]).map((session) => (
            <div key={session.id} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg">
              <Monitor size={14} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 truncate">{session.userAgent || 'Unknown device'}</p>
                <p className="text-xs text-slate-500">
                  {session.ipAddress} · Last active {new Date(session.lastActiveAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => revokeSessionMutation.mutate(session.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded"
                title="Revoke session"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {(sessions as unknown[]).length === 0 && (
            <p className="text-xs text-slate-500">No active sessions found</p>
          )}
        </div>
      </div>
    </div>
  );
}
