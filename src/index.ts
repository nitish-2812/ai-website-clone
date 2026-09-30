/**
 * Web Server Entry Point
 * 
 * Express server providing a web-based UI for the AI Website Cloner.
 * API endpoints for clone, modify, and status operations.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClonePipeline } from './pipeline.js';
import { validateConfig } from './config.js';
import { getTokenUsage } from './ai/llm-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static web UI
app.use(express.static(path.join(__dirname, '..', 'web')));

// ─── State ──────────────────────────────────────────────────────

let currentPipeline: ClonePipeline | null = null;
let pipelineStatus: 'idle' | 'running' | 'completed' | 'failed' = 'idle';
let statusLog: string[] = [];

function log(message: string) {
  statusLog.push(`[${new Date().toISOString()}] ${message}`);
  console.log(message);
}

// ─── API Routes ─────────────────────────────────────────────────

// POST /api/clone — Start cloning a website
app.post('/api/clone', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
  }

  if (pipelineStatus === 'running') {
    return res.status(409).json({ error: 'A clone operation is already running' });
  }

  try {
    validateConfig();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  // Start pipeline in background
  pipelineStatus = 'running';
  statusLog = [];
  currentPipeline = new ClonePipeline(url);

  log(`Starting clone for: ${url}`);

  res.json({ status: 'started', message: `Cloning ${url}...` });

  // Run pipeline asynchronously
  try {
    await currentPipeline.run();
    pipelineStatus = 'completed';
    log('Pipeline completed successfully');

    // Start dev server
    try {
      const port = await currentPipeline.startPreview();
      log(`Preview available at http://localhost:${port}`);
    } catch {
      log('Could not start preview server');
    }
  } catch (err: any) {
    pipelineStatus = 'failed';
    log(`Pipeline failed: ${err.message}`);
  }
});

// GET /api/status — Get current pipeline status
app.get('/api/status', (req, res) => {
  const state = currentPipeline?.getState();
  const usage = getTokenUsage();

  res.json({
    status: pipelineStatus,
    stages: state?.stages || [],
    currentStage: state?.currentStage || null,
    projectPath: currentPipeline?.getProjectPath() || null,
    tokenUsage: usage,
    logs: statusLog.slice(-20),
  });
});

// POST /api/modify — Modify the generated website
app.post('/api/modify', async (req, res) => {
  const { instruction } = req.body;

  if (!instruction) {
    return res.status(400).json({ error: 'Instruction is required' });
  }

  if (!currentPipeline || pipelineStatus !== 'completed') {
    return res.status(400).json({ error: 'No completed clone to modify' });
  }

  log(`Modifying: "${instruction}"`);

  try {
    const result = await currentPipeline.modify(instruction);
    log(`Modification applied: ${result.modifiedFiles.length} file(s) updated`);
    res.json({
      status: 'success',
      message: 'Modification applied',
      plan: result.plan,
      files: result.modifiedFiles,
      explanation: result.explanation,
    });
  } catch (err: any) {
    log(`Modification failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/project-files — Return all generated component & style files
app.get('/api/project-files', async (req, res) => {
  const projectPath = currentPipeline?.getProjectPath() || path.join(__dirname, '..', 'output', 'generated-site');
  try {
    const fsPromises = await import('fs/promises');
    const files: Array<{ path: string; content: string }> = [];

    async function walk(dir: string) {
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            if (!['node_modules', '.next', '.git'].includes(entry.name)) {
              await walk(fullPath);
            }
          } else if (
            entry.name.endsWith('.tsx') ||
            entry.name.endsWith('.ts') ||
            entry.name.endsWith('.css') ||
            entry.name.endsWith('.json')
          ) {
            const content = await fsPromises.readFile(fullPath, 'utf-8');
            files.push({ path: relativePath, content });
          }
        }
      } catch {}
    }

    await walk(projectPath);
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/preview and GET /preview — Render the cloned website directly in the sandbox iframe
app.get(['/api/preview', '/preview'], async (req, res) => {
  const projectPath = currentPipeline?.getProjectPath() || path.join(__dirname, '..', 'output', 'generated-site');
  const fsPromises = await import('fs/promises');

  try {
    // 1. Read globals.css for design tokens and variables
    let cssContent = '';
    try {
      cssContent = await fsPromises.readFile(path.join(projectPath, 'src', 'app', 'globals.css'), 'utf-8');
    } catch {}

    // Clean @tailwind directives for browser CDN compatibility
    const cleanCss = cssContent
      .replace(/@tailwind\s+base;/g, '')
      .replace(/@tailwind\s+components;/g, '')
      .replace(/@tailwind\s+utilities;/g, '');

    // 2. Read components from src/components
    const componentsDir = path.join(projectPath, 'src', 'components');
    const compFunctions: string[] = [];
    const compTagNames: string[] = [];

    try {
      const entries = await fsPromises.readdir(componentsDir);
      for (const file of entries) {
        if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
          let code = await fsPromises.readFile(path.join(componentsDir, file), 'utf-8');
          // Strip imports and 'use client'
          code = code
            .replace(/['"]use client['"];?/g, '')
            .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
            .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, 'function $1')
            .replace(/export\s+function\s+([A-Za-z0-9_]+)/g, 'function $1')
            .replace(/<Image\s+/g, '<img ');

          const funcNameMatch = code.match(/function\s+([A-Za-z0-9_]+)/);
          if (funcNameMatch) {
            compTagNames.push(funcNameMatch[1]);
            compFunctions.push(code);
          }
        }
      }
    } catch {}

    if (compFunctions.length === 0) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { background: #07090e; color: #94a3b8; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { background: #0f172a; border: 1px solid #1e293b; padding: 32px; border-radius: 12px; max-width: 480px; }
              h3 { color: #f8fafc; margin-bottom: 8px; }
              p { font-size: 14px; line-height: 1.5; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="card">
              <h3>No Clone Available Yet</h3>
              <p>Enter a public website URL above and click <strong>Launch AI Agent</strong> to generate and preview your clone here.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Return the full responsive HTML document with React + Babel Standalone + Tailwind
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandbox Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    ${cleanCss}
  </style>
</head>
<body style="background-color: var(--color-background, #ffffff); color: var(--color-text-primary, #0f172a); font-family: var(--font-body, system-ui, sans-serif); min-height: 100vh; margin: 0;">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef } = React;

    ${compFunctions.join('\n\n')}

    function App() {
      return (
        <main className="w-full min-h-screen">
          ${compTagNames.map(tag => `<${tag} />`).join('\n          ')}
        </main>
      );
    }

    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fullHtml);
  } catch (err: any) {
    res.status(500).send(`Preview Error: ${err.message}`);
  }
});

// GET /api/blueprint — Get the generated blueprint
app.get('/api/blueprint', (req, res) => {
  const state = currentPipeline?.getState();
  if (state?.blueprint) {
    res.json(state.blueprint);
  } else {
    res.status(404).json({ error: 'No blueprint available' });
  }
});

// ─── Start Server ───────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║     🤖 AI Website Cloner — Web UI     ║');
  console.log(`  ║     http://localhost:${PORT}              ║`);
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
});
