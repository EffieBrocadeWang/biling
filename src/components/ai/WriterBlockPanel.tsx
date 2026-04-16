import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useCodexStore } from "../../store/codexStore";
import { useForeshadowingStore } from "../../store/foreshadowingStore";
import { useOutlineStore } from "../../store/outlineStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useAiStore } from "../../store/aiStore";
import { aiStream } from "../../lib/ai";
import { docToText, selectRelevantEntries } from "../../lib/context";

const DIRECTION_COLORS: Record<string, string> = {
  "剧情转折": "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200",
  "情感升级": "bg-pink-50 text-pink-600 border-pink-200",
  "新角色登场": "bg-purple-50 text-purple-600 border-purple-200",
  "回收伏笔": "bg-amber-50 dark:bg-amber-900/20 text-amber-700 border-amber-200",
  "场景切换": "bg-blue-50 text-blue-600 border-blue-200",
};

interface Direction {
  type: string;
  summary: string;
  detail?: string;
  expandLoading?: boolean;
}

export function WriterBlockPanel() {
  const { activeChapter } = useEditorStore();
  const { entries } = useCodexStore();
  const { items: foreshadowing } = useForeshadowingStore();
  const { nodes: outlineNodes } = useOutlineStore();
  const { getActiveModel, getKeyForModel, writingRules } = useSettingsStore();
  const { setMode } = useAiStore();

  const [directions, setDirections] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  function getModel() {
    const model = getActiveModel();
    if (!model) { setError("请先在设置中配置 AI 模型"); return null; }
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) { setError("请先在设置中填写 API Key"); return null; }
    return { model, key };
  }

  async function analyze() {
    const cfg = getModel();
    if (!cfg) return;

    setLoading(true);
    setError("");
    setDirections([]);
    setExpanded(null);

    const chapterText = activeChapter ? docToText(activeChapter.content) : "";
    const recentText = chapterText.slice(-3000);
    const relevant = activeChapter ? selectRelevantEntries(entries, chapterText) : [];
    const unresolved = foreshadowing.filter((f) => f.status === "planted").slice(0, 8);
    const upcomingOutline = activeChapter
      ? outlineNodes.filter(
          (n) => n.level === 3 && n.linked_chapter_id == null && n.title
        ).slice(0, 5)
      : [];

    const prompt = `你是一位资深网文策划，作者写到这里卡住了，请提供 5 个不同的剧情发展方向。

【当前章节】${activeChapter?.title ?? "（未选择章节）"}

【最近 3000 字内容】
${recentText || "（暂无内容）"}

${unresolved.length > 0 ? `【未回收的伏笔】\n${unresolved.map((f) => `- ${f.description}`).join("\n")}` : ""}

${upcomingOutline.length > 0 ? `【大纲后续规划】\n${upcomingOutline.map((n) => `- ${n.title}${n.content ? "：" + n.content : ""}`).join("\n")}` : ""}

${relevant.length > 0 ? `【相关百科设定】\n${relevant.map((e) => `- ${e.name}：${e.description.slice(0, 80)}`).join("\n")}` : ""}

${writingRules ? `【写作规则】\n${writingRules}` : ""}

要求：
1. 给出恰好 5 个发展方向，每个方向类型必须是以下之一：剧情转折、情感升级、新角色登场、回收伏笔、场景切换
2. 至少 1 个方向涉及回收已有伏笔
3. 方向之间要有差异性
4. 每个方向一句话概括（不超过 40 字）

请用以下 JSON 格式输出，不要有任何其他文字：
[
  { "type": "剧情转折", "summary": "..." },
  { "type": "情感升级", "summary": "..." },
  { "type": "回收伏笔", "summary": "..." },
  { "type": "场景切换", "summary": "..." },
  { "type": "新角色登场", "summary": "..." }
]`;

    let full = "";
    try {
      await aiStream({
        model: cfg.model,
        apiKey: cfg.key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 800,
        temperature: 0.85,
        onChunk: (delta) => { full += delta; },
      });

      // Parse JSON (strip markdown fences)
      let json = full.trim();
      const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) json = fence[1].trim();
      const parsed: Direction[] = JSON.parse(json);
      setDirections(parsed.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 分析失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function expandDirection(idx: number) {
    const dir = directions[idx];
    if (dir.detail || dir.expandLoading) return;
    const cfg = getModel();
    if (!cfg) return;

    setDirections((prev) => prev.map((d, i) => i === idx ? { ...d, expandLoading: true } : d));
    setExpanded(idx);

    const chapterText = activeChapter ? docToText(activeChapter.content) : "";

    const prompt = `作者选择了以下剧情方向：
【类型】${dir.type}
【概括】${dir.summary}

【当前章节最近内容】
${chapterText.slice(-1500)}

请用 200-300 字详细阐述这个方向：
- 具体如何推进剧情
- 涉及哪些角色
- 给读者的情感效果
- 后续可以如何发展

直接输出内容，不要加标题。`;

    let detail = "";
    try {
      await aiStream({
        model: cfg.model,
        apiKey: cfg.key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 500,
        temperature: 0.75,
        onChunk: (delta) => {
          detail += delta;
          setDirections((prev) => prev.map((d, i) => i === idx ? { ...d, detail, expandLoading: true } : d));
        },
      });
      setDirections((prev) => prev.map((d, i) => i === idx ? { ...d, detail, expandLoading: false } : d));
    } catch {
      setDirections((prev) => prev.map((d, i) => i === idx ? { ...d, expandLoading: false } : d));
    }
  }

  function useContinue(dir: Direction) {
    // Switch to 续写 mode with the direction pre-filled
    setMode("续写");
    // Dispatch a custom event so AiPanel can pick up the prefill text
    window.dispatchEvent(new CustomEvent("writerblock:continue", {
      detail: `请按照以下方向续写：【${dir.type}】${dir.summary}${dir.detail ? "\n\n方向详情：" + dir.detail : ""}`
    }));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">卡文锦囊</span>
          <button
            onClick={analyze}
            disabled={loading || !activeChapter}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {loading ? "分析中…" : "✦ 分析当前章节"}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">AI 根据章节内容、未回收伏笔和大纲规划给出 5 个发展方向</p>
        {!activeChapter && (
          <p className="text-xs text-amber-500 mt-1">请先在左侧选择一个章节</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {error && (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>
        )}

        {loading && directions.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-gray-400 dark:text-gray-500">AI 正在分析你的故事…</p>
          </div>
        )}

        {directions.length === 0 && !loading && !error && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p className="text-3xl mb-3">🧭</p>
            <p className="text-sm">点击「分析当前章节」</p>
            <p className="text-xs mt-1">获取 5 个剧情发展方向</p>
          </div>
        )}

        {directions.map((dir, idx) => {
          const colorClass = DIRECTION_COLORS[dir.type] ?? "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700";
          const isExpanded = expanded === idx;
          return (
            <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${colorClass}`}>
                    {dir.type}
                  </span>
                  <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed flex-1">{dir.summary}</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setExpanded(isExpanded ? null : idx); if (!dir.detail) expandDirection(idx); }}
                    className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    {dir.expandLoading ? "展开中…" : isExpanded && dir.detail ? "收起" : "展开详情"}
                  </button>
                  <button
                    onClick={() => useContinue(dir)}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 transition-colors"
                  >
                    → 按此续写
                  </button>
                </div>
              </div>

              {isExpanded && (dir.detail || dir.expandLoading) && (
                <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-600 leading-relaxed pt-2 whitespace-pre-wrap">
                    {dir.detail}
                    {dir.expandLoading && <span className="inline-block w-1 h-3 bg-indigo-400 ml-0.5 animate-pulse" />}
                  </p>
                  {dir.detail && !dir.expandLoading && (
                    <button
                      onClick={() => useContinue(dir)}
                      className="mt-2 text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      → 按此方向续写
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {directions.length > 0 && !loading && (
          <button
            onClick={analyze}
            className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 py-2 transition-colors"
          >
            换一批方向
          </button>
        )}
      </div>
    </div>
  );
}
