/**
 * Modifier Module
 * 
 * Handles natural-language modifications to the generated frontend.
 * Reads the current codebase, understands the instruction,
 * identifies which files to modify, and applies changes.
 */

import { generateText, generateCode } from './llm-client.js';
import { ModificationResult } from '../types/blueprint.js';
import fs from 'fs/promises';
import path from 'path';

const ANALYSIS_SYSTEM_PROMPT = `You are an expert frontend code modification planner.
Given a natural language instruction and a list of files in a Next.js project,
determine which files need to be modified and what changes should be made.

Return a JSON object with:
{
  "plan": "brief description of the modification plan",
  "filesToModify": ["relative/path/to/file1.tsx", "relative/path/to/file2.tsx"],
  "filesToCreate": ["relative/path/to/newfile.tsx"],
  "filesToDelete": ["relative/path/to/oldfile.tsx"],
  "reasoning": "why these files need changes"
}

Output ONLY valid JSON. No markdown, no code fences.`;

const MODIFY_SYSTEM_PROMPT = `You are an expert React/Next.js developer making targeted modifications to an existing codebase.

Rules:
1. Apply ONLY the requested changes — preserve everything else
2. Maintain existing code style and patterns
3. Keep Tailwind CSS classes for styling
4. Ensure TypeScript correctness
5. Preserve component names and exports
6. Output ONLY the complete modified file — no markdown, no code fences, no explanation
7. If adding a new section, follow the same patterns as existing sections`;

export async function modifyProject(
  projectPath: string,
  instruction: string
): Promise<ModificationResult> {
  console.log(`\n💬 Modification: "${instruction}"`);

  // Step 1: Read the current project files
  const files = await readProjectFiles(projectPath);
  console.log(`  📁 Read ${files.length} project files`);

  // Step 2: Plan the modification
  console.log('  ⏳ Planning modification...');
  const fileList = files.map((f) => `${f.path} (${f.content.length} chars)`).join('\n');

  const planJson = await generateText(
    ANALYSIS_SYSTEM_PROMPT,
    `Instruction: "${instruction}"

Project files:
${fileList}

Key file contents for context:
${files
  .filter((f) => f.path.endsWith('.tsx') || f.path.endsWith('.css'))
  .map((f) => `--- ${f.path} ---\n${f.content.substring(0, 2000)}`)
  .join('\n\n')}

Determine which files need modification.`,
    { maxTokens: 2048, jsonMode: true }
  );

  let plan: {
    plan: string;
    filesToModify: string[];
    filesToCreate: string[];
    filesToDelete: string[];
    reasoning: string;
  };

  try {
    const cleanedJson = planJson.replace(/```(?:json)?\n?/gi, '').replace(/```\n?/g, '').trim();
    plan = JSON.parse(cleanedJson);
  } catch {
    // Fallback: modify the main page and globals.css
    plan = {
      plan: 'Modify page and component files',
      filesToModify: ['src/app/page.tsx', 'src/app/globals.css'],
      filesToCreate: [],
      filesToDelete: [],
      reasoning: 'Default modification targets',
    };
  }

  console.log(`  📋 Plan: ${plan.plan}`);
  console.log(`  📝 Files to modify: ${plan.filesToModify.join(', ')}`);

  // Step 3: Apply modifications
  const modifiedFiles: ModificationResult['modifiedFiles'] = [];

  for (const filePath of plan.filesToModify) {
    const file = files.find((f) => f.path === filePath);
    if (!file) {
      console.log(`  ⚠ File not found: ${filePath}`);
      continue;
    }

    console.log(`  ⏳ Modifying: ${filePath}`);

    const modifiedCode = await generateCode(
      MODIFY_SYSTEM_PROMPT,
      `Apply this modification: "${instruction}"

=== CURRENT FILE: ${filePath} ===
${file.content}

=== CONTEXT (other files) ===
${files
  .filter((f) => f.path !== filePath && f.path.endsWith('.tsx'))
  .map((f) => `--- ${f.path} ---\n${f.content.substring(0, 1000)}`)
  .slice(0, 3)
  .join('\n\n')}

Return the COMPLETE modified file. Preserve everything that doesn't need to change.`,
      { temperature: 0.1 }
    );

    const cleaned = cleanCodeOutput(modifiedCode);

    // Write modified file
    const fullPath = path.join(projectPath, filePath);
    await fs.writeFile(fullPath, cleaned, 'utf-8');

    modifiedFiles.push({
      path: filePath,
      content: cleaned,
      changeDescription: `Modified for: ${instruction}`,
    });

    console.log(`  ✓ Modified: ${filePath}`);
  }

  // Step 4: Create new files if needed
  for (const newFilePath of plan.filesToCreate || []) {
    console.log(`  ⏳ Creating: ${newFilePath}`);

    const newCode = await generateCode(
      MODIFY_SYSTEM_PROMPT,
      `Create a new file for this modification: "${instruction}"

File path: ${newFilePath}

=== EXISTING PROJECT CONTEXT ===
${files
  .filter((f) => f.path.endsWith('.tsx'))
  .map((f) => `--- ${f.path} ---\n${f.content.substring(0, 1500)}`)
  .slice(0, 5)
  .join('\n\n')}

Create the complete file content following the same patterns as existing files.`,
      { temperature: 0.1 }
    );

    const cleaned = cleanCodeOutput(newCode);
    const fullPath = path.join(projectPath, newFilePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, cleaned, 'utf-8');

    modifiedFiles.push({
      path: newFilePath,
      content: cleaned,
      changeDescription: `Created for: ${instruction}`,
    });

    console.log(`  ✓ Created: ${newFilePath}`);
  }

  // Step 5: Delete files if needed
  for (const deleteFilePath of plan.filesToDelete || []) {
    try {
      const fullPath = path.join(projectPath, deleteFilePath);
      await fs.unlink(fullPath);
      console.log(`  ✓ Deleted: ${deleteFilePath}`);
    } catch {
      console.log(`  ⚠ Could not delete: ${deleteFilePath}`);
    }
  }

  // Step 6: Update page.tsx if new components were created
  if ((plan.filesToCreate || []).some((f) => f.includes('components/'))) {
    console.log('  ⏳ Updating page imports for new components...');
    await updatePageImports(projectPath, instruction);
  }

  return {
    modifiedFiles,
    plan: plan.plan,
    explanation: plan.reasoning || plan.plan,
    buildSuccess: false, // caller should re-validate
  };
}

/**
 * Read all relevant project files
 */
async function readProjectFiles(
  projectPath: string
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  async function walk(dir: string, relativeTo: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        // Skip node_modules, .next, etc.
        if (['node_modules', '.next', '.git', 'dist'].includes(entry.name)) continue;
        await walk(fullPath, relativeTo);
      } else if (
        entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.ts') ||
        entry.name.endsWith('.css') ||
        entry.name === 'tailwind.config.ts'
      ) {
        const content = await fs.readFile(fullPath, 'utf-8');
        files.push({ path: relativePath, content });
      }
    }
  }

  await walk(projectPath, projectPath);
  return files;
}

/**
 * Update page.tsx to import newly created components
 */
async function updatePageImports(
  projectPath: string,
  instruction: string
): Promise<void> {
  const pagePath = path.join(projectPath, 'src/app/page.tsx');
  try {
    const pageContent = await fs.readFile(pagePath, 'utf-8');

    // Get all component files
    const componentsDir = path.join(projectPath, 'src/components');
    const componentFiles = await fs.readdir(componentsDir);

    const modifiedPage = await generateCode(
      `You are updating a Next.js page to incorporate new or modified components.
Output ONLY the complete page code. No markdown, no code fences.`,
      `Update this page to incorporate changes for: "${instruction}"

=== CURRENT PAGE ===
${pageContent}

=== AVAILABLE COMPONENTS ===
${componentFiles.join('\n')}

Ensure all components are imported and used in the correct order.`,
      { temperature: 0.1 }
    );

    await fs.writeFile(pagePath, cleanCodeOutput(modifiedPage), 'utf-8');
  } catch {
    // Page update is best-effort
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
