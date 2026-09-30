/**
 * CLI Entry Point
 * 
 * Interactive command-line interface for the AI Website Cloner.
 * Supports: clone, modify, preview operations.
 */

import { ClonePipeline } from './pipeline.js';
import { validateConfig } from './config.js';
import readline from 'readline';

const args = process.argv.slice(2);

async function main() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║     🤖 AI Website Cloner Agent        ║');
  console.log('  ║     ─────────────────────────────      ║');
  console.log('  ║  Clone any website with AI             ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');

  // Parse command
  const command = args[0] || 'interactive';
  const url = args[1];

  switch (command) {
    case 'clone':
      if (!url) {
        console.error('Usage: npm run clone -- clone <URL>');
        process.exit(1);
      }
      await runClone(url);
      break;

    case 'interactive':
      await runInteractive();
      break;

    case 'help':
      printHelp();
      break;

    default:
      // If the first arg looks like a URL, treat as clone
      if (command.startsWith('http')) {
        await runClone(command);
      } else {
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
      }
  }
}

async function runClone(url: string): Promise<ClonePipeline> {
  validateConfig();

  const pipeline = new ClonePipeline(url);
  await pipeline.run();

  // Start preview
  try {
    const port = await pipeline.startPreview();
    console.log(`\n🌐 Preview: http://localhost:${port}`);
    console.log('   Press Ctrl+C to stop\n');
  } catch (err) {
    console.log('\n⚠️  Could not start preview server');
    console.log(`   You can manually run: cd ${pipeline.getProjectPath()} && npm run dev\n`);
  }

  return pipeline;
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  try {
    validateConfig();
  } catch (err: any) {
    console.error(`\n⚠️  ${err.message}`);
    console.log('Create a .env file with your API key. Example:\n');
    console.log('  OPENAI_API_KEY=sk-...');
    console.log('  LLM_PROVIDER=openai');
    console.log('  LLM_MODEL=gpt-4o\n');
    rl.close();
    process.exit(1);
  }

  const url = await ask('\n🌐 Enter website URL to clone: ');

  if (!url || !url.startsWith('http')) {
    console.error('Invalid URL. Must start with http:// or https://');
    rl.close();
    process.exit(1);
  }

  const pipeline = await runClone(url);

  // Modification loop
  console.log('');
  console.log('  ╔═════════════════════════════════════════╗');
  console.log('  ║  💬 Modification Mode                   ║');
  console.log('  ║  Type a natural language instruction     ║');
  console.log('  ║  to modify the generated website.        ║');
  console.log('  ║  Type "exit" to quit.                   ║');
  console.log('  ╚═════════════════════════════════════════╝');
  console.log('');

  while (true) {
    const instruction = await ask('\n💬 Modify > ');

    if (!instruction || instruction.toLowerCase() === 'exit' || instruction.toLowerCase() === 'quit') {
      console.log('\n👋 Goodbye!\n');
      pipeline.stopPreview();
      break;
    }

    if (instruction.toLowerCase() === 'help') {
      console.log('\nExamples:');
      console.log('  "Change the primary color to blue"');
      console.log('  "Add a testimonials section"');
      console.log('  "Make the navbar sticky"');
      console.log('  "Remove the pricing section"');
      console.log('  "Replace the hero section with a bakery hero"');
      continue;
    }

    try {
      await pipeline.modify(instruction);
      console.log('  ✓ Modification applied. Refresh your browser to see changes.');
    } catch (err) {
      console.error(`  ✗ Modification failed: ${err}`);
    }
  }

  rl.close();
}

function printHelp() {
  console.log(`
Usage:
  npm run clone -- <URL>              Clone a website
  npm run clone -- clone <URL>        Clone a website
  npm run clone -- interactive        Interactive mode (default)
  npm run clone -- help               Show this help

Environment Variables (.env):
  OPENAI_API_KEY     OpenAI API key
  ANTHROPIC_API_KEY  Anthropic API key
  LLM_PROVIDER       "openai" or "anthropic" (default: openai)
  LLM_MODEL          Model name (default: gpt-4o)
  VISION_MODEL       Vision model name (default: gpt-4o)
  MAX_RETRIES        Max build fix retries (default: 3)
  OUTPUT_DIR         Output directory (default: ./output)
  VERBOSE            Enable verbose logging (default: false)
`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message || err}`);
  process.exit(1);
});
