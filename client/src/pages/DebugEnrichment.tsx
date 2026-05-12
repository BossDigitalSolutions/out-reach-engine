// DEBUG ONLY — REMOVE BEFORE PRODUCTION
// Admin diagnostic page for med spa enrichment pipeline.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bug, Play, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

interface DebugResult {
  url: string;
  firecrawl: {
    status?: number;
    time_ms?: number;
    success?: boolean;
    markdown?: string | null;
    markdown_length?: number;
    raw_response?: unknown;
    error?: string | null;
  };
  claude_prompt: {
    system?: string;
    user?: string;
    estimated_tokens?: number;
  };
  claude_response: {
    status?: number;
    time_ms?: number;
    input_tokens?: number;
    output_tokens?: number;
    raw_text?: string;
    has_code_fences?: boolean;
    starts_with_brace?: boolean;
    error?: string | null;
  };
  parsed: {
    success?: boolean;
    data?: Record<string, unknown>;
    error?: string;
    attempted_to_parse?: string;
    signature_treatment_status?: 'populated' | 'null';
    would_use_template?: string;
    would_save_to_lead?: Record<string, unknown>;
  };
  overall_status: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded border px-2 py-0.5 ${
        ok
          ? 'bg-green-900/40 text-green-300 border-green-800/50'
          : 'bg-red-900/40 text-red-300 border-red-800/50'
      }`}
    >
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />} {label}
    </span>
  );
}

function Card({
  title,
  defaultOpen = false,
  status,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  status?: 'ok' | 'fail' | 'warn';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {title}
          {status === 'ok' && <CheckCircle size={14} className="text-green-400" />}
          {status === 'fail' && <XCircle size={14} className="text-red-400" />}
          {status === 'warn' && <AlertTriangle size={14} className="text-amber-400" />}
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-800">{children}</div>}
    </div>
  );
}

export default function DebugEnrichment() {
  const [url, setUrl] = useState('');
  const [showFullMarkdown, setShowFullMarkdown] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);

  const runMutation = useMutation({
    mutationFn: (testUrl: string) =>
      api.post('/debug/enrichment', { url: testUrl }).then((r) => r.data as DebugResult),
    onSuccess: (data) => {
      setResult(data);
      setShowFullMarkdown(false);
      if (data.overall_status === 'success') toast.success('Pipeline completed');
      else toast.error(`Pipeline status: ${data.overall_status}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Test failed';
      toast.error(msg);
    },
  });

  const fc = result?.firecrawl;
  const cr = result?.claude_response;
  const pr = result?.parsed;
  const fcStatus = !fc ? undefined : fc.success ? 'ok' : 'fail';
  const claudeStatus = !cr ? undefined : cr.error ? 'fail' : 'ok';
  const parseStatus = !pr
    ? undefined
    : pr.success
    ? pr.signature_treatment_status === 'populated'
      ? 'ok'
      : 'warn'
    : 'fail';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bug size={24} /> Debug Enrichment
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Run a single URL through the full Firecrawl → Claude → Parse pipeline. Admin-only diagnostic tool.
        </p>
        <p className="text-xs text-amber-400 mt-1">
          ⚠️ DEBUG ONLY — each run consumes 1 Firecrawl credit and ~1k Claude tokens.
        </p>
      </div>

      {/* Form */}
      <div className="card">
        <label className="label">URL to test</label>
        <div className="flex gap-3">
          <input
            type="url"
            className="input flex-1"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={runMutation.isPending}
          />
          <button
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            onClick={() => url && runMutation.mutate(url)}
            disabled={runMutation.isPending || !url}
          >
            {runMutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play size={16} /> Run full pipeline test
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* Overall status */}
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Overall status</p>
              <p className="text-lg font-semibold text-white">{result.overall_status}</p>
            </div>
            <div className="flex gap-2">
              {fc?.status != null && <StatusBadge ok={!!fc.success} label={`Firecrawl ${fc.status}`} />}
              {cr?.error == null && cr?.time_ms != null && <StatusBadge ok label={`Claude ${cr.time_ms}ms`} />}
              {pr?.success && <StatusBadge ok label="Parsed" />}
              {pr?.success === false && <StatusBadge ok={false} label="Parse failed" />}
            </div>
          </div>

          {/* Card 1: Firecrawl */}
          <Card title="1. Firecrawl raw response" defaultOpen status={fcStatus}>
            {fc?.error ? (
              <div className="text-sm text-red-400 mt-2">
                <p className="font-semibold">Error:</p>
                <pre className="bg-red-950/30 rounded p-2 text-xs whitespace-pre-wrap">{fc.error}</pre>
                {!!fc.raw_response && (
                  <pre className="bg-slate-950 rounded p-2 text-xs whitespace-pre-wrap mt-2 max-h-60 overflow-auto">
                    {JSON.stringify(fc.raw_response, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div className="mt-2 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">HTTP status</p>
                    <p className={fc?.success ? 'text-green-400' : 'text-red-400'}>{fc?.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Response time</p>
                    <p className="text-slate-200">{fc?.time_ms} ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Markdown length</p>
                    <p className={`${(fc?.markdown_length ?? 0) < 500 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {fc?.markdown_length?.toLocaleString()} chars
                    </p>
                  </div>
                </div>
                {(fc?.markdown_length ?? 0) < 500 && (
                  <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded px-2 py-1">
                    ⚠️ Markdown under 500 chars — likely JS-only site or Firecrawl blocked
                  </p>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    Markdown preview ({showFullMarkdown ? 'full' : 'first 2000 chars'})
                  </p>
                  <pre className="bg-slate-950 rounded p-2 text-xs whitespace-pre-wrap max-h-96 overflow-auto text-slate-300">
                    {fc?.markdown
                      ? showFullMarkdown
                        ? fc.markdown
                        : fc.markdown.slice(0, 2000) + (fc.markdown.length > 2000 ? '\n\n...[truncated]' : '')
                      : '(empty)'}
                  </pre>
                  {(fc?.markdown?.length ?? 0) > 2000 && (
                    <button
                      onClick={() => setShowFullMarkdown(!showFullMarkdown)}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                      {showFullMarkdown ? 'Show less' : 'Show full markdown'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Card 2: Claude prompt */}
          <Card title="2. Claude extraction prompt">
            <div className="mt-2 space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Estimated tokens</p>
                <p className="text-slate-200">{result.claude_prompt.estimated_tokens?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">System prompt</p>
                <pre className="bg-slate-950 rounded p-2 text-xs whitespace-pre-wrap text-slate-300">
                  {result.claude_prompt.system}
                </pre>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">User prompt</p>
                <pre className="bg-slate-950 rounded p-2 text-xs whitespace-pre-wrap max-h-96 overflow-auto text-slate-300">
                  {result.claude_prompt.user}
                </pre>
              </div>
            </div>
          </Card>

          {/* Card 3: Claude raw response */}
          <Card title="3. Claude raw response" status={claudeStatus}>
            {cr?.error ? (
              <div className="text-sm text-red-400 mt-2">
                <p className="font-semibold">Error:</p>
                <pre className="bg-red-950/30 rounded p-2 text-xs whitespace-pre-wrap">{cr.error}</pre>
              </div>
            ) : (
              <div className="mt-2 space-y-2 text-sm">
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Response time</p>
                    <p className="text-slate-200">{cr?.time_ms} ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Input tokens</p>
                    <p className="text-slate-200">{cr?.input_tokens?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Output tokens</p>
                    <p className="text-slate-200">{cr?.output_tokens?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Starts with {'{'}?</p>
                    <p className={cr?.starts_with_brace ? 'text-green-400' : 'text-amber-400'}>
                      {cr?.starts_with_brace ? 'yes' : 'no — Claude added prefix'}
                    </p>
                  </div>
                </div>
                {cr?.has_code_fences && (
                  <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded px-2 py-1">
                    ⚠️ Response contains code fences (```) — will be stripped before parsing
                  </p>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Raw response text</p>
                  <pre className="bg-slate-950 rounded p-2 text-xs whitespace-pre-wrap max-h-96 overflow-auto text-slate-300">
                    {cr?.raw_text}
                  </pre>
                </div>
              </div>
            )}
          </Card>

          {/* Card 4: Parsed result */}
          <Card title="4. Parsed result" defaultOpen status={parseStatus}>
            {pr?.success === false ? (
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-red-400 font-semibold">Parse failed</p>
                <pre className="bg-red-950/30 rounded p-2 text-xs whitespace-pre-wrap">{pr.error}</pre>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Attempted to parse:</p>
                  <pre className="bg-slate-950 rounded p-2 text-xs whitespace-pre-wrap max-h-60 overflow-auto text-slate-300">
                    {pr.attempted_to_parse}
                  </pre>
                </div>
              </div>
            ) : pr?.data ? (
              <div className="mt-2 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-2">Extracted fields</p>
                  <div className="bg-slate-950 rounded p-3 space-y-1.5 text-xs font-mono">
                    {Object.entries(pr.data).map(([key, value]) => (
                      <div key={key} className="flex gap-3">
                        <span className="text-slate-500 w-44 shrink-0">{key}:</span>
                        <span
                          className={
                            value == null || value === ''
                              ? 'text-red-400'
                              : 'text-green-300'
                          }
                        >
                          {value == null ? 'null' : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
                  <p className="text-xs font-semibold text-slate-300 mb-1">What would happen next?</p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>
                      • Lead saved with: signature_treatment ={' '}
                      <span className={pr.signature_treatment_status === 'populated' ? 'text-green-400' : 'text-red-400'}>
                        {JSON.stringify(pr.data.signature_treatment)}
                      </span>
                    </li>
                    <li>• Email template: {pr.would_use_template}</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No parse result yet.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
