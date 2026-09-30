/**
 * Blueprint Types — The Intermediate Representation (IR)
 * 
 * This is the structured JSON schema that sits between website analysis
 * and code generation. It decouples the two stages, making the system
 * generalizable, debuggable, and testable.
 */

// ─── Color & Typography ───────────────────────────────────────────

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  border: string;
  additionalColors: string[];
}

export interface TypographyScale {
  fontFamily: {
    heading: string;
    body: string;
    mono?: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl'?: string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

// ─── Spacing & Layout ─────────────────────────────────────────────

export interface SpacingScale {
  unit: number; // base unit in px
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface LayoutConfig {
  maxWidth: string;
  containerPadding: string;
  gridColumns?: number;
  gap?: string;
}

// ─── Components ───────────────────────────────────────────────────

export type ComponentType =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'pricing'
  | 'testimonials'
  | 'cta'
  | 'footer'
  | 'stats'
  | 'faq'
  | 'team'
  | 'gallery'
  | 'contact'
  | 'content-section'
  | 'card-grid'
  | 'banner'
  | 'sidebar'
  | 'custom';

export interface NavItem {
  text: string;
  href: string;
  children?: NavItem[];
}

export interface ButtonConfig {
  text: string;
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  href?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface ImageAsset {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  localPath?: string; // path to downloaded asset
  isIcon?: boolean;
  isLogo?: boolean;
}

export interface TextContent {
  type: 'heading' | 'subheading' | 'paragraph' | 'label' | 'caption';
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  alignment?: 'left' | 'center' | 'right';
}

export interface CardItem {
  title: string;
  description: string;
  icon?: ImageAsset;
  image?: ImageAsset;
  link?: string;
  badge?: string;
}

// ─── Section Blueprint ────────────────────────────────────────────

export interface SectionBlueprint {
  id: string;
  type: ComponentType;
  order: number;
  layout: {
    type: 'full-width' | 'contained' | 'two-column' | 'three-column' | 'grid' | 'split';
    alignment: 'left' | 'center' | 'right';
    verticalAlignment?: 'top' | 'center' | 'bottom';
    direction?: 'row' | 'column';
    reversed?: boolean;
  };
  style: {
    backgroundColor: string;
    textColor?: string;
    paddingY: string;
    paddingX?: string;
    hasBorder?: boolean;
    borderRadius?: string;
    backgroundImage?: string;
    backgroundOverlay?: string;
  };
  content: {
    texts: TextContent[];
    buttons: ButtonConfig[];
    images: ImageAsset[];
    cards: CardItem[];
    navItems?: NavItem[];
    listItems?: string[];
    customData?: Record<string, unknown>;
  };
  responsive: {
    mobile: {
      layout?: Partial<SectionBlueprint['layout']>;
      hidden?: boolean;
    };
    tablet?: {
      layout?: Partial<SectionBlueprint['layout']>;
    };
  };
}

// ─── Full Website Blueprint ───────────────────────────────────────

export interface WebsiteBlueprint {
  metadata: {
    sourceUrl: string;
    title: string;
    description: string;
    favicon?: string;
    ogImage?: string;
    language: string;
    analyzedAt: string;
  };
  designTokens: {
    colors: ColorPalette;
    typography: TypographyScale;
    spacing: SpacingScale;
    layout: LayoutConfig;
    borderRadius: {
      sm: string;
      md: string;
      lg: string;
      full: string;
    };
    shadows: {
      sm: string;
      md: string;
      lg: string;
    };
  };
  sections: SectionBlueprint[];
  assets: {
    images: ImageAsset[];
    fonts: string[];
    iconLibrary?: string; // e.g., "lucide", "heroicons", "fontawesome"
  };
  navigation: {
    type: 'fixed' | 'sticky' | 'static';
    logo?: ImageAsset;
    items: NavItem[];
    ctaButton?: ButtonConfig;
  };
}

// ─── Agent Pipeline Types ─────────────────────────────────────────

export interface AnalysisResult {
  screenshot: {
    fullPage: string;   // file path
    viewport: string;   // file path
    mobile?: string;    // file path
  };
  dom: {
    html: string;
    title: string;
    metaDescription: string;
    headings: string[];
    links: Array<{ text: string; href: string }>;
    navItems: Array<{ text: string; href: string }>;
    textBlocks: string[];
    sections: Array<{
      tag: string;
      id?: string;
      className?: string;
      textContent: string;
      childCount: number;
    }>;
  };
  styles: {
    computedStyles: Array<{
      selector: string;
      properties: Record<string, string>;
    }>;
    colorPalette: string[];
    fontFamilies: string[];
    mediaQueries: string[];
  };
  assets: {
    images: Array<{
      src: string;
      alt: string;
      width?: number;
      height?: number;
      localPath?: string;
    }>;
    fonts: string[];
    externalStylesheets: string[];
  };
}

export interface GenerationResult {
  projectPath: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  errors: string[];
  buildSuccess: boolean;
}

export interface ModificationRequest {
  instruction: string;
  projectPath: string;
  currentFiles: Array<{
    path: string;
    content: string;
  }>;
}

export interface ModificationResult {
  modifiedFiles: Array<{
    path: string;
    content: string;
    changeDescription: string;
  }>;
  explanation: string;
  buildSuccess: boolean;
}

export interface PipelineConfig {
  llmProvider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  visionModel: string;
  maxRetries: number;
  outputDir: string;
  screenshotDir: string;
  verbose: boolean;
}

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface PipelineState {
  url: string;
  stages: PipelineStage[];
  analysis?: AnalysisResult;
  blueprint?: WebsiteBlueprint;
  generation?: GenerationResult;
  currentStage: string;
}
