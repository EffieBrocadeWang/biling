import { create } from "zustand";
import { getDb } from "../lib/db";
import type { Project } from "../types";

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  loadProjects: () => Promise<void>;
  createProject: (name: string, genre: string, synopsis: string) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const db = await getDb();
    const projects = await db.select<Project[]>(
      "SELECT id, name, genre, synopsis, word_count, created_at, updated_at FROM projects ORDER BY updated_at DESC"
    );
    set({ projects, loading: false });
  },

  createProject: async (name, genre, synopsis) => {
    const db = await getDb();
    const result = await db.execute(
      "INSERT INTO projects (name, genre, synopsis) VALUES (?, ?, ?)",
      [name, genre, synopsis]
    );
    const project = await db.select<Project[]>(
      "SELECT * FROM projects WHERE id = ?",
      [result.lastInsertId]
    );
    set((state) => ({ projects: [project[0], ...state.projects] }));

    // Create a default volume
    await db.execute(
      "INSERT INTO volumes (project_id, title, sort_order) VALUES (?, ?, 0)",
      [result.lastInsertId, "第一卷"]
    );

    return project[0];
  },

  deleteProject: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM projects WHERE id = ?", [id]);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },
}));
