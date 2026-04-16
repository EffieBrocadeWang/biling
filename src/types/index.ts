export interface Project {
  id: number;
  name: string;
  genre: string;
  synopsis: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface Volume {
  id: number;
  project_id: number;
  title: string;
  sort_order: number;
}

export interface Chapter {
  id: number;
  volume_id: number;
  title: string;
  content: string; // JSON (Tiptap doc)
  summary: string;
  word_count: number;
  status: "draft" | "published";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: number;
  chapter_id: number;
  content: string;
  word_count: number;
  created_at: string;
}

export interface Foreshadowing {
  id: number;
  project_id: number;
  chapter_id: number | null;
  chapter_title: string;
  content: string;
  note: string;
  status: "planted" | "resolved";
  resolved_chapter_id: number | null;
  resolved_chapter_title: string;
  created_at: string;
  updated_at: string;
}

export type CodexType = "character" | "faction" | "location" | "item" | "rule";

export const CODEX_TYPE_LABELS: Record<CodexType, string> = {
  character: "角色",
  faction: "势力",
  location: "地点",
  item: "物品",
  rule: "规则",
};

export const CODEX_TYPE_ICONS: Record<CodexType, string> = {
  character: "👤",
  faction: "⚔️",
  location: "📍",
  item: "📦",
  rule: "📜",
};

export interface Inspiration {
  id: number;
  project_id: number;
  content: string;
  linked_chapter_id: number | null;
  linked_chapter_title: string;
  linked_codex_id: number | null;
  linked_codex_name: string;
  source: string;
  created_at: string;
}

export interface OutlineNode {
  id: number;
  project_id: number;
  parent_id: number | null;
  title: string;
  content: string;
  level: 1 | 2 | 3;
  linked_chapter_id: number | null;
  sort_order: number;
  created_at: string;
  // computed in store
  children?: OutlineNode[];
}

export interface CodexEntry {
  id: number;
  project_id: number;
  type: CodexType;
  name: string;
  aliases: string;
  description: string;
  ai_instructions: string;
  tags: string;
  created_at: string;
  updated_at: string;
}
