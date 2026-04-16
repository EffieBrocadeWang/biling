import { useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { Sidebar } from "./Sidebar";
import { ChapterEditor } from "../editor/ChapterEditor";
import { CodexPanel } from "../codex/CodexPanel";
import { AiPanel } from "../ai/AiPanel";
import { WritingRulesPanel } from "../rules/WritingRulesPanel";
import { StatsPanel } from "../stats/StatsPanel";
import { ImportExportPanel } from "../io/ImportExportPanel";
import { ForeshadowingPanel } from "../foreshadowing/ForeshadowingPanel";
import { OutlinePanel } from "../outline/OutlinePanel";
import { SearchModal } from "../search/SearchModal";
import { InspirationCapture } from "../inspiration/InspirationCapture";
import { InspirationsPanel } from "../inspiration/InspirationsPanel";
import { DeconstructPanel } from "../deconstruct/DeconstructPanel";
import { SettingsModal } from "../settings/SettingsModal";
import type { Project } from "../../types";

type MainView = "editor" | "outline" | "codex" | "rules" | "foreshadowing" | "inspirations" | "deconstruct" | "stats" | "io";

const TABS: { id: MainView; label: string }[] = [
  { id: "editor",        label: "写作" },
  { id: "outline",       label: "大纲" },
  { id: "codex",         label: "世界百科" },
  { id: "rules",         label: "写作规则" },
  { id: "foreshadowing", label: "伏笔" },
  { id: "inspirations",  label: "灵感" },
  { id: "deconstruct",   label: "拆书" },
  { id: "stats",         label: "统计" },
  { id: "io",            label: "导入导出" },
];

interface Props {
  project: Project;
  onBack: () => void;
}

export function EditorLayout({ project, onBack }: Props) {
  const { loadProjectData, sidebarOpen, aiPanelOpen, toggleSidebar, toggleAiPanel } =
    useEditorStore();
  const [mainView, setMainView] = useState<MainView>("editor");
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  useEffect(() => {
    loadProjectData(project.id);
  }, [project.id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "i") {
        e.preventDefault();
        setShowCapture(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggleSidebar]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:text-gray-600 text-sm"
          >
            ← 书架
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 max-w-32 truncate">{project.name}</span>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full shrink-0">
            {project.genre}
          </span>

          <span className="text-gray-300 dark:text-gray-600 ml-1">|</span>
          <div className="flex gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainView(tab.id)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  mainView === tab.id
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mainView === "editor" && (
            <>
              <button
                onClick={toggleSidebar}
                className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${sidebarOpen ? "text-indigo-600" : "text-gray-400 dark:text-gray-500"}`}
                title="切换侧边栏 (Cmd+\\)"
              >≡</button>
              <button
                onClick={toggleAiPanel}
                className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${aiPanelOpen ? "text-indigo-600" : "text-gray-400 dark:text-gray-500"}`}
                title="切换 AI 面板"
              >AI</button>
            </>
          )}
          <button
            onClick={() => setShowCapture(true)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="记录灵感 (Cmd+Shift+I)"
          >💡</button>
          <button
            onClick={() => setShowSearch(true)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="全文搜索 (Cmd+Shift+F)"
          >🔍</button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            title="设置"
          >⚙</button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {mainView === "editor" && (
          <div className="flex h-full">
            {sidebarOpen && (
              <div className="w-52 shrink-0 overflow-hidden">
                <Sidebar />
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <ChapterEditor />
            </div>
            {aiPanelOpen && (
              <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                <AiPanel />
              </div>
            )}
          </div>
        )}

        {mainView === "outline" && (
          <div className="h-full overflow-hidden">
            <OutlinePanel
              projectId={project.id}
              projectName={project.name}
              projectGenre={project.genre}
              projectSynopsis={project.synopsis}
            />
          </div>
        )}

        {mainView === "codex" && (
          <CodexPanel projectId={project.id} onOpenSettings={() => setShowSettings(true)} />
        )}

        {mainView === "rules" && (
          <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <WritingRulesPanel />
          </div>
        )}

        {mainView === "stats" && (
          <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <StatsPanel projectId={project.id} />
          </div>
        )}

        {mainView === "foreshadowing" && (
          <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <ForeshadowingPanel projectId={project.id} />
          </div>
        )}

        {mainView === "inspirations" && (
          <div className="h-full overflow-hidden">
            <InspirationsPanel
              projectId={project.id}
              onCaptureOpen={() => setShowCapture(true)}
              onSwitchToEditor={() => setMainView("editor")}
            />
          </div>
        )}

        {mainView === "deconstruct" && (
          <div className="h-full overflow-hidden">
            <DeconstructPanel projectId={project.id} />
          </div>
        )}

        {mainView === "io" && (
          <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-800">
            <ImportExportPanel project={project} />
          </div>
        )}
      </div>

      {showCapture && (
        <InspirationCapture
          projectId={project.id}
          onClose={() => setShowCapture(false)}
        />
      )}

      {showSearch && (
        <SearchModal
          projectId={project.id}
          onClose={() => setShowSearch(false)}
          onNavigate={() => setMainView("editor")}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
