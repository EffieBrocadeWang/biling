import { create } from "zustand";
import { getDb, generateId } from "../lib/db";

export type DocType =
  | "story_synopsis"
  | "writing_rules"
  | "style_guide"
  | "canon_log"
  | "relationship_map"
  | "plot_threads"
  | "reference_notes"
  | "writing_log"
  | "custom";

export type AiInjection = "always" | "contextual" | "manual" | "none";

export interface ProjectDoc {
  id: string;
  book_id: string;
  doc_type: DocType;
  title: string;
  content: string;
  ai_injection: AiInjection;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  story_synopsis:   "故事梗概",
  writing_rules:    "写作铁律",
  style_guide:      "文笔风格指南",
  canon_log:        "已确定事实",
  relationship_map: "人物关系图",
  plot_threads:     "暗线规划",
  reference_notes:  "参考作品笔记",
  writing_log:      "写作日志",
  custom:           "自定义文档",
};

export const DOC_TYPE_ICONS: Record<DocType, string> = {
  story_synopsis:   "📖",
  writing_rules:    "📜",
  style_guide:      "✍️",
  canon_log:        "🔒",
  relationship_map: "🕸️",
  plot_threads:     "🧵",
  reference_notes:  "📚",
  writing_log:      "📔",
  custom:           "📄",
};

export const AI_INJECTION_LABELS: Record<AiInjection, string> = {
  always:      "每次注入",
  contextual:  "按需注入",
  manual:      "手动选择",
  none:        "不注入",
};

export const AI_INJECTION_COLORS: Record<AiInjection, string> = {
  always:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  contextual: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  manual:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  none:       "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

// Default template content for each doc type
export const DOC_TYPE_TEMPLATES: Record<DocType, string> = {
  story_synopsis: `# 故事梗概

## 核心故事
（描述主线故事）

## 主角
- 姓名：
- 起点：
- 目标：
- 核心矛盾：

## 关键转折
1.
2.
3.

## 结局方向
`,

  writing_rules: `# 写作铁律

## 文笔
1. 长短交替 — 不允许连续 3 句以上相同节奏
2. 对话辨识度 — 遮住名字能认出谁在说话
3.

## 情节
4. 每弧必须有反转名场面
5. 反派反应必须写 — 打脸后写崩溃/震惊
6.

## 禁忌
7. 不美化压迫
8. 不让主角为大局忍辱负重
9. `,

  style_guide: `# 文笔风格指南

## 整体风格
（描述你的目标文风）

## 句式偏好
- 节奏：
- 段落长度：
- 视角描写习惯：

## 参考范例
（粘贴你希望模仿的文字片段）

## 禁止的写法
- `,

  canon_log: `# 已确定事实

> 此文档记录正文中写定的不可更改的事实。AI 续写时不可违反。

## 人物
-

## 世界规则
-

## 剧情已发生
- `,

  relationship_map: `# 人物关系图

## 主角
- **姓名**：
- **身份**：

## 核心关系

| 角色A | 关系 | 角色B | 当前态度 | 变化趋势 |
|------|------|------|---------|---------|
|  |  |  |  |  |

## 关系变化记录
`,

  plot_threads: `# 暗线规划

## 长线伏笔

| 伏笔描述 | 埋下位置 | 计划回收 | 状态 |
|---------|---------|---------|------|
|  |  |  | 未回收 |

## 跨卷暗线
`,

  reference_notes: `# 参考作品笔记

## 参考作品
书名：

## 学习要点
1.

## 技法分析

## 不学的部分
`,

  writing_log: `# 写作日志

## 设定决策记录

### ${new Date().toLocaleDateString("zh-CN")}
-

## 重大修改记录
`,

  custom: ``,
};

interface ProjectDocsStore {
  docs: ProjectDoc[];
  loading: boolean;

  loadDocs: (bookId: string) => Promise<void>;
  ensureSynopsisDoc: (bookId: string, synopsis: string) => Promise<void>;
  createDoc: (
    bookId: string,
    docType: DocType,
    title: string,
    content: string,
    aiInjection: AiInjection
  ) => Promise<ProjectDoc>;
  updateDoc: (
    id: string,
    patch: Partial<Pick<ProjectDoc, "title" | "content" | "ai_injection">>
  ) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  reorderDoc: (id: string, direction: "up" | "down") => Promise<void>;
  getAlwaysDocs: () => ProjectDoc[];
}

export const useProjectDocsStore = create<ProjectDocsStore>((set, get) => ({
  docs: [],
  loading: false,

  loadDocs: async (bookId) => {
    set({ loading: true });
    try {
      const db = await getDb();
      const rows = await db.select<ProjectDoc[]>(
        "SELECT * FROM project_docs WHERE book_id = ? ORDER BY sort_order, created_at",
        [bookId]
      );
      set({ docs: rows });
    } finally {
      set({ loading: false });
    }
  },

  ensureSynopsisDoc: async (bookId, synopsis) => {
    if (!synopsis.trim()) return;
    const db = await getDb();
    const existing = await db.select<ProjectDoc[]>(
      "SELECT * FROM project_docs WHERE book_id = ? AND doc_type = 'story_synopsis' LIMIT 1",
      [bookId]
    );
    if (existing.length > 0) {
      if (!existing[0].content.trim()) {
        await db.execute(
          "UPDATE project_docs SET content = ?, updated_at = datetime('now') WHERE id = ?",
          [synopsis, existing[0].id]
        );
      }
    } else {
      const id = generateId();
      await db.execute(
        `INSERT INTO project_docs (id, book_id, doc_type, title, content, ai_injection, sort_order)
         VALUES (?, ?, 'story_synopsis', '故事梗概', ?, 'always', 0)`,
        [id, bookId, synopsis]
      );
    }
    // Reload store so UI reflects the change
    await get().loadDocs(bookId);
  },

  createDoc: async (bookId, docType, title, content, aiInjection) => {
    const db = await getDb();
    const id = generateId();
    const maxOrder = Math.max(0, ...get().docs.map(d => d.sort_order));
    await db.execute(
      `INSERT INTO project_docs (id, book_id, doc_type, title, content, ai_injection, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, bookId, docType, title, content, aiInjection, maxOrder + 1]
    );
    const rows = await db.select<ProjectDoc[]>(
      "SELECT * FROM project_docs WHERE id = ?", [id]
    );
    const newDoc = rows[0];
    set(state => ({ docs: [...state.docs, newDoc] }));
    return newDoc;
  },

  updateDoc: async (id, patch) => {
    const db = await getDb();
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (patch.title !== undefined)        { sets.push("title = ?");        vals.push(patch.title); }
    if (patch.content !== undefined)      { sets.push("content = ?");      vals.push(patch.content); }
    if (patch.ai_injection !== undefined) { sets.push("ai_injection = ?"); vals.push(patch.ai_injection); }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await db.execute(`UPDATE project_docs SET ${sets.join(", ")} WHERE id = ?`, vals);
    set(state => ({
      docs: state.docs.map(d => d.id === id ? { ...d, ...patch } : d),
    }));
  },

  deleteDoc: async (id) => {
    const db = await getDb();
    await db.execute("DELETE FROM project_docs WHERE id = ?", [id]);
    set(state => ({ docs: state.docs.filter(d => d.id !== id) }));
  },

  reorderDoc: async (id, direction) => {
    const docs = [...get().docs];
    const idx = docs.findIndex(d => d.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= docs.length) return;
    [docs[idx], docs[swapIdx]] = [docs[swapIdx], docs[idx]];
    const db = await getDb();
    await Promise.all(docs.map((d, i) =>
      db.execute("UPDATE project_docs SET sort_order = ? WHERE id = ?", [i, d.id])
    ));
    set({ docs: docs.map((d, i) => ({ ...d, sort_order: i })) });
  },

  getAlwaysDocs: () => get().docs.filter(d => d.ai_injection === "always"),
}));
