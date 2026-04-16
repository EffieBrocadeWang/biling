import { create } from "zustand";
import { getDb, generateId } from "../lib/db";
import type { Foreshadowing } from "../types";

interface ForeshadowingStore {
  items: Foreshadowing[];
  loading: boolean;
  load: (bookId: string) => Promise<void>;
  add: (bookId: string, description: string, plantedChapterId: string | null) => Promise<Foreshadowing>;
  update: (id: string, fields: Partial<Pick<Foreshadowing, "description" | "notes" | "status" | "resolved_chapter_id">>) => Promise<void>;
  resolve: (id: string, chapterId: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useForeshadowingStore = create<ForeshadowingStore>((set) => ({
  items: [],
  loading: false,

  load: async (bookId) => {
    set({ loading: true });
    const db = await getDb();
    const items = await db.select<Foreshadowing[]>(
      "SELECT * FROM foreshadowing WHERE book_id = ? ORDER BY status ASC, created_at DESC",
      [bookId]
    );
    set({ items, loading: false });
  },

  add: async (bookId, description, plantedChapterId) => {
    const db = await getDb();
    const id = generateId();
    await db.execute(
      "INSERT INTO foreshadowing (id, book_id, description, planted_chapter_id) VALUES (?, ?, ?, ?)",
      [id, bookId, description, plantedChapterId]
    );
    const rows = await db.select<Foreshadowing[]>(
      "SELECT * FROM foreshadowing WHERE id = ?",
      [id]
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

  resolve: async (id, chapterId) => {
    const db = await getDb();
    await db.execute(
      "UPDATE foreshadowing SET status = 'resolved', resolved_chapter_id = ?, updated_at = datetime('now') WHERE id = ?",
      [chapterId, id]
    );
    set((state) => ({
      items: state.items.map((f) =>
        f.id === id ? { ...f, status: "resolved", resolved_chapter_id: chapterId } : f
      ),
    }));
  },

  remove: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM foreshadowing WHERE id = ?", [id]);
    set((state) => ({ items: state.items.filter((f) => f.id !== id) }));
  },
}));
