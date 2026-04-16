import { useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { useInspirationStore } from "../../store/inspirationStore";
import { aiStream } from "../../lib/ai";

const DIMENSIONS = [
  { id: "structure", label: "📐 结构分析", desc: "章节节奏、起承转合、高潮分布" },
  { id: "character", label: "🎭 角色分析", desc: "人物出场、性格刻画、角色关系" },
  { id: "writing",   label: "📝 写法分析", desc: "描写手法、对话比例、叙事视角" },
  { id: "hook",      label: "🎣 钩子分析", desc: "悬念设置、章末 hook、留存技巧" },
];

interface AnalysisResult {
  dimensionId: string;
  content: string;
  loading: boolean;
}

interface Props {
  projectId: number;
}

export function DeconstructPanel({ projectId }: Props) {
  const { getActiveModel, getKeyForModel } = useSettingsStore();
  const { add: addInspiration } = useInspirationStore();

  const [inputText, setInputText] = useState("");
  const [selectedDims, setSelectedDims] = useState<string[]>(["structure", "hook"]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const wordCount = inputText.replace(/\s/g, "").length;

  function toggleDim(id: string) {
    setSelectedDims((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  async function analyze() {
    if (!inputText.trim() || selectedDims.length === 0) return;

    const model = getActiveModel();
    if (!model) { setError("请先在设置中配置 AI 模型"); return; }
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) { setError("请先在设置中填写 API Key"); return; }

    setError("");
    setAnalyzing(true);
    setResults([]);
    setActiveTab(null);

    const dimLabels = selectedDims.map((d) => DIMENSIONS.find((dim) => dim.id === d)?.label ?? d);

    const prompt = `你是一位资深网文评论家和结构分析师。请分析以下小说片段。

【分析维度】${dimLabels.join("、")}

要求：
1. 对每个维度分别给出具体的分析结论（200-300字）
2. 用「【原文引用】」标注具体段落例子（如有）
3. 每个维度末尾给出 2-3 条可操作的写作技巧总结

请严格按照以下格式输出，每个维度之间用 "---DIMENSION---" 分隔：

${selectedDims.map((d) => {
  const dim = DIMENSIONS.find((dim) => dim.id === d);
  return `【${dim?.label ?? d}】\n（${dim?.desc}的分析内容）`;
}).join("\n---DIMENSION---\n")}

---DIMENSION---（以上格式，每个维度一段）

【分析文本】
${inputText.slice(0, 15000)}`;

    // Initialize results as loading
    const initResults: AnalysisResult[] = selectedDims.map((id) => ({
      dimensionId: id,
      content: "",
      loading: true,
    }));
    setResults(initResults);
    setActiveTab(selectedDims[0]);

    let full = "";
    try {
      await aiStream({
        model,
        apiKey: key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 3000,
        temperature: 0.7,
        onChunk: (delta) => {
          full += delta;
          // Parse streaming output into dimension segments
          const segments = full.split("---DIMENSION---");
          setResults(
            selectedDims.map((id, idx) => ({
              dimensionId: id,
              content: (segments[idx] ?? "").trim(),
              loading: idx === segments.length - 1 && full.length > 0,
            }))
          );
        },
      });

      // Final parse
      const segments = full.split("---DIMENSION---");
      setResults(
        selectedDims.map((id, idx) => ({
          dimensionId: id,
          content: (segments[idx] ?? "").trim(),
          loading: false,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请重试");
      setResults([]);
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveToInspiration(result: AnalysisResult) {
    const dim = DIMENSIONS.find((d) => d.id === result.dimensionId);
    await addInspiration(projectId, `【拆书笔记 · ${dim?.label ?? result.dimensionId}】\n\n${result.content}`, {
      source: "deconstruct",
    });
    setSavedIds((prev) => new Set([...prev, result.dimensionId]));
  }

  const activeResult = results.find((r) => r.dimensionId === activeTab);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">拆书工具</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">粘贴任意小说文本，AI 分析其写作技巧和结构</p>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: input */}
        <div className="w-80 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 dark:text-gray-600">粘贴小说文本</label>
                <span className="text-xs text-gray-400 dark:text-gray-500">{wordCount.toLocaleString()} 字</span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={"粘贴 5,000 – 50,000 字的小说文本\n\n可以是：\n• 你自己的章节\n• 喜欢的网文片段\n• 任意中文小说内容"}
                rows={16}
                className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-300 resize-none leading-relaxed bg-gray-50 dark:bg-gray-800"
                style={{ fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}
              />
              {wordCount > 0 && wordCount < 1000 && (
                <p className="text-xs text-amber-500 mt-1">建议粘贴 1000 字以上，分析更准确</p>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 dark:text-gray-600 mb-2 block">分析维度</label>
              <div className="space-y-2">
                {DIMENSIONS.map((dim) => (
                  <label key={dim.id} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedDims.includes(dim.id)}
                      onChange={() => toggleDim(dim.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-indigo-600">{dim.label}</span>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{dim.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <button
              onClick={analyze}
              disabled={analyzing || !inputText.trim() || selectedDims.length === 0}
              className="w-full py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {analyzing ? "AI 分析中…" : "✦ 开始分析"}
            </button>
          </div>
        </div>

        {/* Right: results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {results.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-gray-600">
              <div className="text-center">
                <p className="text-4xl mb-3">📖</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">粘贴文本后点击「开始分析」</p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">支持 5,000 – 50,000 字</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0 px-4 pt-3 gap-1">
                {results.map((r) => {
                  const dim = DIMENSIONS.find((d) => d.id === r.dimensionId);
                  return (
                    <button
                      key={r.dimensionId}
                      onClick={() => setActiveTab(r.dimensionId)}
                      className={`px-3 py-2 text-xs rounded-t-lg border-b-2 transition-colors ${
                        activeTab === r.dimensionId
                          ? "border-indigo-500 text-indigo-600 font-medium"
                          : "border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {dim?.label ?? r.dimensionId}
                      {r.loading && (
                        <span className="ml-1 inline-block w-2 h-2 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeResult && (
                  <>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {activeResult.content}
                        {activeResult.loading && (
                          <span className="inline-block w-1 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
                        )}
                      </p>
                    </div>
                    {!activeResult.loading && activeResult.content && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                          onClick={() => saveToInspiration(activeResult)}
                          disabled={savedIds.has(activeResult.dimensionId)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            savedIds.has(activeResult.dimensionId)
                              ? "bg-green-100 text-green-600"
                              : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100"
                          }`}
                        >
                          {savedIds.has(activeResult.dimensionId) ? "已保存到灵感 ✓" : "💡 保存到灵感"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
