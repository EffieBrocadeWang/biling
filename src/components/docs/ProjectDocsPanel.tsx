import { useEffect, useState, useRef } from "react";
import { InfoButton } from "../common/InfoButton";
import { FeatureTip } from "../common/FeatureTip";
import {
  useProjectDocsStore,
  type ProjectDoc,
  type DocType,
  type AiInjection,
  DOC_TYPE_LABELS,
  DOC_TYPE_ICONS,
  DOC_TYPE_TEMPLATES,
  AI_INJECTION_LABELS,
  AI_INJECTION_COLORS,
} from "../../store/projectDocsStore";

interface Props {
  projectId: string;
}

const DOC_TYPE_OPTIONS: DocType[] = [
  "story_synopsis",
  "writing_rules",
  "style_guide",
  "canon_log",
  "relationship_map",
  "plot_threads",
  "reference_notes",
  "writing_log",
  "custom",
];

const AI_INJECTION_OPTIONS: AiInjection[] = ["always", "contextual", "manual", "none"];

export function ProjectDocsPanel({ projectId }: Props) {
  const { docs, loading, loadDocs, createDoc, updateDoc, deleteDoc, reorderDoc } =
    useProjectDocsStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDocType, setNewDocType] = useState<DocType>("custom");
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state for selected doc
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftInjection, setDraftInjection] = useState<AiInjection>("none");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDocs(projectId);
  }, [projectId]);

  // When selected doc changes, load its data into edit state
  const selectedDoc = docs.find((d) => d.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedDoc) {
      setDraftTitle(selectedDoc.title);
      setDraftContent(selectedDoc.content);
      setDraftInjection(selectedDoc.ai_injection);
      setDirty(false);
      setSaved(false);
    }
  }, [selectedId]);

  // Auto-select first doc
  useEffect(() => {
    if (docs.length > 0 && !selectedId) {
      setSelectedId(docs[0].id);
    }
  }, [docs]);

  async function handleCreate() {
    setCreateError(null);
    const title = newTitle.trim() || DOC_TYPE_LABELS[newDocType];
    const content = DOC_TYPE_TEMPLATES[newDocType];
    try {
      const doc = await createDoc(projectId, newDocType, title, content,
        newDocType === "story_synopsis" ? "always" : "none");
      setSelectedId(doc.id);
      setShowNewForm(false);
      setNewTitle("");
      setNewDocType("custom");
    } catch (err) {
      setCreateError(String(err));
    }
  }

  function handleContentChange(val: string) {
    setDraftContent(val);
    setDirty(true);
    setSaved(false);
    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (selectedId) {
        updateDoc(selectedId, { content: val }).then(() => {
          setSaved(true);
          setDirty(false);
          setTimeout(() => setSaved(false), 2000);
        });
      }
    }, 1200);
  }

  function handleTitleChange(val: string) {
    setDraftTitle(val);
    setDirty(true);
    setSaved(false);
  }

  function handleInjectionChange(val: AiInjection) {
    setDraftInjection(val);
    setDirty(true);
    setSaved(false);
    // Injection setting: save immediately
    if (selectedId) {
      updateDoc(selectedId, { ai_injection: val });
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    await updateDoc(selectedId, {
      title: draftTitle,
      content: draftContent,
      ai_injection: draftInjection,
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete(doc: ProjectDoc) {
    if (!confirm(`确定要删除「${doc.title}」吗？此操作不可撤销。`)) return;
    if (selectedId === doc.id) {
      const remaining = docs.filter((d) => d.id !== doc.id);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }
    await deleteDoc(doc.id);
  }

  return (
    <div className="flex h-full overflow-hidden relative">
      <FeatureTip
        featureId="docs"
        title="项目文档 — 给 AI 定规矩"
        body="在这里创建「写作铁律」「已确定事实」等文档。设为「每次请求」后，AI 每次续写都会自动遵守这些规则。"
        cta="新建一份「写作铁律」文档"
        onCta={() => {}}
      />
      {/* ── Left: doc list ── */}
      <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              项目文档
            </span>
            <InfoButton id="docs.writing_rules" />
          </div>
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-bold transition-colors"
            title="新建文档"
          >
            +
          </button>
        </div>

        {/* New doc form */}
        {showNewForm && (
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
            <select
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value as DocType)}
              className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 outline-none focus:border-indigo-400"
            >
              {DOC_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_ICONS[t]} {DOC_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={DOC_TYPE_LABELS[newDocType]}
              className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 outline-none focus:border-indigo-400"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewForm(false); }}
              autoFocus
            />
            {createError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1 break-all">{createError}</p>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={handleCreate}
                className="flex-1 text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 transition-colors"
              >
                创建
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewTitle(""); setCreateError(null); }}
                className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-4 text-center">加载中…</p>
          )}
          {!loading && docs.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">暂无文档</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">点击 + 新建</p>
            </div>
          )}
          {docs.map((doc, idx) => (
            <div
              key={doc.id}
              onClick={() => setSelectedId(doc.id)}
              className={`group flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-lg cursor-pointer transition-colors text-xs ${
                selectedId === doc.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              <span className="shrink-0 text-[11px]">{DOC_TYPE_ICONS[doc.doc_type]}</span>
              <span className="flex-1 truncate">{doc.title}</span>
              {/* Injection badge */}
              {doc.ai_injection !== "none" && (
                <span className={`shrink-0 text-[9px] px-1 py-0.5 rounded font-medium ${AI_INJECTION_COLORS[doc.ai_injection]}`}>
                  {doc.ai_injection === "always" ? "常" : doc.ai_injection === "contextual" ? "需" : "选"}
                </span>
              )}
              {/* Reorder buttons */}
              <div className="shrink-0 hidden group-hover:flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); reorderDoc(doc.id, "up"); }}
                  disabled={idx === 0}
                  className="w-4 h-4 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="上移"
                >↑</button>
                <button
                  onClick={(e) => { e.stopPropagation(); reorderDoc(doc.id, "down"); }}
                  disabled={idx === docs.length - 1}
                  className="w-4 h-4 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="下移"
                >↓</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: editor ── */}
      {selectedDoc ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Doc header bar */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <span className="text-base">{DOC_TYPE_ICONS[selectedDoc.doc_type]}</span>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => { if (selectedId && draftTitle !== selectedDoc.title) updateDoc(selectedId, { title: draftTitle }); }}
              className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600"
              placeholder="文档标题"
            />

            {/* AI injection selector */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 dark:text-gray-500">AI注入：</span>
                <InfoButton id="docs.injection_strategy" />
              </div>
              <div className="flex gap-1">
                {AI_INJECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleInjectionChange(opt)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      draftInjection === opt
                        ? AI_INJECTION_COLORS[opt] + " border-transparent font-medium"
                        : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    title={AI_INJECTION_LABELS[opt]}
                  >
                    {AI_INJECTION_LABELS[opt]}
                  </button>
                ))}
              </div>
            </div>

            {/* Save / status */}
            <div className="flex items-center gap-2 shrink-0">
              {saved && !dirty && (
                <span className="text-xs text-green-600 dark:text-green-400">已保存 ✓</span>
              )}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                  dirty
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
              >
                {saving ? "保存中…" : "保存"}
              </button>
              <button
                onClick={() => handleDelete(selectedDoc)}
                className="text-xs px-2 py-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="删除此文档"
              >
                删除
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden p-4 bg-white dark:bg-gray-900">
            <textarea
              value={draftContent}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-full resize-none border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-mono leading-relaxed bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800 dark:text-gray-100"
              placeholder="在这里编写文档内容（支持 Markdown 格式）…"
              spellCheck={false}
            />
          </div>

          {/* Footer hint */}
          <div className="shrink-0 px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {draftContent.length} 字符
              {draftInjection === "always" && (
                <span className="ml-2 text-red-500">· 每次自动注入 AI 系统提示</span>
              )}
              {draftInjection === "contextual" && (
                <span className="ml-2 text-blue-500">· 按需注入（AI 判断相关性）</span>
              )}
              {draftInjection === "manual" && (
                <span className="ml-2 text-yellow-600">· 手动选择后注入</span>
              )}
            </span>
            <span className="text-xs text-gray-300 dark:text-gray-600">
              {selectedDoc.doc_type !== "custom" && DOC_TYPE_LABELS[selectedDoc.doc_type]}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-gray-600">
          <div className="text-center">
            <p className="text-3xl mb-2">📄</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">从左侧选择文档，或点击 + 新建</p>
          </div>
        </div>
      )}
    </div>
  );
}
