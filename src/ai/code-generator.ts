/**
 * Code Generator Module
 * 
 * Takes a WebsiteBlueprint and generates a complete Next.js project
 * with individual React components for each section.
 * 
 * Uses component-by-component generation strategy for better quality
 * and to stay within token limits.
 */

import { generateCode, generateText } from './llm-client.js';
import { WebsiteBlueprint, SectionBlueprint, GenerationResult } from '../types/blueprint.js';
import path from 'path';
import fs from 'fs/promises';

const CODE_GEN_SYSTEM_PROMPT = `You are an expert React/Next.js frontend developer.
You generate clean, production-quality TypeScript React components.

Rules:
1. Use TypeScript with proper typing
2. Use Tailwind CSS for all styling (utility classes only)
3. Components must be self-contained and reusable
4. Use semantic HTML elements
5. Ensure responsive design with Tailwind breakpoints (sm:, md:, lg:)
6. Use Next.js Image component for images where appropriate
7. Include proper aria attributes for accessibility
8. NO placeholder text — use the actual content provided
9. Output ONLY the component code — no markdown, no code fences, no explanation
10. Use 'use client' directive only when needed (event handlers, state)
11. Export the component as default export`;

const PAGE_ASSEMBLY_SYSTEM_PROMPT = `You are an expert Next.js developer.
You assemble individual React components into a complete page.

Rules:
1. Import all section components
2. Arrange them in the correct order
3. Use proper Next.js page structure
4. Include metadata export for SEO
5. Output ONLY the page code — no markdown, no code fences, no explanation`;

export async function generateProjectCode(
  blueprint: WebsiteBlueprint,
  outputDir: string
): Promise<GenerationResult> {
  console.log('\n⚙️  Stage 3: Code Generation');

  const projectPath = path.join(outputDir, 'generated-site');
  const files: Array<{ path: string; content: string }> = [];
  const errors: string[] = [];

  // Step 1: Scaffold the Next.js project structure
  console.log('  ⏳ Scaffolding Next.js project...');
  const scaffoldFiles = await scaffoldProject(blueprint, projectPath);
  files.push(...scaffoldFiles);

  // Step 2: Generate each section component
  console.log(`  ⏳ Generating ${blueprint.sections.length} components...`);

  for (const section of blueprint.sections) {
    try {
      console.log(`    → Generating: ${section.type} (${section.id})`);
      const componentCode = await generateSectionComponent(section, blueprint);
      const componentName = sectionIdToComponentName(section.id);
      const filePath = `src/components/${componentName}.tsx`;

      files.push({
        path: filePath,
        content: componentCode,
      });
    } catch (err) {
      const msg = `Failed to generate ${section.type} (${section.id}): ${err}`;
      console.log(`    ✗ ${msg}`);
      errors.push(msg);
    }
  }

  // Step 3: Generate the main page that assembles all components
  console.log('  ⏳ Assembling page...');
  const pageCode = await generateMainPage(blueprint, files);
  files.push({
    path: 'src/app/page.tsx',
    content: pageCode,
  });

  // Step 4: Generate global styles with design tokens
  const globalStyles = generateGlobalStyles(blueprint);
  files.push({
    path: 'src/app/globals.css',
    content: globalStyles,
  });

  // Step 5: Generate tailwind config
  const tailwindConfig = generateTailwindConfig(blueprint);
  files.push({
    path: 'tailwind.config.ts',
    content: tailwindConfig,
  });

  // Step 6: Write all files to disk
  console.log('  ⏳ Writing files to disk...');
  for (const file of files) {
    const fullPath = path.join(projectPath, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
  }

  console.log(`  ✓ Generated ${files.length} files`);
  if (errors.length > 0) {
    console.log(`  ⚠ ${errors.length} generation errors`);
  }

  return {
    projectPath,
    files,
    errors,
    buildSuccess: false, // will be set after validation
  };
}

/**
 * Generate a single section component
 */
async function generateSectionComponent(
  section: SectionBlueprint,
  blueprint: WebsiteBlueprint
): Promise<string> {
  const componentName = sectionIdToComponentName(section.id);

  const prompt = `Generate a React component called "${componentName}" for a "${section.type}" section.

=== SECTION DETAILS ===
${JSON.stringify(section, null, 2)}

=== DESIGN TOKENS ===
Colors: ${JSON.stringify(blueprint.designTokens.colors)}
Typography: ${JSON.stringify(blueprint.designTokens.typography)}
Border radius: ${JSON.stringify(blueprint.designTokens.borderRadius)}

=== NAVIGATION (if navbar) ===
${section.type === 'navbar' ? JSON.stringify(blueprint.navigation) : 'N/A'}

=== REQUIREMENTS ===
- Component name: ${componentName}
- Use Tailwind CSS classes for ALL styling
- Make it responsive (mobile-first with sm:, md:, lg: breakpoints)
- Use the exact text content provided (not placeholders)
- Use the exact colors from design tokens where applicable
- For images, use <img> tags with the provided src URLs and alt text
- For the navbar: include mobile hamburger menu with state management
- Export as default: export default function ${componentName}() { ... }
- If the component needs interactivity (click handlers, state), add 'use client' at the top

Generate ONLY the TypeScript React component code. No markdown. No code fences. No explanations.`;

  const code = await generateCode(CODE_GEN_SYSTEM_PROMPT, prompt, {
    temperature: 0.1,
  });

  // Clean any accidental markdown wrappers
  return cleanCodeOutput(code);
}

/**
 * Generate the main page that imports and renders all section components
 */
async function generateMainPage(
  blueprint: WebsiteBlueprint,
  componentFiles: Array<{ path: string; content: string }>
): Promise<string> {
  const componentImports = blueprint.sections
    .map((section) => {
      const name = sectionIdToComponentName(section.id);
      return `import ${name} from '@/components/${name}';`;
    })
    .join('\n');

  const componentUsage = blueprint.sections
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const name = sectionIdToComponentName(section.id);
      return `      <${name} />`;
    })
    .join('\n');

  const prompt = `Generate a Next.js page component (app router) that assembles these section components.

=== IMPORTS NEEDED ===
${componentImports}

=== COMPONENT USAGE (in order) ===
${componentUsage}

=== METADATA ===
Title: ${blueprint.metadata.title}
Description: ${blueprint.metadata.description}

=== REQUIREMENTS ===
- Use Next.js App Router metadata export
- Import and render all components in the correct order
- Wrap in a main element
- Add proper font imports if needed (Google Fonts: ${blueprint.designTokens.typography.fontFamily.heading}, ${blueprint.designTokens.typography.fontFamily.body})
- This is a server component (no 'use client')

Generate ONLY the TypeScript code. No markdown. No code fences.`;

  const code = await generateCode(PAGE_ASSEMBLY_SYSTEM_PROMPT, prompt, {
    temperature: 0.1,
  });

  return cleanCodeOutput(code);
}

/**
 * Scaffold the basic Next.js project files
 */
async function scaffoldProject(
  blueprint: WebsiteBlueprint,
  projectPath: string
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'generated-site',
        version: '1.0.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          next: '14.2.5',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          '@types/node': '^20',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          autoprefixer: '^10',
          postcss: '^8',
          tailwindcss: '^3.4',
          typescript: '^5',
        },
      },
      null,
      2
    ),
  });

  // tsconfig.json
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify(
      {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2
    ),
  });

  // next.config.mjs
  files.push({
    path: 'next.config.mjs',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
`,
  });

  // postcss.config.mjs
  files.push({
    path: 'postcss.config.mjs',
    content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`,
  });

  // Layout
  const fontImport = getFontImport(blueprint);
  files.push({
    path: 'src/app/layout.tsx',
    content: `import type { Metadata } from 'next';
${fontImport.importStatement}
import './globals.css';

export const metadata: Metadata = {
  title: '${escapeString(blueprint.metadata.title)}',
  description: '${escapeString(blueprint.metadata.description)}',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="${blueprint.metadata.language || 'en'}">
      <body className={${fontImport.className}}>
        {children}
      </body>
    </html>
  );
}
`,
  });

  return files;
}

/**
 * Generate global CSS with design tokens
 */
function generateGlobalStyles(blueprint: WebsiteBlueprint): string {
  const { colors, typography } = blueprint.designTokens;

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-background: ${colors.background};
  --color-surface: ${colors.surface};
  --color-text-primary: ${colors.text?.primary || '#111827'};
  --color-text-secondary: ${colors.text?.secondary || '#6b7280'};
  --color-text-muted: ${colors.text?.muted || '#9ca3af'};
  --color-border: ${colors.border || '#e5e7eb'};
  --font-heading: ${typography.fontFamily?.heading || 'system-ui'}, system-ui, sans-serif;
  --font-body: ${typography.fontFamily?.body || 'system-ui'}, system-ui, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  color: var(--color-text-primary);
  background-color: var(--color-background);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

img {
  max-width: 100%;
  height: auto;
}

a {
  color: inherit;
  text-decoration: none;
}
`;
}

/**
 * Generate Tailwind config with custom design tokens
 */
function generateTailwindConfig(blueprint: WebsiteBlueprint): string {
  const { colors, borderRadius } = blueprint.designTokens;

  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "${colors.primary}",
        secondary: "${colors.secondary}",
        accent: "${colors.accent}",
        surface: "${colors.surface}",
        border: "${colors.border || '#e5e7eb'}",
      },
      borderRadius: {
        sm: "${borderRadius?.sm || '0.25rem'}",
        md: "${borderRadius?.md || '0.5rem'}",
        lg: "${borderRadius?.lg || '1rem'}",
      },
    },
  },
  plugins: [],
};

export default config;
`;
}

// ─── Utility functions ────────────────────────────────────────────

function sectionIdToComponentName(id: string): string {
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function cleanCodeOutput(code: string): string {
  let cleaned = code.trim();

  // Remove markdown code fences if present
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    cleaned = cleaned.substring(firstNewline + 1);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
  }

  return cleaned.trim();
}

function escapeString(str: string): string {
  return (str || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function getFontImport(blueprint: WebsiteBlueprint): {
  importStatement: string;
  className: string;
} {
  const heading = blueprint.designTokens.typography?.fontFamily?.heading || 'Inter';
  const body = blueprint.designTokens.typography?.fontFamily?.body || 'Inter';

  // Map common fonts to next/font/google names
  const fontMap: Record<string, string> = {
    'Inter': 'Inter',
    'Roboto': 'Roboto',
    'Open Sans': 'Open_Sans',
    'Lato': 'Lato',
    'Montserrat': 'Montserrat',
    'Poppins': 'Poppins',
    'Outfit': 'Outfit',
    'DM Sans': 'DM_Sans',
    'Plus Jakarta Sans': 'Plus_Jakarta_Sans',
    'Manrope': 'Manrope',
    'Space Grotesk': 'Space_Grotesk',
  };

  const primaryFont = fontMap[heading] || fontMap[body] || 'Inter';
  const fontVarName = primaryFont.toLowerCase().replace(/_/g, '');

  return {
    importStatement: `import { ${primaryFont} } from 'next/font/google';

const ${fontVarName} = ${primaryFont}({ subsets: ['latin'] });`,
    className: `\`\${${fontVarName}.className}\``,
  };
}
