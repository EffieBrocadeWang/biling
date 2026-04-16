import { useEffect, useState } from "react";
import { useCodexStore } from "../../store/codexStore";
import { useEditorStore } from "../../store/editorStore";
import { useSettingsStore } from "../../store/settingsStore";
import { aiStream } from "../../lib/ai";
import {
  CODEX_TYPE_LABELS,
  CODEX_TYPE_ICONS,
  type CodexEntry,
  type CodexType,
} from "../../types";

const ALL_TYPES: CodexType[] = ["character", "faction", "location", "item", "rule"];

interface Props {
  projectId: number;
  onOpenSettings: () => void;
}

// ── AI instruction generator ───────────────────────────────────────────────

function buildAIInstructionPrompt(entry: CodexEntry, chapterExcerpts: string): string {
  const typeLabel = CODEX_TYPE_LABELS[entry.type];
  const parts = [
    `你是一个辅助中文网文写作的助手。请根据以下信息，为"${entry.name}"生成简洁的 AI 指令。`,
    `\n【实体类型】${typeLabel}`,
    `【名称】${entry.name}`,
  ];
  if (entry.aliases) parts.push(`【别名】${entry.aliases}`);
  if (entry.description) parts.push(`【描述】\n${entry.description}`);
  if (chapterExcerpts) parts.push(`【相关情节摘录】\n${chapterExcerpts}`);
  parts.push(`\n请生成 3-6 条 AI 写作指令，格式为短句要点（以"- "开头），内容包括：
- 写作时需要遵守的关键设定（外貌特征、性格习惯、口头禅等）
- 与其他角色/势力的关系要点
- 当前剧情状态（如有）
- 禁止 AI 泄露或违反的设定

只输出指令列表，不需要解释。`);
  return parts.join("\n");
}

// Extract up to ~800 chars of chapter text mentioning the entity name
function extractChapterExcerpts(chapters: { content: string; title: string }[], name: string, aliases: string): string {
  const terms = [name, ...aliases.split(/[，,、]/).map((s) => s.trim())].filter(Boolean);
  const excerpts: string[] = [];
  let totalChars = 0;

  for (const chapter of chapters) {
    if (totalChars >= 800) break;
    let text = "";
    try {
      const doc = JSON.parse(chapter.content);
      text = extractTextFromDoc(doc);
    } catch {
      continue;
    }
    const hit = terms.some((t) => text.includes(t));
    if (!hit) continue;
    // Grab the first 200 chars around the first mention
    const idx = terms.reduce((best, t) => {
      const i = text.indexOf(t);
      return i >= 0 && (best < 0 || i < best) ? i : best;
    }, -1);
    if (idx < 0) continue;
    const start = Math.max(0, idx - 60);
    const snippet = `[${chapter.title}] …${text.slice(start, start + 200)}…`;
    excerpts.push(snippet);
    totalChars += snippet.length;
  }
  return excerpts.join("\n\n");
}

function extractTextFromDoc(doc: { type?: string; text?: string; content?: object[] }): string {
  if (!doc) return "";
  if (doc.type === "text") return doc.text ?? "";
  if (doc.content) return doc.content.map((n) => extractTextFromDoc(n as typeof doc)).join("");
  return "";
}

// ── Entry detail form ──────────────────────────────────────────────────────

interface DetailProps {
  entry: CodexEntry;
  onClose: () => void;
  onOpenSettings: () => void;
}

function EntryDetail({ entry, onClose, onOpenSettings }: DetailProps) {
  const { updateEntry, deleteEntry } = useCodexStore();
  const { chapters } = useEditorStore();
  const { getActiveModel, getKeyForModel, loaded, load } = useSettingsStore();

  const [form, setForm] = useState({
    name: entry.name,
    aliases: entry.aliases,
    description: entry.description,
    ai_instructions: entry.ai_instructions,
    tags: entry.tags,
  });
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, []);

  async function save() {
    if (!dirty) return;
    await updateEntry(entry.id, form);
    setDirty(false);
  }

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  }

  async function handleGenerateInstructions() {
    const model = getActiveModel();
    if (!model) { setGenError("请先在设置中选择 AI 模型"); return; }
    const apiKey = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!apiKey) { setGenError("请先在设置中填写 API 密钥"); onOpenSettings(); return; }

    setGenerating(true);
    setGenError(null);
    const excerpts = extractChapterExcerpts(chapters, form.name, form.aliases);
    const prompt = buildAIInstructionPrompt({ ...entry, ...form }, excerpts);

    try {
      let result = "";
      update("ai_instructions", "");
      await aiStream({
        model,
        apiKey,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 512,
        temperature: 0.5,
        onChunk: (delta) => {
          result += delta;
          setForm((f) => ({ ...f, ai_instructions: result }));
        },
      });
      // Persist the generated result
      await updateEntry(entry.id, { ai_instructions: result });
      setDirty(false);
    } catch (err) {
      setGenError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{CODEX_TYPE_ICONS[entry.type]}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{CODEX_TYPE_LABELS[entry.type]}</span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={save}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              保存
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:text-gray-600 text-xl leading-none">×</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">名称</label>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={save}
            className="w-full text-base font-semibold border-b border-gray-200 dark:border-gray-700 focus:border-indigo-400 outline-none py-1 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">别名 / 外号</label>
          <input
            value={form.aliases}
            onChange={(e) => update("aliases", e.target.value)}
            onBlur={save}
            placeholder="用逗号分隔多个别名"
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            onBlur={save}
            placeholder="外貌、背景、性格、能力等详细描述..."
            rows={5}
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
          />
        </div>

        {/* AI instructions with generate button */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">
              AI 指令
              <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">（注入 AI 上下文时使用）</span>
            </label>
            <button
              onClick={handleGenerateInstructions}
              disabled={generating}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                generating
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-400 cursor-wait"
                  : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100"
              }`}
              title="根据描述和情节内容，AI 自动生成指令"
            >
              {generating ? (
                <>
                  <span className="animate-spin inline-block">⟳</span> 生成中…
                </>
              ) : (
                <>✨ AI 生成</>
              )}
            </button>
          </div>
          {genError && (
            <p className="text-xs text-red-500 mb-1 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{genError}</p>
          )}
          <textarea
            value={form.ai_instructions}
            onChange={(e) => update("ai_instructions", e.target.value)}
            onBlur={save}
            placeholder={"手动输入，或点击「AI 生成」自动推断。例如：\n- 此角色说话简短、冷淡，绝不主动示弱\n- 左手有旧伤，紧张时会无意识握拳\n- 与女主之间存在未解决的背叛"}
            rows={6}
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">标签</label>
          <input
            value={form.tags}
            onChange={(e) => update("tags", e.target.value)}
            onBlur={save}
            placeholder="用空格分隔，例如：主角 男 修仙"
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Delete */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 flex-1">确认删除？</span>
            <button
              onClick={async () => { await deleteEntry(entry.id); onClose(); }}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              删除
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              取消
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:text-red-600">
            删除此条目
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main codex panel ───────────────────────────────────────────────────────

export function CodexPanel({ projectId, onOpenSettings }: Props) {
  const { entries, loading, loadEntries, createEntry } = useCodexStore();
  const [activeType, setActiveType] = useState<CodexType | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState<CodexType | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadEntries(projectId);
  }, [projectId]);

  const filtered = entries.filter((e) => {
    if (activeType !== "all" && e.type !== activeType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.aliases.toLowerCase().includes(q) ||
        e.tags.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selected = selectedId ? entries.find((e) => e.id === selectedId) ?? null : null;

  async function handleCreate(type: CodexType) {
    if (!newName.trim()) return;
    const entry = await createEntry(projectId, type, newName.trim());
    setNewName("");
    setCreating(null);
    setSelectedId(entry.id);
  }

  // Count per type
  function countOf(type: CodexType) {
    return entries.filter((e) => e.type === type).length;
  }

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className={`flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${selected ? "w-72 shrink-0" : "flex-1"}`}>
        {/* Search */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索条目..."
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-gray-900"
          />
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveType("all")}
            className={`px-2 py-1 text-xs rounded-full shrink-0 ${activeType === "all" ? "bg-indigo-100 text-indigo-700" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            全部 {entries.length > 0 && `(${entries.length})`}
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-2 py-1 text-xs rounded-full shrink-0 flex items-center gap-1 ${activeType === t ? "bg-indigo-100 text-indigo-700" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
            >
              {CODEX_TYPE_ICONS[t]} {CODEX_TYPE_LABELS[t]}
              {countOf(t) > 0 && <span className="text-gray-400 dark:text-gray-500">{countOf(t)}</span>}
            </button>
          ))}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-8">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-8">
              {search ? "无匹配结果" : "暂无条目"}
            </div>
          ) : (
            filtered.map((e) => (
              <div
                key={e.id}
                onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-0.5 ${
                  selectedId === e.id
                    ? "bg-indigo-100 text-indigo-700"
                    : "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                }`}
              >
                <span className="text-base shrink-0">{CODEX_TYPE_ICONS[e.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  {e.aliases && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{e.aliases}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add new */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 shrink-0">
          {creating ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate(creating);
                  if (e.key === "Escape") { setCreating(null); setNewName(""); }
                }}
                placeholder={`新${CODEX_TYPE_LABELS[creating]}名称`}
                className="flex-1 text-sm border border-indigo-400 rounded px-2 py-1 outline-none"
              />
              <button
                onClick={() => handleCreate(creating)}
                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                添加
              </button>
              <button
                onClick={() => { setCreating(null); setNewName(""); }}
                className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:text-gray-600"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {ALL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCreating(t)}
                  className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:bg-indigo-900/30 rounded transition-colors"
                >
                  + {CODEX_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail */}
      {selected && (
        <div className="flex-1 overflow-hidden">
          <EntryDetail
            key={selected.id}
            entry={selected}
            onClose={() => setSelectedId(null)}
            onOpenSettings={onOpenSettings}
          />
        </div>
      )}
    </div>
  );
}
