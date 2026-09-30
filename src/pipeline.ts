/**
 * Pipeline Orchestrator
 * 
 * Orchestrates the full website cloning pipeline:
 * URL → Analysis → Blueprint → Code Generation → Validation → Preview
 * 
 * Each stage is independent and can be re-run separately.
 */

import { captureScreenshots } from './analyzer/screenshot.js';
import { extractDOM } from './analyzer/dom-extractor.js';
import { extractStyles } from './analyzer/style-extractor.js';
import { extractAssets } from './analyzer/asset-extractor.js';
import { generateBlueprint } from './ai/blueprint-generator.js';
import { generateProjectCode } from './ai/code-generator.js';
import { validateAndFix, startDevServer } from './generator/validator.js';
import { modifyProject } from './ai/modifier.js';
import { getTokenUsage } from './ai/llm-client.js';
import { config, validateConfig } from './config.js';
import {
  AnalysisResult,
  WebsiteBlueprint,
  GenerationResult,
  PipelineState,
} from './types/blueprint.js';
import fs from 'fs/promises';
import path from 'path';

export class ClonePipeline {
  private state: PipelineState;
  private devServerProcess: any = null;

  constructor(url: string) {
    this.state = {
      url,
      stages: [
        { name: 'analysis', status: 'pending' },
        { name: 'blueprint', status: 'pending' },
        { name: 'generation', status: 'pending' },
        { name: 'validation', status: 'pending' },
        { name: 'preview', status: 'pending' },
      ],
      currentStage: 'analysis',
    };
  }

  /**
   * Run the full pipeline end-to-end
   */
  async run(): Promise<PipelineState> {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   AI Website Cloner — Pipeline Starting     ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`\n🌐 Target: ${this.state.url}\n`);

    validateConfig();

    try {
      // Stage 1: Analysis
      await this.runAnalysis();

      // Stage 2: Blueprint Generation
      await this.runBlueprintGeneration();

      // Stage 3: Code Generation
      await this.runCodeGeneration();

      // Stage 4: Validation & Error Fixing
      await this.runValidation();

      // Report
      this.printReport();

      return this.state;
    } catch (error) {
      console.error(`\n❌ Pipeline failed: ${error}`);
      throw error;
    }
  }

  /**
   * Stage 1: Analyze the target website
   */
  async runAnalysis(): Promise<AnalysisResult> {
    this.updateStage('analysis', 'running');
    console.log('📸 Stage 1: Website Analysis');
    console.log('  ⏳ Capturing screenshots...');

    try {
      // Run all extractors in parallel for speed
      const [screenshots, dom, styles, assets] = await Promise.all([
        captureScreenshots(this.state.url),
        extractDOM(this.state.url),
        extractStyles(this.state.url),
        extractAssets(this.state.url, true),
      ]);

      const analysis: AnalysisResult = {
        screenshot: screenshots,
        dom,
        styles,
        assets,
      };

      this.state.analysis = analysis;
      this.updateStage('analysis', 'completed');

      // Save analysis to disk for debugging
      const analysisPath = path.join(config.outputDir, 'analysis.json');
      await fs.mkdir(config.outputDir, { recursive: true });
      await fs.writeFile(
        analysisPath,
        JSON.stringify(
          {
            screenshot: analysis.screenshot,
            dom: {
              title: dom.title,
              headingCount: dom.headings.length,
              sectionCount: dom.sections.length,
              navItemCount: dom.navItems.length,
            },
            styles: {
              colorCount: styles.colorPalette.length,
              fontCount: styles.fontFamilies.length,
            },
            assets: {
              imageCount: assets.images.length,
              fontCount: assets.fonts.length,
            },
          },
          null,
          2
        ),
        'utf-8'
      );

      return analysis;
    } catch (error) {
      this.updateStage('analysis', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Stage 2: Generate the website blueprint
   */
  async runBlueprintGeneration(): Promise<WebsiteBlueprint> {
    if (!this.state.analysis) {
      throw new Error('Analysis must be run before blueprint generation');
    }

    this.updateStage('blueprint', 'running');

    try {
      const blueprint = await generateBlueprint(this.state.analysis);
      this.state.blueprint = blueprint;
      this.updateStage('blueprint', 'completed');

      // Save blueprint for debugging
      const blueprintPath = path.join(config.outputDir, 'blueprint.json');
      await fs.writeFile(blueprintPath, JSON.stringify(blueprint, null, 2), 'utf-8');
      console.log(`  💾 Blueprint saved to ${blueprintPath}`);

      return blueprint;
    } catch (error) {
      this.updateStage('blueprint', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Stage 3: Generate the Next.js project code
   */
  async runCodeGeneration(): Promise<GenerationResult> {
    if (!this.state.blueprint) {
      throw new Error('Blueprint must be generated before code generation');
    }

    this.updateStage('generation', 'running');

    try {
      const result = await generateProjectCode(this.state.blueprint, config.outputDir);
      this.state.generation = result;
      this.updateStage('generation', 'completed');
      return result;
    } catch (error) {
      this.updateStage('generation', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Stage 4: Validate the build and fix errors
   */
  async runValidation(): Promise<void> {
    if (!this.state.generation) {
      throw new Error('Code must be generated before validation');
    }

    this.updateStage('validation', 'running');

    try {
      const result = await validateAndFix(this.state.generation.projectPath);
      this.state.generation.buildSuccess = result.success;
      this.state.generation.errors = result.errors;

      if (result.success) {
        this.updateStage('validation', 'completed');
      } else {
        this.updateStage('validation', 'completed'); // completed but with errors
        console.log(`  ⚠ Build has ${result.errors.length} remaining error(s)`);
        console.log('  💡 The dev server may still work — attempting preview...');
      }
    } catch (error) {
      this.updateStage('validation', 'failed', String(error));
      // Don't throw — still attempt preview
      console.log('  ⚠ Validation failed, but attempting preview anyway...');
    }
  }

  /**
   * Start the dev server for preview
   */
  async startPreview(): Promise<number> {
    if (!this.state.generation) {
      throw new Error('Code must be generated before preview');
    }

    this.updateStage('preview', 'running');

    try {
      const { port, process: proc } = await startDevServer(
        this.state.generation.projectPath
      );
      this.devServerProcess = proc;
      this.updateStage('preview', 'completed');
      return port;
    } catch (error) {
      this.updateStage('preview', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Modify the generated project using natural language
   */
  async modify(instruction: string): Promise<void> {
    if (!this.state.generation) {
      throw new Error('Code must be generated before modification');
    }

    const result = await modifyProject(
      this.state.generation.projectPath,
      instruction
    );

    console.log(`  📝 Modified ${result.modifiedFiles.length} file(s)`);
    console.log(`  ℹ️  ${result.explanation}`);

    // Re-validate after modification
    console.log('  ⏳ Re-validating build...');
    const validation = await validateAndFix(this.state.generation.projectPath);
    result.buildSuccess = validation.success;

    if (!validation.success) {
      console.log('  ⚠ Build has errors after modification — dev server may still work');
    } else {
      console.log('  ✓ Build successful after modification');
    }
  }

  /**
   * Stop the dev server
   */
  stopPreview(): void {
    if (this.devServerProcess) {
      this.devServerProcess.kill();
      this.devServerProcess = null;
      console.log('  ✓ Dev server stopped');
    }
  }

  /**
   * Get the current pipeline state
   */
  getState(): PipelineState {
    return this.state;
  }

  /**
   * Get the generated project path
   */
  getProjectPath(): string | undefined {
    return this.state.generation?.projectPath;
  }

  // ─── Private helpers ────────────────────────────────────────────

  private updateStage(
    name: string,
    status: 'running' | 'completed' | 'failed',
    error?: string
  ): void {
    const stage = this.state.stages.find((s) => s.name === name);
    if (stage) {
      stage.status = status;
      if (status === 'running') stage.startedAt = new Date();
      if (status === 'completed' || status === 'failed') stage.completedAt = new Date();
      if (error) stage.error = error;
    }
    this.state.currentStage = name;
  }

  private printReport(): void {
    const usage = getTokenUsage();

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║            Pipeline Report                   ║');
    console.log('╠══════════════════════════════════════════════╣');

    for (const stage of this.state.stages) {
      const icon =
        stage.status === 'completed' ? '✅'
        : stage.status === 'failed' ? '❌'
        : stage.status === 'running' ? '⏳'
        : '⬜';
      const duration =
        stage.startedAt && stage.completedAt
          ? `${((stage.completedAt.getTime() - stage.startedAt.getTime()) / 1000).toFixed(1)}s`
          : '-';
      console.log(`║ ${icon} ${stage.name.padEnd(15)} ${duration.padStart(8)} ║`);
    }

    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║ 📊 Token usage:                              ║`);
    console.log(`║    Input:  ${String(usage.inputTokens).padStart(8)} tokens          ║`);
    console.log(`║    Output: ${String(usage.outputTokens).padStart(8)} tokens          ║`);
    console.log(`║    Calls:  ${String(usage.calls).padStart(8)}                  ║`);
    console.log(`║    Cost:   ${usage.estimatedCost.padStart(8)}                  ║`);
    console.log('╚══════════════════════════════════════════════╝');

    if (this.state.generation) {
      console.log(`\n📁 Generated project: ${this.state.generation.projectPath}`);
      console.log(`📄 Files generated: ${this.state.generation.files.length}`);
      console.log(
        `🏗️  Build status: ${this.state.generation.buildSuccess ? '✅ Success' : '⚠️  Has errors'}`
      );
    }
  }
}
