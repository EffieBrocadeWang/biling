import { useEffect, useState } from "react";
import { useInspirationStore } from "../../store/inspirationStore";
import { useAiStore } from "../../store/aiStore";
import type { Inspiration } from "../../types";

interface Props {
  projectId: string;
  onCaptureOpen: () => void;
  onSwitchToEditor: () => void;
}

function InspirationCard({
  item,
  onDelete,
  onContinue,
}: {
  item: Inspiration;
  onDelete: () => void;
  onContinue: () => void;
}) {
  const { update } = useInspirationStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);

  async function commitEdit() {
    if (draft.trim() && draft !== item.content) {
      await update(item.id, draft.trim());
    }
    setEditing(false);
  }

  const dateStr = new Date(item.created_at).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 group hover:border-indigo-200 transition-colors">
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(item.content); setEditing(false); } }}
          rows={3}
          className="w-full text-sm outline-none resize-none leading-relaxed"
          style={{ fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}
        />
      ) : (
        <p
          className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap cursor-text"
          onClick={() => setEditing(true)}
        >
          {item.content}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr}</span>
          {item.linked_chapter_id && (
            <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2 py-0.5 rounded-full">
              已关联章节
            </span>
          )}
          {item.is_used === 1 && (
            <span className="text-xs bg-green-50 text-green-500 px-2 py-0.5 rounded-full">已使用</span>
          )}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onContinue}
            className="text-xs text-indigo-500 hover:text-indigo-700"
            title="在此基础上续写"
          >
            续写
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

export function InspirationsPanel({ projectId, onCaptureOpen, onSwitchToEditor }: Props) {
  const { items, load, remove } = useInspirationStore();
  const { setMode } = useAiStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    load(projectId);
  }, [projectId]);

  const filtered = search.trim()
    ? items.filter((i) => i.content.toLowerCase().includes(search.toLowerCase()))
    : items;

  function handleContinue(item: Inspiration) {
    setMode("续写");
    window.dispatchEvent(new CustomEvent("writerblock:continue", {
      detail: `请在以下灵感的基础上续写：\n\n${item.content}`,
    }));
    onSwitchToEditor();
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">灵感收集</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {items.length > 0 ? `${items.length} 条灵感` : "随时捕捉你的写作灵感"}
          </p>
        </div>
        <button
          onClick={onCaptureOpen}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          💡 记录灵感
        </button>
      </div>

      {/* Search */}
      {items.length > 3 && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索灵感…"
            className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-300 bg-gray-50 dark:bg-gray-800"
          />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 && search ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            未找到包含「{search}」的灵感
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-3">💡</p>
            <p className="text-sm mb-1">还没有记录任何灵感</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mb-4">
              按 <kbd className="border border-gray-200 dark:border-gray-700 rounded px-1 text-gray-400 dark:text-gray-500">⌘ Shift I</kbd> 随时捕捉灵感
            </p>
            <button
              onClick={onCaptureOpen}
              className="text-xs px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              记录第一条灵感
            </button>
          </div>
        ) : (
          filtered.map((item) => (
            <InspirationCard
              key={item.id}
              item={item}
              onDelete={() => remove(item.id)}
              onContinue={() => handleContinue(item)}
            />
          ))
        )}
      </div>

      {/* Shortcut hint */}
      {items.length > 0 && (
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-white dark:bg-gray-900 text-xs text-gray-400 dark:text-gray-500 flex items-center justify-between">
          <span>点击灵感内容可直接编辑</span>
          <span><kbd className="border border-gray-100 dark:border-gray-800 rounded px-1">⌘⇧I</kbd> 快速捕捉</span>
        </div>
      )}
    </div>
  );
}
