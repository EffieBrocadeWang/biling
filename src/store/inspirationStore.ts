import { create } from "zustand";
import { getDb } from "../lib/db";
import type { Inspiration } from "../types";

interface InspirationStore {
  items: Inspiration[];
  projectId: number | null;

  load: (projectId: number) => Promise<void>;
  add: (
    projectId: number,
    content: string,
    opts?: {
      linkedChapterId?: number | null;
      linkedChapterTitle?: string;
      linkedCodexId?: number | null;
      linkedCodexName?: string;
      source?: string;
    }
  ) => Promise<Inspiration>;
  update: (id: number, content: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useInspirationStore = create<InspirationStore>((set) => ({
  items: [],
  projectId: null,

  load: async (projectId) => {
    const db = await getDb();
    const items = await db.select<Inspiration[]>(
      `SELECT * FROM inspirations WHERE project_id = ? ORDER BY created_at DESC`,
      [projectId]
    );
    set({ items, projectId });
  },

  add: async (projectId, content, opts = {}) => {
    const db = await getDb();
    const {
      linkedChapterId = null,
      linkedChapterTitle = "",
      linkedCodexId = null,
      linkedCodexName = "",
      source = "manual",
    } = opts;
    const result = await db.execute(
      `INSERT INTO inspirations (project_id, content, linked_chapter_id, linked_chapter_title, linked_codex_id, linked_codex_name, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, content, linkedChapterId, linkedChapterTitle, linkedCodexId, linkedCodexName, source]
    );
    const rows = await db.select<Inspiration[]>(
      `SELECT * FROM inspirations WHERE id = ?`,
      [result.lastInsertId]
    );
    const newItem = rows[0];
    set((state) => ({ items: [newItem, ...state.items] }));
    return newItem;
  },

  update: async (id, content) => {
    const db = await getDb();
    await db.execute(`UPDATE inspirations SET content = ? WHERE id = ?`, [content, id]);
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, content } : i)),
    }));
  },

  remove: async (id) => {
    const db = await getDb();
    await db.execute(`DELETE FROM inspirations WHERE id = ?`, [id]);
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },
}));
