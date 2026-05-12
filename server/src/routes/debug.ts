// DEBUG ONLY — REMOVE BEFORE PRODUCTION
// Admin-only diagnostic endpoint for med spa enrichment pipeline.

import { Router, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { decryptField } from '../services/encryption';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

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
  overall_status:
    | 'unknown'
    | 'success'
    | 'failed_at_firecrawl'
    | 'firecrawl_threw'
    | 'failed_at_claude'
    | 'claude_threw'
    | 'failed_at_parse'
    | 'missing_api_keys';
}

// POST /api/debug/enrichment
router.post('/enrichment', async (req: AuthRequest, res: Response) => {
  try {
    const { url } = z.object({ url: z.string().url() }).parse(req.body);

    const result: DebugResult = {
      url,
      firecrawl: {},
      claude_prompt: {},
      claude_response: {},
      parsed: {},
      overall_status: 'unknown',
    };

    // Get API keys from user settings
    const settings = await prisma.settings.findUnique({ where: { userId: req.user!.userId } });
    const firecrawlApiKey =
      decryptField((settings as Record<string, unknown> | null)?.firecrawlApiKey as string | null | undefined) ||
      process.env.FIRECRAWL_API_KEY;
    const anthropicApiKey =
      decryptField(settings?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY;

    if (!firecrawlApiKey || !anthropicApiKey) {
      result.overall_status = 'missing_api_keys';
      result.firecrawl.error = !firecrawlApiKey ? 'Firecrawl API key not configured' : null;
      result.claude_response.error = !anthropicApiKey ? 'Anthropic API key not configured' : null;
      return res.json(result);
    }

    // ─── Step 1: Firecrawl ────────────────────────────────────────────────
    const fcStart = Date.now();
    let markdown: string | null = null;
    try {
      const fcRes = await axios.post(
        'https://api.firecrawl.dev/v1/scrape',
        { url, formats: ['markdown'] },
        {
          headers: {
            Authorization: `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
          validateStatus: () => true,
        }
      );

      markdown = fcRes.data?.data?.markdown || null;
      result.firecrawl = {
        status: fcRes.status,
        time_ms: Date.now() - fcStart,
        success: fcRes.status >= 200 && fcRes.status < 300,
        markdown,
        markdown_length: markdown?.length || 0,
        raw_response: fcRes.data,
        error: fcRes.status >= 200 && fcRes.status < 300 ? null : (fcRes.data?.error || `HTTP ${fcRes.status}`),
      };

      if (!result.firecrawl.success || !markdown) {
        result.overall_status = 'failed_at_firecrawl';
        return res.json(result);
      }
    } catch (e) {
      result.firecrawl = {
        time_ms: Date.now() - fcStart,
        error: e instanceof Error ? e.message : 'unknown firecrawl error',
      };
      result.overall_status = 'firecrawl_threw';
      return res.json(result);
    }

    // ─── Step 2: Build Claude prompt ─────────────────────────────────────
    const systemPrompt =
      'You are extracting lead data from a med spa website. Output ONLY valid JSON matching the schema. If a field cannot be confidently determined from the content, use null. Do not invent data.';

    const userPrompt = `Schema:
{
  "email": "primary contact email (info@, hello@, contact@, or an owner's direct email if listed). Null if no email visible.",
  "clinic_name": "the trading name of the med spa, as it appears in the site header or footer",
  "owner_name": "first name only of the owner or lead practitioner, if clearly identifiable on About page or homepage. Null if not clear.",
  "signature_treatment": "the most prominently featured specific treatment (e.g. 'Profhilo', 'Morpheus8', 'Polynucleotides', 'CoolSculpting'). Must be a specific named treatment, NOT a generic category like 'injectables', 'skincare', 'facials', or 'body contouring'. Pick based on homepage prominence, repetition across pages, and dedicated service pages. Null if no single specific treatment clearly dominates.",
  "location_city": "city or town where the clinic is located, from contact page, footer, or homepage",
  "instagram_handle": "Instagram username without the @, from social links. Null if no Instagram link found."
}

Website URL: ${url}

Website content:
${markdown}

Output only the JSON object. No commentary, no markdown code fences.`;

    result.claude_prompt = {
      system: systemPrompt,
      user: userPrompt,
      estimated_tokens: Math.ceil((systemPrompt.length + userPrompt.length) / 4),
    };

    // ─── Step 3: Call Claude ─────────────────────────────────────────────
    const claudeStart = Date.now();
    let rawText = '';
    try {
      const client = new Anthropic({ apiKey: anthropicApiKey });
      const claudeRes = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = claudeRes.content[0];
      rawText = content?.type === 'text' ? content.text : '';

      result.claude_response = {
        status: 200,
        time_ms: Date.now() - claudeStart,
        input_tokens: claudeRes.usage?.input_tokens,
        output_tokens: claudeRes.usage?.output_tokens,
        raw_text: rawText,
        has_code_fences: rawText.includes('```'),
        starts_with_brace: rawText.trim().startsWith('{'),
        error: null,
      };
    } catch (e) {
      result.claude_response = {
        time_ms: Date.now() - claudeStart,
        error: e instanceof Error ? e.message : 'unknown claude error',
      };
      result.overall_status = 'claude_threw';
      return res.json(result);
    }

    // ─── Step 4: Parse ───────────────────────────────────────────────────
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      const sigTreatment = parsed.signature_treatment;
      result.parsed = {
        success: true,
        data: parsed,
        signature_treatment_status: sigTreatment ? 'populated' : 'null',
        would_use_template: sigTreatment
          ? `Variant A (with treatment: "${sigTreatment}")`
          : 'Variant B (fallback "your treatments")',
        would_save_to_lead: parsed,
      };
      result.overall_status = 'success';
    } catch (parseError) {
      result.parsed = {
        success: false,
        error: parseError instanceof Error ? parseError.message : 'unknown parse error',
        attempted_to_parse: cleaned,
      };
      result.overall_status = 'failed_at_parse';
    }

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const message = err instanceof Error ? err.message : 'Debug failed';
    res.status(500).json({ error: message });
  }
});

export default router;
