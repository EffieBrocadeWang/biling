import type { Chapter, CodexEntry } from "../types";
import { CODEX_TYPE_LABELS } from "../types";

const RECENT_CHARS = 2000;        // current chapter tail to inject (non-consistency modes)
const MAX_CODEX_ENTRIES = 8;
const MAX_CODEX_CONSISTENCY = 30; // more entries for consistency checking
const PREV_CHAPTER_SUMMARIES = 5; // how many preceding chapters' summaries to inject

// ── Text extraction ────────────────────────────────────────────────────────

export function docToText(content: string): string {
  try {
    return extractText(JSON.parse(content));
  } catch {
    return "";
  }
}

function extractText(node: { type?: string; text?: string; content?: object[] }): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.content) {
    return node.content
      .map((n) => extractText(n as typeof node))
      .join(node.type === "paragraph" ? "\n" : "");
  }
  return "";
}

// ── Codex relevance scoring ────────────────────────────────────────────────

function scoreEntry(entry: CodexEntry, text: string): number {
  const terms = [entry.name, ...entry.aliases.split(/[，,、\s]/).filter(Boolean)];
  return terms.reduce((score, term) => {
    if (!term) return score;
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) { count++; pos++; }
    return score + count * (term.length > 1 ? 2 : 1);
  }, 0);
}

export function selectRelevantEntries(entries: CodexEntry[], chapterText: string): CodexEntry[] {
  const scored = entries
    .map((e) => ({ entry: e, score: scoreEntry(e, chapterText) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CODEX_ENTRIES).map((s) => s.entry);
}

function formatEntry(e: CodexEntry): string {
  const lines = [`【${CODEX_TYPE_LABELS[e.type]}】${e.name}`];
  if (e.aliases) lines.push(`别名：${e.aliases}`);
  if (e.description) lines.push(e.description);
  if (e.ai_instructions) lines.push(`注意：${e.ai_instructions}`);
  return lines.join("\n");
}

// ── Summary generation prompt ──────────────────────────────────────────────

export function buildSummaryPrompt(chapter: Chapter): string {
  const text = docToText(chapter.content);
  return `请为以下小说章节生成一段简洁的情节摘要（150字以内）。

要求：
- 概括本章的主要事件、人物动向、情绪变化
- 记录重要的伏笔、冲突、转折点
- 语言简洁，避免废话
- 只输出摘要内容，不要加标题或前缀

【章节标题】${chapter.title}

【章节内容】
${text.slice(0, 4000)}`;
}

// ── Context assembly ───────────────────────────────────────────────────────

export interface AssembledContext {
  systemPrompt: string;
  recentText: string;
  injectedEntries: CodexEntry[];
  injectedSummaries: number;
}

// Modes where the user pastes their own text — skip injecting chapter content
const USER_PROVIDES_TEXT = new Set(["润色", "扩写", "缩写"]);

export function assembleContext(
  chapter: Chapter | null,
  allChapters: Chapter[],
  allEntries: CodexEntry[],
  mode: string,
  writingRules: string
): AssembledContext {
  const chapterText = chapter ? docToText(chapter.content) : "";
  const injectChapter = !USER_PROVIDES_TEXT.has(mode);
  const isConsistency = mode === "一致性";

  // Consistency mode: full chapter text; others: tail only
  const recentText = injectChapter
    ? isConsistency ? chapterText : chapterText.slice(-RECENT_CHARS)
    : "";

  // Consistency mode: inject all entries (grouped by type, capped); others: relevance-scored
  const injectedEntries = chapter
    ? isConsistency
      ? allEntries.slice(0, MAX_CODEX_CONSISTENCY)
      : selectRelevantEntries(allEntries, chapterText)
    : [];

  // Find preceding chapters: all chapters that come before the current one in sorted order
  // allChapters is already sorted by (volume sort_order, chapter sort_order) from the store
  const currentIdx = chapter ? allChapters.findIndex((c) => c.id === chapter.id) : -1;
  const prevChapters = currentIdx > 0
    ? allChapters
        .slice(0, currentIdx)
        .filter((c) => c.summary)
        .slice(-PREV_CHAPTER_SUMMARIES)
    : [];

  const parts: string[] = [
    "你是一个专业的中文网文写作助手。你的任务是辅助作者创作，而不是替代作者。",
    "风格要求：符合中文网文写作习惯，保持作者的个人风格。",
  ];

  if (writingRules) {
    parts.push(`\n【写作规则】\n${writingRules}`);
  }

  if (injectedEntries.length > 0) {
    parts.push(`\n【世界百科 — 当前章节相关】`);
    injectedEntries.forEach((e) => parts.push(formatEntry(e)));
  }

  if (prevChapters.length > 0) {
    parts.push(`\n【前情提要 — 最近 ${prevChapters.length} 章摘要】`);
    prevChapters.forEach((c) => parts.push(`${c.title}：${c.summary}`));
  }

  if (chapter) {
    parts.push(`\n【当前章节】${chapter.title}`);
  }

  if (recentText) {
    const label = isConsistency
      ? `全文内容（${recentText.length} 字）`
      : `最近内容（最后 ${RECENT_CHARS} 字）`;
    parts.push(`\n【${label}】\n${recentText}`);
  }

  if (USER_PROVIDES_TEXT.has(mode)) {
    parts.push(`\n注意：用户会提供具体的文字内容，请只对用户提供的文字进行操作，不要自行补充或续写。`);
  }

  const modeInstructions: Record<string, string> = {
    续写: "请根据上文，自然地续写接下来的情节。保持相同的叙事视角和文风，续写约 300-500 字。",
    润色: "请润色用户提供的文字。保留原意，改善表达，让文字更流畅、更有画面感。",
    扩写: "请扩写用户提供的内容。增加细节描写、心理描写或环境渲染，扩充至原文的 2-3 倍。",
    缩写: "请压缩用户提供的内容，保留核心情节，删去冗余，缩短至原文的 1/3 左右。",
    对话: "请根据角色性格和当前情境，生成自然流畅的对话。注意角色各自的说话风格。",
    情节: "请根据当前剧情走向，提供 2-3 个合理的下一步情节发展方向（简要描述即可）。",
    一致性: `请对当前章节进行一致性审查，检查以下几类问题：
1. 与世界百科设定的矛盾（人物外貌/能力/关系/地名/规则等）
2. 章节内部的自我矛盾（前后描述不一致）
3. 与前情提要的逻辑冲突

输出格式：
- 若发现问题：逐条列出，格式为「❌ [问题类型] 描述」，引用原文片段，说明与设定的冲突
- 若无问题：输出「✅ 本章未发现一致性问题」并简述检查结论
- 末尾给出 1-2 条修改建议（如有）`,
    自由: "请根据作者的问题或需求提供帮助。",
  };

  if (modeInstructions[mode]) {
    parts.push(`\n【当前模式】${mode}\n${modeInstructions[mode]}`);
  }

  return {
    systemPrompt: parts.join("\n"),
    recentText,
    injectedEntries,
    injectedSummaries: prevChapters.length,
  };
}
