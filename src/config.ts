import { config as dotenvConfig } from 'dotenv';
import { PipelineConfig } from './types/blueprint.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const config: PipelineConfig = {
  llmProvider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'gemini') || 'gemini',
  model: process.env.LLM_MODEL || 'gemini-flash-lite-latest',
  visionModel: process.env.VISION_MODEL || 'gemini-flash-lite-latest',
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  outputDir: process.env.OUTPUT_DIR || path.join(projectRoot, 'output'),
  screenshotDir: path.join(projectRoot, '.screenshots'),
  verbose: process.env.VERBOSE === 'true',
};

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function validateConfig(): void {
  if (config.llmProvider === 'openai' && !OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is required when using OpenAI provider. Set it in .env file.'
    );
  }
  if (config.llmProvider === 'anthropic' && !ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is required when using Anthropic provider. Set it in .env file.'
    );
  }
  if (config.llmProvider === 'gemini' && !GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is required when using Gemini provider. Set it in .env file.'
    );
  }
}

export const PROJECT_ROOT = projectRoot;
export const TEMPLATES_DIR = path.join(projectRoot, 'templates');
