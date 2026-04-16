import { create } from "zustand";
import { getDb } from "../lib/db";
import type { Foreshadowing } from "../types";

interface ForeshadowingStore {
  items: Foreshadowing[];
  loading: boolean;
  load: (projectId: number) => Promise<void>;
  add: (projectId: number, content: string, chapterId: number | null, chapterTitle: string) => Promise<Foreshadowing>;
  update: (id: number, fields: Partial<Pick<Foreshadowing, "content" | "note" | "status" | "resolved_chapter_id" | "resolved_chapter_title">>) => Promise<void>;
  resolve: (id: number, chapterId: number | null, chapterTitle: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useForeshadowingStore = create<ForeshadowingStore>((set) => ({
  items: [],
  loading: false,

  load: async (projectId) => {
    set({ loading: true });
    const db = await getDb();
    const items = await db.select<Foreshadowing[]>(
      "SELECT * FROM foreshadowing WHERE project_id = ? ORDER BY status ASC, created_at DESC",
      [projectId]
    );
    set({ items, loading: false });
  },

  add: async (projectId, content, chapterId, chapterTitle) => {
    const db = await getDb();
    const result = await db.execute(
      "INSERT INTO foreshadowing (project_id, content, chapter_id, chapter_title) VALUES (?, ?, ?, ?)",
      [projectId, content, chapterId, chapterTitle]
    );
    const rows = await db.select<Foreshadowing[]>(
      "SELECT * FROM foreshadowing WHERE id = ?",
      [result.lastInsertId]
    );
    set((state) => ({ items: [rows[0], ...state.items] }));
    return rows[0];
  },

  update: async (id, fields) => {
    const db = await getDb();
    const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
    await db.execute(
      `UPDATE foreshadowing SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
      [...Object.values(fields), id]
    );
    set((state) => ({
      items: state.items.map((f) => f.id === id ? { ...f, ...fields } : f),
    }));
  },

  resolve: async (id, chapterId, chapterTitle) => {
    const db = await getDb();
    await db.execute(
      "UPDATE foreshadowing SET status = 'resolved', resolved_chapter_id = ?, resolved_chapter_title = ?, updated_at = datetime('now') WHERE id = ?",
      [chapterId, chapterTitle, id]
    );
    set((state) => ({
      items: state.items.map((f) =>
        f.id === id ? { ...f, status: "resolved", resolved_chapter_id: chapterId, resolved_chapter_title: chapterTitle } : f
      ),
    }));
  },

  remove: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM foreshadowing WHERE id = ?", [id]);
    set((state) => ({ items: state.items.filter((f) => f.id !== id) }));
  },
}));
