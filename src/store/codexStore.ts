import { create } from "zustand";
import { getDb } from "../lib/db";
import type { CodexEntry, CodexType } from "../types";

interface CodexStore {
  entries: CodexEntry[];
  loading: boolean;
  loadEntries: (projectId: number) => Promise<void>;
  createEntry: (projectId: number, type: CodexType, name: string) => Promise<CodexEntry>;
  updateEntry: (id: number, fields: Partial<Omit<CodexEntry, "id" | "project_id" | "created_at" | "updated_at">>) => Promise<void>;
  deleteEntry: (id: number) => Promise<void>;
}

export const useCodexStore = create<CodexStore>((set) => ({
  entries: [],
  loading: false,

  loadEntries: async (projectId) => {
    set({ loading: true });
    const db = await getDb();
    const entries = await db.select<CodexEntry[]>(
      "SELECT * FROM codex_entries WHERE project_id = ? ORDER BY type, name",
      [projectId]
    );
    set({ entries, loading: false });
  },

  createEntry: async (projectId, type, name) => {
    const db = await getDb();
    const result = await db.execute(
      "INSERT INTO codex_entries (project_id, type, name) VALUES (?, ?, ?)",
      [projectId, type, name]
    );
    const rows = await db.select<CodexEntry[]>(
      "SELECT * FROM codex_entries WHERE id = ?",
      [result.lastInsertId]
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
      `UPDATE codex_entries SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
      values
    );
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...fields } : e)),
    }));
  },

  deleteEntry: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM codex_entries WHERE id = ?", [id]);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },
}));
