import { create } from "zustand";
import { getDb, generateId } from "../lib/db";
import type { CodexEntity, CodexType } from "../types";

interface CodexStore {
  entries: CodexEntity[];
  loading: boolean;
  loadEntries: (bookId: string) => Promise<void>;
  createEntry: (bookId: string, type: CodexType, name: string) => Promise<CodexEntity>;
  updateEntry: (id: string, fields: Partial<Omit<CodexEntity, "id" | "book_id" | "created_at" | "updated_at">>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useCodexStore = create<CodexStore>((set) => ({
  entries: [],
  loading: false,

  loadEntries: async (bookId) => {
    set({ entries: [], loading: true });
    const db = await getDb();
    const entries = await db.select<CodexEntity[]>(
      "SELECT * FROM codex_entities WHERE book_id = ? ORDER BY type, name",
      [bookId]
    );
    set({ entries, loading: false });
  },

  createEntry: async (bookId, type, name) => {
    const db = await getDb();
    const id = generateId();
    await db.execute(
      "INSERT INTO codex_entities (id, book_id, type, name) VALUES (?, ?, ?, ?)",
      [id, bookId, type, name]
    );
    const rows = await db.select<CodexEntity[]>(
      "SELECT * FROM codex_entities WHERE id = ?",
      [id]
    );
    set((state) => ({ entries: [...state.entries, rows[0]] }));
    return rows[0];
  },

  updateEntry: async (id, fields) => {
    const db = await getDb();
    const sets = Object.keys(fields)
      .map((k) => `${k} = ?`)
      .join(", ");
    const values = [...Object.values(fields), id];
    await db.execute(
      `UPDATE codex_entities SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
      values
    );
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...fields } : e)),
    }));
  },

  deleteEntry: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM codex_entities WHERE id = ?", [id]);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },
}));
