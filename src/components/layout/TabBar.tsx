import { useState, useRef, useEffect } from "react";
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTabStore, type Tab, type TabType, TAB_ICONS, TAB_LABELS } from "../../store/tabStore";

// Non-chapter tab types the user can open from the + menu
const NEW_TAB_OPTIONS: TabType[] = [
  "outline", "codex", "foreshadowing", "stats",
  "deconstruct", "inspirations", "rules", "docs", "packs", "io", "toolbox",
];

// ── Sortable tab item ──────────────────────────────────────────────────────

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function SortableTab({ tab, isActive, onActivate, onClose, onContextMenu }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 px-2.5 py-1 text-xs border-r border-gray-200 dark:border-gray-700 cursor-pointer shrink-0 max-w-44 group transition-colors ${
        isActive
          ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-[inset_0_-2px_0_0] shadow-indigo-500"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      title={tab.title}
      {...attributes}
      {...listeners}
    >
      <span className="shrink-0 text-[11px]">{TAB_ICONS[tab.type]}</span>
      <span className="truncate">{tab.title || "未命名"}</span>
      <button
        className={`shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-300 dark:hover:bg-gray-600 leading-none text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 ml-0.5 transition-opacity ${
          isActive ? "opacity-70" : "opacity-0 group-hover:opacity-70"
        }`}
        onClick={onClose}
        title="关闭标签页 (Ctrl+W)"
      >
        ×
      </button>
    </div>
  );
}

// ── TabBar ─────────────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  panel: "left" | "right";
}

export function TabBar({ tabs, activeId, panel }: TabBarProps) {
  const { activateTab, closeTab, closeOtherTabs, closeRightTabs, moveTabToOtherPanel, setFocusedPanel, openTab, reorderTabs } =
    useTabStore();
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const newTabBtnRef = useRef<HTMLButtonElement>(null);
  const newTabMenuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Close menus on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        newTabMenuRef.current && !newTabMenuRef.current.contains(target) &&
        newTabBtnRef.current && !newTabBtnRef.current.contains(target)
      ) {
        setShowNewTabMenu(false);
      }
      if (contextMenu && !((e.target as Element).closest?.(".tab-context-menu"))) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [contextMenu]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex(t => t.id === active.id);
    const newIndex = tabs.findIndex(t => t.id === over.id);
    reorderTabs(panel, arrayMove(tabs, oldIndex, newIndex));
  }

  function handleContextMenu(e: React.MouseEvent, tabId: string) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }

  function handleContextAction(action: string) {
    if (!contextMenu) return;
    const { tabId } = contextMenu;
    if (action === "close") closeTab(tabId);
    else if (action === "closeOthers") closeOtherTabs(tabId, panel);
    else if (action === "closeRight") closeRightTabs(tabId, panel);
    else if (action === "moveToOther") moveTabToOtherPanel(tabId);
    setContextMenu(null);
  }

  function handleOpenNewTab(type: TabType) {
    openTab({ type, title: TAB_LABELS[type] }, panel);
    setShowNewTabMenu(false);
    setFocusedPanel(panel);
  }

  return (
    // Outer: two sections — scrollable tabs + fixed buttons (no overflow on outer)
    <div
      className="flex items-stretch bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 select-none"
      style={{ minHeight: "33px" }}
      onClick={() => setFocusedPanel(panel)}
    >
      {/* Scrollable tab list */}
      <div className="flex items-stretch overflow-x-auto flex-1 min-w-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeId}
                onActivate={() => { activateTab(tab.id); setFocusedPanel(panel); }}
                onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* + New tab button — outside overflow container so dropdown isn't clipped */}
      <div className="relative shrink-0 border-l border-gray-200 dark:border-gray-700">
        <button
          ref={newTabBtnRef}
          className="h-full px-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-colors"
          onClick={(e) => { e.stopPropagation(); setFocusedPanel(panel); setShowNewTabMenu(v => !v); }}
          title="新建标签页"
        >
          +
        </button>

        {showNewTabMenu && (
          <div
            ref={newTabMenuRef}
            className="absolute top-full right-0 z-50 bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg py-1 min-w-36"
            onClick={(e) => e.stopPropagation()}
          >
            {NEW_TAB_OPTIONS.map((type) => (
              <button
                key={type}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                onClick={() => handleOpenNewTab(type)}
              >
                <span>{TAB_ICONS[type]}</span>
                <span>{TAB_LABELS[type]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right-click context menu (fixed position, not clipped) */}
      {contextMenu && (
        <div
          className="tab-context-menu fixed z-50 bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg py-1 min-w-28"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => handleContextAction("moveToOther")}
          >{panel === "left" ? "移到右侧面板 →" : "← 移到左侧面板"}</button>
          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => handleContextAction("close")}
          >关闭</button>
          <button
            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => handleContextAction("closeOthers")}
          >关闭其他</button>
          <button
            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => handleContextAction("closeRight")}
          >关闭右侧</button>
        </div>
      )}
    </div>
  );
}
