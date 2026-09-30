/**
 * Validator Module
 * 
 * Implements the self-healing build loop:
 * 1. Install dependencies in the generated project
 * 2. Attempt to build
 * 3. If errors, feed them to LLM to fix
 * 4. Retry up to maxRetries times
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { generateCode } from '../ai/llm-client.js';
import { config } from '../config.js';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const ERROR_FIX_SYSTEM_PROMPT = `You are an expert Next.js/React/TypeScript debugger.
You are given a source file that has build errors.
Fix the errors and return the COMPLETE corrected file.

Rules:
1. Fix ALL errors mentioned
2. Preserve the original functionality and styling
3. Output ONLY the corrected code — no markdown, no code fences, no explanation
4. If a type error, add proper TypeScript types
5. If a missing import, add the import
6. If a JSX error, fix the JSX syntax
7. Do NOT change the component name or exports`;

export interface ValidationResult {
  success: boolean;
  errors: string[];
  fixAttempts: number;
}

export async function validateAndFix(projectPath: string): Promise<ValidationResult> {
  console.log('\n🔄 Stage 4: Validation & Error Handling');

  const result: ValidationResult = {
    success: false,
    errors: [],
    fixAttempts: 0,
  };

  // Step 1: Install dependencies
  console.log('  ⏳ Checking dependencies in generated project...');
  const nextInstalled = await fs.access(path.join(projectPath, 'node_modules', 'next'))
    .then(() => true)
    .catch(() => false);

  if (nextInstalled) {
    console.log('  ✓ Dependencies already installed');
  } else {
    console.log('  ⏳ Installing dependencies in generated project...');
    try {
      await execAsync('npm install --prefer-offline --no-audit', {
        cwd: projectPath,
        timeout: 180000,
      });
      console.log('  ✓ Dependencies installed');
    } catch (err: any) {
      console.log(`  ✗ npm install failed: ${err.message}`);
      result.errors.push(`npm install failed: ${err.message}`);
      return result;
    }
  }

  // Step 2: Build loop with retries
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    result.fixAttempts = attempt;
    console.log(`  ⏳ Build attempt ${attempt + 1}/${config.maxRetries + 1}...`);

    try {
      const { stdout, stderr } = await execAsync('npx next build', {
        cwd: projectPath,
        timeout: 120000,
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      });

      // Build succeeded
      console.log('  ✓ Build successful!');
      result.success = true;
      return result;
    } catch (err: any) {
      const errorOutput = (err.stderr || '') + '\n' + (err.stdout || '');
      const errors = parseBuildErrors(errorOutput);

      if (errors.length === 0) {
        console.log(`  ⚠ Build failed but no parseable errors`);
        result.errors.push(errorOutput.substring(0, 500));

        if (attempt >= config.maxRetries) break;
        continue;
      }

      console.log(`  ⚠ Found ${errors.length} build error(s)`);
      result.errors = errors.map((e) => `${e.file}: ${e.message}`);

      if (attempt >= config.maxRetries) {
        console.log(`  ✗ Max retries reached (${config.maxRetries})`);
        break;
      }

      // Attempt to fix errors
      console.log(`  ⏳ Attempting AI-powered fix...`);
      await fixBuildErrors(projectPath, errors);
    }
  }

  return result;
}

/**
 * Start the dev server for preview
 */
export async function startDevServer(
  projectPath: string
): Promise<{ port: number; process: any }> {
  console.log('\n👁️  Starting local preview...');

  const { spawn } = await import('child_process');

  const port = 3456;
  const devProcess = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: projectPath,
    shell: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  // Wait for dev server to be ready
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve({ port, process: devProcess });
    }, 15000);

    devProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('ready') || output.includes('localhost')) {
        clearTimeout(timeout);
        console.log(`  ✓ Dev server running at http://localhost:${port}`);
        resolve({ port, process: devProcess });
      }
    });

    devProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (config.verbose) {
        console.log(`  [dev] ${output}`);
      }
    });

    devProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ─── Error Parsing & Fixing ──────────────────────────────────────

interface BuildError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
}

function parseBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  const lines = output.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // TypeScript/Next.js error pattern: ./src/components/File.tsx:10:5
    const tsMatch = line.match(/\.\/(.+?\.tsx?):(\d+):(\d+)/);
    if (tsMatch) {
      const errorMessage = lines.slice(i, i + 5).join('\n');
      errors.push({
        file: tsMatch[1],
        line: parseInt(tsMatch[2]),
        column: parseInt(tsMatch[3]),
        message: errorMessage,
      });
      continue;
    }

    // Type error pattern
    const typeMatch = line.match(/Type error:(.+)/);
    if (typeMatch) {
      // Look backward for file reference
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const fileRef = lines[j].match(/\.\/(.+?\.tsx?)/);
        if (fileRef) {
          errors.push({
            file: fileRef[1],
            message: typeMatch[1].trim(),
          });
          break;
        }
      }
    }

    // Module not found
    const moduleMatch = line.match(/Module not found.*'(.+?)'/);
    if (moduleMatch) {
      errors.push({
        file: 'unknown',
        message: `Module not found: ${moduleMatch[1]}`,
      });
    }
  }

  // Deduplicate by file
  const seen = new Set<string>();
  return errors.filter((e) => {
    const key = `${e.file}:${e.message.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fixBuildErrors(
  projectPath: string,
  errors: BuildError[]
): Promise<void> {
  // Group errors by file
  const errorsByFile = new Map<string, BuildError[]>();
  for (const error of errors) {
    const existing = errorsByFile.get(error.file) || [];
    existing.push(error);
    errorsByFile.set(error.file, existing);
  }

  for (const [filePath, fileErrors] of errorsByFile) {
    if (filePath === 'unknown') continue;

    const fullPath = path.join(projectPath, filePath);
    try {
      const currentCode = await fs.readFile(fullPath, 'utf-8');

      const errorDescriptions = fileErrors
        .map((e) => `Line ${e.line || '?'}: ${e.message}`)
        .join('\n');

      const fixedCode = await generateCode(
        ERROR_FIX_SYSTEM_PROMPT,
        `Fix the following build errors in this file.

=== ERRORS ===
${errorDescriptions}

=== CURRENT CODE ===
${currentCode}

Return the COMPLETE corrected file. Fix all errors while preserving functionality.`,
        { temperature: 0.1 }
      );

      const cleaned = cleanCodeOutput(fixedCode);
      await fs.writeFile(fullPath, cleaned, 'utf-8');
      console.log(`    ✓ Fixed: ${filePath}`);
    } catch (err) {
      console.log(`    ✗ Could not fix ${filePath}: ${err}`);
    }
  }
}

function cleanCodeOutput(code: string): string {
  let cleaned = code.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    cleaned = cleaned.substring(firstNewline + 1);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
  }
  return cleaned.trim();
}
