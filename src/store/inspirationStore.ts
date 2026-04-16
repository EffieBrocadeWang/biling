import { create } from "zustand";
import { getDb, generateId } from "../lib/db";
import type { Inspiration } from "../types";

interface InspirationStore {
  items: Inspiration[];
  bookId: string | null;

  load: (bookId: string) => Promise<void>;
  add: (
    bookId: string,
    content: string,
    opts?: {
      linkedChapterId?: string | null;
      linkedEntityId?: string | null;
    }
  ) => Promise<Inspiration>;
  update: (id: string, content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useInspirationStore = create<InspirationStore>((set) => ({
  items: [],
  bookId: null,

  load: async (bookId) => {
    const db = await getDb();
    const items = await db.select<Inspiration[]>(
      `SELECT * FROM inspirations WHERE book_id = ? ORDER BY created_at DESC`,
      [bookId]
    );
    set({ items, bookId });
  },

  add: async (bookId, content, opts = {}) => {
    const db = await getDb();
    const {
      linkedChapterId = null,
      linkedEntityId = null,
    } = opts;
    const id = generateId();
    await db.execute(
      `INSERT INTO inspirations (id, book_id, content, linked_chapter_id, linked_entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, bookId, content, linkedChapterId, linkedEntityId]
    );
    const rows = await db.select<Inspiration[]>(
      `SELECT * FROM inspirations WHERE id = ?`,
      [id]
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
