import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:biling.db");
  await initSchema(_db);
  return _db;
}

async function createTables(db: Database) {
  // ── Schema version tracking ──────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    )
  `);

  // ── Books (was: projects) ────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '',
      synopsis TEXT NOT NULL DEFAULT '',
      arc_summary TEXT NOT NULL DEFAULT '',
      writing_rules TEXT NOT NULL DEFAULT '',
      word_count_goal INTEGER NOT NULL DEFAULT 0,
      daily_word_goal INTEGER NOT NULL DEFAULT 3000,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Volumes ──────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Chapters ─────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      volume_id TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      summary TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','writing','review','done','published')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Chapter snapshots (was: snapshots) ───────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chapter_snapshots (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Codex entities (was: codex_entries) ──────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS codex_entities (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'character' CHECK (type IN ('character','faction','location','item','rule','event','custom')),
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      ai_instructions TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      properties TEXT NOT NULL DEFAULT '{}',
      avatar_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_codex_book ON codex_entities(book_id, type)
  `);

  // ── Foreshadowing ────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS foreshadowing (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      planted_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planted',
      resolved_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_foreshadowing_book ON foreshadowing(book_id, status)
  `);

  // ── Writing stats (was: daily_stats) ─────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS writing_stats (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      words_written INTEGER NOT NULL DEFAULT 0,
      words_ai_generated INTEGER NOT NULL DEFAULT 0,
      time_spent_minutes INTEGER NOT NULL DEFAULT 0,
      chapters_completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE(book_id, date)
    )
  `);

  // ── Settings ─────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Outline nodes ────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS outline_nodes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES outline_nodes(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      linked_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_outline_book ON outline_nodes(book_id, level)
  `);

  // ── Inspirations ─────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inspirations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      linked_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      linked_entity_id TEXT REFERENCES codex_entities(id) ON DELETE SET NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_inspirations_book ON inspirations(book_id, created_at)
  `);

  // ── New tables ───────────────────────────────────────────────────────────

  await db.execute(`
    CREATE TABLE IF NOT EXISTS codex_relationships (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      entity_a_id TEXT NOT NULL REFERENCES codex_entities(id) ON DELETE CASCADE,
      entity_b_id TEXT NOT NULL REFERENCES codex_entities(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      description TEXT,
      chapter_introduced TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      UNIQUE (entity_a_id, entity_b_id, relationship_type)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS codex_mentions (
      entity_id TEXT NOT NULL REFERENCES codex_entities(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      mention_count INTEGER DEFAULT 0,
      first_position INTEGER,
      last_position INTEGER,
      manually_linked INTEGER DEFAULT 0,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (chapter_id, entity_id)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      title TEXT,
      model_provider TEXT,
      model_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      token_count INTEGER,
      cost_estimate REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS aigc_tracking (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      paragraph_index INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'ai', 'ai_edited')),
      model_used TEXT,
      original_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS project_docs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL CHECK (doc_type IN ('writing_rules','style_guide','canon_log','relationship_map','plot_threads','reference_notes','writing_log','custom')),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      ai_injection TEXT NOT NULL DEFAULT 'none' CHECK (ai_injection IN ('always','contextual','manual','none')),
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sensitive_words (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      word TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('block','warn','info')),
      platform TEXT DEFAULT 'all',
      suggestion TEXT,
      is_builtin INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Writing packs ────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS writing_packs (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      version      TEXT NOT NULL,
      author       TEXT,
      description  TEXT,
      genre        TEXT,
      icon         TEXT,
      manifest     TEXT NOT NULL,
      installed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS writing_pack_items (
      id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      pack_id    TEXT NOT NULL REFERENCES writing_packs(id) ON DELETE CASCADE,
      category   TEXT NOT NULL CHECK (category IN ('template','material','inspiration','writing_rule','reference')),
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      metadata   TEXT DEFAULT '{}',
      sort_order INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_pack_items ON writing_pack_items(pack_id, category, sort_order)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      api_key_ref TEXT,
      base_url TEXT,
      default_model TEXT NOT NULL,
      api_type TEXT NOT NULL DEFAULT 'openai' CHECK (api_type IN ('openai','anthropic','ollama','remote')),
      is_active INTEGER NOT NULL DEFAULT 1,
      max_context INTEGER DEFAULT 32000,
      temperature REAL DEFAULT 0.7,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Migration: rename old tables if they exist ───────────────────────────
  await migrateOldTables(db);
}

async function initSchema(db: Database) {
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
  await createTables(db);
}

async function tableExists(db: Database, name: string): Promise<boolean> {
  const rows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?",
    [name]
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

async function columnExists(db: Database, table: string, column: string): Promise<boolean> {
  const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

async function migrateOldTables(db: Database) {
  // Use ALTER TABLE RENAME COLUMN to fix old project_id → book_id columns in-place.
  // This works without disabling FK constraints and is safe on SQLite 3.25+.

  // volumes: project_id → book_id
  if (await tableExists(db, "volumes") && await columnExists(db, "volumes", "project_id")) {
    await db.execute(`ALTER TABLE volumes RENAME COLUMN project_id TO book_id`);
  }

  // chapters: project_id → book_id
  if (await tableExists(db, "chapters") && await columnExists(db, "chapters", "project_id")) {
    await db.execute(`ALTER TABLE chapters RENAME COLUMN project_id TO book_id`);
  }

  // foreshadowing: project_id → book_id, content → description, note → notes
  if (await tableExists(db, "foreshadowing")) {
    if (await columnExists(db, "foreshadowing", "project_id"))
      await db.execute(`ALTER TABLE foreshadowing RENAME COLUMN project_id TO book_id`);
    if (await columnExists(db, "foreshadowing", "content"))
      await db.execute(`ALTER TABLE foreshadowing RENAME COLUMN content TO description`);
    if (await columnExists(db, "foreshadowing", "note"))
      await db.execute(`ALTER TABLE foreshadowing RENAME COLUMN note TO notes`);
  }

  // inspirations: project_id → book_id
  if (await tableExists(db, "inspirations") && await columnExists(db, "inspirations", "project_id")) {
    await db.execute(`ALTER TABLE inspirations RENAME COLUMN project_id TO book_id`);
  }

  // outline_nodes: project_id → book_id
  if (await tableExists(db, "outline_nodes") && await columnExists(db, "outline_nodes", "project_id")) {
    await db.execute(`ALTER TABLE outline_nodes RENAME COLUMN project_id TO book_id`);
  }

  // projects → books: copy data if projects table still exists
  if (await tableExists(db, "projects") && !(await tableExists(db, "_migrated_projects"))) {
    try {
      await db.execute(`
        INSERT OR IGNORE INTO books (id, title, genre, synopsis, created_at, updated_at)
        SELECT CAST(id AS TEXT), COALESCE(name, title, ''), COALESCE(genre, ''),
               COALESCE(synopsis, ''), created_at, updated_at FROM projects
      `);
      await db.execute(`ALTER TABLE projects RENAME TO _migrated_projects`);
    } catch { /* ignore */ }
  }

  // snapshots → chapter_snapshots
  if (await tableExists(db, "snapshots") && !(await tableExists(db, "_migrated_snapshots"))) {
    try {
      await db.execute(`
        INSERT OR IGNORE INTO chapter_snapshots (id, chapter_id, content, word_count, created_at)
        SELECT CAST(id AS TEXT), CAST(chapter_id AS TEXT), content, word_count, created_at FROM snapshots
      `);
      await db.execute(`ALTER TABLE snapshots RENAME TO _migrated_snapshots`);
    } catch { /* ignore */ }
  }

  // codex_entries → codex_entities
  if (await tableExists(db, "codex_entries") && !(await tableExists(db, "_migrated_codex_entries"))) {
    try {
      await db.execute(`
        INSERT OR IGNORE INTO codex_entities (id, book_id, type, name, aliases, description, ai_instructions, tags, created_at, updated_at)
        SELECT CAST(id AS TEXT), CAST(project_id AS TEXT), type, name, '[]',
               COALESCE(description, ''), COALESCE(ai_instructions, ''), COALESCE(tags, ''),
               created_at, updated_at FROM codex_entries
      `);
      await db.execute(`ALTER TABLE codex_entries RENAME TO _migrated_codex_entries`);
    } catch { /* ignore */ }
  }

  // daily_stats → writing_stats
  if (await tableExists(db, "daily_stats") && !(await tableExists(db, "_migrated_daily_stats"))) {
    try {
      await db.execute(`
        INSERT OR IGNORE INTO writing_stats (book_id, date, words_written)
        SELECT CAST(project_id AS TEXT), date, words_written FROM daily_stats
      `);
      await db.execute(`ALTER TABLE daily_stats RENAME TO _migrated_daily_stats`);
    } catch { /* ignore */ }
  }
}
