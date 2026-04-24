/**
 * AI package — Claude + Whisper wrappers
 * Populated in Phase 2 (Week 9)
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Lazy singletons — only instantiated when used
let _claude: Anthropic | null = null;
let _openai: OpenAI | null = null;

export function getClaude(): Anthropic {
  if (!_claude) {
    _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _claude;
}

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Models
export const CLAUDE_MODELS = {
  primary: 'claude-sonnet-4-6',   // Main — dispatch, call analysis
  cheap: 'claude-haiku-3-5',      // Bulk ops — sentiment, classification
} as const;
