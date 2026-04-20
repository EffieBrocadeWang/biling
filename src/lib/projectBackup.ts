import { save, open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { getDb, generateId } from "./db";

export const BACKUP_SCHEMA_VERSION = 1;

export interface ProjectBackupMeta {
  schema_version: number;
  export_time: string;
  app_version: string;
  book_title: string;
  book_genre: string;
  chapter_count: number;
  word_count: number;
}

export interface ProjectBackupData {
  meta: ProjectBackupMeta;
  book: Record<string, unknown>;
  volumes: Record<string, unknown>[];
  chapters: Record<string, unknown>[];
  chapter_snapshots: Record<string, unknown>[];
  outline_nodes: Record<string, unknown>[];
  codex_entities: Record<string, unknown>[];
  codex_relationships: Record<string, unknown>[];
  foreshadowing: Record<string, unknown>[];
  inspirations: Record<string, unknown>[];
  project_docs: Record<string, unknown>[];
  writing_stats: Record<string, unknown>[];
}

export async function exportProjectBackup(bookId: string): Promise<string | null> {
  const db = await getDb();

  const books = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM books WHERE id = ?", [bookId]
  );
  if (books.length === 0) throw new Error("Book not found");
  const book = books[0];

  const [
    volumes, chapters, snapshots, outlineNodes,
    codexEntities, codexRels, foreshadowing, inspirations,
    projectDocs, writingStats,
  ] = await Promise.all([
    db.select<Record<string, unknown>[]>("SELECT * FROM volumes WHERE book_id = ? ORDER BY sort_order", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM chapters WHERE book_id = ? ORDER BY sort_order", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT cs.* FROM chapter_snapshots cs JOIN chapters ch ON cs.chapter_id = ch.id WHERE ch.book_id = ?", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM outline_nodes WHERE book_id = ? ORDER BY level, sort_order", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM codex_entities WHERE book_id = ?", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT cr.* FROM codex_relationships cr JOIN codex_entities ce ON cr.entity_a_id = ce.id WHERE ce.book_id = ?", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM foreshadowing WHERE book_id = ?", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM inspirations WHERE book_id = ?", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM project_docs WHERE book_id = ? ORDER BY sort_order", [bookId]),
    db.select<Record<string, unknown>[]>("SELECT * FROM writing_stats WHERE book_id = ?", [bookId]),
  ]);

  const totalWordCount = (chapters as { word_count?: number }[]).reduce((s, c) => s + (c.word_count ?? 0), 0);

  const data: ProjectBackupData = {
    meta: {
      schema_version: BACKUP_SCHEMA_VERSION,
      export_time: new Date().toISOString(),
      app_version: "1.0.0",
      book_title: String(book.title ?? ""),
      book_genre: String(book.genre ?? ""),
      chapter_count: chapters.length,
      word_count: totalWordCount,
    },
    book,
    volumes,
    chapters,
    chapter_snapshots: snapshots,
    outline_nodes: outlineNodes,
    codex_entities: codexEntities,
    codex_relationships: codexRels,
    foreshadowing,
    inspirations,
    project_docs: projectDocs,
    writing_stats: writingStats,
  };

  const json = JSON.stringify(data, null, 2);
  const compressed = zipSync({ "backup.json": strToU8(json) }, { level: 6 });

  const defaultName = `${String(book.title ?? "project")}.biling-project`;
  const filePath = await save({
    defaultPath: defaultName,
    filters: [
      { name: "笔灵项目文件", extensions: ["biling-project"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (!filePath) return null;

  await writeFile(filePath, compressed);
  return filePath;
}

export interface BackupPreview {
  meta: ProjectBackupMeta;
  filePath: string;
}

export async function pickBackupFile(): Promise<BackupPreview | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: "笔灵项目文件", extensions: ["biling-project"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (!selected) return null;
  const filePath = typeof selected === "string" ? selected : (selected as string);

  const bytes = await readFile(filePath);
  const unzipped = unzipSync(bytes);
  const jsonBytes = unzipped["backup.json"];
  if (!jsonBytes) throw new Error("无效的备份文件：缺少 backup.json");

  const data: ProjectBackupData = JSON.parse(strFromU8(jsonBytes));
  if (!data.meta) throw new Error("无效的备份文件：缺少 meta 信息");

  return { meta: data.meta, filePath };
}

export async function importProjectBackup(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const unzipped = unzipSync(bytes);
  const jsonBytes = unzipped["backup.json"];
  if (!jsonBytes) throw new Error("无效的备份文件");

  const data: ProjectBackupData = JSON.parse(strFromU8(jsonBytes));
  const db = await getDb();

  // Assign a new book ID to avoid conflicts with existing data
  const newBookId = generateId();


  // Build ID remapping maps for all entities (to avoid PK conflicts)
  const volumeIdMap = new Map<string, string>();
  const chapterIdMap = new Map<string, string>();
  const outlineIdMap = new Map<string, string>();
  const codexIdMap = new Map<string, string>();
  const snapshotIdMap = new Map<string, string>();

  data.volumes.forEach(v => volumeIdMap.set(String(v.id), generateId()));
  data.chapters.forEach(c => chapterIdMap.set(String(c.id), generateId()));
  data.outline_nodes.forEach(n => outlineIdMap.set(String(n.id), generateId()));
  data.codex_entities.forEach(e => codexIdMap.set(String(e.id), generateId()));
  data.chapter_snapshots.forEach(s => snapshotIdMap.set(String(s.id), generateId()));

  await db.execute("BEGIN TRANSACTION");
  try {
    // Insert book with new ID
    await db.execute(
      `INSERT INTO books (id, title, author, genre, synopsis, arc_summary, writing_rules, word_count_goal, daily_word_goal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newBookId,
        data.book.title ?? "",
        data.book.author ?? "",
        data.book.genre ?? "",
        data.book.synopsis ?? "",
        data.book.arc_summary ?? "",
        data.book.writing_rules ?? "",
        data.book.word_count_goal ?? 0,
        data.book.daily_word_goal ?? 3000,
        data.book.created_at ?? new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // Insert volumes
    for (const v of data.volumes) {
      const newId = volumeIdMap.get(String(v.id))!;
      await db.execute(
        `INSERT INTO volumes (id, book_id, title, summary, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, newBookId, v.title ?? "", v.summary ?? "", v.sort_order ?? 0, v.updated_at ?? new Date().toISOString()]
      );
    }

    // Insert chapters
    for (const c of data.chapters) {
      const newId = chapterIdMap.get(String(c.id))!;
      const newVolumeId = volumeIdMap.get(String(c.volume_id)) ?? String(c.volume_id);
      await db.execute(
        `INSERT INTO chapters (id, book_id, volume_id, title, content, summary, word_count, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId, newBookId, newVolumeId,
          c.title ?? "", c.content ?? "{}", c.summary ?? "",
          c.word_count ?? 0, c.status ?? "draft",
          c.sort_order ?? 0,
          c.created_at ?? new Date().toISOString(),
          c.updated_at ?? new Date().toISOString(),
        ]
      );
    }

    // Insert chapter snapshots
    for (const s of data.chapter_snapshots) {
      const newId = snapshotIdMap.get(String(s.id))!;
      const newChapterId = chapterIdMap.get(String(s.chapter_id));
      if (!newChapterId) continue;
      await db.execute(
        `INSERT INTO chapter_snapshots (id, chapter_id, content, word_count, label, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, newChapterId, s.content ?? "", s.word_count ?? 0, s.label ?? null, s.created_at ?? new Date().toISOString()]
      );
    }

    // Insert outline nodes — must respect parent_id order (roots first)
    const sortedNodes = [...data.outline_nodes].sort((a, b) => (Number(a.level) || 1) - (Number(b.level) || 1));
    for (const n of sortedNodes) {
      const newId = outlineIdMap.get(String(n.id))!;
      const newParentId = n.parent_id ? (outlineIdMap.get(String(n.parent_id)) ?? null) : null;
      const newLinkedChapterId = n.linked_chapter_id ? (chapterIdMap.get(String(n.linked_chapter_id)) ?? null) : null;
      await db.execute(
        `INSERT INTO outline_nodes (id, book_id, parent_id, title, content, level, linked_chapter_id, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId, newBookId, newParentId,
          n.title ?? "", n.content ?? "",
          n.level ?? 1, newLinkedChapterId,
          n.sort_order ?? 0,
          n.created_at ?? new Date().toISOString(),
        ]
      );
    }

    // Insert codex entities
    for (const e of data.codex_entities) {
      const newId = codexIdMap.get(String(e.id))!;
      await db.execute(
        `INSERT INTO codex_entities (id, book_id, type, name, aliases, description, ai_instructions, tags, properties, avatar_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId, newBookId, e.type ?? "custom",
          e.name ?? "", e.aliases ?? "[]", e.description ?? "",
          e.ai_instructions ?? "", e.tags ?? "", e.properties ?? "{}",
          null,
          e.created_at ?? new Date().toISOString(),
          e.updated_at ?? new Date().toISOString(),
        ]
      );
    }

    // Insert codex relationships
    for (const r of data.codex_relationships) {
      const newId = generateId();
      const newA = codexIdMap.get(String(r.entity_a_id));
      const newB = codexIdMap.get(String(r.entity_b_id));
      if (!newA || !newB) continue;
      const newChapter = r.chapter_introduced ? (chapterIdMap.get(String(r.chapter_introduced)) ?? null) : null;
      await db.execute(
        `INSERT OR IGNORE INTO codex_relationships (id, book_id, entity_a_id, entity_b_id, relationship_type, description, chapter_introduced)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, newBookId, newA, newB, r.relationship_type ?? "", r.description ?? "", newChapter]
      );
    }

    // Insert foreshadowing
    for (const f of data.foreshadowing) {
      const newId = generateId();
      const newPlanted = f.planted_chapter_id ? (chapterIdMap.get(String(f.planted_chapter_id)) ?? null) : null;
      const newResolved = f.resolved_chapter_id ? (chapterIdMap.get(String(f.resolved_chapter_id)) ?? null) : null;
      await db.execute(
        `INSERT INTO foreshadowing (id, book_id, planted_chapter_id, description, notes, status, resolved_chapter_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId, newBookId, newPlanted,
          f.description ?? "", f.notes ?? "",
          f.status ?? "planted", newResolved,
          f.created_at ?? new Date().toISOString(),
          f.updated_at ?? new Date().toISOString(),
        ]
      );
    }

    // Insert inspirations
    for (const i of data.inspirations) {
      const newId = generateId();
      const newLinkedChapter = i.linked_chapter_id ? (chapterIdMap.get(String(i.linked_chapter_id)) ?? null) : null;
      const newLinkedEntity = i.linked_entity_id ? (codexIdMap.get(String(i.linked_entity_id)) ?? null) : null;
      await db.execute(
        `INSERT INTO inspirations (id, book_id, content, linked_chapter_id, linked_entity_id, is_used, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, newBookId, i.content ?? "", newLinkedChapter, newLinkedEntity, i.is_used ?? 0, i.created_at ?? new Date().toISOString()]
      );
    }

    // Insert project docs
    for (const d of data.project_docs) {
      const newId = generateId();
      await db.execute(
        `INSERT INTO project_docs (id, book_id, doc_type, title, content, ai_injection, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId, newBookId,
          d.doc_type ?? "custom", d.title ?? "", d.content ?? "",
          d.ai_injection ?? "none", d.sort_order ?? 0,
          d.created_at ?? new Date().toISOString(),
          d.updated_at ?? new Date().toISOString(),
        ]
      );
    }

    // Insert writing stats (skip duplicates)
    for (const s of data.writing_stats) {
      const newId = generateId();
      await db.execute(
        `INSERT OR IGNORE INTO writing_stats (id, book_id, date, words_written, words_ai_generated, time_spent_minutes, chapters_completed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, newBookId, s.date ?? "", s.words_written ?? 0, s.words_ai_generated ?? 0, s.time_spent_minutes ?? 0, s.chapters_completed ?? 0]
      );
    }

    await db.execute("COMMIT");
    return newBookId;
  } catch (err) {
    await db.execute("ROLLBACK");
    throw err;
  }
}
