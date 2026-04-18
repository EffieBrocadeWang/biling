import { create } from "zustand";
import { getDb, generateId } from "../lib/db";
import type { Volume, Chapter, ChapterSnapshot } from "../types";

interface EditorStore {
  projectId: string | null;
  volumes: Volume[];
  chapters: Chapter[];
  activeChapterId: string | null;
  activeChapter: Chapter | null;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;

  loadProjectData: (projectId: string) => Promise<void>;
  setActiveChapter: (chapterId: string) => Promise<void>;
  createChapter: (volumeId: string, title?: string) => Promise<string>; // returns new chapter id
  createVolume: (projectId: string) => Promise<void>;
  saveChapter: (chapterId: string, content: string, wordCount: number) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  renameChapter: (chapterId: string, title: string) => Promise<void>;
  renameVolume: (volumeId: string, title: string) => Promise<void>;
  saveSummary: (chapterId: string, summary: string) => Promise<void>;
  reorderChapters: (volumeId: string, orderedIds: string[]) => Promise<void>;
  moveChapterToVolume: (chapterId: string, targetVolumeId: string, insertAtIndex?: number) => Promise<void>;
  setChapterStatus: (chapterId: string, status: Chapter["status"]) => Promise<void>;
  createSnapshot: (chapterId: string, content: string, wordCount: number) => Promise<void>;
  loadSnapshots: (chapterId: string) => Promise<ChapterSnapshot[]>;
  restoreSnapshot: (chapterId: string, snapshot: ChapterSnapshot) => Promise<void>;
  applyChapterSortOrder: (items: { id: string; volumeId: string; sortOrder: number }[]) => Promise<void>;
  toggleSidebar: () => void;
  toggleAiPanel: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  projectId: null,
  volumes: [],
  chapters: [],
  activeChapterId: null,
  activeChapter: null,
  sidebarOpen: true,
  aiPanelOpen: true,

  loadProjectData: async (projectId) => {
    const db = await getDb();
    const volumes = await db.select<Volume[]>(
      "SELECT * FROM volumes WHERE book_id = ? ORDER BY sort_order",
      [projectId]
    );
    const chapters = await db.select<Chapter[]>(
      `SELECT c.* FROM chapters c
       JOIN volumes v ON c.volume_id = v.id
       WHERE v.book_id = ?
       ORDER BY v.sort_order, c.sort_order`,
      [projectId]
    );
    set({ projectId, volumes, chapters, activeChapterId: null, activeChapter: null });
  },

  setActiveChapter: async (chapterId) => {
    const db = await getDb();
    const rows = await db.select<Chapter[]>(
      "SELECT * FROM chapters WHERE id = ?",
      [chapterId]
    );
    if (rows.length > 0) {
      set({ activeChapterId: chapterId, activeChapter: rows[0] });
    }
  },

  createChapter: async (volumeId, title = "") => {
    const db = await getDb();
    const { chapters, projectId } = get();
    const existing = chapters.filter((c) => c.volume_id === volumeId);
    const sortOrder = existing.length;
    const id = generateId();
    await db.execute(
      "INSERT INTO chapters (id, book_id, volume_id, title, content, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [id, projectId, volumeId, title, JSON.stringify({ type: "doc", content: [] }), sortOrder]
    );
    const rows = await db.select<Chapter[]>(
      "SELECT * FROM chapters WHERE id = ?",
      [id]
    );
    if (rows.length > 0) {
      set((state) => ({ chapters: [...state.chapters, rows[0]] }));
      get().setActiveChapter(rows[0].id);
    }
    return id;
  },

  createVolume: async (projectId) => {
    const db = await getDb();
    const existing = get().volumes;
    const sortOrder = existing.length;
    const title = `第 ${sortOrder + 1} 卷`;
    const id = generateId();
    await db.execute(
      "INSERT INTO volumes (id, book_id, title, sort_order) VALUES (?, ?, ?, ?)",
      [id, projectId, title, sortOrder]
    );
    const rows = await db.select<Volume[]>(
      "SELECT * FROM volumes WHERE id = ?",
      [id]
    );
    if (rows.length > 0) {
      set((state) => ({ volumes: [...state.volumes, rows[0]] }));
    }
  },

  saveChapter: async (chapterId, content, wordCount) => {
    const db = await getDb();
    // Get old word count to compute delta
    const old = get().chapters.find((c) => c.id === chapterId);
    const delta = wordCount - (old?.word_count ?? 0);

    await db.execute(
      "UPDATE chapters SET content = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?",
      [content, wordCount, chapterId]
    );

    // Track writing stats (only count increases)
    const { projectId } = get();
    if (projectId && delta > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const statId = generateId();
      await db.execute(
        `INSERT INTO writing_stats (id, book_id, date, words_written)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(book_id, date)
         DO UPDATE SET words_written = words_written + excluded.words_written`,
        [statId, projectId, today, delta]
      );
    }

    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId ? { ...c, content, word_count: wordCount } : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? { ...state.activeChapter, content, word_count: wordCount }
          : state.activeChapter,
    }));
  },

  deleteChapter: async (chapterId) => {
    const db = await getDb();
    await db.execute("DELETE FROM chapters WHERE id = ?", [chapterId]);
    const { activeChapterId, chapters } = get();
    const remaining = chapters.filter((c) => c.id !== chapterId);
    set({ chapters: remaining });
    if (activeChapterId === chapterId) {
      set({ activeChapterId: null, activeChapter: null });
    }
  },

  renameChapter: async (chapterId, title) => {
    const db = await getDb();
    await db.execute("UPDATE chapters SET title = ? WHERE id = ?", [title, chapterId]);
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId ? { ...c, title } : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? { ...state.activeChapter, title }
          : state.activeChapter,
    }));
  },

  renameVolume: async (volumeId, title) => {
    const db = await getDb();
    await db.execute("UPDATE volumes SET title = ? WHERE id = ?", [title, volumeId]);
    set((state) => ({
      volumes: state.volumes.map((v) =>
        v.id === volumeId ? { ...v, title } : v
      ),
    }));
  },

  createSnapshot: async (chapterId, content, wordCount) => {
    const db = await getDb();
    const id = generateId();
    await db.execute(
      "INSERT INTO chapter_snapshots (id, chapter_id, content, word_count) VALUES (?, ?, ?, ?)",
      [id, chapterId, content, wordCount]
    );
    // Keep only the 20 most recent snapshots per chapter
    await db.execute(
      `DELETE FROM chapter_snapshots WHERE chapter_id = ? AND id NOT IN (
         SELECT id FROM chapter_snapshots WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 20
       )`,
      [chapterId, chapterId]
    );
  },

  loadSnapshots: async (chapterId) => {
    const db = await getDb();
    return db.select<ChapterSnapshot[]>(
      "SELECT * FROM chapter_snapshots WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 20",
      [chapterId]
    );
  },

  restoreSnapshot: async (chapterId, snapshot) => {
    const db = await getDb();
    await db.execute(
      "UPDATE chapters SET content = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?",
      [snapshot.content, snapshot.word_count, chapterId]
    );
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId
          ? { ...c, content: snapshot.content, word_count: snapshot.word_count }
          : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? { ...state.activeChapter, content: snapshot.content, word_count: snapshot.word_count }
          : state.activeChapter,
    }));
  },

  saveSummary: async (chapterId, summary) => {
    const db = await getDb();
    await db.execute("UPDATE chapters SET summary = ? WHERE id = ?", [summary, chapterId]);
    set((state) => ({
      chapters: state.chapters.map((c) => c.id === chapterId ? { ...c, summary } : c),
      activeChapter: state.activeChapter?.id === chapterId
        ? { ...state.activeChapter, summary }
        : state.activeChapter,
    }));
  },

  reorderChapters: async (volumeId, orderedIds) => {
    const db = await getDb();
    await Promise.all(
      orderedIds.map((id, index) =>
        db.execute("UPDATE chapters SET sort_order = ? WHERE id = ?", [index, id])
      )
    );
    set((state) => {
      const others = state.chapters.filter((c) => c.volume_id !== volumeId);
      const reordered = orderedIds
        .map((id) => state.chapters.find((c) => c.id === id)!)
        .filter(Boolean)
        .map((c, i) => ({ ...c, sort_order: i }));
      return {
        chapters: [...others, ...reordered].sort((a, b) => {
          if (a.volume_id !== b.volume_id) return a.volume_id < b.volume_id ? -1 : 1;
          return a.sort_order - b.sort_order;
        }),
      };
    });
  },

  moveChapterToVolume: async (chapterId, targetVolumeId, insertAtIndex) => {
    const db = await getDb();
    const { chapters } = get();
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter || chapter.volume_id === targetVolumeId) return;

    const sourceVolumeId = chapter.volume_id;

    // Compute new source order (without moved chapter)
    const srcChapters = chapters
      .filter(c => c.volume_id === sourceVolumeId && c.id !== chapterId)
      .sort((a, b) => a.sort_order - b.sort_order);

    // Compute new target order (with moved chapter inserted)
    const tgtChapters = chapters
      .filter(c => c.volume_id === targetVolumeId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const insertAt = insertAtIndex !== undefined
      ? Math.max(0, Math.min(insertAtIndex, tgtChapters.length))
      : tgtChapters.length;
    const newTgtChapters = [
      ...tgtChapters.slice(0, insertAt),
      chapter,
      ...tgtChapters.slice(insertAt),
    ];

    // Apply DB updates
    await db.execute("UPDATE chapters SET volume_id = ? WHERE id = ?", [targetVolumeId, chapterId]);
    await Promise.all([
      ...srcChapters.map((c, i) => db.execute("UPDATE chapters SET sort_order = ? WHERE id = ?", [i, c.id])),
      ...newTgtChapters.map((c, i) => db.execute("UPDATE chapters SET sort_order = ? WHERE id = ?", [i, c.id])),
    ]);

    // Build update map: id → { volume_id, sort_order }
    const updateMap = new Map<string, { volume_id: string; sort_order: number }>();
    srcChapters.forEach((c, i) => updateMap.set(c.id, { volume_id: sourceVolumeId, sort_order: i }));
    newTgtChapters.forEach((c, i) => updateMap.set(c.id, { volume_id: targetVolumeId, sort_order: i }));

    set(state => ({
      chapters: state.chapters.map(c => {
        const upd = updateMap.get(c.id);
        return upd ? { ...c, ...upd } : c;
      }),
    }));
  },

  applyChapterSortOrder: async (items) => {
    const db = await getDb();
    await Promise.all(
      items.map((item) =>
        db.execute(
          "UPDATE chapters SET volume_id = ?, sort_order = ? WHERE id = ?",
          [item.volumeId, item.sortOrder, item.id]
        )
      )
    );
    set((state) => ({
      chapters: state.chapters.map((c) => {
        const item = items.find((i) => i.id === c.id);
        return item ? { ...c, volume_id: item.volumeId, sort_order: item.sortOrder } : c;
      }),
    }));
  },

  setChapterStatus: async (chapterId, status) => {
    const db = await getDb();
    await db.execute("UPDATE chapters SET status = ? WHERE id = ?", [status, chapterId]);
    set((state) => ({
      chapters: state.chapters.map((c) =>
        c.id === chapterId ? { ...c, status } : c
      ),
      activeChapter:
        state.activeChapter?.id === chapterId
          ? { ...state.activeChapter, status }
          : state.activeChapter,
    }));
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
}));
