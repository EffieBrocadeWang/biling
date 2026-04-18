import { create } from "zustand";
import { getDb } from "../lib/db";
import { AI_MODELS, type AIModel } from "../lib/ai";

export interface ProviderKey {
  provider: string;
  key: string;
}

export interface EditorAppearance {
  fontSize: number;       // px: 16 | 18 | 20 | 22
  lineHeight: number;     // 1.8 | 2.0 | 2.2 | 2.4
  maxWidth: number;       // px: 640 | 768 | 900 | 1100
  fontFamily: "sans" | "serif";
}

const DEFAULT_APPEARANCE: EditorAppearance = {
  fontSize: 18,
  lineHeight: 2.0,
  maxWidth: 768,
  fontFamily: "sans",
};

export type ThemeMode = "light" | "dark" | "system";

interface SettingsStore {
  activeModelId: string;
  providerKeys: ProviderKey[];
  writingRules: string;
  dailyGoal: number;
  appearance: EditorAppearance;
  theme: ThemeMode;
  remoteUrl: string;
  // Tutorial state
  onboardingCompleted: boolean;
  seenFeatures: string[];      // e.g. ["codex", "outline", "ai_panel"]
  allTipsDisabled: boolean;
  showHelpButtons: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setActiveModel: (modelId: string) => Promise<void>;
  setProviderKey: (provider: string, key: string) => Promise<void>;
  setWritingRules: (rules: string) => Promise<void>;
  setDailyGoal: (goal: number) => Promise<void>;
  setAppearance: (patch: Partial<EditorAppearance>) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setRemoteUrl: (url: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  markFeatureSeen: (feature: string) => Promise<void>;
  disableAllTips: () => Promise<void>;
  setShowHelpButtons: (show: boolean) => Promise<void>;
  resetTutorial: () => Promise<void>;
  getActiveModel: () => AIModel | null;
  getKeyForModel: (model: AIModel) => string;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  activeModelId: "deepseek-chat",
  providerKeys: [],
  writingRules: "",
  dailyGoal: 3000,
  appearance: DEFAULT_APPEARANCE,
  theme: "light" as ThemeMode,
  remoteUrl: "",
  onboardingCompleted: false,
  seenFeatures: [],
  allTipsDisabled: false,
  showHelpButtons: true,
  loaded: false,

  load: async () => {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings"
    );
    const keys: ProviderKey[] = [];
    let activeModelId = "deepseek-chat";
    let writingRules = "";
    let dailyGoal = 3000;
    let appearance = { ...DEFAULT_APPEARANCE };
    let theme: ThemeMode = "system";
    let remoteUrl = "";
    let onboardingCompleted = false;
    let seenFeatures: string[] = [];
    let allTipsDisabled = false;
    let showHelpButtons = true;
    for (const row of rows) {
      if (row.key === "active_model") activeModelId = row.value;
      else if (row.key === "writing_rules") writingRules = row.value;
      else if (row.key === "daily_goal") dailyGoal = parseInt(row.value) || 3000;
      else if (row.key === "theme") theme = (row.value as ThemeMode) || "system";
      else if (row.key === "ai_remote_url") remoteUrl = row.value;
      else if (row.key === "tutorial.onboarding_completed") onboardingCompleted = row.value === "true";
      else if (row.key === "tutorial.all_tips_disabled") allTipsDisabled = row.value === "true";
      else if (row.key === "tutorial.show_help_buttons") showHelpButtons = row.value !== "false";
      else if (row.key === "tutorial.seen_features") {
        try { seenFeatures = JSON.parse(row.value); } catch { /* ignore */ }
      }
      else if (row.key === "appearance") {
        try { appearance = { ...DEFAULT_APPEARANCE, ...JSON.parse(row.value) }; } catch { /* ignore */ }
      }
      else if (row.key.startsWith("ai_key_")) keys.push({ provider: row.key.slice(7), key: row.value });
    }
    set({ activeModelId, providerKeys: keys, writingRules, dailyGoal, appearance, theme, remoteUrl,
          onboardingCompleted, seenFeatures, allTipsDisabled, showHelpButtons, loaded: true });
  },

  setActiveModel: async (modelId) => {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_model', ?)",
      [modelId]
    );
    set({ activeModelId: modelId });
  },

  setProviderKey: async (provider, key) => {
    const db = await getDb();
    if (key.trim()) {
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [`ai_key_${provider}`, key.trim()]
      );
    } else {
      await db.execute("DELETE FROM settings WHERE key = ?", [`ai_key_${provider}`]);
    }
    set((state) => {
      const others = state.providerKeys.filter((p) => p.provider !== provider);
      return { providerKeys: key.trim() ? [...others, { provider, key: key.trim() }] : others };
    });
  },

  setWritingRules: async (rules) => {
    const db = await getDb();
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('writing_rules', ?)", [rules]);
    set({ writingRules: rules });
  },

  setDailyGoal: async (goal) => {
    const db = await getDb();
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_goal', ?)", [String(goal)]);
    set({ dailyGoal: goal });
  },

  setTheme: async (theme) => {
    const db = await getDb();
    await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)", [theme]);
    set({ theme });
  },

  setAppearance: async (patch) => {
    const next = { ...get().appearance, ...patch };
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('appearance', ?)",
      [JSON.stringify(next)]
    );
    set({ appearance: next });
  },

  completeOnboarding: async () => {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('tutorial.onboarding_completed', 'true')"
    );
    set({ onboardingCompleted: true });
  },

  markFeatureSeen: async (feature) => {
    const { seenFeatures } = get();
    if (seenFeatures.includes(feature)) return;
    const next = [...seenFeatures, feature];
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('tutorial.seen_features', ?)",
      [JSON.stringify(next)]
    );
    set({ seenFeatures: next });
  },

  disableAllTips: async () => {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('tutorial.all_tips_disabled', 'true')"
    );
    set({ allTipsDisabled: true });
  },

  setShowHelpButtons: async (show) => {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('tutorial.show_help_buttons', ?)",
      [String(show)]
    );
    set({ showHelpButtons: show });
  },

  resetTutorial: async () => {
    const db = await getDb();
    await db.execute("DELETE FROM settings WHERE key LIKE 'tutorial.%'");
    set({ onboardingCompleted: false, seenFeatures: [], allTipsDisabled: false, showHelpButtons: true });
  },

  setRemoteUrl: async (url) => {
    const db = await getDb();
    if (url.trim()) {
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_remote_url', ?)",
        [url.trim()]
      );
    } else {
      await db.execute("DELETE FROM settings WHERE key = 'ai_remote_url'");
    }
    set({ remoteUrl: url.trim() });
  },

  getActiveModel: () => {
    const { activeModelId } = get();
    return AI_MODELS.find((m) => m.id === activeModelId) ?? null;
  },

  getKeyForModel: (model) => {
    const { providerKeys } = get();
    return providerKeys.find((p) => p.provider === model.provider)?.key ?? "";
  },
}));
