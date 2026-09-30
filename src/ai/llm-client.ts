/**
 * LLM Client Module
 * 
 * Abstraction layer for OpenAI, Anthropic, and Google Gemini API calls.
 * Handles text generation, vision analysis, and structured output.
 * 
 * Default: Gemini 2.0 Flash (FREE tier — $0.00 cost)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { config, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY } from '../config.js';
import fs from 'fs/promises';
import path from 'path';

// ─── Retry helper for rate limits / 503 errors ───────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4, label = 'API call'): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isRetryable = msg.includes('503') || msg.includes('429') ||
        msg.includes('high demand') || msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('rate limit');

      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }

      const delay = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s, 40s
      console.log(`  ⏳ ${label} hit rate limit, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label} failed after ${maxRetries} retries`);
}

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return geminiClient;
}

// ─── Token usage tracking (for cost awareness) ───────────────────

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

const usageTracker: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  calls: 0,
};

export function getTokenUsage(): TokenUsage & { estimatedCost: string } {
  let cost = 0;

  if (config.llmProvider === 'gemini') {
    // Gemini 2.0 Flash free tier = $0.00
    cost = 0;
  } else if (config.llmProvider === 'openai') {
    const inputCost = (usageTracker.inputTokens / 1_000_000) * 2.5;
    const outputCost = (usageTracker.outputTokens / 1_000_000) * 10;
    cost = inputCost + outputCost;
  } else {
    const inputCost = (usageTracker.inputTokens / 1_000_000) * 3;
    const outputCost = (usageTracker.outputTokens / 1_000_000) * 15;
    cost = inputCost + outputCost;
  }

  return {
    ...usageTracker,
    estimatedCost: `$${cost.toFixed(4)}`,
  };
}

// ─── Text completion ──────────────────────────────────────────────

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const model = options?.model || config.model;
  const temperature = options?.temperature ?? 0.2;
  const maxTokens = options?.maxTokens ?? 4096;

  if (config.llmProvider === 'gemini') {
    return generateTextGemini(systemPrompt, userPrompt, {
      model,
      temperature,
      maxTokens,
      jsonMode: options?.jsonMode,
    });
  }

  if (config.llmProvider === 'anthropic') {
    return generateTextAnthropic(systemPrompt, userPrompt, {
      model,
      temperature,
      maxTokens,
    });
  }

  return generateTextOpenAI(systemPrompt, userPrompt, {
    model,
    temperature,
    maxTokens,
    jsonMode: options?.jsonMode,
  });
}

// ─── Gemini Text Generation ──────────────────────────────────────

async function generateTextGemini(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const client = getGeminiClient();
  usageTracker.calls++;

  const model = client.getGenerativeModel({
    model: options.model,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const result = await withRetry(
    () => model.generateContent(userPrompt),
    4,
    'Gemini text generation'
  );
  const response = result.response;

  // Track usage
  if (response.usageMetadata) {
    usageTracker.inputTokens += response.usageMetadata.promptTokenCount || 0;
    usageTracker.outputTokens += response.usageMetadata.candidatesTokenCount || 0;
  }

  return response.text();
}

// ─── OpenAI Text Generation ─────────────────────────────────────

async function generateTextOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const client = getOpenAIClient();
  usageTracker.calls++;

  const response = await client.chat.completions.create({
    model: options.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });

  if (response.usage) {
    usageTracker.inputTokens += response.usage.prompt_tokens;
    usageTracker.outputTokens += response.usage.completion_tokens;
  }

  return response.choices[0]?.message?.content || '';
}

// ─── Anthropic Text Generation ──────────────────────────────────

async function generateTextAnthropic(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
  }
): Promise<string> {
  const client = getAnthropicClient();
  usageTracker.calls++;

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (response.usage) {
    usageTracker.inputTokens += response.usage.input_tokens;
    usageTracker.outputTokens += response.usage.output_tokens;
  }

  const textBlock = response.content.find((c) => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

// ─── Vision analysis (with image) ─────────────────────────────────

export async function analyzeImage(
  systemPrompt: string,
  userPrompt: string,
  imagePaths: string[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const model = options?.model || config.visionModel;
  const temperature = options?.temperature ?? 0.2;
  const maxTokens = options?.maxTokens ?? 4096;

  // Read images and convert to base64
  const imageContents = await Promise.all(
    imagePaths.map(async (imgPath) => {
      const buffer = await fs.readFile(imgPath);
      const base64 = buffer.toString('base64');
      const ext = path.extname(imgPath).replace('.', '').toLowerCase();
      const mimeType =
        ext === 'png' ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif'
        : 'image/png';
      return { base64, mimeType };
    })
  );

  if (config.llmProvider === 'gemini') {
    return analyzeImageGemini(systemPrompt, userPrompt, imageContents, {
      model,
      temperature,
      maxTokens,
      jsonMode: options?.jsonMode,
    });
  }

  if (config.llmProvider === 'anthropic') {
    return analyzeImageAnthropic(systemPrompt, userPrompt, imageContents, {
      model,
      temperature,
      maxTokens,
    });
  }

  return analyzeImageOpenAI(systemPrompt, userPrompt, imageContents, {
    model,
    temperature,
    maxTokens,
    jsonMode: options?.jsonMode,
  });
}

// ─── Gemini Vision Analysis ─────────────────────────────────────

async function analyzeImageGemini(
  systemPrompt: string,
  userPrompt: string,
  images: Array<{ base64: string; mimeType: string }>,
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const client = getGeminiClient();
  usageTracker.calls++;

  const model = client.getGenerativeModel({
    model: options.model,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });

  // Build parts: images + text prompt
  const parts: Part[] = [
    ...images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    })),
    { text: userPrompt },
  ];

  const result = await withRetry(
    () => model.generateContent(parts),
    4,
    'Gemini vision analysis'
  );
  const response = result.response;

  if (response.usageMetadata) {
    usageTracker.inputTokens += response.usageMetadata.promptTokenCount || 0;
    usageTracker.outputTokens += response.usageMetadata.candidatesTokenCount || 0;
  }

  return response.text();
}

// ─── OpenAI Vision Analysis ─────────────────────────────────────

async function analyzeImageOpenAI(
  systemPrompt: string,
  userPrompt: string,
  images: Array<{ base64: string; mimeType: string }>,
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const client = getOpenAIClient();
  usageTracker.calls++;

  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map(
    (img) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: 'high' as const,
      },
    })
  );

  const response = await client.chat.completions.create({
    model: options.model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: userPrompt },
        ],
      },
    ],
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });

  if (response.usage) {
    usageTracker.inputTokens += response.usage.prompt_tokens;
    usageTracker.outputTokens += response.usage.completion_tokens;
  }

  return response.choices[0]?.message?.content || '';
}

// ─── Anthropic Vision Analysis ──────────────────────────────────

async function analyzeImageAnthropic(
  systemPrompt: string,
  userPrompt: string,
  images: Array<{ base64: string; mimeType: string }>,
  options: {
    model: string;
    temperature: number;
    maxTokens: number;
  }
): Promise<string> {
  const client = getAnthropicClient();
  usageTracker.calls++;

  const imageBlocks: Anthropic.Messages.ImageBlockParam[] = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
      data: img.base64,
    },
  }));

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  });

  if (response.usage) {
    usageTracker.inputTokens += response.usage.input_tokens;
    usageTracker.outputTokens += response.usage.output_tokens;
  }

  const textBlock = response.content.find((c) => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

// ─── Large code generation (higher token limit) ───────────────────

export async function generateCode(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<string> {
  return generateText(systemPrompt, userPrompt, {
    model: options?.model || config.model,
    temperature: options?.temperature ?? 0.1,
    maxTokens: 16384, // Higher limit for code generation
  });
}
