import { useState, useEffect } from "react";
import { useProjectDocsStore, type DocType } from "../../store/projectDocsStore";
import { useCodexStore } from "../../store/codexStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useOutlineStore } from "../../store/outlineStore";
import { aiStream } from "../../lib/ai";
import type { OutlineNode } from "../../types";

interface Category {
  id: string;
  label: string;
  icon: string;
  docType?: DocType;
  isCodex?: boolean;
  optional?: boolean;
  threshold: number;
  description: string;
  howToAdd: string;
  aiTemplate: (args: { name: string; genre: string; synopsis: string; outline?: string; relevantDocs?: string }) => string;
}

const CATEGORIES: Category[] = [
  {
    id: "story_synopsis",
    label: "故事梗概",
    icon: "📖",
    docType: "story_synopsis",
    threshold: 80,
    description: "故事的核心设定和主线方向，是大纲生成最重要的参考依据。",
    howToAdd: "打开「项目文档」标签页 → 找到「故事梗概」文档并编辑，或点击「导入到项目文档」自动创建。",
    aiTemplate: ({ name, genre, synopsis, outline, relevantDocs }) =>
      `请为${genre}小说《${name}》生成一个故事梗概文档，必须严格基于以下已有信息，不要自行发明与这些信息无关的情节。
${synopsis ? `\n【书籍简介】\n${synopsis}\n` : ""}${outline ? `\n【当前大纲】\n${outline}\n` : ""}${relevantDocs ? `\n【相关文档】\n${relevantDocs}\n` : ""}
请根据以上信息，总结并生成故事梗概，包含：主角背景与起点、核心矛盾冲突、主要目标、关键转折点、结局大方向。约300字，使用Markdown格式。`,
  },
  {
    id: "relationship_map",
    label: "人物关系图",
    icon: "🕸️",
    docType: "relationship_map",
    threshold: 100,
    description: "核心人物关系和动态变化，帮助 AI 理解人物互动逻辑，避免关系混乱。",
    howToAdd: "打开「项目文档」标签页 → 新建文档 → 选择「人物关系图」类型，或点击「导入到项目文档」自动创建。",
    aiTemplate: ({ name, genre, synopsis, outline, relevantDocs }) =>
      `请为${genre}小说《${name}》生成一个人物关系图文档，必须基于以下已有信息。
${synopsis ? `\n【书籍简介】\n${synopsis}\n` : ""}${outline ? `\n【当前大纲】\n${outline}\n` : ""}${relevantDocs ? `\n【相关文档】\n${relevantDocs}\n` : ""}
包含：主角基本信息、3-5个核心配角简介、人物关系表格（角色A/关系/角色B/当前态度/变化趋势）。使用Markdown格式。`,
  },
  {
    id: "world_setting",
    label: "世界观设定",
    icon: "🌍",
    docType: "canon_log",
    threshold: 100,
    description: "已确定的世界规则、地名、势力设定，防止 AI 生成与设定矛盾的内容。",
    howToAdd: "打开「项目文档」标签页 → 新建文档 → 选择「已确定事实」类型，或点击「导入到项目文档」自动创建。",
    aiTemplate: ({ name, genre, synopsis, outline, relevantDocs }) =>
      `请为${genre}小说《${name}》生成一个世界观设定文档，必须基于以下已有信息。
${synopsis ? `\n【书籍简介】\n${synopsis}\n` : ""}${outline ? `\n【当前大纲】\n${outline}\n` : ""}${relevantDocs ? `\n【相关文档】\n${relevantDocs}\n` : ""}
包含：世界背景简述、核心规则体系（如修炼/魔法/科技）、主要势力列表、重要地点。使用Markdown格式，约300字。`,
  },
  {
    id: "style_guide",
    label: "文笔风格指南",
    icon: "✍️",
    docType: "style_guide",
    threshold: 80,
    description: "描述你希望的写作风格，让 AI 续写更贴近你的个人文风。",
    howToAdd: "打开「项目文档」标签页 → 新建文档 → 选择「文笔风格指南」类型，或点击「导入到项目文档」自动创建。",
    aiTemplate: ({ genre }) =>
      `请为${genre}类型网文生成一个文笔风格指南模板，包含：整体风格定位、句式偏好（长短句节奏）、视角描写习惯、参考范例说明、禁止的写法。使用Markdown格式。`,
  },
  {
    id: "codex",
    label: "百科词条",
    icon: "📚",
    isCodex: true,
    optional: true,
    threshold: 3,
    description: "角色、势力、地点等词条，AI 续写时会自动引用相关内容，提升一致性。",
    howToAdd: "打开「百科」标签页，添加主要角色、势力、地点等词条。建议至少添加主角和核心配角。",
    aiTemplate: ({ name, genre, synopsis }) =>
      `请为${genre}小说《${name}》生成主角的百科词条内容示例。${synopsis ? `参考：${synopsis}` : ""}
包含：姓名、身份背景、外貌特征、核心能力、性格特点、重要人物关系。约200字，可作为词条描述直接使用。`,
  },
  {
    id: "plot_threads",
    label: "情节线索规划",
    icon: "🧵",
    docType: "plot_threads",
    optional: true,
    threshold: 80,
    description: "长线伏笔和跨卷暗线规划，有助于生成更有深度、逻辑更连贯的大纲。",
    howToAdd: "打开「项目文档」标签页 → 新建文档 → 选择「暗线规划」类型，或点击「导入到项目文档」自动创建。",
    aiTemplate: ({ name, genre, synopsis, outline, relevantDocs }) =>
      `请为${genre}小说《${name}》生成一个情节线索规划，必须基于以下已有信息。
${synopsis ? `\n【书籍简介】\n${synopsis}\n` : ""}${outline ? `\n【当前大纲】\n${outline}\n` : ""}${relevantDocs ? `\n【相关文档】\n${relevantDocs}\n` : ""}
包含：2-3条长线伏笔（描述、埋下时机、计划回收时机）的表格，以及1-2条跨卷暗线。使用Markdown格式。`,
  },
];

type Status = "green" | "yellow" | "red";

const STATUS_ICON: Record<Status, string> = { green: "✅", yellow: "⚠️", red: "❌" };
const STATUS_COLOR: Record<Status, string> = {
  green: "text-green-600 dark:text-green-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  red: "text-red-500 dark:text-red-400",
};
const STATUS_BORDER: Record<Status, string> = {
  green: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10",
  yellow: "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10",
  red: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
};

interface Props {
  projectId: string;
  projectName: string;
  projectGenre: string;
  projectSynopsis: string;
}

export function OutlineAssistant({ projectId, projectName, projectGenre, projectSynopsis }: Props) {
  const { docs, createDoc, updateDoc, loadDocs } = useProjectDocsStore();
  const { entries, loadEntries, createEntry, updateEntry } = useCodexStore();
  const { getActiveModel, getKeyForModel } = useSettingsStore();
  const { nodes } = useOutlineStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<Record<string, boolean>>({});
  const [codexAdding, setCodexAdding] = useState(false);
  const [codexAdded, setCodexAdded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadEntries(projectId);
  }, [projectId]);

  const bookDocs = docs.filter(d => d.book_id === projectId);
  const bookEntries = entries.filter(e => e.book_id === projectId);

  function buildOutlineContext(): string {
    const flat = nodes.filter(n => n.book_id === projectId);
    if (flat.length === 0) return "";
    function render(node: OutlineNode, indent: string): string {
      const label = ["", "全书大纲", "卷纲", "章纲"][node.level] ?? "";
      const desc = node.content ? `：${node.content}` : "";
      let text = `${indent}[${label}] ${node.title || "未命名"}${desc}`;
      (node.children ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
        .forEach(c => { text += "\n" + render(c, indent + "  "); });
      return text;
    }
    const map = new Map<string, OutlineNode>();
    flat.forEach(n => map.set(n.id, { ...n, children: [] }));
    const roots: OutlineNode[] = [];
    flat.forEach(n => {
      const node = map.get(n.id)!;
      if (n.parent_id == null) roots.push(node);
      else map.get(n.parent_id)?.children?.push(node);
    });
    return roots.slice().sort((a, b) => a.sort_order - b.sort_order).map(r => render(r, "")).join("\n");
  }

  function buildDocsContext(): string {
    const relevant = bookDocs.filter(
      d => (d.ai_injection === "always" || d.ai_injection === "contextual") && d.content.trim()
    );
    if (relevant.length === 0) return "";
    return relevant.map(d => `### ${d.title}\n${d.content.trim()}`).join("\n\n");
  }

  function getStatus(cat: Category): Status {
    if (cat.isCodex) {
      if (bookEntries.length === 0) return "red";
      if (bookEntries.length < cat.threshold) return "yellow";
      return "green";
    }
    const doc = bookDocs.find(d => d.doc_type === cat.docType);
    if (!doc) return "red";
    const len = doc.content.trim().length;
    if (len === 0) return "red";
    if (len < cat.threshold) return "yellow";
    return "green";
  }

  async function handleGenerate(cat: Category) {
    const model = getActiveModel();
    if (!model) return;
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) return;

    const outline = buildOutlineContext();
    const relevantDocs = buildDocsContext();

    setGenerating(cat.id);
    setSuggestions(prev => ({ ...prev, [cat.id]: "" }));
    setImportDone(prev => ({ ...prev, [cat.id]: false }));
    try {
      let full = "";
      await aiStream({
        model,
        apiKey: key,
        messages: [{
          role: "user",
          content: cat.aiTemplate({
            name: projectName,
            genre: projectGenre,
            synopsis: projectSynopsis,
            outline: outline || undefined,
            relevantDocs: relevantDocs || undefined,
          }),
        }],
        maxTokens: 1000,
        temperature: 0.75,
        onChunk: (delta) => {
          full += delta;
          setSuggestions(prev => ({ ...prev, [cat.id]: full }));
        },
      });
    } finally {
      setGenerating(null);
    }
  }

  async function handleImport(cat: Category) {
    const text = suggestions[cat.id];
    if (!text?.trim() || cat.isCodex) return;

    setImporting(cat.id);
    try {
      // For story_synopsis: append to existing doc or create new
      if (cat.docType === "story_synopsis") {
        const existing = bookDocs.find(d => d.doc_type === "story_synopsis");
        if (existing) {
          const newContent = existing.content.trim()
            ? `${existing.content.trim()}\n\n---\n\n${text.trim()}`
            : text.trim();
          await updateDoc(existing.id, { content: newContent });
        } else {
          await createDoc(projectId, "story_synopsis", "故事梗概", text.trim(), "always");
        }
      } else if (cat.docType) {
        // For other types: create a new doc
        const title = `${cat.label}（AI 建议）`;
        await createDoc(projectId, cat.docType, title, text.trim(), "contextual");
      }
      await loadDocs(projectId);
      setImportDone(prev => ({ ...prev, [cat.id]: true }));
    } finally {
      setImporting(null);
    }
  }

  async function handleAddToCodex(catId: string) {
    const text = suggestions[catId];
    if (!text?.trim()) return;
    setCodexAdding(true);
    try {
      // Extract name: look for "姓名：XXX" pattern, fall back to "AI建议词条"
      const nameMatch = text.match(/姓名[：:]\s*([^\n，,（(【\s]+)/);
      const entryName = nameMatch?.[1]?.trim() || "AI建议词条";
      const entry = await createEntry(projectId, "character", entryName);
      await updateEntry(entry.id, { description: text.trim() });
      await loadEntries(projectId);
      setCodexAdded(prev => ({ ...prev, [catId]: true }));
    } finally {
      setCodexAdding(false);
    }
  }

  const greenCount = CATEGORIES.filter(c => getStatus(c) === "green").length;
  const total = CATEGORIES.length;

  return (
    <div className="p-3">
      {/* Summary bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(greenCount / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{greenCount}/{total} 完整</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        以下均为<span className="font-medium text-gray-600 dark:text-gray-300">建议项，非必须</span>。信息越丰富，生成大纲质量越高。
      </p>

      <div className="space-y-1.5">
        {CATEGORIES.map((cat) => {
          const status = getStatus(cat);
          const isExpanded = expandedId === cat.id;
          const suggestion = suggestions[cat.id] ?? "";

          return (
            <div key={cat.id} className={`rounded-lg border ${STATUS_BORDER[status]}`}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
              >
                <span className="text-sm leading-none">{cat.icon}</span>
                <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                  {cat.label}
                  {cat.optional && <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">（可选）</span>}
                </span>
                <span className={`text-sm leading-none ${STATUS_COLOR[status]}`}>{STATUS_ICON[status]}</span>
                <span className="text-gray-300 dark:text-gray-600 text-xs ml-1">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-0.5 space-y-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">{cat.description}</p>

                  {status !== "green" && (
                    <div className="bg-white dark:bg-gray-900 rounded p-2 border border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">📌 如何添加</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{cat.howToAdd}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleGenerate(cat)}
                      disabled={generating === cat.id}
                      className="text-xs px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {generating === cat.id ? "生成中…" : "✦ AI 生成建议内容"}
                    </button>
                    <span className="text-xs text-gray-400 dark:text-gray-500">可在下方编辑后导入</span>
                  </div>

                  {suggestion && (
                    <div className="space-y-2">
                      <textarea
                        value={suggestion}
                        onChange={(e) => setSuggestions(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        rows={6}
                        className="w-full text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 resize-y font-sans leading-relaxed outline-none focus:ring-1 focus:ring-indigo-400"
                        placeholder="AI 生成内容，可直接编辑…"
                      >
                        {generating === cat.id && <span className="inline-block w-1 h-3 bg-indigo-400 ml-0.5 animate-pulse" />}
                      </textarea>
                      {cat.isCodex ? (
                        <button
                          onClick={() => handleAddToCodex(cat.id)}
                          disabled={codexAdding || codexAdded[cat.id]}
                          className={`text-xs px-3 py-1.5 rounded transition-colors ${
                            codexAdded[cat.id]
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                          }`}
                        >
                          {codexAdded[cat.id] ? "✓ 已添加到百科" : codexAdding ? "添加中…" : "📥 添加到百科词条"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleImport(cat)}
                          disabled={importing === cat.id || generating === cat.id}
                          className={`text-xs px-3 py-1.5 rounded transition-colors ${
                            importDone[cat.id]
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                          }`}
                        >
                          {importDone[cat.id]
                            ? "✓ 已导入项目文档"
                            : importing === cat.id
                            ? "导入中…"
                            : cat.docType === "story_synopsis"
                            ? "📥 导入到故事梗概（追加）"
                            : "📥 导入到项目文档"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
