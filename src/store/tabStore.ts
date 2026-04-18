import { create } from "zustand";
import { getDb } from "../lib/db";

export type TabType =
  | "chapter"
  | "outline"
  | "codex"
  | "foreshadowing"
  | "stats"
  | "deconstruct"
  | "inspirations"
  | "io"
  | "rules"
  | "docs"
  | "packs"
  | "toolbox"
  | "outlinenode"
  | "about";

export const TAB_LABELS: Record<TabType, string> = {
  chapter: "章节",
  outline: "大纲",
  codex: "世界百科",
  foreshadowing: "伏笔",
  stats: "统计",
  deconstruct: "拆书",
  inspirations: "灵感",
  io: "导入导出",
  rules: "写作规则",
  docs: "项目文档",
  packs: "资源库",
  toolbox: "工具箱",
  outlinenode: "章纲",
  about: "关于笔灵",
};

export const TAB_ICONS: Record<TabType, string> = {
  chapter: "📄",
  outline: "📋",
  codex: "📚",
  foreshadowing: "🔗",
  stats: "📊",
  deconstruct: "🔍",
  inspirations: "💡",
  io: "📂",
  rules: "📜",
  docs: "🗂️",
  packs: "📦",
  toolbox: "🧰",
  outlinenode: "📋",
  about: "ℹ️",
};

// Only one of these can exist across all panels (navigate to existing instead of opening new)
const SINGLETON_TYPES = new Set<TabType>([
  "outline", "codex", "foreshadowing", "stats",
  "deconstruct", "inspirations", "io", "rules", "docs", "packs", "toolbox", "about",
]);

export interface Tab {
  id: string;        // unique instance id (not chapterId)
  type: TabType;
  entityId?: string; // chapterId for chapter tabs
  title: string;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface TabStore {
  projectId: string | null;
  leftTabs: Tab[];
  rightTabs: Tab[];
  activeLeftId: string | null;
  activeRightId: string | null;
  splitMode: "single" | "split";
  splitRatio: number;
  focusedPanel: "left" | "right";
  recentlyClosed: Tab[];

  // Lifecycle
  init: (projectId: string) => Promise<void>;
  save: () => Promise<void>;

  // Tab management
  openTab: (spec: Omit<Tab, "id">, panel?: "left" | "right") => void;
  openChapterTab: (chapterId: string, title: string) => void;
  openOutlineNodeTab: (nodeId: string, title: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string, panel: "left" | "right") => void;
  closeRightTabs: (tabId: string, panel: "left" | "right") => void;
  moveTabToOtherPanel: (tabId: string) => void;
  activateTab: (tabId: string) => void;
  reopenLastClosed: () => void;
  reorderTabs: (panel: "left" | "right", tabs: Tab[]) => void;
  updateTabTitle: (chapterId: string, title: string) => void;

  // Split view
  setSplitMode: (mode: "single" | "split") => void;
  setSplitRatio: (ratio: number) => void;
  setFocusedPanel: (panel: "left" | "right") => void;

  // Selectors
  getActiveTab: (panel: "left" | "right") => Tab | null;
  getFocusedTab: () => Tab | null;
}

export const useTabStore = create<TabStore>((set, get) => ({
  projectId: null,
  leftTabs: [],
  rightTabs: [],
  activeLeftId: null,
  activeRightId: null,
  splitMode: "single",
  splitRatio: 0.5,
  focusedPanel: "left",
  recentlyClosed: [],

  init: async (projectId) => {
    set({ projectId });
    try {
      const db = await getDb();
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = ?",
        [`tab_state_${projectId}`]
      );
      if (rows.length > 0) {
        const saved = JSON.parse(rows[0].value);
        set({
          leftTabs: saved.leftTabs ?? [],
          rightTabs: saved.rightTabs ?? [],
          activeLeftId: saved.activeLeftId ?? null,
          activeRightId: saved.activeRightId ?? null,
          splitMode: saved.splitMode ?? "single",
          splitRatio: saved.splitRatio ?? 0.5,
          focusedPanel: "left",
          recentlyClosed: [],
        });
      } else {
        set({
          leftTabs: [], rightTabs: [],
          activeLeftId: null, activeRightId: null,
          splitMode: "single", splitRatio: 0.5,
          focusedPanel: "left", recentlyClosed: [],
        });
      }
    } catch { /* ignore */ }
  },

  save: async () => {
    const { projectId, leftTabs, rightTabs, activeLeftId, activeRightId, splitMode, splitRatio } = get();
    if (!projectId) return;
    try {
      const db = await getDb();
      const data = { leftTabs, rightTabs, activeLeftId, activeRightId, splitMode, splitRatio };
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [`tab_state_${projectId}`, JSON.stringify(data)]
      );
    } catch { /* ignore */ }
  },

  openTab: (spec, panel) => {
    const state = get();
    // In single-split mode, always use left panel regardless of focusedPanel
    const targetPanel = panel ?? (state.splitMode === "single" ? "left" : state.focusedPanel);

    // Singleton: if already open anywhere, just activate it
    if (SINGLETON_TYPES.has(spec.type)) {
      const existL = state.leftTabs.find(t => t.type === spec.type);
      if (existL) {
        set({ activeLeftId: existL.id, focusedPanel: "left" });
        get().save();
        return;
      }
      const existR = state.rightTabs.find(t => t.type === spec.type);
      if (existR) {
        set({ activeRightId: existR.id, focusedPanel: "right" });
        get().save();
        return;
      }
    }

    // Chapter / outlinenode tab: if same entity already open anywhere, activate it
    if ((spec.type === "chapter" || spec.type === "outlinenode") && spec.entityId) {
      const existL = state.leftTabs.find(t => t.type === spec.type && t.entityId === spec.entityId);
      if (existL) {
        set({ activeLeftId: existL.id, focusedPanel: "left" });
        get().save();
        return;
      }
      const existR = state.rightTabs.find(t => t.type === spec.type && t.entityId === spec.entityId);
      if (existR) {
        set({ activeRightId: existR.id, focusedPanel: "right" });
        get().save();
        return;
      }
    }

    // Create new tab in target panel
    const newTab: Tab = { ...spec, id: makeId() };
    if (targetPanel === "left") {
      set({ leftTabs: [...state.leftTabs, newTab], activeLeftId: newTab.id, focusedPanel: "left" });
    } else {
      set({ rightTabs: [...state.rightTabs, newTab], activeRightId: newTab.id, focusedPanel: "right" });
    }
    get().save();
  },

  openChapterTab: (chapterId, title) => {
    get().openTab({ type: "chapter", entityId: chapterId, title });
  },

  openOutlineNodeTab: (nodeId, title) => {
    get().openTab({ type: "outlinenode", entityId: nodeId, title: title || "章纲" });
  },

  closeTab: (tabId) => {
    const state = get();

    function closeFrom(tabs: Tab[], activeId: string | null) {
      const idx = tabs.findIndex(t => t.id === tabId);
      if (idx === -1) return { tabs, activeId, closed: null as Tab | null };
      const closed = tabs[idx];
      const newTabs = tabs.filter(t => t.id !== tabId);
      const newActiveId = activeId === tabId
        ? (newTabs.length > 0 ? newTabs[Math.min(idx, newTabs.length - 1)].id : null)
        : activeId;
      return { tabs: newTabs, activeId: newActiveId, closed };
    }

    const L = closeFrom(state.leftTabs, state.activeLeftId);
    const R = closeFrom(state.rightTabs, state.activeRightId);
    const closed = L.closed ?? R.closed;

    set({
      leftTabs: L.tabs, activeLeftId: L.activeId,
      rightTabs: R.tabs, activeRightId: R.activeId,
      recentlyClosed: closed
        ? [closed, ...state.recentlyClosed].slice(0, 10)
        : state.recentlyClosed,
    });
    get().save();
  },

  closeOtherTabs: (tabId, panel) => {
    const tabs = panel === "left" ? get().leftTabs : get().rightTabs;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    set(panel === "left"
      ? { leftTabs: [tab], activeLeftId: tabId }
      : { rightTabs: [tab], activeRightId: tabId }
    );
    get().save();
  },

  closeRightTabs: (tabId, panel) => {
    const tabs = panel === "left" ? get().leftTabs : get().rightTabs;
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    set(panel === "left"
      ? { leftTabs: tabs.slice(0, idx + 1) }
      : { rightTabs: tabs.slice(0, idx + 1) }
    );
    get().save();
  },

  moveTabToOtherPanel: (tabId) => {
    const state = get();
    const inLeft = state.leftTabs.some(t => t.id === tabId);
    const tab = (inLeft ? state.leftTabs : state.rightTabs).find(t => t.id === tabId);
    if (!tab) return;

    if (inLeft) {
      const newLeft = state.leftTabs.filter(t => t.id !== tabId);
      set({
        leftTabs: newLeft,
        activeLeftId: state.activeLeftId === tabId
          ? (newLeft.length > 0 ? newLeft[Math.max(0, newLeft.length - 1)].id : null)
          : state.activeLeftId,
        rightTabs: [...state.rightTabs, tab],
        activeRightId: tabId,
        focusedPanel: "right",
        splitMode: "split", // auto-enable split if not already on
      });
    } else {
      const newRight = state.rightTabs.filter(t => t.id !== tabId);
      set({
        rightTabs: newRight,
        activeRightId: state.activeRightId === tabId
          ? (newRight.length > 0 ? newRight[Math.max(0, newRight.length - 1)].id : null)
          : state.activeRightId,
        leftTabs: [...state.leftTabs, tab],
        activeLeftId: tabId,
        focusedPanel: "left",
      });
    }
    get().save();
  },

  activateTab: (tabId) => {
    const state = get();
    if (state.leftTabs.some(t => t.id === tabId)) {
      set({ activeLeftId: tabId, focusedPanel: "left" });
    } else if (state.rightTabs.some(t => t.id === tabId)) {
      set({ activeRightId: tabId, focusedPanel: "right" });
    }
    get().save();
  },

  reopenLastClosed: () => {
    const state = get();
    if (state.recentlyClosed.length === 0) return;
    const [last, ...rest] = state.recentlyClosed;
    set({ recentlyClosed: rest });
    get().openTab(last, state.focusedPanel);
  },

  reorderTabs: (panel, tabs) => {
    set(panel === "left" ? { leftTabs: tabs } : { rightTabs: tabs });
    get().save();
  },

  updateTabTitle: (entityId, title) => {
    set(state => ({
      leftTabs: state.leftTabs.map(t =>
        (t.type === "chapter" || t.type === "outlinenode") && t.entityId === entityId ? { ...t, title } : t
      ),
      rightTabs: state.rightTabs.map(t =>
        (t.type === "chapter" || t.type === "outlinenode") && t.entityId === entityId ? { ...t, title } : t
      ),
    }));
    get().save();
  },

  setSplitMode: (splitMode) => {
    if (splitMode === "single") {
      const state = get();
      // Merge right tabs into left (deduplicate)
      const combined = [...state.leftTabs];
      for (const t of state.rightTabs) {
        const dup = combined.some(e =>
          t.type === "chapter"
            ? e.type === "chapter" && e.entityId === t.entityId
            : e.type === t.type
        );
        if (!dup) combined.push(t);
      }
      set({
        splitMode,
        leftTabs: combined, rightTabs: [],
        activeLeftId: state.activeLeftId ?? state.activeRightId,
        activeRightId: null,
        focusedPanel: "left",
      });
    } else {
      set({ splitMode });
    }
    get().save();
  },

  setSplitRatio: (ratio) => {
    set({ splitRatio: ratio });
    get().save();
  },

  setFocusedPanel: (focusedPanel) => set({ focusedPanel }),

  getActiveTab: (panel) => {
    const state = get();
    const tabs = panel === "left" ? state.leftTabs : state.rightTabs;
    const activeId = panel === "left" ? state.activeLeftId : state.activeRightId;
    return tabs.find(t => t.id === activeId) ?? null;
  },

  getFocusedTab: () => {
    const { focusedPanel } = get();
    return get().getActiveTab(focusedPanel);
  },
}));
