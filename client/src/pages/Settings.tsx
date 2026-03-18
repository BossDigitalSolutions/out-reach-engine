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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi } from '../lib/api';

const INDUSTRY_LIST = [
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'gyms', label: 'Gyms & Fitness' },
  { key: 'salons', label: 'Salons & Barbershops' },
  { key: 'dental', label: 'Dental Offices' },
  { key: 'contractors', label: 'Contractors' },
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'auto_repair', label: 'Auto Repair' },
];

interface Settings {
  senderName?: string;
  senderEmail?: string;
  emailSignature?: string;
  dailySendLimit: number;
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
  hasWhatsAppToken: boolean;
  whatsAppPhoneId?: string;
}

interface ApiKeyField {
  key: string;
  label: string;
  placeholder: string;
  icon: string;
  docs: string;
}

const API_KEY_FIELDS: ApiKeyField[] = [
  {
    key: 'googleApiKey',
    label: 'Google Places API Key',
    placeholder: 'AIza...',
    icon: 'google',
    docs: 'console.cloud.google.com',
  },
  {
    key: 'anthropicApiKey',
    label: 'Anthropic (Claude) API Key',
    placeholder: 'sk-ant-...',
    icon: 'anthropic',
    docs: 'console.anthropic.com',
  },
  {
    key: 'sendgridApiKey',
    label: 'SendGrid API Key',
    placeholder: 'SG...',
    icon: 'sendgrid',
    docs: 'app.sendgrid.com',
  },
];

export default function Settings() {
  const qc = useQueryClient();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [whatsAppPhoneId, setWhatsAppPhoneId] = useState('');
  const [form, setForm] = useState({
    senderName: '',
    senderEmail: '',
    emailSignature: '',
    dailySendLimit: 30,
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

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        senderName: settings.senderName || '',
        senderEmail: settings.senderEmail || '',
        emailSignature: settings.emailSignature || '',
        dailySendLimit: settings.dailySendLimit || 30,
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

  const handleSave = () => {
    const payload: Record<string, unknown> = { ...form, industryWeights };
    if (whatsAppPhoneId.trim()) payload.whatsAppPhoneId = whatsAppPhoneId.trim();
    // Only include API keys if user entered new values
    for (const [key, value] of Object.entries(apiKeys)) {
      if (value.trim()) payload[key] = value.trim();
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
        <p className="text-slate-400 text-sm mt-1">Configure your API keys and email settings</p>
      </div>

      {/* API Keys */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Key size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">API Keys</h2>
        </div>
        <p className="text-xs text-slate-500">
          Keys are stored securely and never exposed in the UI. Enter a new value to update.
        </p>

        {API_KEY_FIELDS.map(({ key, label, placeholder }) => {
          const isSet = settings?.[`has${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof Settings] as boolean;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{label}</label>
                {isSet ? (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle size={12} />
                    Configured
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <XCircle size={12} />
                    Not set
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

      {/* Sender Settings */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-slate-100">Sender Settings</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="label">Sender Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@yourdomain.com"
              value={form.senderEmail}
              onChange={(e) => setForm((f) => ({ ...f, senderEmail: e.target.value }))}
            />
          </div>
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
          <p className="text-xs text-slate-600 mt-1">
            Appended to the bottom of every generated email
          </p>
        </div>

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
          <p className="text-xs text-slate-600 mt-1">
            Emails are spread out over an 8-hour window to avoid spam flags
          </p>
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
                Gradually increases send volume from 2/day to your limit. Helps build sender
                reputation and avoid spam filters.
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
        <p className="text-xs text-slate-500">
          Boost lead scores for industries you prioritize (0 = no boost, 25 = max boost)
        </p>
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

      {/* WhatsApp */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={18} className="text-green-400" />
          <h2 className="text-base font-semibold text-slate-100">WhatsApp Business API</h2>
          <span className="text-xs text-slate-500 ml-1">optional</span>
        </div>
        <p className="text-xs text-slate-500">
          Connect your Meta WhatsApp Business account to send messages directly from the app.
          Without credentials, messages open in your WhatsApp app via a pre-filled link instead.
        </p>
        <div className="bg-green-900/10 border border-green-800/30 rounded-lg px-3 py-2 text-xs text-green-300 space-y-1">
          <p className="font-medium">How to get your credentials:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-green-400/80">
            <li>Create a Meta Business account at developers.facebook.com</li>
            <li>Add a WhatsApp product to your app</li>
            <li>Copy the Phone Number ID from the WhatsApp dashboard</li>
            <li>Generate a permanent access token from a System User</li>
          </ol>
          <p className="text-green-400/60 mt-1">Note: Cold outreach via API requires Meta-approved message templates.</p>
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
          <p className="text-xs text-slate-600 mt-1">Found in Meta for Developers → WhatsApp → API Setup</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Access Token</label>
            {settings?.hasWhatsAppToken ? (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle size={12} />
                Configured
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <XCircle size={12} />
                Not set
              </div>
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
    </div>
  );
}
