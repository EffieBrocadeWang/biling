import { useEffect, useState } from "react";
import { useForeshadowingStore } from "../../store/foreshadowingStore";
import { useEditorStore } from "../../store/editorStore";
import { useSettingsStore } from "../../store/settingsStore";
import { aiStream } from "../../lib/ai";
import type { Foreshadowing } from "../../types";

interface Props {
  projectId: string;
}

// ── Single foreshadowing card ──────────────────────────────────────────────

function ForeshadowingCard({
  item,
  chapters,
  onResolve,
  onReopen,
  onDelete,
}: {
  item: Foreshadowing;
  chapters: import("../../types").Chapter[];
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { update } = useForeshadowingStore();
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.notes);
  const resolved = item.status === "resolved";

  // Look up chapter title from chapter id
  const plantedChapterTitle = item.planted_chapter_id
    ? chapters.find((c) => c.id === item.planted_chapter_id)?.title ?? ""
    : "";
  const resolvedChapterTitle = item.resolved_chapter_id
    ? chapters.find((c) => c.id === item.resolved_chapter_id)?.title ?? ""
    : "";

  return (
    <div className={`rounded-xl border p-4 transition-colors ${resolved ? "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800" : "border-amber-200 bg-amber-50 dark:bg-amber-900/20"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 text-base shrink-0 ${resolved ? "grayscale opacity-40" : ""}`}>🪢</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${resolved ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-800 dark:text-gray-100"}`}>
            {item.description}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {plantedChapterTitle && (
              <span className="text-xs text-gray-400 dark:text-gray-500">埋线：{plantedChapterTitle}</span>
            )}
            {resolved && resolvedChapterTitle && (
              <span className="text-xs text-green-600">✓ 回收：{resolvedChapterTitle}</span>
            )}
          </div>

          {/* Note */}
          {editingNote ? (
            <div className="mt-2">
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                placeholder="添加备注，例如回收的时机或方式…"
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={async () => {
                    await update(item.id, { notes: noteDraft });
                    setEditingNote(false);
                  }}
                  className="text-xs px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                >保存</button>
                <button onClick={() => { setNoteDraft(item.notes); setEditingNote(false); }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">取消</button>
              </div>
            </div>
          ) : (
            item.notes && (
              <p
                className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => setEditingNote(true)}
              >
                {item.notes}
              </p>
            )
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-black/5">
        {!editingNote && (
          <button
            onClick={() => setEditingNote(true)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {item.notes ? "编辑备注" : "+ 备注"}
          </button>
        )}
        <div className="flex-1" />
        {resolved ? (
          <button
            onClick={() => onReopen(item.id)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-amber-600"
          >重新打开</button>
        ) : (
          <button
            onClick={() => onResolve(item.id)}
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >✓ 标记已回收</button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="text-xs text-red-400 hover:text-red-600 ml-1"
        >删除</button>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function ForeshadowingPanel({ projectId }: Props) {
  const { items, loading, load, add, resolve, update, remove } = useForeshadowingStore();
  const { activeChapter, chapters } = useEditorStore();
  const { getActiveModel, getKeyForModel } = useSettingsStore();

  const [newContent, setNewContent] = useState("");
  const [filter, setFilter] = useState<"all" | "planted" | "resolved">("planted");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => { load(projectId); }, [projectId]);

  const planted = items.filter((f) => f.status === "planted");
  const resolved = items.filter((f) => f.status === "resolved");
  const filtered = filter === "all" ? items : filter === "planted" ? planted : resolved;

  async function handleAdd() {
    if (!newContent.trim()) return;
    await add(
      projectId,
      newContent.trim(),
      activeChapter?.id ?? null,
    );
    setNewContent("");
  }

  async function handleResolve(id: string) {
    await resolve(id, activeChapter?.id ?? null);
  }

  async function handleReopen(id: string) {
    await update(id, { status: "planted", resolved_chapter_id: null });
  }

  // AI scan current chapter for implicit foreshadowing
  async function handleAiScan() {
    if (!activeChapter) return;
    const model = getActiveModel();
    if (!model) { setScanError("请先配置 AI 模型"); return; }
    const apiKey = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!apiKey) { setScanError("请先配置 API 密钥"); return; }

    setScanning(true);
    setScanError(null);

    const existingContents = items.map((f) => f.description).join("\n");
    const prompt = `请分析以下小说章节，找出其中隐含的伏笔、悬念、未解决的线索。

要求：
- 只列出真正的伏笔（后文需要回收的内容）
- 每条伏笔用一句话描述
- 格式：每行一条，以"- "开头
- 如果没有新伏笔，回复"无新伏笔"
${existingContents ? `\n已有伏笔（不要重复）：\n${existingContents}` : ""}

【章节标题】${activeChapter.title}

【章节内容】
${JSON.parse(activeChapter.content || '{"content":[]}').content?.map((n: { content?: { text?: string }[] }) => n.content?.map((t) => t.text ?? "").join("") ?? "").join("\n") ?? ""}`;

    try {
      let result = "";
      await aiStream({
        model, apiKey,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 400,
        temperature: 0.4,
        onChunk: (d) => { result += d; },
      });

      // Parse bullet lines
      const lines = result.split("\n")
        .map((l) => l.replace(/^[-•·]\s*/, "").trim())
        .filter((l) => l && l !== "无新伏笔" && l.length > 5);

      for (const line of lines) {
        await add(projectId, line, activeChapter.id);
      }

      if (lines.length === 0) setScanError("AI 未在本章发现新伏笔");
    } catch (e) {
      setScanError(String(e));
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">伏笔追踪</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {planted.length} 条待回收 · {resolved.length} 条已回收
          </p>
        </div>
        <button
          onClick={handleAiScan}
          disabled={scanning || !activeChapter}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
          title={activeChapter ? "AI 扫描当前章节的伏笔" : "请先打开一个章节"}
        >
          {scanning
            ? <><span className="animate-spin inline-block">⟳</span> 扫描中…</>
            : <>✨ AI 扫描当前章节</>}
        </button>
      </div>

      {scanError && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-4">{scanError}</p>
      )}

      {/* Add manually */}
      <div className="flex gap-2 mb-5">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={activeChapter ? `在「${activeChapter.title}」中添加伏笔…` : "添加伏笔…"}
          className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={handleAdd}
          disabled={!newContent.trim()}
          className="px-4 py-2 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          添加
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {(["planted", "all", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === f ? "bg-amber-100 text-amber-700 font-medium" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {f === "planted" ? `待回收 (${planted.length})` : f === "resolved" ? `已回收 (${resolved.length})` : "全部"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">🪢</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {filter === "planted" ? "暂无待回收的伏笔" : filter === "resolved" ? "暂无已回收的伏笔" : "暂无伏笔"}
          </p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">手动添加，或点击「AI 扫描」自动识别</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ForeshadowingCard
              key={item.id}
              item={item}
              chapters={chapters}
              onResolve={handleResolve}
              onReopen={handleReopen}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
