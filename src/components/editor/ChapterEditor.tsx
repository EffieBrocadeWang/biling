import { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEditorStore } from "../../store/editorStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useOutlineStore } from "../../store/outlineStore";
import { aiStream } from "../../lib/ai";
import { buildSummaryPrompt } from "../../lib/context";
import type { ChapterSnapshot } from "../../types";

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const AUTOSAVE_DEBOUNCE_MS = 2000;

// Custom event for AI panel → editor insertion
export const INSERT_TEXT_EVENT = "biling:insert-text";
export function dispatchInsertText(text: string) {
  window.dispatchEvent(new CustomEvent(INSERT_TEXT_EVENT, { detail: text }));
}

export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Snapshot panel ─────────────────────────────────────────────────────────

interface SnapshotPanelProps {
  chapterId: string;
  onRestore: (snapshot: ChapterSnapshot) => void;
  onClose: () => void;
}

function SnapshotPanel({ chapterId, onRestore, onClose }: SnapshotPanelProps) {
  const { loadSnapshots } = useEditorStore();
  const [snapshots, setSnapshots] = useState<ChapterSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshots(chapterId).then((s) => {
      setSnapshots(s);
      setLoading(false);
    });
  }, [chapterId]);

  return (
    <div className="absolute top-10 right-4 z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-72">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">历史版本</span>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:text-gray-600 text-lg leading-none">×</button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-6">加载中...</div>
        ) : snapshots.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-6">暂无历史版本</div>
        ) : (
          snapshots.map((s) => (
            <div key={s.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatTime(s.created_at)}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{s.word_count} 字</span>
              </div>
              {confirming === s.id ? (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { onRestore(s); onClose(); }}
                    className="flex-1 text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700"
                  >
                    确认恢复
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-600 rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(s.id)}
                  className="mt-1 text-xs text-indigo-500 hover:text-indigo-700"
                >
                  恢复此版本
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
        每 5 分钟自动保存一个版本，保留最近 20 个
      </div>
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────────────────

export function ChapterEditor() {
  const { activeChapter, saveChapter, setChapterStatus, createSnapshot, restoreSnapshot, saveSummary } =
    useEditorStore();
  const { getActiveModel, getKeyForModel, appearance } = useSettingsStore();
  const { nodes: outlineNodes } = useOutlineStore();

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedContent = useRef<string>("");
  const lastSnapshotContent = useRef<string>("");
  const isDirty = useRef(false);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "落笔处，世界始..." }),
      CharacterCount,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-lg max-w-none focus:outline-none min-h-full px-16 py-12",
        style: "font-size: inherit; line-height: inherit; font-family: inherit;",
      },
    },
    onUpdate: ({ editor }) => {
      isDirty.current = true;
      setSaveStatus("unsaved");
      const json = JSON.stringify(editor.getJSON());

      // Layer 2: debounced auto-save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (json !== lastSavedContent.current && activeChapter) {
          setSaveStatus("saving");
          lastSavedContent.current = json;
          const wc = countWords(editor.getText());
          await saveChapter(activeChapter.id, json, wc);
          setSaveStatus("saved");
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  // Layer 1: load chapter into editor
  useEffect(() => {
    if (!editor || !activeChapter) return;
    let doc: object;
    try {
      doc = JSON.parse(activeChapter.content || "{}");
    } catch {
      doc = { type: "doc", content: [] };
    }
    const incoming = JSON.stringify(doc);
    if (JSON.stringify(editor.getJSON()) !== incoming) {
      editor.commands.setContent(doc);
      lastSavedContent.current = incoming;
      lastSnapshotContent.current = incoming;
    }
    setSaveStatus("saved");
    isDirty.current = false;
    setSummaryDraft(activeChapter?.summary ?? "");
  }, [activeChapter?.id]);

  // Layer 3: periodic snapshot every 5 min if content changed
  useEffect(() => {
    if (snapshotTimer.current) clearInterval(snapshotTimer.current);
    snapshotTimer.current = setInterval(async () => {
      if (!editor || !activeChapter || !isDirty.current) return;
      const json = JSON.stringify(editor.getJSON());
      if (json === lastSnapshotContent.current) return;
      lastSnapshotContent.current = json;
      isDirty.current = false;
      const wc = countWords(editor.getText());
      await createSnapshot(activeChapter.id, json, wc);
    }, SNAPSHOT_INTERVAL_MS);
    return () => {
      if (snapshotTimer.current) clearInterval(snapshotTimer.current);
    };
  }, [activeChapter?.id, editor]);

  // Layer 4: save on window close / visibility change
  useEffect(() => {
    async function flushSave() {
      if (!editor || !activeChapter) return;
      const json = JSON.stringify(editor.getJSON());
      if (json === lastSavedContent.current) return;
      lastSavedContent.current = json;
      const wc = countWords(editor.getText());
      await saveChapter(activeChapter.id, json, wc);
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushSave();
    }
    window.addEventListener("beforeunload", flushSave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushSave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [editor, activeChapter, saveChapter]);

  // Toast helper
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  // Insert text from AI panel
  useEffect(() => {
    function handleInsert(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      if (!editor || !text) return;
      editor.chain().focus().insertContentAt(editor.state.doc.content.size, [
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text }] },
      ]).run();
    }
    window.addEventListener(INSERT_TEXT_EVENT, handleInsert);
    return () => window.removeEventListener(INSERT_TEXT_EVENT, handleInsert);
  }, [editor]);

  // Cmd+S manual save
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!editor || !activeChapter) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSaveStatus("saving");
        const json = JSON.stringify(editor.getJSON());
        const wc = countWords(editor.getText());
        lastSavedContent.current = json;
        await saveChapter(activeChapter.id, json, wc);
        setSaveStatus("saved");
      }
    },
    [editor, activeChapter, saveChapter]
  );
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Restore snapshot
  async function handleRestore(snapshot: ChapterSnapshot) {
    if (!editor || !activeChapter) return;
    let doc: object;
    try { doc = JSON.parse(snapshot.content); } catch { return; }
    editor.commands.setContent(doc);
    lastSavedContent.current = snapshot.content;
    await restoreSnapshot(activeChapter.id, snapshot);
    setSaveStatus("saved");
  }

  if (!activeChapter) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-gray-600">
        <div className="text-center">
          <div className="text-5xl mb-4">📖</div>
          <p className="text-base text-gray-400 dark:text-gray-500 mb-1">从左侧选择章节开始写作</p>
          <p className="text-xs text-gray-300 dark:text-gray-600">或在卷标题旁点击 + 新建章节</p>
          <div className="mt-6 flex flex-col gap-2 text-xs text-gray-300 dark:text-gray-600">
            <span>💡 <kbd className="border border-gray-200 dark:border-gray-700 rounded px-1 text-gray-400 dark:text-gray-500">Cmd+\</kbd> 折叠侧边栏</span>
            <span>💡 <kbd className="border border-gray-200 dark:border-gray-700 rounded px-1 text-gray-400 dark:text-gray-500">Cmd+Shift+F</kbd> 全文搜索</span>
          </div>
        </div>
      </div>
    );
  }

  const wordCount = editor ? countWords(editor.getText()) : activeChapter.word_count;

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-1 bg-white dark:bg-gray-900 shrink-0">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-bold ${editor?.isActive("bold") ? "bg-gray-200 dark:bg-gray-600" : ""}`}
          title="加粗 (Cmd+B)"
        >B</button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 italic ${editor?.isActive("italic") ? "bg-gray-200 dark:bg-gray-600" : ""}`}
          title="斜体 (Cmd+I)"
        >I</button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 line-through ${editor?.isActive("strike") ? "bg-gray-200 dark:bg-gray-600" : ""}`}
          title="删除线"
        >S</button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${editor?.isActive("blockquote") ? "bg-gray-200 dark:bg-gray-600" : ""}`}
          title="引用"
        >"</button>
        <button
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          className="px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="分割线"
        >—</button>

        <div className="flex-1" />

        {/* Manual snapshot */}
        <button
          onClick={async () => {
            if (!editor || !activeChapter) return;
            const json = JSON.stringify(editor.getJSON());
            const wc = countWords(editor.getText());
            lastSnapshotContent.current = json;
            await createSnapshot(activeChapter.id, json, wc);
            showToast("已存档 ✓");
          }}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-indigo-600 transition-colors"
          title="手动保存版本"
        >
          存档
        </button>

        {/* Chapter summary */}
        <button
          onClick={() => setShowSummary((v) => !v)}
          className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 ${showSummary ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" : "text-gray-400 dark:text-gray-500"}`}
          title="章节摘要"
        >
          摘要
          {activeChapter.summary && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          )}
        </button>

        {/* Snapshot history */}
        <button
          onClick={() => setShowSnapshots((v) => !v)}
          className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${showSnapshots ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" : "text-gray-400 dark:text-gray-500"}`}
          title="历史版本"
        >
          历史
        </button>
      </div>

      {/* Outline hint */}
      {(() => {
        const linked = outlineNodes.find(
          (n) => n.level === 3 && n.linked_chapter_id === activeChapter.id
        );
        if (!linked) return null;
        return (
          <div className="shrink-0 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 flex items-start gap-2">
            <span className="text-indigo-400 text-xs shrink-0 mt-0.5">📋 章纲</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-indigo-700">{linked.title}</span>
              {linked.content && (
                <span className="text-xs text-indigo-500 ml-2">{linked.content}</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div
          style={{
            maxWidth: appearance.maxWidth,
            margin: "0 auto",
            fontSize: appearance.fontSize,
            lineHeight: appearance.lineHeight,
            fontFamily: appearance.fontFamily === "serif"
              ? "'Noto Serif SC', 'SimSun', 'STSong', Georgia, serif"
              : "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', SimHei, sans-serif",
          }}
        >
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-1.5 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 shrink-0">
        <span>{activeChapter.title}</span>
        <div className="flex items-center gap-3">
          {/* Save indicator */}
          <span className={
            saveStatus === "saving" ? "text-amber-400" :
            saveStatus === "unsaved" ? "text-gray-300 dark:text-gray-600" :
            "text-green-400"
          }>
            {saveStatus === "saving" ? "保存中…" :
             saveStatus === "unsaved" ? "未保存" :
             "已保存"}
          </span>

          {/* Status cycle: draft→writing→review→done→published→draft */}
          {(() => {
            const STATUS_CYCLE: import("../../types").Chapter["status"][] = ["draft", "writing", "review", "done", "published"];
            const STATUS_LABELS: Record<string, string> = { draft: "草稿", writing: "写作中", review: "审阅", done: "完成", published: "已发布" };
            const STATUS_COLORS: Record<string, string> = {
              draft: "bg-gray-100 dark:bg-gray-700 text-gray-400",
              writing: "bg-blue-100 text-blue-600",
              review: "bg-yellow-100 text-yellow-600",
              done: "bg-indigo-100 text-indigo-600",
              published: "bg-green-100 text-green-600",
            };
            const STATUS_DOT: Record<string, string> = {
              draft: "bg-gray-300", writing: "bg-blue-400", review: "bg-yellow-400",
              done: "bg-indigo-400", published: "bg-green-400",
            };
            const cur = activeChapter.status;
            const nextIdx = (STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length;
            const next = STATUS_CYCLE[nextIdx];
            return (
              <button
                onClick={() => setChapterStatus(activeChapter.id, next)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${STATUS_COLORS[cur] ?? STATUS_COLORS.draft}`}
                title={`点击切换到：${STATUS_LABELS[next]}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[cur] ?? "bg-gray-300"}`} />
                {STATUS_LABELS[cur] ?? cur}
              </button>
            );
          })()}

          <span>{wordCount.toLocaleString()} 字</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none animate-fade-in">
          {toast}
        </div>
      )}

      {/* Summary panel */}
      {showSummary && (
        <div className="absolute top-10 right-40 z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-80">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">章节摘要</span>
            <button
              onClick={async () => {
                if (!activeChapter) return;
                const model = getActiveModel();
                if (!model) { showToast("请先配置 AI 模型"); return; }
                const apiKey = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
                if (!apiKey) { showToast("请先配置 API 密钥"); return; }
                setGeneratingSummary(true);
                setSummaryDraft("");
                try {
                  const prompt = buildSummaryPrompt(activeChapter);
                  const result = await aiStream({
                    model, apiKey,
                    messages: [{ role: "user", content: prompt }],
                    maxTokens: 300,
                    temperature: 0.5,
                    onChunk: (d) => setSummaryDraft((s) => s + d),
                  });
                  await saveSummary(activeChapter.id, result);
                  showToast("摘要已保存 ✓");
                } catch (e) {
                  showToast(`生成失败: ${String(e)}`);
                } finally {
                  setGeneratingSummary(false);
                }
              }}
              disabled={generatingSummary}
              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 rounded disabled:opacity-50"
            >
              {generatingSummary ? <><span className="animate-spin inline-block">⟳</span> 生成中…</> : "✨ AI 生成"}
            </button>
          </div>
          <div className="p-4">
            <textarea
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              placeholder="在此手动输入本章摘要，或点击「AI 生成」…&#10;&#10;摘要会被注入后续章节的 AI 上下文（前情提要）。"
              rows={5}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={async () => {
                  if (activeChapter) {
                    await saveSummary(activeChapter.id, summaryDraft);
                    showToast("摘要已保存 ✓");
                  }
                }}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                保存
              </button>
            </div>
          </div>
          <div className="px-4 pb-3 text-xs text-gray-400 dark:text-gray-500">
            已生成摘要的章节在侧边栏显示绿点
          </div>
        </div>
      )}

      {/* Snapshot panel */}
      {showSnapshots && (
        <SnapshotPanel
          chapterId={activeChapter.id}
          onRestore={handleRestore}
          onClose={() => setShowSnapshots(false)}
        />
      )}
    </div>
  );
}
