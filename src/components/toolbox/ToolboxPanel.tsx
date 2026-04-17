import { useState } from "react";
import { NamingTool } from "./NamingTool";
import type { Book } from "../../types";

type ToolId = "naming";

interface Tool {
  id: ToolId;
  icon: string;
  label: string;
  desc: string;
}

const TOOLS: Tool[] = [
  { id: "naming", icon: "✍️", label: "取名器", desc: "人名 · 地名" },
];

interface Props {
  project: Book;
}

export function ToolboxPanel({ project }: Props) {
  const [activeTool, setActiveTool] = useState<ToolId>("naming");

  const tool = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-800">
      {/* Left nav */}
      <div className="w-36 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col pt-3">
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
            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Tool content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tool header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tool.icon}</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tool.label}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{tool.desc}</p>
            </div>
          </div>
        </div>

        {/* Tool body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 py-5">
            {activeTool === "naming" && (
              <NamingTool projectGenre={project.genre} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
