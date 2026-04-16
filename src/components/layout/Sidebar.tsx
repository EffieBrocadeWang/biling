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
import type { Chapter } from "../../types";

// ── Sortable chapter item ──────────────────────────────────────────────────

interface ChapterItemProps {
  chapter: Chapter;
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
          chapter.status === "published" ? "bg-green-400" : "bg-gray-300"
        }`}
        title={chapter.status === "published" ? "已发布" : "草稿"}
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
          <span className="text-sm truncate flex-1">{chapter.title}</span>
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

// ── Main Sidebar ───────────────────────────────────────────────────────────

export function Sidebar() {
  const {
    projectId, volumes, chapters, activeChapterId,
    createChapter, createVolume, deleteChapter,
    renameChapter, renameVolume, setActiveChapter,
    reorderChapters, setChapterStatus,
  } = useEditorStore();

  const [renamingChapter, setRenamingChapter] = useState<number | null>(null);
  const [renamingVolume, setRenamingVolume] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    type: "chapter" | "volume";
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function chaptersForVolume(volumeId: number) {
    return chapters
      .filter((c) => c.volume_id === volumeId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function handleDragEnd(event: DragEndEvent, volumeId: number) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const volChapters = chaptersForVolume(volumeId);
    const oldIndex = volChapters.findIndex((c) => c.id === active.id);
    const newIndex = volChapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(volChapters, oldIndex, newIndex);
    reorderChapters(volumeId, reordered.map((c) => c.id));
  }

  function startRenameChapter(id: number, title: string) {
    setContextMenu(null);
    setRenamingChapter(id);
    setRenameValue(title);
  }

  function startRenameVolume(id: number, title: string) {
    setContextMenu(null);
    setRenamingVolume(id);
    setRenameValue(title);
  }

  function handleContextMenu(e: React.MouseEvent, type: "chapter" | "volume", id: number) {
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
      <div className="flex-1 overflow-y-auto py-2">
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, volume.id)}
              >
                <SortableContext
                  items={volChapters.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {volChapters.map((chapter) => (
                    <ChapterItem
                      key={chapter.id}
                      chapter={chapter}
                      isActive={activeChapterId === chapter.id}
                      isRenaming={renamingChapter === chapter.id}
                      renameValue={renameValue}
                      onSelect={() => setActiveChapter(chapter.id)}
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
              </DndContext>

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
      </div>

      {/* Add volume */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <button
          onClick={() => projectId && createVolume(projectId)}
          className="w-full text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-indigo-600 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          + 新建卷
        </button>
      </div>

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
                  const next = contextChapter.status === "published" ? "draft" : "published";
                  setChapterStatus(contextChapter.id, next);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {contextChapter.status === "published" ? "改为草稿" : "标记为已发布"}
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
