import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useTabStore, TAB_LABELS } from "../../store/tabStore";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { AiPanel } from "../ai/AiPanel";
import { SearchModal } from "../search/SearchModal";
import { InspirationCapture } from "../inspiration/InspirationCapture";
import { SettingsModal } from "../settings/SettingsModal";
import type { Book } from "../../types";

interface Props {
  project: Book;
  onBack: () => void;
}

export function EditorLayout({ project, onBack }: Props) {
  const { loadProjectData, sidebarOpen, aiPanelOpen, toggleSidebar, toggleAiPanel, setActiveChapter } =
    useEditorStore();
  const {
    init: initTabs, leftTabs, rightTabs, activeLeftId, activeRightId,
    splitMode, splitRatio, focusedPanel, setSplitMode, setSplitRatio, setFocusedPanel,
    openTab, getActiveTab,
  } = useTabStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Load project data + restore tab state on mount
  useEffect(() => {
    loadProjectData(project.id);
    initTabs(project.id);
  }, [project.id]);

  // Sync activeChapterId in editorStore with the focused panel's active chapter tab
  // (needed so AI context builder always knows the current chapter)
  useEffect(() => {
    const tab = getActiveTab(focusedPanel);
    if (tab?.type === "chapter" && tab.entityId) {
      setActiveChapter(tab.entityId);
    }
  }, [
    focusedPanel,
    focusedPanel === "left" ? activeLeftId : activeRightId,
  ]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Ctrl+\ — toggle sidebar
      if (e.key === "\\" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl+Shift+\ — toggle split view
      if ((e.key === "\\" || e.key === "|") && e.shiftKey) {
        e.preventDefault();
        const { splitMode: mode, setSplitMode: setMode } = useTabStore.getState();
        setMode(mode === "split" ? "single" : "split");
        return;
      }

      // Ctrl+Shift+F — search
      if (e.key === "f" && e.shiftKey) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Ctrl+Shift+I — capture inspiration
      if (e.key === "i" && e.shiftKey) {
        e.preventDefault();
        setShowCapture(true);
        return;
      }

      // Ctrl+W — close current tab
      if (e.key === "w" && !e.shiftKey) {
        // Don't prevent default on macOS since Cmd+W closes the window — only block on non-mac
        const state = useTabStore.getState();
        const tabs = state.focusedPanel === "left" ? state.leftTabs : state.rightTabs;
        const activeId = state.focusedPanel === "left" ? state.activeLeftId : state.activeRightId;
        if (tabs.length > 0 && activeId) {
          e.preventDefault();
          state.closeTab(activeId);
        }
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — next/prev tab
      if (e.key === "Tab") {
        e.preventDefault();
        const state = useTabStore.getState();
        const tabs = state.focusedPanel === "left" ? state.leftTabs : state.rightTabs;
        const activeId = state.focusedPanel === "left" ? state.activeLeftId : state.activeRightId;
        if (tabs.length < 2) return;
        const idx = tabs.findIndex(t => t.id === activeId);
        const next = e.shiftKey
          ? tabs[(idx - 1 + tabs.length) % tabs.length]
          : tabs[(idx + 1) % tabs.length];
        state.activateTab(next.id);
        return;
      }

      // Ctrl+Shift+T — reopen last closed tab
      if (e.key === "t" && e.shiftKey) {
        e.preventDefault();
        useTabStore.getState().reopenLastClosed();
        return;
      }

      // Ctrl+1–9 — jump to tab N
      if (e.key >= "1" && e.key <= "9" && !e.shiftKey) {
        const n = parseInt(e.key) - 1;
        const state = useTabStore.getState();
        const tabs = state.focusedPanel === "left" ? state.leftTabs : state.rightTabs;
        if (n < tabs.length) {
          e.preventDefault();
          state.activateTab(tabs[n].id);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleSidebar]);

  // ── Split divider drag ─────────────────────────────────────────────────────
  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDraggingDivider(true);
  }

  useEffect(() => {
    if (!isDraggingDivider) return;
    function onMouseMove(e: MouseEvent) {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
    }
    function onMouseUp() {
      setIsDraggingDivider(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingDivider, setSplitRatio]);

  // ── Quick-open tab from top nav ────────────────────────────────────────────
  function openSingletonTab(type: Parameters<typeof openTab>[0]["type"]) {
    openTab({ type, title: TAB_LABELS[type] });
  }

  const activeFocusedTab = getActiveTab(focusedPanel);
  // Show AI panel for chapter editing and outline editing; hide for other tab types
  const showAiPanel = aiPanelOpen && (
    activeFocusedTab?.type === "chapter" ||
    activeFocusedTab?.type === "outline" ||
    activeFocusedTab?.type === "outlinenode" ||
    activeFocusedTab == null
  );

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
          >← 书架</button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 max-w-32 truncate">{project.title}</span>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full shrink-0">
            {project.genre}
          </span>

          <span className="text-gray-300 dark:text-gray-600 ml-1">|</span>

          {/* Quick-open tab buttons */}
          <div className="flex gap-0.5">
            {[
              { type: "outline" as const,       label: "大纲" },
              { type: "codex" as const,         label: "百科" },
              { type: "foreshadowing" as const, label: "伏笔" },
              { type: "stats" as const,         label: "统计" },
              { type: "rules" as const,         label: "规则" },
              { type: "docs" as const,          label: "文档" },
              { type: "io" as const,            label: "导入导出" },
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => openSingletonTab(item.type)}
                className="px-2.5 py-1 text-xs rounded transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => openSingletonTab("toolbox")}
              className="px-2.5 py-1 text-xs rounded transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
            >
              🧰 工具箱
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Split toggle */}
          <button
            onClick={() => setSplitMode(splitMode === "split" ? "single" : "split")}
            className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${splitMode === "split" ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" : "text-gray-400 dark:text-gray-500"}`}
            title={`${splitMode === "split" ? "关闭" : "开启"}分屏 (Ctrl+Shift+\\)`}
          >⊞ 分屏</button>

          <button
            onClick={toggleSidebar}
            className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${sidebarOpen ? "text-indigo-600" : "text-gray-400 dark:text-gray-500"}`}
            title="切换侧边栏 (Ctrl+\\)"
          >≡</button>
          <button
            onClick={toggleAiPanel}
            className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${aiPanelOpen ? "text-indigo-600" : "text-gray-400 dark:text-gray-500"}`}
            title="切换 AI 面板"
          >AI</button>
          <button
            onClick={() => setShowCapture(true)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="记录灵感 (Ctrl+Shift+I)"
          >💡</button>
          <button
            onClick={() => setShowSearch(true)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="全文搜索 (Ctrl+Shift+F)"
          >🔍</button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="设置"
          >⚙</button>
          <button
            onClick={() => openSingletonTab("about")}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="关于笔灵"
          >ℹ</button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-52 shrink-0 overflow-hidden">
            <Sidebar />
          </div>
        )}

        {/* Tab panels */}
        <div
          ref={splitContainerRef}
          className={`flex-1 flex overflow-hidden ${isDraggingDivider ? "cursor-col-resize select-none" : ""}`}
        >
          {/* Left panel */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ width: splitMode === "split" ? `${splitRatio * 100}%` : "100%" }}
            onMouseDown={() => setFocusedPanel("left")}
          >
            <TabBar tabs={leftTabs} activeId={activeLeftId} panel="left" />
            <TabContent
              tabs={leftTabs}
              activeId={activeLeftId}
              project={project}
              onCaptureOpen={() => setShowCapture(true)}
              onOpenSettings={() => setShowSettings(true)}
            />
          </div>

          {/* Divider + right panel */}
          {splitMode === "split" && (
            <>
              <div
                className={`w-1 shrink-0 transition-colors cursor-col-resize ${
                  isDraggingDivider
                    ? "bg-indigo-500"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-indigo-400"
                }`}
                onMouseDown={onDividerMouseDown}
                onDoubleClick={() => setSplitRatio(0.5)}
                title="拖拽调整比例，双击恢复 50/50"
              />

              <div
                className="flex flex-col flex-1 overflow-hidden"
                onMouseDown={() => setFocusedPanel("right")}
              >
                <TabBar tabs={rightTabs} activeId={activeRightId} panel="right" />
                <TabContent
                  tabs={rightTabs}
                  activeId={activeRightId}
                  project={project}
                  onCaptureOpen={() => setShowCapture(true)}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>
            </>
          )}
        </div>

        {/* AI panel */}
        {showAiPanel && (
          <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <AiPanel />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showCapture && (
        <InspirationCapture projectId={project.id} onClose={() => setShowCapture(false)} />
      )}
      {showSearch && (
        <SearchModal
          projectId={project.id}
          onClose={() => setShowSearch(false)}
          onNavigate={() => {
            // SearchModal already called setActiveChapter; open the chapter tab here
            const { activeChapterId, chapters } = useEditorStore.getState();
            if (activeChapterId) {
              const ch = chapters.find(c => c.id === activeChapterId);
              useTabStore.getState().openChapterTab(activeChapterId, ch?.title || "章节");
            }
          }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
