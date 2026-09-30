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
