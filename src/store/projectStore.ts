import { create } from "zustand";
import { getDb, generateId } from "../lib/db";
import type { Book } from "../types";

interface ProjectStore {
  projects: Book[];
  loading: boolean;
  loadProjects: () => Promise<void>;
  createProject: (title: string, genre: string, synopsis: string) => Promise<Book>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const projects = await db.select<Book[]>(
        "SELECT id, title, author, genre, synopsis, arc_summary, writing_rules, word_count_goal, daily_word_goal, created_at, updated_at FROM books ORDER BY updated_at DESC"
      );
      set({ projects, loading: false });
    } catch (e) {
      console.error("loadProjects failed:", e);
      set({ loading: false });
    }
  },

  createProject: async (title, genre, synopsis) => {
    const db = await getDb();
    const id = generateId();
    await db.execute(
      "INSERT INTO books (id, title, genre, synopsis) VALUES (?, ?, ?, ?)",
      [id, title, genre, synopsis]
    );
    const project = await db.select<Book[]>(
      "SELECT * FROM books WHERE id = ?",
      [id]
    );
    set((state) => ({ projects: [project[0], ...state.projects] }));

    // Create a default volume
    const volumeId = generateId();
    await db.execute(
      "INSERT INTO volumes (id, book_id, title, sort_order) VALUES (?, ?, ?, 0)",
      [volumeId, id, "第一卷"]
    );

    return project[0];
  },

  deleteProject: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM books WHERE id = ?", [id]);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },
}));
