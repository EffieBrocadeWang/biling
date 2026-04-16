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
  loaded: boolean;
  load: () => Promise<void>;
  setActiveModel: (modelId: string) => Promise<void>;
  setProviderKey: (provider: string, key: string) => Promise<void>;
  setWritingRules: (rules: string) => Promise<void>;
  setDailyGoal: (goal: number) => Promise<void>;
  setAppearance: (patch: Partial<EditorAppearance>) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  getActiveModel: () => AIModel | null;
  getKeyForModel: (model: AIModel) => string;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  activeModelId: "qwen2.5:14b",
  providerKeys: [],
  writingRules: "",
  dailyGoal: 3000,
  appearance: DEFAULT_APPEARANCE,
  theme: "system" as ThemeMode,
  loaded: false,

  load: async () => {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings"
    );
    const keys: ProviderKey[] = [];
    let activeModelId = "qwen2.5:14b";
    let writingRules = "";
    let dailyGoal = 3000;
    let appearance = { ...DEFAULT_APPEARANCE };
    let theme: ThemeMode = "system";
    for (const row of rows) {
      if (row.key === "active_model") activeModelId = row.value;
      else if (row.key === "writing_rules") writingRules = row.value;
      else if (row.key === "daily_goal") dailyGoal = parseInt(row.value) || 3000;
      else if (row.key === "theme") theme = (row.value as ThemeMode) || "system";
      else if (row.key === "appearance") {
        try { appearance = { ...DEFAULT_APPEARANCE, ...JSON.parse(row.value) }; } catch { /* ignore */ }
      }
      else if (row.key.startsWith("ai_key_")) keys.push({ provider: row.key.slice(7), key: row.value });
    }
    set({ activeModelId, providerKeys: keys, writingRules, dailyGoal, appearance, theme, loaded: true });
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

  getActiveModel: () => {
    const { activeModelId } = get();
    return AI_MODELS.find((m) => m.id === activeModelId) ?? null;
  },

  getKeyForModel: (model) => {
    const { providerKeys } = get();
    return providerKeys.find((p) => p.provider === model.provider)?.key ?? "";
  },
}));
