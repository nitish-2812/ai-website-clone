# ⚡ Synthetix — Autonomous Frontend Re-Engineering Agent

[![Live Cloud Demo](https://img.shields.io/badge/Live%20Demo-Railway%20App-00f2fe?style=for-the-badge&logo=railway)](https://ai-website-clone-production.up.railway.app)
[![Video Walkthrough](https://img.shields.io/badge/Video%20Demo-Loom%20Walkthrough-ff007f?style=for-the-badge&logo=loom)](https://www.loom.com/share/9ccd8c3907724d8d82c74b5791f9a1db)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Gemini%20Vision%20Flash-4285F4?style=for-the-badge&logo=google)](https://aistudio.google.com/)
[![Framework](https://img.shields.io/badge/Next.js%2014-Tailwind%20CSS-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)
[![Zero-Cost Budget](https://img.shields.io/badge/Budget-$0.00%20(Free%20Tier)-10b981?style=for-the-badge)]()

> **Founding AI Engineer Assignment Submission**  
> An autonomous multi-modal agent that takes any public website URL, deconstructs its visual geometry and computed styling, synthesizes production-ready Next.js 14 and Tailwind CSS, and supports instant conversational natural-language refactoring — running on a **100% zero-cost budget ($0.00)**.

---

## 📺 5-Minute Video Walkthrough
Click the banner below to watch the complete end-to-end architecture and live product demonstration:

[![Watch Synthetix Walkthrough on Loom](https://cdn.loom.com/sessions/thumbnails/9ccd8c3907724d8d82c74b5791f9a1db-with-play.gif)](https://www.loom.com/share/9ccd8c3907724d8d82c74b5791f9a1db)

👉 **[Direct Link to Loom Video Walkthrough](https://www.loom.com/share/9ccd8c3907724d8d82c74b5791f9a1db)**

---

## 🌐 Live Cloud Deployment
Experience the autonomous agent live in production:  
👉 **[https://ai-website-clone-production.up.railway.app](https://ai-website-clone-production.up.railway.app)**

- **Dockerized Full-Stack Cloud Environment** (Ubuntu Jammy + Playwright Chromium + Node.js 20).
- **Instant Test Presets**: Clone *Example Domain*, *Hacker News*, *Linear.app*, or *Stripe* with 1-click.
- **Live Sandbox Preview**: Test Desktop (1200px), Tablet (768px), and Mobile (375px) viewports with zero iframe recursion.
- **Conversational Modifier**: Apply natural language prompts (e.g., *"Cyberpunk Dark Theme"*) to refactor design tokens and components in under 3 seconds.
- **Codebase & Diff Inspector**: Inspect source files (`globals.css`, `HeroSection.tsx`) with active file tabs and modified badges.

---

## 🧠 System Architecture

Traditional web scrapers extract brittle markup with deeply nested inline CSS. Synthetix mimics a **Senior Frontend Engineer** by separating visual perception from code synthesis through a structured **Intermediate Blueprint IR (Intermediate Representation)**.

```
                              PUBLIC WEBSITE URL
                                      │
                                      ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │  STAGE 01: PERCEPTION & MULTI-VIEWPORT CRAWL (Playwright Chromium)│
    │  • Desktop (1280x800) & Mobile (375x812) Viewport Screenshots     │
    │  • Computed CSS Token Tree (Colors, Typographic Scales, Spacing)  │
    │  • Semantic DOM Hierarchy & Asset Harvester (SVGs, Images, Favicon)│
    └─────────────────────────────────┬─────────────────────────────────┘
                                      │
                                      ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │  STAGE 02: MULTIMODAL BLUEPRINT IR (Google Gemini Vision)         │
    │  • Fuses visual ground-truth with DOM semantics into Schema IR    │
    │  • Spatial Section Decomposition (Header, Hero, Features, Footer) │
    │  • Global Design Tokens (Color Palette, Font Stack, Borders)      │
    └─────────────────────────────────┬─────────────────────────────────┘
                                      │
                                      ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │  STAGE 03: MODULAR CODE SYNTHESIS (Next.js 14 + Tailwind CSS)     │
    │  • Component-by-component functional React synthesis              │
    │  • Next.js 14 App Router layout & SEO metadata generation         │
    │  • Dynamic Tailwind utility mapping (no hardcoded styles)         │
    └─────────────────────────────────┬─────────────────────────────────┘
                                      │
                                      ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │  STAGE 04: SELF-HEALING AST VALIDATION                            │
    │  • High-speed AST syntax & structural verification (< 1.5s)       │
    │  • Bracket balancing, export verification, and import resolution   │
    │  • Autonomous LLM repair feedback loop if errors are discovered   │
    └─────────────────────────────────┬─────────────────────────────────┘
                                      │
                                      ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │  STAGE 05: INTERACTIVE SANDBOX & CONVERSATIONAL REFACTORING       │
    │  • Live React 18 + Babel Standalone + Tailwind CDN Sandbox        │
    │  • Multi-Viewport Sandbox (Desktop, Tablet, Mobile)               │
    │  • Natural-Language Codebase Refactoring (e.g. Cyberpunk Theme)   │
    │  • Interactive Codebase & Diff Inspector with [Modified] badges   │
    └───────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ The 5-Stage Autonomous Pipeline

### Stage 1: Perception & Crawl (`src/analyzer/`)
- Spawns headless Chromium via **Playwright** with custom user-agents and anti-bot mitigation.
- Captures full-page and above-the-fold screenshots across desktop and mobile viewports.
- Injects a DOM crawler that computes active CSS styles (`getComputedStyle`), extracts colors, typography scales, layout containers, and collects media assets.

### Stage 2: Multimodal Blueprint IR (`src/ai/blueprint-generator.ts`)
- Rather than blindly converting raw HTML to JSX, visual screenshots and DOM trees are fed into **Gemini Vision** (`gemini-flash-lite-latest`).
- Produces a strongly-typed `WebsiteBlueprint` JSON schema defining:
  - Global design tokens (primary, background, surface, text, fonts).
  - Spatial section breakdown with semantic roles, responsive layouts, and content items.

### Stage 3: Code Generation (`src/ai/code-generator.ts`)
- Generates self-contained, modular TypeScript React components for every detected section in `src/components/`.
- Assembles `src/app/page.tsx`, `layout.tsx`, `globals.css` (with Tailwind CSS variables), and `tailwind.config.ts`.
- Uses a component-by-component synthesis strategy to maintain high code fidelity while respecting token limits.

### Stage 4: Self-Healing Build Loop (`src/generator/validator.ts`)
- Validates the generated AST syntax, balanced tags, and exports in under 1.5 seconds.
- If syntax errors or TypeScript mismatches are detected, the agent parses the diagnostic trace, feeds the broken component into an error-recovery prompt, and auto-repairs the file in a feedback loop.

### Stage 5: Live Sandbox & Conversational Refactoring (`src/ai/modifier.ts`)
- Provides an isolated live preview sandbox executing React 18 and Babel Standalone natively.
- **Conversational Modifier**: Users can submit prompts like *"Change the theme to a sleek cyberpunk dark mode with cyan and neon pink accents"* or *"Add a 3-tier pricing table"*.
- The modifier agent parses the project tree, identifies the target files, refactors the AST, and updates the live preview in ~2–4 seconds without requiring a full re-clone.

---

## 💰 Zero-Cost Engineering ($0.00 Total Spend)

A core requirement for this assignment was operating on a **strict $0 budget**. Synthetix achieves this through careful architectural choices:

| Layer | Technology | Cost Strategy |
|---|---|---|
| **Vision Model** | Google Gemini Vision (`gemini-flash-lite-latest`) | 100% Free Tier (15 RPM / 1M TPM) |
| **Code Synthesis** | Google Gemini Flash | Free Tier ($0.0000 API spend) |
| **Headless Browser** | Playwright Chromium (in Docker) | Open Source / Local compute |
| **Cloud Hosting** | Railway Cloud PaaS | Starter plan with free monthly resource credits |
| **Telemetry Bar** | Live token & cost tracker in Web UI | Reports exact spend ($0.0000) per run |

---

## ⚡ Conversational Refactoring in Action

When you prompt:
> *"Change the theme to a sleek cyberpunk dark mode with cyan and neon pink accents"*

The agent executes targeted AST and design token refactoring across the codebase:

```diff
/* src/app/globals.css */
:root {
-  --color-primary: #ff6600;
-  --color-background: #ffffff;
-  --color-surface: #f6f6ef;
-  --color-text-primary: #222222;
+  --color-primary: #06b6d4;          /* Vibrant Neon Cyan */
+  --color-accent: #ff007f;           /* Hot Magenta Accent */
+  --color-background: #0f172a;       /* Cyberpunk Dark Slate */
+  --color-surface: #1e293b;          /* Elevated Dark Card Surface */
+  --color-text-primary: #f8fafc;     /* High-Contrast White Text */
+  --color-border: #334155;           /* Subtle Dark Border */
}
```

```diff
// src/components/HeroSection.tsx
- <section className="w-full bg-white text-gray-900 py-16">
+ <section className="w-full bg-[#0f172a] text-[#f8fafc] py-16 shadow-[0_0_25px_rgba(0,240,255,0.1)]">
...
- <a href="#" className="border border-gray-300 text-gray-700 bg-white">
+ <a href="#" className="border border-[#06b6d4] text-[#06b6d4] hover:bg-[#06b6d4] hover:text-slate-950 font-medium rounded-md transition-colors duration-200 shadow-sm">
```

---

## 💻 Local Setup & Quickstart

### Prerequisites
- Node.js 18+ or 20+
- A free Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Install
```bash
git clone https://github.com/nitish-2812/ai-website-clone.git
cd ai-website-clone
npm install
npx playwright install chromium
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
LLM_PROVIDER=gemini
LLM_MODEL=gemini-flash-lite-latest
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the Web Application
```bash
# Start the Web UI & API Server
npm run dev

# Open in browser: http://localhost:3000
```

### 4. Run via CLI (Headless Mode)
```bash
# Clone any website directly via command line
npm run clone -- https://example.com
```

### 5. Run via Docker
```bash
docker build -t ai-website-clone .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_key ai-website-clone
```

---

## 🧪 Technology Stack

- **Agent Runtime:** Node.js 20, TypeScript, Express 5
- **Multimodal AI:** `@google/genai` (Gemini Flash Vision)
- **Browser Automation:** Playwright Chromium 1.63, Cheerio
- **Generated Codebase:** Next.js 14 App Router, React 18, Tailwind CSS, TypeScript
- **Sandbox Preview:** Babel Standalone + React 18 + Tailwind CDN (Isolated sandbox)
- **Deployment:** Docker (multi-stage Ubuntu Jammy), Railway Cloud PaaS

---

## 👤 Author & Acknowledgments

- **Author:** Nitish
- **Assignment:** Founding AI Engineer Challenge
- **GitHub:** [@nitish-2812](https://github.com/nitish-2812)
- **Live App:** [ai-website-clone-production.up.railway.app](https://ai-website-clone-production.up.railway.app)
- **Loom Video:** [5-Minute Demo Video Walkthrough](https://www.loom.com/share/9ccd8c3907724d8d82c74b5791f9a1db)
