export type ThemeId = "office" | "romance" | "friends";
export type ButtonBehavior = "normal" | "escape" | "magnetic" | "clickable";
export type FontId = "sans" | "serif" | "rounded";
export type AnimationIntensity = "subtle" | "balanced" | "playful";

export interface ButtonConfig {
  label: string;
  behavior: ButtonBehavior;
  result: string;
}

export interface SiteConfig {
  version: 1;
  theme: ThemeId;
  question: string;
  buttons: [ButtonConfig, ButtonConfig];
  background: string;
  accent: string;
  font: FontId;
  intensity: AnimationIntensity;
  pageTitle: string;
  description: string;
}

export const STORAGE_KEY = "chooseone.settings.v2";
export const LEGACY_STORAGE_KEY = "chooseone.settings.v1";

export const THEME_INFO: Record<ThemeId, { name: string; caption: string; emoji: string }> = {
  office: { name: "Office hours", caption: "A little workplace mischief", emoji: "☕" },
  romance: { name: "Love, actually", caption: "One question. All the butterflies.", emoji: "♡" },
  friends: { name: "Bestie business", caption: "Friendship, with a side of chaos", emoji: "✌" },
};

export const FONT_OPTIONS: { value: FontId; label: string }[] = [
  { value: "sans", label: "Modern sans · clean & bold" },
  { value: "serif", label: "Editorial serif · a little romantic" },
  { value: "rounded", label: "Friendly rounded · soft & playful" },
];

export const THEME_DEFAULTS: Record<ThemeId, SiteConfig> = {
  office: {
    version: 1,
    theme: "office",
    question: "Ekhon ki cholche?",
    buttons: [
      { label: "Canteen e chill", behavior: "clickable", result: "Caught in 4K! ☕ A little canteen break never hurt anyone. Please hold all meetings until further notice." },
      { label: "Desk e kaj", behavior: "escape", result: "Plot twist! Actual work is happening. Someone take a screenshot! 📸" },
    ],
    background: "#f6f5ef",
    accent: "#c3ed89",
    font: "sans",
    intensity: "balanced",
    pageTitle: "Choose One — A very important question",
    description: "A tiny question. A little mischief. A playful, friendly challenge for your favorite people.",
  },
  romance: {
    version: 1,
    theme: "romance",
    question: "Do you love me?",
    buttons: [
      { label: "Yes ❤️", behavior: "magnetic", result: "I knew it. ♡ You just made my whole day. Here's to all our little moments, and a million more." },
      { label: "No 🙈", behavior: "escape", result: "Okay, okay. I'll win you over with snacks. ♡" },
    ],
    background: "#fff1f2",
    accent: "#f9aec4",
    font: "serif",
    intensity: "subtle",
    pageTitle: "Choose One — A little love note",
    description: "One question, a few butterflies, and a little love note made just for you.",
  },
  friends: {
    version: 1,
    theme: "friends",
    question: "Treat dibi toh?",
    buttons: [
      { label: "Chol, amar treat! 🍕", behavior: "clickable", result: "Screenshot taken. 📸 No take-backs, bestie! Group chat e proof pathai? Pizza's on you!" },
      { label: "Wallet khali bro", behavior: "escape", result: "Wallet khali, but friendship full. Fine, next one's on me! 🤝" },
    ],
    background: "#f1edff",
    accent: "#c7b4ff",
    font: "rounded",
    intensity: "playful",
    pageTitle: "Choose One — Bestie business",
    description: "A very serious friendship question. Choose wisely. Your bestie is watching.",
  },
};

// Preserve the original in-joke separately from the reusable office theme.
const LEGACY_OFFICE_DEFAULT: SiteConfig = {
  ...THEME_DEFAULTS.office,
  question: "Asif bhai ekhon kothay?",
  buttons: [
    { label: "Canteen e ghumay", behavior: "clickable", result: "Caught in 4K! ☕ Asif bhai is recharging in the canteen. Please hold all meetings until further notice." },
    { label: "Desk e kaj kore", behavior: "escape", result: "Plot twist! Asif bhai is actually working. Someone take a screenshot! 📸" },
  ],
};

export const ASIF_CONFIG: SiteConfig = {
  ...LEGACY_OFFICE_DEFAULT,
  buttons: [
    { ...LEGACY_OFFICE_DEFAULT.buttons[0], result: "Nice guess! Chomu is in FAL Canteen…\nJhimaitese…" },
    { ...LEGACY_OFFICE_DEFAULT.buttons[1] },
  ],
  pageTitle: "Asif bhai ekhon kothay? — Made by Mir",
  description: "Canteen e ghumay, na desk e kaj kore? A very serious office mystery. Made by Mir.",
};

export function getAsifConfig(): SiteConfig {
  return { ...ASIF_CONFIG, buttons: [{ ...ASIF_CONFIG.buttons[0] }, { ...ASIF_CONFIG.buttons[1] }] };
}

export function getThemeDefault(theme: ThemeId = "office"): SiteConfig {
  const config = THEME_DEFAULTS[theme];
  return { ...config, buttons: [{ ...config.buttons[0] }, { ...config.buttons[1] }] };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${name} must contain 1–${max} characters.`);
  }
  return value.trim();
}

function enumField<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new Error(`${name} is not a supported option.`);
  }
  return value as T;
}

/** Validate every field and construct a new object; imported objects are never merged blindly. */
export function parseConfig(input: unknown): SiteConfig {
  if (!record(input) || input.version !== 1) throw new Error("Choose a valid Choose One configuration (version 1).");
  if (!Array.isArray(input.buttons) || input.buttons.length !== 2) throw new Error("Your configuration needs exactly two buttons.");
  const buttons = input.buttons.map((button, index): ButtonConfig => {
    if (!record(button)) throw new Error(`Button ${index + 1} is missing.`);
    return {
      label: stringField(button.label, `Button ${index + 1} label`, 50),
      behavior: enumField(button.behavior, ["normal", "escape", "magnetic", "clickable"], "Button behavior"),
      result: stringField(button.result, `Button ${index + 1} response`, 400),
    };
  }) as [ButtonConfig, ButtonConfig];
  if (buttons.every((button) => button.behavior === "escape")) throw new Error("Keep at least one button clickable so visitors can answer.");
  for (const key of ["background", "accent"] as const) {
    if (typeof input[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(input[key] as string)) {
      throw new Error(`${key === "accent" ? "Accent" : "Background"} must be a six-digit hex color, like #c3ed89.`);
    }
  }
  return {
    version: 1,
    theme: enumField(input.theme, ["office", "romance", "friends"], "Theme"),
    question: stringField(input.question, "Question", 180),
    buttons,
    background: input.background as string,
    accent: input.accent as string,
    font: enumField(input.font, ["sans", "serif", "rounded"], "Font"),
    intensity: enumField(input.intensity, ["subtle", "balanced", "playful"], "Animation intensity"),
    pageTitle: stringField(input.pageTitle, "Page title", 120),
    description: stringField(input.description, "Description", 300),
  };
}

export function loadConfig(): SiteConfig {
  if (typeof window === "undefined") return getThemeDefault();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return parseConfig(JSON.parse(stored));
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return getThemeDefault();
    const previous = parseConfig(JSON.parse(legacy));
    // Only replace the exact old default. Preserve every intentionally edited configuration.
    return JSON.stringify(previous) === JSON.stringify(LEGACY_OFFICE_DEFAULT) ? getThemeDefault() : previous;
  } catch {
    return getThemeDefault();
  }
}

export function saveConfig(config: SiteConfig): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parseConfig(config)));
}
