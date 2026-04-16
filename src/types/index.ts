export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  synopsis: string;
  arc_summary: string;
  writing_rules: string;
  word_count_goal: number;
  daily_word_goal: number;
  created_at: string;
  updated_at: string;
}

export interface Volume {
  id: string;
  book_id: string;
  title: string;
  summary: string;
  sort_order: number;
  updated_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  volume_id: string;
  title: string;
  content: string; // JSON (Tiptap doc)
  summary: string;
  word_count: number;
  status: "draft" | "writing" | "review" | "done" | "published";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterSnapshot {
  id: string;
  chapter_id: string;
  content: string;
  word_count: number;
  label: string | null;
  created_at: string;
}

export interface Foreshadowing {
  id: string;
  book_id: string;
  planted_chapter_id: string | null;
  description: string;
  notes: string;
  status: "planted" | "resolved";
  resolved_chapter_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CodexType = "character" | "faction" | "location" | "item" | "rule" | "event" | "custom";

export const CODEX_TYPE_LABELS: Record<CodexType, string> = {
  character: "角色",
  faction: "势力",
  location: "地点",
  item: "物品",
  rule: "规则",
  event: "事件",
  custom: "自定义",
};

export const CODEX_TYPE_ICONS: Record<CodexType, string> = {
  character: "👤",
  faction: "⚔️",
  location: "📍",
  item: "📦",
  rule: "📜",
  event: "📅",
  custom: "🗂️",
};

export interface Inspiration {
  id: string;
  book_id: string;
  content: string;
  linked_chapter_id: string | null;
  linked_entity_id: string | null;
  is_used: number;
  created_at: string;
}

export interface OutlineNode {
  id: string;
  book_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  level: 1 | 2 | 3;
  linked_chapter_id: string | null;
  sort_order: number;
  created_at: string;
  // computed in store
  children?: OutlineNode[];
}

export interface CodexEntity {
  id: string;
  book_id: string;
  type: CodexType;
  name: string;
  aliases: string; // JSON array string, e.g. '["alias1","alias2"]'
  description: string;
  ai_instructions: string;
  tags: string;
  properties: string; // JSON object string
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface WritingStat {
  id: string;
  book_id: string;
  date: string;
  words_written: number;
  words_ai_generated: number;
  time_spent_minutes: number;
  chapters_completed: number;
}
