import { useState, useEffect } from "react";
import { scanText, categoryLabel, type ScanResult, type ScanMatch } from "../../lib/scanner";
import type { Platform } from "../../data/sensitiveWords";

interface Props {
  text: string;
  initialPlatform?: Platform;
  onClose: () => void;
}

const PLATFORM_OPTIONS: { id: Platform; label: string }[] = [
  { id: "all",      label: "通用" },
  { id: "qidian",   label: "起点" },
  { id: "fanqie",   label: "番茄" },
  { id: "jinjiang", label: "晋江" },
  { id: "feilu",    label: "飞卢" },
];

function MatchCard({ match }: { match: ScanMatch }) {
  const isBlock = match.entry.severity === "block";
  return (
    <div className={`rounded-lg border p-3 ${
      isBlock
        ? "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20"
        : "border-yellow-200 bg-yellow-50 dark:border-yellow-800/50 dark:bg-yellow-900/20"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${isBlock ? "text-red-700 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}>
              {match.entry.word}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isBlock
                ? "bg-red-100 text-red-600 dark:bg-red-800/40 dark:text-red-300"
                : "bg-yellow-100 text-yellow-600 dark:bg-yellow-800/40 dark:text-yellow-300"
            }`}>
              {isBlock ? "屏蔽" : "警告"}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {categoryLabel(match.entry.category)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words leading-relaxed">
            {match.context}
          </p>
        </div>
      </div>
      {match.entry.suggestion && (
        <p className="text-xs mt-1.5 text-gray-600 dark:text-gray-300">
          建议替换：<span className="font-medium text-indigo-600 dark:text-indigo-400">{match.entry.suggestion}</span>
        </p>
      )}
    </div>
  );
}

export function SensitivityScanner({ text, initialPlatform = "all", onClose }: Props) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [tab, setTab] = useState<"block" | "warn" | "all">("block");

  useEffect(() => {
    const r = scanText(text, platform);
    setResult(r);
    // Switch to appropriate tab based on results
    if (r.blockCount > 0) setTab("block");
    else if (r.warnCount > 0) setTab("warn");
    else setTab("all");
  }, [text, platform]);

  const displayed = result
    ? tab === "all"
      ? result.matches
      : result.matches.filter((m) => m.entry.severity === (tab === "block" ? "block" : "warn"))
    : [];

  const isClean = result && result.matches.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">敏感词检测</h2>
            {result && !isClean && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {result.blockCount > 0 && (
                  <span className="text-red-500 mr-2">{result.blockCount} 个屏蔽词</span>
                )}
                {result.warnCount > 0 && (
                  <span className="text-yellow-500">{result.warnCount} 个警告词</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Platform tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {PLATFORM_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                platform === p.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Result summary / clean */}
        {isClean ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
            <div className="text-4xl">✓</div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">未检测到敏感词</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-8">
              当前平台（{PLATFORM_OPTIONS.find((p) => p.id === platform)?.label}）规则下，文本无敏感词
            </p>
          </div>
        ) : (
          <>
            {/* Severity tabs */}
            {result && result.matches.length > 0 && (
              <div className="flex gap-2 px-5 pt-3 shrink-0">
                {result.blockCount > 0 && (
                  <button
                    onClick={() => setTab("block")}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                      tab === "block"
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-200 hover:text-red-600"
                    }`}
                  >
                    屏蔽词 {result.blockCount}
                  </button>
                )}
                {result.warnCount > 0 && (
                  <button
                    onClick={() => setTab("warn")}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                      tab === "warn"
                        ? "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-yellow-200 hover:text-yellow-600"
                    }`}
                  >
                    警告词 {result.warnCount}
                  </button>
                )}
                {result.blockCount > 0 && result.warnCount > 0 && (
                  <button
                    onClick={() => setTab("all")}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                      tab === "all"
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-200 hover:text-indigo-600"
                    }`}
                  >
                    全部 {result.matches.length}
                  </button>
                )}
              </div>
            )}

            {/* Match list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0">
              {displayed.map((m, i) => (
                <MatchCard key={i} match={m} />
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
