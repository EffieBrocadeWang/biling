import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "../../store/editorStore";
import { useOutlineStore } from "../../store/outlineStore";
import { useTabStore } from "../../store/tabStore";
import type { Chapter, OutlineNode, Volume } from "../../types";

// ── Sortable chapter item ──────────────────────────────────────────────────

interface ChapterItemProps {
  chapter: Chapter;
  globalIndex: number;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

function ChapterItem({
  chapter,
  globalIndex,
  isActive,
  isRenaming,
  renameValue,
  onSelect,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: ChapterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`flex items-center px-3 py-2 cursor-pointer group rounded-sm mx-1 ${
        isActive ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
      }`}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="mr-1.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing text-xs shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </span>

      {/* Status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${
          chapter.status === "published" ? "bg-green-400" :
          chapter.status === "done" ? "bg-indigo-400" :
          chapter.status === "review" ? "bg-yellow-400" :
          chapter.status === "writing" ? "bg-blue-400" :
          "bg-gray-300"
        }`}
        title={chapter.status}
      />

      {/* Summary dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 mr-1 ${chapter.summary ? "bg-green-400" : "bg-transparent"}`}
        title={chapter.summary ? "已有摘要" : ""}
      />

      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameCommit();
            else if (e.key === "Escape") onRenameCancel();
          }}
          className="text-sm bg-white dark:bg-gray-900 border border-indigo-400 rounded px-1 w-full outline-none"
        />
      ) : (
        <>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mr-1.5 w-5 text-right tabular-nums">
            {globalIndex}
          </span>
          {chapter.title ? (
            <span className="text-sm truncate flex-1">{chapter.title}</span>
          ) : (
            <span className="text-sm truncate flex-1 text-gray-400 dark:text-gray-500">
              第{globalIndex}章
            </span>
          )}
          {chapter.word_count > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 shrink-0">
              {chapter.word_count}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ── Sidebar outline navigator ──────────────────────────────────────────────

function OutlineNode({ node, activeChapterId, onJump, onCreateLinked }: {
  node: OutlineNode;
  activeChapterId: string | null;
  onJump: (nodeId: string) => void;
  onCreateLinked: (node: OutlineNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const children = (node.children ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const isLeaf = node.level === 3;
  const isLinked = isLeaf && !!node.linked_chapter_id;
  const isUnlinkedLeaf = isLeaf && !node.linked_chapter_id;
  const isActive = isLinked && node.linked_chapter_id === activeChapterId;

  const INDENT = ["", "ml-0", "ml-3", "ml-6"] as const;
  const TITLE_COLOR = node.level === 1
    ? "text-indigo-600 dark:text-indigo-400 font-semibold text-xs"
    : node.level === 2
    ? "text-blue-600 dark:text-blue-400 font-medium text-xs"
    : "text-gray-700 dark:text-gray-200 text-xs";

  return (
    <div className={INDENT[node.level]}>
      <div
        className={`flex items-center gap-1 px-1 py-0.5 rounded group ${
          isActive
            ? "bg-indigo-100 dark:bg-indigo-900/40"
            : isLeaf
            ? "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            : children.length > 0
            ? "cursor-pointer"
            : ""
        }`}
        onClick={() => {
          if (isLeaf) onJump(node.id);          // 章纲: always open outline node view
          else if (children.length > 0) setOpen((v) => !v);
        }}
      >
        {children.length > 0 ? (
          <button
            className="text-gray-300 dark:text-gray-600 hover:text-gray-500 text-xs w-3 shrink-0"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className={`w-3 shrink-0 text-center text-xs ${isLinked ? (isActive ? "text-indigo-500" : "text-gray-300 dark:text-gray-600") : "text-gray-200 dark:text-gray-700"}`}>
            {isLinked ? "•" : "·"}
          </span>
        )}
        <span className={`truncate flex-1 leading-5 ${TITLE_COLOR} ${!node.title ? "italic opacity-50" : ""}`}>
          {node.title || "未命名"}
        </span>
        {/* Unlinked 章纲: show "+" button to create & link a chapter */}
        {isUnlinkedLeaf && (
          <button
            title="新建并关联章节"
            disabled={creating}
            onClick={async (e) => {
              e.stopPropagation();
              setCreating(true);
              await onCreateLinked(node);
              setCreating(false);
            }}
            className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 hover:text-indigo-600 shrink-0 w-4 text-center leading-none"
          >
            {creating ? "…" : "+"}
          </button>
        )}
        {/* Linked 章纲: show doc indicator */}
        {isLinked && (
          <span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 shrink-0" title="已关联正文">📄</span>
        )}
      </div>
      {open && children.length > 0 && (
        <div>
          {children.map((child) => (
            <OutlineNode
              key={child.id}
              node={child}
              activeChapterId={activeChapterId}
              onJump={onJump}
              onCreateLinked={onCreateLinked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarOutline({ projectId }: { projectId: string }) {
  const { tree, nodes, updateNode } = useOutlineStore();
  const { activeChapterId, volumes, createChapter } = useEditorStore();
  const { openOutlineNodeTab } = useTabStore();

  const roots = tree
    .filter((n) => n.book_id === projectId && n.parent_id == null)
    .sort((a, b) => a.sort_order - b.sort_order);

  const hasNodes = nodes.some((n) => n.book_id === projectId);

  if (!hasNodes) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-4">
        <div>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            前往顶部「大纲」标签<br />添加大纲内容
          </p>
        </div>
      </div>
    );
  }

  function handleJump(nodeId: string) {
    // For 章纲 clicks: open the outline node planning view, not the chapter directly
    const node = nodes.find(n => n.id === nodeId);
    if (node) openOutlineNodeTab(node.id, node.title || "章纲");
  }

  async function handleCreateLinked(node: OutlineNode) {
    const sortedVols = [...volumes].sort((a, b) => a.sort_order - b.sort_order);
    if (!sortedVols.length) return;

    // Find which volume corresponds to this node's level-2 ancestor (卷纲)
    // by matching the 卷纲's position among all level-2 nodes → volume at same index
    let targetVol = sortedVols[0];
    if (node.parent_id) {
      const allNodes = nodes.filter((n) => n.book_id === projectId);
      const level2Parent = allNodes.find((n) => n.id === node.parent_id && n.level === 2);
      if (level2Parent) {
        const allLevel2 = allNodes
          .filter((n) => n.level === 2)
          .sort((a, b) => a.sort_order - b.sort_order);
        const idx = allLevel2.findIndex((n) => n.id === level2Parent.id);
        if (idx >= 0 && idx < sortedVols.length) targetVol = sortedVols[idx];
      }
    }

    const title = node.title || "新章节";
    const chapterId = await createChapter(targetVol.id, title);
    await updateNode(node.id, { linked_chapter_id: chapterId });
    openOutlineNodeTab(node.id, node.title || "章纲");
  }

  return (
    <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
      {roots.map((node) => (
        <OutlineNode
          key={node.id}
          node={node}
          activeChapterId={activeChapterId}
          onJump={handleJump}
          onCreateLinked={handleCreateLinked}
        />
      ))}
    </div>
  );
}

// ── Sort-by-outline helpers ────────────────────────────────────────────────

interface SortItem { id: string; volumeId: string; sortOrder: number; }

function computeOutlineSort(
  nodes: OutlineNode[],
  volumes: Volume[],
  chapters: Chapter[],
  projectId: string
): SortItem[] {
  const allNodes = nodes.filter((n) => n.book_id === projectId);
  const sortedVols = [...volumes].sort((a, b) => a.sort_order - b.sort_order);
  if (!sortedVols.length) return [];

  // Walk outline tree in order: level1 → level2 (卷纲) → level3 (章纲)
  // Each level-2 maps to a volume by its global index among all level-2 nodes
  const linkedOrder: { chapterId: string; volId: string }[] = [];
  const linkedSet = new Set<string>();

  const level1 = allNodes.filter((n) => n.level === 1 && n.parent_id == null)
    .sort((a, b) => a.sort_order - b.sort_order);

  let vol2Idx = 0;
  for (const l1 of level1) {
    const level2 = allNodes.filter((n) => n.parent_id === l1.id && n.level === 2)
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const l2 of level2) {
      const targetVolId = (sortedVols[vol2Idx] ?? sortedVols[sortedVols.length - 1]).id;
      const level3 = allNodes.filter((n) => n.parent_id === l2.id && n.level === 3)
        .sort((a, b) => a.sort_order - b.sort_order);
      for (const l3 of level3) {
        if (l3.linked_chapter_id && chapters.some((c) => c.id === l3.linked_chapter_id)) {
          linkedOrder.push({ chapterId: l3.linked_chapter_id, volId: targetVolId });
          linkedSet.add(l3.linked_chapter_id);
        }
      }
      vol2Idx++;
    }
  }

  // Per-volume: linked chapters first (in outline order), then unlinked at end
  const result: SortItem[] = [];
  const volLinked = new Map<string, string[]>();
  for (const { chapterId, volId } of linkedOrder) {
    if (!volLinked.has(volId)) volLinked.set(volId, []);
    volLinked.get(volId)!.push(chapterId);
  }

  for (const vol of sortedVols) {
    const linked = volLinked.get(vol.id) ?? [];
    const unlinked = chapters
      .filter((c) => c.volume_id === vol.id && !linkedSet.has(c.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.id);
    [...linked, ...unlinked].forEach((id, idx) => {
      result.push({ id, volumeId: vol.id, sortOrder: idx });
    });
  }

  // Safety: any chapters not covered (shouldn't happen)
  for (const ch of chapters) {
    if (!result.find((r) => r.id === ch.id)) {
      result.push({ id: ch.id, volumeId: ch.volume_id, sortOrder: 999 });
    }
  }

  return result;
}

// ── Main Sidebar ───────────────────────────────────────────────────────────

export function Sidebar() {
  const {
    projectId, volumes, chapters, activeChapterId,
    createChapter, createVolume, deleteChapter,
    renameChapter, renameVolume, setActiveChapter,
    reorderChapters, setChapterStatus, moveChapterToVolume,
    applyChapterSortOrder,
  } = useEditorStore();
  const { nodes } = useOutlineStore();
  const { openChapterTab } = useTabStore();

  const [sidebarMode, setSidebarMode] = useState<"chapters" | "outline">("chapters");
  const [renamingChapter, setRenamingChapter] = useState<string | null>(null);
  const [renamingVolume, setRenamingVolume] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    type: "chapter" | "volume";
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // Sort-by-outline dialog state
  type SortPhase = "confirm" | "done";
  const [sortPhase, setSortPhase] = useState<SortPhase | null>(null);
  const [sortUnlinked, setSortUnlinked] = useState<string[]>([]);
  const [sortPending, setSortPending] = useState<SortItem[]>([]);
  const [sortSnapshot, setSortSnapshot] = useState<SortItem[] | null>(null);

  function handleSortByOutline() {
    if (!projectId) return;
    const pending = computeOutlineSort(nodes, volumes, chapters, projectId);
    const unlinkedTitles = chapters
      .filter((c) => !nodes.some((n) => n.linked_chapter_id === c.id))
      .map((c) => c.title || "未命名章节");
    setSortPending(pending);
    setSortUnlinked(unlinkedTitles);
    setSortPhase("confirm");
  }

  async function confirmSort() {
    const snapshot: SortItem[] = chapters.map((c) => ({
      id: c.id, volumeId: c.volume_id, sortOrder: c.sort_order,
    }));
    setSortSnapshot(snapshot);
    await applyChapterSortOrder(sortPending);
    setSortPhase("done");
  }

  async function undoSort() {
    if (sortSnapshot) await applyChapterSortOrder(sortSnapshot);
    setSortPhase(null);
    setSortSnapshot(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function chaptersForVolume(volumeId: string) {
    return chapters
      .filter((c) => c.volume_id === volumeId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  // Build global chapter index map: chapterId → 1-based global number
  const globalChapterIndex = (() => {
    const map = new Map<string, number>();
    let idx = 1;
    for (const vol of [...volumes].sort((a, b) => a.sort_order - b.sort_order)) {
      for (const ch of chaptersForVolume(vol.id)) {
        map.set(ch.id, idx++);
      }
    }
    return map;
  })();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeChapter = chapters.find(c => c.id === active.id);
    const overChapter = chapters.find(c => c.id === over.id);
    if (!activeChapter || !overChapter) return;

    const sourceVolumeId = activeChapter.volume_id;
    const targetVolumeId = overChapter.volume_id;

    if (sourceVolumeId === targetVolumeId) {
      // Same volume: reorder within volume
      const volChapters = chaptersForVolume(sourceVolumeId);
      const oldIndex = volChapters.findIndex(c => c.id === active.id);
      const newIndex = volChapters.findIndex(c => c.id === over.id);
      const reordered = arrayMove(volChapters, oldIndex, newIndex);
      reorderChapters(sourceVolumeId, reordered.map(c => c.id));
    } else {
      // Cross-volume: move chapter to target volume, insert before the over chapter
      const tgtChapters = chaptersForVolume(targetVolumeId);
      const insertAt = tgtChapters.findIndex(c => c.id === over.id);
      moveChapterToVolume(activeChapter.id, targetVolumeId, insertAt >= 0 ? insertAt : tgtChapters.length);
    }
  }

  function startRenameChapter(id: string, title: string) {
    setContextMenu(null);
    setRenamingChapter(id);
    setRenameValue(title);
  }

  function startRenameVolume(id: string, title: string) {
    setContextMenu(null);
    setRenamingVolume(id);
    setRenameValue(title);
  }

  function handleContextMenu(e: React.MouseEvent, type: "chapter" | "volume", id: string) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  }

  const contextChapter = contextMenu?.type === "chapter"
    ? chapters.find((c) => c.id === contextMenu.id)
    : null;

  return (
    <div
      className="flex flex-col h-full bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 select-none"
      onClick={() => setContextMenu(null)}
    >
      {/* Mode toggle */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => setSidebarMode("chapters")}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            sidebarMode === "chapters"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-white dark:bg-gray-900"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          章节
        </button>
        <button
          onClick={() => setSidebarMode("outline")}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            sidebarMode === "outline"
              ? "text-indigo-600 border-b-2 border-indigo-500 bg-white dark:bg-gray-900"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          大纲
        </button>
      </div>

      {/* Outline mode */}
      {sidebarMode === "outline" && projectId && (
        <SidebarOutline projectId={projectId} />
      )}

      {/* Chapters mode */}
      {sidebarMode === "chapters" && (<><div className="flex-1 overflow-y-auto py-2">
        {volumes.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-2xl mb-2">📖</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-3 leading-relaxed">新建一卷开始写作</p>
            <button
              onClick={() => projectId && createVolume(projectId)}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + 新建第一卷
            </button>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {volumes.map((volume) => {
            const volChapters = chaptersForVolume(volume.id);

            return (
              <div key={volume.id}>
                {/* Volume header */}
                <div
                  className="flex items-center justify-between px-3 py-1.5 group"
                  onContextMenu={(e) => handleContextMenu(e, "volume", volume.id)}
                >
                  {renamingVolume === volume.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={async () => {
                        if (renameValue.trim()) await renameVolume(volume.id, renameValue.trim());
                        setRenamingVolume(null);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          if (renameValue.trim()) await renameVolume(volume.id, renameValue.trim());
                          setRenamingVolume(null);
                        } else if (e.key === "Escape") {
                          setRenamingVolume(null);
                        }
                      }}
                      className="text-xs font-semibold bg-white dark:bg-gray-900 border border-indigo-400 rounded px-1 w-full outline-none"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {volume.title}
                    </span>
                  )}
                  <button
                    onClick={() => createChapter(volume.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-indigo-600 text-lg leading-none ml-1"
                    title="新建章节"
                  >
                    +
                  </button>
                </div>

                {/* Sortable chapters */}
                <SortableContext
                  items={volChapters.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {volChapters.map((chapter) => (
                    <ChapterItem
                      key={chapter.id}
                      chapter={chapter}
                      globalIndex={globalChapterIndex.get(chapter.id) ?? 0}
                      isActive={activeChapterId === chapter.id}
                      isRenaming={renamingChapter === chapter.id}
                      renameValue={renameValue}
                      onSelect={() => {
                        const title = chapter.title || `第${globalChapterIndex.get(chapter.id) ?? ""}章`;
                        openChapterTab(chapter.id, title);
                        setActiveChapter(chapter.id);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, "chapter", chapter.id)}
                      onRenameChange={setRenameValue}
                      onRenameCommit={async () => {
                        if (renameValue.trim()) await renameChapter(chapter.id, renameValue.trim());
                        setRenamingChapter(null);
                      }}
                      onRenameCancel={() => setRenamingChapter(null)}
                    />
                  ))}
                </SortableContext>

                {volChapters.length === 0 && (
                  <div
                    onClick={() => createChapter(volume.id)}
                    className="text-xs text-gray-400 dark:text-gray-500 px-5 py-2 cursor-pointer hover:text-indigo-500"
                  >
                    + 新建章节
                  </div>
                )}
              </div>
            );
          })}
        </DndContext>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 p-2 shrink-0 space-y-1">
        <button
          onClick={() => projectId && createVolume(projectId)}
          className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          + 新建卷
        </button>
        <button
          onClick={handleSortByOutline}
          disabled={volumes.length === 0}
          className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-40"
          title="按大纲顺序重排所有章节"
        >
          ↕ 按大纲排序
        </button>
      </div>

      {/* Confirm sort dialog */}
      {sortPhase === "confirm" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">按大纲排序</h3>
            {sortUnlinked.length > 0 ? (
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                {sortUnlinked.map((t) => `【${t}】`).join("")}
                {" 没有和大纲关联，排序后会排到最后，不是按照当前次序。你可以先关联再排序。"}
                <br /><br />是否现在排序？
              </p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                自动排序会影响当前章节顺序，此动作可以撤销，是否现在排序？
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSortPhase(null)}
                className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
              >
                取消
              </button>
              <button
                onClick={confirmSort}
                className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                现在排序
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done/undo dialog */}
      {sortPhase === "done" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">排序已完成</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">章节已按大纲顺序重新排列。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={undoSort}
                className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded border border-gray-200 dark:border-gray-700"
              >
                撤销
              </button>
              <button
                onClick={() => { setSortPhase(null); setSortSnapshot(null); }}
                className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                接受
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg py-1 min-w-36"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "chapter" && contextChapter && (
            <>
              <button
                onClick={() => startRenameChapter(contextChapter.id, contextChapter.title)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                重命名
              </button>
              <button
                onClick={() => {
                  const cycle: import("../../types").Chapter["status"][] = ["draft", "writing", "review", "done", "published"];
                  const nextIdx = (cycle.indexOf(contextChapter.status) + 1) % cycle.length;
                  const next = cycle[nextIdx];
                  setChapterStatus(contextChapter.id, next);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                切换状态
              </button>
              <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
              <button
                onClick={() => {
                  deleteChapter(contextMenu.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                删除
              </button>
            </>
          )}
          {contextMenu.type === "volume" && (
            <button
              onClick={() => {
                const vol = volumes.find((v) => v.id === contextMenu.id);
                if (vol) startRenameVolume(vol.id, vol.title);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              重命名
            </button>
          )}
        </div>
      )}
    </div>
  );
}
