import { useState } from "react";
import { NamingTool } from "./NamingTool";
import { DeconstructPanel } from "../deconstruct/DeconstructPanel";
import { InspirationsPanel } from "../inspiration/InspirationsPanel";
import { WritingPacksPanel } from "../packs/WritingPacksPanel";
import type { Book } from "../../types";

type ToolId = "naming" | "deconstruct" | "inspirations" | "packs";

interface Tool {
  id: ToolId;
  icon: string;
  label: string;
  desc: string;
}

const TOOLS: Tool[] = [
  { id: "naming",      icon: "✍️", label: "取名器",  desc: "人名 · 地名" },
  { id: "inspirations",icon: "💡", label: "灵感",    desc: "记录创作灵感" },
  { id: "packs",       icon: "📦", label: "资源库",  desc: "写作包 · 素材" },
  { id: "deconstruct", icon: "🔍", label: "拆书",    desc: "AI 分析参考书" },
];

interface Props {
  project: Book;
  onCaptureOpen: () => void;
}

export function ToolboxPanel({ project, onCaptureOpen }: Props) {
  const [activeTool, setActiveTool] = useState<ToolId>("naming");

  const tool = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-800">
      {/* Left nav */}
      <div className="w-28 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col pt-3">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 px-3 mb-2 uppercase tracking-wider">工具箱</p>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`flex flex-col items-start px-3 py-3 mx-1 rounded-lg text-left transition-colors ${
              activeTool === t.id
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <span className="text-lg leading-none mb-1">{t.icon}</span>
            <span className="text-sm font-medium">{t.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Tool content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — only for naming (others have their own headers) */}
        {activeTool === "naming" && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{tool.icon}</span>
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tool.label}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">{tool.desc}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tool body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTool === "naming" && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-xl mx-auto px-6 py-5">
                <NamingTool projectGenre={project.genre} />
              </div>
            </div>
          )}
          {activeTool === "deconstruct" && (
            <DeconstructPanel projectId={project.id} />
          )}
          {activeTool === "inspirations" && (
            <InspirationsPanel
              projectId={project.id}
              onCaptureOpen={onCaptureOpen}
              onSwitchToEditor={() => {}}
            />
          )}
          {activeTool === "packs" && (
            <WritingPacksPanel projectId={project.id} />
          )}
        </div>
      </div>
    </div>
  );
}
