/**
 * DS Coverage — Configuration
 *
 * Defines the config schema and provides minimal, agnostic defaults.
 * Stack-specific patterns are provided by presets (see presets.ts)
 * and applied via the interactive wizard (`npx ds-coverage init`).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// ============================================
// CONFIG TYPES
// ============================================

export interface ViolationCategoryConfig {
  enabled: boolean;
  label: string;
  icon: string;
  /** CSS color for the dashboard */
  color: string;
  /** Regex pattern string (without flags — 'g' is added automatically) */
  pattern: string;
  /**
   * When true, multiple matches on the same line are merged into one violation.
   * Useful for typography: `text-sm font-medium` on one line = 1 violation, not 2.
   * @default false
   */
  deduplicateByLine?: boolean;
  /**
   * Path patterns to exclude from this violation category (substring match).
   * Files matching any pattern will skip scanning for this category.
   * @example ["components/ui/"] - excludes all files under components/ui/
   */
  excludePaths?: string[];
}

export interface ComponentApiConfig {
  enabled: boolean;
  /** Directories containing reusable components (relative to scanDir) */
  directories: string[];
  /** The "target" directory where new components should live */
  primaryDirectory: string;
  /** Legacy directories (to flag for migration) */
  legacyDirectories: string[];
  api: {
    requireCVA: boolean;
    requireRadix: boolean;
    /** Expected variant prop names (e.g. ['variant', 'size']) */
    expectedProps: string[];
    /** Forbidden prop names that indicate legacy code */
    forbiddenProps: string[];
    /** Expected size values */
    expectedSizes: string[];
    /** Forbidden size values */
    forbiddenSizes: string[];
    /** Legacy variant values to flag */
    legacyVariantValues: string[];
  };
  /** Scoring weights for compliance score (should sum to ~100) */
  scoring: {
    usesCVA: number;
    correctNaming: number;
    correctSizes: number;
    hasClassName: number;
    usesCompoundVariants: number;
    hasAsChild: number;
    usesRadix: number;
  };
}

export interface BusinessLogicAnalysisConfig {
  enabled: boolean;
  /** Directories to exclude from business logic analysis (e.g. ['components/ui/']) */
  excludeDirectories: string[];
  /** Risk assessment thresholds */
  riskThresholds: {
    safe: {
      maxStateHooks: number;
      maxEffects: number;
      maxApiCalls: number;
    };
    careful: {
      maxStateHooks: number;
      maxEffects: number;
      maxApiCalls: number;
    };
  };
  /** Native HTML element detection */
  nativeHtmlElements: {
    enabled: boolean;
    elements: string[]; // ['input', 'select', 'button', 'label', 'textarea', 'form']
  };
}

export interface PurityConfig {
  enabled: boolean;
  /** Directories containing UI components that should be pure (e.g. ['components']) */
  uiCandidateDirs: string[];
  /** Import patterns that are allowed in UI components */
  allowedImportMatchers: string[];
  /** Import patterns that indicate business logic entanglement */
  forbiddenImportMatchers: string[];
  /** Directory patterns that indicate business logic zones */
  businessDirMatchers: string[];
  /** Next.js server API imports that should be flagged */
  nextServerImportMatchers: string[];
}

export interface DsCoverageConfig {
  /** Directory to scan (relative to project root) - kept for backward compatibility */
  scanDir: string;
  /** Directories to scan (relative to project root) - if provided, overrides scanDir */
  scanDirs?: string[];
  /** File extensions to scan */
  extensions: string[];
  /** Paths to exclude (substring match) */
  exclude: string[];

  /** Violation categories to detect */
  violations: Record<string, ViolationCategoryConfig>;

  /** Migration flag patterns (searched in comments) */
  flags: {
    migrateSimple: string;
    migrateComplex: string;
    todo: string;
  };

  /** Component API analysis configuration */
  componentAnalysis: ComponentApiConfig;

  /** Roadmap generation settings */
  roadmap: {
    enabled: boolean;
    /** Max files shown per phase */
    maxFilesPerPhase: number;
    /** Max violations for a file to be a "quick win" */
    quickWinThreshold: number;
    /** Custom phases (in order). Each phase filters files by a function description. */
    phases: Array<{
      id: string;
      title: string;
      description: string;
      businessCase: string;
      /** Which violation category this phase targets, or 'flags' for flagged files, or 'quickWins', or a directory prefix */
      filter:
        | { type: "flags" }
        | { type: "directory"; prefix: string }
        | { type: "category"; key: string }
        | { type: "quickWins" }
        | { type: "all" };
    }>;
  };

  /** Component migration planning */
  migration: {
    enabled: boolean;
    /** Target design system name (e.g. "shadcn/ui", "Custom DS v2") */
    targetDS: string;
    /** Component mappings: source → target with guidelines */
    mappings: Array<{
      source: string;
      sourceImportPattern: string;
      target: string;
      targetImportPath: string;
      complexity: "simple" | "moderate" | "complex";
      guidelines: string;
      propMapping?: string;
      breakingChanges?: string[];
      effort?: string;
    }>;
  };

  /** Business logic analysis configuration */
  businessLogicAnalysis: BusinessLogicAnalysisConfig;

  /** Purity contract configuration for import boundary analysis */
  purity: PurityConfig;

  /** Dashboard customization */
  dashboard: {
    title: string;
    subtitle: string;
  };

  /** Output paths (relative to project root) */
  output: {
    reportJson: string;
    dashboardHtml: string;
  };
}

// ============================================
// DEFAULTS — Minimal & agnostic
// ============================================

export const DEFAULT_CONFIG: DsCoverageConfig = {
  scanDir: "src",
  extensions: [".tsx", ".jsx", ".ts", ".js"],
  exclude: [
    "node_modules/",
    "dist/",
    "build/",
    "test/",
    "__tests__/",
    ".test.",
    ".spec.",
    "stories/",
    ".storybook/",
  ],

  violations: {},

  flags: {
    migrateSimple: "@ds-migrate:\\s*simple",
    migrateComplex: "@ds-migrate:\\s*complex",
    todo: "@ds-todo",
  },

  componentAnalysis: {
    enabled: false,
    directories: ["components/ui/"],
    primaryDirectory: "components/ui/",
    legacyDirectories: [],
    api: {
      requireCVA: false,
      requireRadix: false,
      expectedProps: ["variant", "size"],
      forbiddenProps: [],
      expectedSizes: ["small", "medium", "large"],
      forbiddenSizes: [],
      legacyVariantValues: [],
    },
    scoring: {
      usesCVA: 0,
      correctNaming: 35,
      correctSizes: 25,
      hasClassName: 15,
      usesCompoundVariants: 0,
      hasAsChild: 0,
      usesRadix: 0,
    },
  },

  roadmap: {
    enabled: true,
    maxFilesPerPhase: 30,
    quickWinThreshold: 3,
    phases: [
      {
        id: "resolve-flags",
        title: "Resolve existing migration flags",
        description: "Files already annotated with migration flags from previous reviews.",
        businessCase: "Highest ROI — zero discovery cost, just execution.",
        filter: { type: "flags" },
      },
      {
        id: "quick-wins",
        title: "Quick wins — files with 1-3 violations",
        description: "Files that can be fully migrated with minimal effort.",
        businessCase: "Best coverage metric improvement per hour. Builds momentum.",
        filter: { type: "quickWins" },
      },
    ],
  },

  migration: {
    enabled: false,
    targetDS: "",
    mappings: [],
  },

  businessLogicAnalysis: {
    enabled: false,
    excludeDirectories: ["components/ui/"],
    riskThresholds: {
      safe: {
        maxStateHooks: 2,
        maxEffects: 0,
        maxApiCalls: 0,
      },
      careful: {
        maxStateHooks: 5,
        maxEffects: 2,
        maxApiCalls: 1,
      },
    },
    nativeHtmlElements: {
      enabled: true,
      elements: ["input", "select", "button", "label", "textarea", "form"],
    },
  },

  purity: {
    enabled: false,
    uiCandidateDirs: ["components"],
    allowedImportMatchers: ["react", "clsx", "classnames", "tailwind-merge", "@radix-ui/", "@/components/ui/"],
    forbiddenImportMatchers: ["@/lib/", "@/server/", "@/db/", "@/actions/", "@/features/"],
    businessDirMatchers: ["app/", "lib/", "server/", "db/", "actions/", "features/"],
    nextServerImportMatchers: ["next/headers", "next/cache"],
  },

  dashboard: {
    title: "Design System Coverage",
    subtitle: "",
  },

  output: {
    reportJson: "ds-coverage-report.json",
    dashboardHtml: "ds-coverage-dashboard.html",
  },
};

// ============================================
// CONFIG LOADER
// ============================================

const CONFIG_FILE_NAMES = [
  "ds-coverage.config.js",
  "ds-coverage.config.mjs",
  "ds-coverage.config.cjs",
  "ds-coverage.config.json",
  "ds-coverage.config.ts",
];

/** Deep merge two objects (source overrides target) */
// biome-ignore lint: any is needed for generic deep merge
export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal) &&
      targetVal !== null
    ) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }
  return result;
}

/**
 * Load config from a specific path or auto-discover from CONFIG_FILE_NAMES.
 * When configPath is provided, only that file is tried (and errors are thrown).
 */
export async function loadConfig(
  projectRoot: string,
  configPath?: string,
): Promise<DsCoverageConfig> {
  // If explicit config path, load it directly (errors are surfaced)
  if (configPath) {
    const fullPath = resolve(projectRoot, configPath);
    const userConfig = await loadSingleConfig(fullPath, configPath);
    const merged = deepMerge(DEFAULT_CONFIG, userConfig);
    return validateConfig(merged);
  }

  // Auto-discover
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = join(projectRoot, fileName);

    // Only attempt to load files that actually exist
    if (!existsSync(filePath)) continue;

    try {
      const userConfig = await loadSingleConfig(filePath, fileName);
      const merged = deepMerge(DEFAULT_CONFIG, userConfig);
      return validateConfig(merged);
    } catch (err) {
      // File exists but failed to load — surface the error (syntax error, etc.)
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to load config file "${fileName}":\n  ${message}\n\n` +
        `Fix the error in ${fileName}, or delete it and re-run \`npx ds-coverage init\`.`,
      );
    }
  }

  // No config file found — use defaults
  return { ...DEFAULT_CONFIG };
}

async function loadSingleConfig(filePath: string, displayName: string): Promise<Record<string, unknown>> {
  if (displayName.endsWith(".json")) {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  }

  // For .js, .mjs, .cjs, .ts — use dynamic import
  const fileUrl = `file://${resolve(filePath)}`;
  const mod = await import(fileUrl);
  return mod.default || mod;
}

// ============================================
// CONFIG VALIDATION
// ============================================

const KNOWN_TOP_KEYS = new Set([
  "scanDir", "scanDirs", "extensions", "exclude",
  "violations", "flags",
  "componentAnalysis", "roadmap", "migration", "businessLogicAnalysis", "purity",
  "dashboard", "output",
]);

function validateConfig(config: DsCoverageConfig): DsCoverageConfig {
  // Warn about unknown top-level keys
  for (const key of Object.keys(config)) {
    if (!KNOWN_TOP_KEYS.has(key)) {
      console.warn(`⚠️  ds-coverage config: unknown key "${key}" — will be ignored. Check for typos.`);
    }
  }

  // Validate regex patterns
  for (const [key, catConfig] of Object.entries(config.violations)) {
    if (!catConfig.enabled) continue;
    try {
      new RegExp(catConfig.pattern, "g");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  ds-coverage config: invalid regex in violations.${key}.pattern: ${message}`);
    }
  }

  return config;
}
