import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

export type ChatMode = "续写" | "润色" | "扩写" | "缩写" | "对话" | "情节" | "一致性" | "自由" | "卡文" | "章节标题" | "爽点检测";

export const CHAT_MODES: ChatMode[] = ["续写", "润色", "扩写", "缩写", "对话", "情节", "一致性", "自由", "卡文", "章节标题", "爽点检测"];

export const MODE_HINTS: Record<ChatMode, string> = {
  续写: "直接点击「续写」，或告诉我从哪里开始续写",
  润色: "粘贴需要润色的段落",
  扩写: "粘贴需要扩写的段落",
  缩写: "粘贴需要缩短的段落",
  对话: "描述对话场景和参与角色",
  情节: "直接点击「生成建议」，或描述当前剧情",
  一致性: "粘贴需要检查的段落，或直接点击「检查当前章节」",
  自由: "有什么想法或问题？",
  卡文: "点击「分析」，AI 根据当前章节、伏笔和大纲给出 5 个方向",
  章节标题: "点击「生成标题」，AI 根据本章内容生成 8 个候选标题",
  爽点检测: "点击「检测」，AI 分析本章节奏、爽点密度和慢节奏区段",
};

export interface PendingQuote {
  text: string;
  mode: ChatMode;
  autoSend: boolean;
}

interface AiStore {
  messages: ChatMessage[];
  mode: ChatMode;
  pendingQuote: PendingQuote | null;
  setMode: (mode: ChatMode) => void;
  setPendingQuote: (q: PendingQuote | null) => void;
  addMessage: (msg: Omit<ChatMessage, "id">) => string;
  updateMessage: (id: string, content: string, loading?: boolean) => void;
  clearMessages: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export const useAiStore = create<AiStore>((set) => ({
  messages: [],
  mode: "自由",
  pendingQuote: null,

  setMode: (mode) => set({ mode }),
  setPendingQuote: (q) => set({ pendingQuote: q }),

  addMessage: (msg) => {
    const id = uid();
    set((state) => ({ messages: [...state.messages, { ...msg, id }] }));
    return id;
  },

  updateMessage: (id, delta, loading = false) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: loading ? m.content + delta : delta, loading } : m
      ),
    })),

  clearMessages: () => set({ messages: [] }),
}));
