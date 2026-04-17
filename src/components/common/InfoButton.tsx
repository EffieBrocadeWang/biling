import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { HELP_CONTENT } from "../../data/helpContent";

interface Props {
  id: string;         // key in HELP_CONTENT, e.g. 'ai.modes'
  className?: string;
}

export function InfoButton({ id, className = "" }: Props) {
  const { showHelpButtons } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const entry = HELP_CONTENT[id];
  if (!showHelpButtons || !entry) return null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`relative inline-flex ${className}`} ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-indigo-500 hover:border-indigo-400 flex items-center justify-center text-[10px] leading-none transition-colors select-none"
        title={entry.title}
        aria-label={`帮助：${entry.title}`}
      >
        ⓘ
      </button>

      {open && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">ⓘ {entry.title}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none ml-2"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{entry.body}</p>
          {entry.example && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 italic">{entry.example}</p>
          )}
          {entry.tip && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5">💡 {entry.tip}</p>
          )}
        </div>
      )}
    </div>
  );
}
