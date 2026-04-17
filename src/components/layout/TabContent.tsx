import type { Tab } from "../../store/tabStore";
import type { Book } from "../../types";
import { ChapterEditor } from "../editor/ChapterEditor";
import { CodexPanel } from "../codex/CodexPanel";
import { OutlinePanel } from "../outline/OutlinePanel";
import { ForeshadowingPanel } from "../foreshadowing/ForeshadowingPanel";
import { StatsPanel } from "../stats/StatsPanel";
import { ImportExportPanel } from "../io/ImportExportPanel";
import { InspirationsPanel } from "../inspiration/InspirationsPanel";
import { DeconstructPanel } from "../deconstruct/DeconstructPanel";
import { WritingRulesPanel } from "../rules/WritingRulesPanel";
import { ProjectDocsPanel } from "../docs/ProjectDocsPanel";
import { WritingPacksPanel } from "../packs/WritingPacksPanel";
import { ToolboxPanel } from "../toolbox/ToolboxPanel";

interface TabContentProps {
  tabs: Tab[];
  activeId: string | null;
  project: Book;
  onCaptureOpen: () => void;
  onOpenSettings: () => void;
}

/**
 * Renders all tabs, hiding inactive ones with display:none instead of unmounting.
 * This preserves Tiptap editor undo history and scroll position for each chapter tab.
 */
export function TabContent({ tabs, activeId, project, onCaptureOpen, onOpenSettings }: TabContentProps) {
  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-gray-600">
        <div className="text-center">
          <p className="text-4xl mb-3">+</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">点击上方 + 打开标签页</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">或从左侧选择章节</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden relative">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className="absolute inset-0 flex flex-col"
            style={{ display: isActive ? "flex" : "none" }}
          >
            {tab.type === "chapter" && (
              <ChapterEditor chapterId={tab.entityId} />
            )}
            {tab.type === "outline" && (
              <OutlinePanel
                projectId={project.id}
                projectName={project.title}
                projectGenre={project.genre}
                projectSynopsis={project.synopsis}
              />
            )}
            {tab.type === "codex" && (
              <CodexPanel projectId={project.id} onOpenSettings={onOpenSettings} />
            )}
            {tab.type === "foreshadowing" && (
              <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                <ForeshadowingPanel projectId={project.id} />
              </div>
            )}
            {tab.type === "stats" && (
              <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                <StatsPanel projectId={project.id} />
              </div>
            )}
            {tab.type === "deconstruct" && (
              <DeconstructPanel projectId={project.id} />
            )}
            {tab.type === "inspirations" && (
              <InspirationsPanel
                projectId={project.id}
                onCaptureOpen={onCaptureOpen}
                onSwitchToEditor={() => {}}
              />
            )}
            {tab.type === "io" && (
              <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                <ImportExportPanel project={project} />
              </div>
            )}
            {tab.type === "rules" && (
              <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
                <WritingRulesPanel />
              </div>
            )}
            {tab.type === "docs" && (
              <ProjectDocsPanel projectId={project.id} />
            )}
            {tab.type === "packs" && (
              <WritingPacksPanel projectId={project.id} />
            )}
            {tab.type === "toolbox" && (
              <ToolboxPanel project={project} />
            )}
          </div>
        );
      })}
    </div>
  );
}
