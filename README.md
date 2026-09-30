# 🤖 AI Website Cloner

An AI-powered agent that takes any public website URL and automatically recreates its frontend using React/Next.js.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- An OpenAI API key (GPT-4o) or Anthropic API key (Claude)

### Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd ai-website-cloner

# 2. Install dependencies
npm install

# 3. Install Playwright browser
npx playwright install chromium

# 4. Configure environment
cp .env.example .env
# Edit .env and add your API key

# 5. Run the cloner (CLI)
npm run clone -- https://example.com

# Or start the web UI
npm run dev
# Open http://localhost:3000
```

## 🏗️ Architecture

```
Website URL
    ↓
┌─────────────────────────────────────────┐
│  Stage 1: Website Analysis              │
│  ├── Screenshot Capture (Playwright)    │
│  ├── DOM Extraction                     │
│  ├── Style Extraction (computed CSS)    │
│  └── Asset Extraction (images, fonts)   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 2: AI Understanding              │
│  ├── Vision Model Analysis (GPT-4o)    │
│  ├── Structured Blueprint Generation    │
│  └── Design Token Extraction            │
└─────────────────────────────────────────┘
    ↓  (Blueprint IR — JSON intermediate representation)
┌─────────────────────────────────────────┐
│  Stage 3: Code Generation               │
│  ├── Component-by-component generation  │
│  ├── Next.js project scaffolding        │
│  ├── Tailwind CSS styling               │
│  └── Asset integration                  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 4: Validation                    │
│  ├── Build check (next build)           │
│  ├── Error parsing                      │
│  └── Self-healing fix loop (max 3x)    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Stage 5: Preview & Modification        │
│  ├── Local dev server (next dev)        │
│  ├── Natural language modification      │
│  └── Re-validation after changes        │
└─────────────────────────────────────────┘
```

### Key Architecture Decision: Blueprint IR

The system uses a **structured JSON blueprint** as an intermediate representation between analysis and code generation. This:

- **Decouples** analysis from generation — either can be improved independently
- **Enables generalization** — the blueprint schema is website-agnostic
- **Aids debugging** — blueprints are human-readable and saved to disk
- **Improves quality** — merges vision analysis (layout truth) with DOM extraction (content truth)

## 🛠️ Technologies

| Component | Technology |
|---|---|
| Website capture | Playwright (headless Chromium) |
| DOM parsing | Playwright page.evaluate |
| LLM (text + code) | OpenAI GPT-4o / Anthropic Claude |
| Vision analysis | GPT-4o Vision |
| Generated frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Agent backend | Node.js + TypeScript |
| Web UI | Express + vanilla HTML/CSS/JS |

## 📁 Project Structure

```
ai-website-cloner/
├── src/
│   ├── cli.ts                    # CLI entry point
│   ├── index.ts                  # Web server entry point
│   ├── pipeline.ts               # Pipeline orchestrator
│   ├── config.ts                 # Configuration
│   ├── analyzer/
│   │   ├── screenshot.ts         # Screenshot capture
│   │   ├── dom-extractor.ts      # DOM extraction
│   │   ├── style-extractor.ts    # Computed style extraction
│   │   └── asset-extractor.ts    # Image/font/icon extraction
│   ├── ai/
│   │   ├── llm-client.ts         # LLM abstraction (OpenAI + Anthropic)
│   │   ├── blueprint-generator.ts # Blueprint IR generation
│   │   ├── code-generator.ts     # React component generation
│   │   └── modifier.ts           # Natural language modification
│   ├── generator/
│   │   └── validator.ts          # Build validation + self-healing
│   └── types/
│       └── blueprint.ts          # TypeScript types
├── web/                          # Web UI
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── package.json
└── tsconfig.json
```

## 🎯 Key Implementation Decisions

1. **Component-by-component generation**: Instead of generating the entire page in one LLM call (which hits token limits and reduces quality), each section is generated as a separate React component. This dramatically improves both quality and reliability.

2. **Hybrid analysis (Screenshot + DOM)**: Screenshots give the vision model visual truth (layout, spacing, colors as rendered), while DOM extraction gives structural truth (actual text, links, semantic elements). Combining both produces far better results.

3. **Self-healing build loop**: Generated code often has TypeScript/JSX errors. The validator parses build errors, feeds them back to the LLM with the failing code, and retries up to 3 times. This makes the system significantly more robust.

4. **Dual LLM provider support**: Supports both OpenAI and Anthropic, allowing cost optimization and fallback strategies.

5. **Cost tracking**: Every LLM call tracks token usage and estimates cost, enabling cost awareness and optimization.

## ⚠️ Limitations

- **Complex animations**: CSS animations and JS-based interactions from the original site are not replicated
- **Dynamic content**: JavaScript-rendered content beyond initial page load may not be captured
- **Complex SVGs**: Inline SVGs are simplified or replaced with placeholder shapes
- **Authentication-gated pages**: Only publicly accessible pages can be cloned
- **Pixel-perfect accuracy**: The recreation is a best-effort approximation, not pixel-perfect
- **Large pages**: Very long pages may be truncated due to screenshot/token limits

## 💰 Cost Awareness

Approximate cost per website clone (using GPT-4o):

| Operation | Est. Cost |
|---|---|
| Vision analysis | ~$0.30–0.50 |
| Blueprint generation | ~$0.10–0.20 |
| Code generation (5 components) | ~$0.30–0.60 |
| Error fixing (per retry) | ~$0.10 |
| Modification (per instruction) | ~$0.10–0.20 |
| **Total per clone** | **~$0.80–1.50** |

### Cost Optimization Strategies

- Analysis results are cached — re-running won't re-analyze
- Component-level generation keeps individual prompts small
- Structured output (JSON mode) reduces wasted tokens
- Error fix retries are capped at 3 to prevent cost explosions

## 🧪 Testing

The agent has been tested with the following website types:
- Simple landing pages (marketing sites)
- Content-heavy pages (blogs, documentation)
- E-commerce product pages

## 📄 License

MIT
