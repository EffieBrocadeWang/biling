import { useState, useEffect, useRef } from "react";
import { useOutlineStore } from "../../store/outlineStore";
import { useEditorStore } from "../../store/editorStore";
import { useTabStore } from "../../store/tabStore";

interface Props {
  nodeId: string;
}

export function OutlineNodePanel({ nodeId }: Props) {
  const { nodes, updateNode } = useOutlineStore();
  const { chapters, volumes, createChapter } = useEditorStore();
  const { openChapterTab, updateTabTitle } = useTabStore();

  const node = nodes.find((n) => n.id === nodeId) ?? null;

  const [title, setTitle] = useState(node?.title ?? "");
  const [content, setContent] = useState(node?.content ?? "");
  const [creating, setCreating] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when node changes (e.g. renamed from OutlinePanel)
  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setContent(node.content);
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
        章纲不存在或已删除
      </div>
    );
  }

  const currentNode = node; // non-null alias for closures below

  const linkedChapter = currentNode.linked_chapter_id
    ? chapters.find((c) => c.id === currentNode.linked_chapter_id) ?? null
    : null;

  function scheduleContentSave(value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateNode(currentNode.id, { content: value });
    }, 800);
  }

  async function handleTitleBlur() {
    const trimmed = title.trim();
    if (trimmed !== currentNode.title) {
      await updateNode(currentNode.id, { title: trimmed });
      updateTabTitle(currentNode.id, trimmed);
    }
  }

  async function handleCreateLinked() {
    // Infer target volume from the L2 parent's position among all L2 nodes
    const l2Parent = currentNode.parent_id
      ? nodes.find(n => n.id === currentNode.parent_id)
      : null;

    const allL2 = nodes
      .filter(n => n.level === 2 && n.book_id === currentNode.book_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const l2Index = l2Parent ? allL2.findIndex(n => n.id === l2Parent.id) : -1;
    const sortedVols = [...volumes].sort((a, b) => a.sort_order - b.sort_order);
    const targetVol = (l2Index >= 0 && l2Index < sortedVols.length)
      ? sortedVols[l2Index]
      : sortedVols[0];

    if (!targetVol) return;

    // Infer target position from L3 sibling index under same L2 parent
    const l3Siblings = l2Parent
      ? nodes.filter(n => n.parent_id === l2Parent.id).sort((a, b) => a.sort_order - b.sort_order)
      : [];
    const targetPosition = l3Siblings.findIndex(n => n.id === currentNode.id);
    const volChapterCount = chapters.filter(c => c.volume_id === targetVol.id).length;

    setCreating(true);

    // Create empty gap-filling chapters if needed
    for (let i = volChapterCount; i < targetPosition; i++) {
      await createChapter(targetVol.id, "");
    }

    const chapterTitle = title.trim() || "新章节";
    const chapterId = await createChapter(targetVol.id, chapterTitle);
    await updateNode(currentNode.id, { linked_chapter_id: chapterId });
    setCreating(false);
  }

  async function handleLinkToExisting(chapterId: string) {
    await updateNode(currentNode.id, { linked_chapter_id: chapterId || null });
    setShowLinkEditor(false);
  }

  function openLinkedChapter() {
    if (!linkedChapter) return;
    openChapterTab(linkedChapter.id, linkedChapter.title || "章节");
  }

  const LEVEL_LABEL = ["", "全书大纲", "卷纲", "章纲"][currentNode.level] ?? "节点";

  // Chapters grouped by volume for the link editor
  const sortedVols = [...volumes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
          {LEVEL_LABEL} · L{currentNode.level}
        </span>

        {/* Linked chapter actions */}
        <div className="flex items-center gap-2">
          {linkedChapter ? (
            <>
              <button
                onClick={openLinkedChapter}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium"
                title="在新标签页打开正文"
              >
                <span>打开正文</span>
                <span className="opacity-60 truncate max-w-24">
                  {linkedChapter.title || "未命名"}
                </span>
                <span>→</span>
              </button>
              <button
                onClick={() => setShowLinkEditor(v => !v)}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="编辑关联章节"
              >
                编辑关联
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCreateLinked}
                disabled={creating}
                className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
              >
                {creating ? "创建中…" : "+ 新建正文"}
              </button>
              <button
                onClick={() => setShowLinkEditor(v => !v)}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="关联已有章节"
              >
                关联已有
              </button>
            </>
          )}
        </div>
      </div>

      {/* Link editor dropdown */}
      {showLinkEditor && (
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">选择要关联的正文章节：</p>
          <select
            defaultValue={currentNode.linked_chapter_id ?? ""}
            onChange={(e) => handleLinkToExisting(e.target.value)}
            className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-400"
          >
            <option value="">— 不关联 —</option>
            {sortedVols.map(vol => {
              const volChapters = chapters
                .filter(c => c.volume_id === vol.id)
                .sort((a, b) => a.sort_order - b.sort_order);
              if (volChapters.length === 0) return null;
              return (
                <optgroup key={vol.id} label={vol.title}>
                  {volChapters.map((ch, i) => (
                    <option key={ch.id} value={ch.id}>
                      第{i + 1}章 {ch.title || "（未命名）"}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <button
            onClick={() => setShowLinkEditor(false)}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            取消
          </button>
        </div>
      )}

      {/* Editable content area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="章纲标题…"
          className="w-full text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent outline-none border-none placeholder-gray-300 dark:placeholder-gray-600 mb-4"
        />

        {/* Content / planning notes */}
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleContentSave(e.target.value);
          }}
          placeholder={`在此记录本章纲的详细规划：\n\n• 本章核心目标\n• 主要事件和节拍\n• 角色动机与变化\n• 伏笔埋设 / 回收\n• 情绪曲线和节奏`}
          className="w-full flex-1 text-sm text-gray-700 dark:text-gray-200 bg-transparent outline-none border-none resize-none placeholder-gray-300 dark:placeholder-gray-600 leading-relaxed"
          style={{ minHeight: "60vh" }}
        />
      </div>

      {/* Status bar */}
      <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0 flex items-center justify-between text-xs text-gray-300 dark:text-gray-600">
        <span>{content.length > 0 ? `${content.length} 字` : "暂无内容"}</span>
        {linkedChapter && (
          <button
            onClick={openLinkedChapter}
            className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
          >
            正文：{linkedChapter.title || "未命名"} →
          </button>
        )}
      </div>
    </div>
  );
}
