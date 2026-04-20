import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useSettingsStore } from "../../store/settingsStore";
import { useProjectDocsStore } from "../../store/projectDocsStore";
import { useProjectStore } from "../../store/projectStore";
import { useOutlineStore } from "../../store/outlineStore";
import { aiStream } from "../../lib/ai";

const CHAPTER_RE = /^(第[零一二三四五六七八九十百千\d]+[章节回]|Chapter\s+\d+)/i;
const VOLUME_CHAR_LIMIT = 80000;

interface ChunkChapter { title: string; content: string }
interface BookVolume {
  label: string;
  chapters: ChunkChapter[];
  charCount: number;
  startChapter: number;
  endChapter: number;
}

interface VolumeState {
  analysis: string;
  analyzing: boolean;
  generating: boolean;
  generated: string;
  parsedOutline: RawOutlineNode[] | null;
  saved: boolean;
}

interface RawOutlineNode {
  title: string;
  content?: string;
  children?: RawOutlineNode[];
}

function parseTxtIntoChapters(text: string): ChunkChapter[] {
  const lines = text.split(/\r?\n/);
  const chapters: ChunkChapter[] = [];
  let title = "";
  let buf: string[] = [];

  for (const line of lines) {
    if (CHAPTER_RE.test(line.trim())) {
      if (buf.some(l => l.trim())) chapters.push({ title: title || "前言", content: buf.join("\n").trim() });
      title = line.trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.some(l => l.trim())) chapters.push({ title: title || "正文", content: buf.join("\n").trim() });
  if (chapters.length === 0 && text.trim()) chapters.push({ title: "全文", content: text.trim() });
  return chapters;
}

function splitIntoVolumes(chapters: ChunkChapter[]): BookVolume[] {
  if (chapters.length === 0) return [];
  const totalChars = chapters.reduce((s, c) => s + c.content.length, 0);
  if (totalChars <= VOLUME_CHAR_LIMIT) {
    return [{ label: "全文", chapters, charCount: totalChars, startChapter: 1, endChapter: chapters.length }];
  }

  const volumes: BookVolume[] = [];
  let current: ChunkChapter[] = [];
  let currentChars = 0;
  let volIdx = 1;
  let startIdx = 1;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    current.push(ch);
    currentChars += ch.content.length;
    const isLast = i === chapters.length - 1;
    if ((currentChars >= VOLUME_CHAR_LIMIT || isLast) && current.length > 0) {
      volumes.push({
        label: `第${volIdx}部分（第${startIdx}章—第${startIdx + current.length - 1}章）`,
        chapters: current,
        charCount: currentChars,
        startChapter: startIdx,
        endChapter: startIdx + current.length - 1,
      });
      startIdx += current.length;
      volIdx++;
      current = [];
      currentChars = 0;
    }
  }
  return volumes;
}

function parseOutlineJson(raw: string): RawOutlineNode[] | null {
  let json = raw.trim();
  const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) json = fence[1].trim();
  const start = json.indexOf("[");
  const end = json.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(json.slice(start, end + 1));
  } catch {
    return null;
  }
}

function OutlinePreview({ nodes, depth = 0 }: { nodes: RawOutlineNode[]; depth?: number }) {
  const indents = ["", "ml-4", "ml-8"];
  const labels = ["卷纲", "章纲", ""];
  return (
    <>
      {nodes.map((n, i) => (
        <div key={i} className={depth > 0 ? indents[Math.min(depth, 2)] : ""}>
          <div className="flex items-start gap-1.5 py-0.5">
            <span className="shrink-0 text-xs px-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">{labels[Math.min(depth, 1)]}</span>
            <span className={`text-xs ${depth === 0 ? "font-semibold text-slate-700 dark:text-slate-300" : "text-gray-600 dark:text-gray-300"}`}>{n.title || "未命名"}</span>
            {n.content && <span className="text-xs text-gray-400 dark:text-gray-500 truncate">— {n.content}</span>}
          </div>
          {n.children && n.children.length > 0 && (
            <OutlinePreview nodes={n.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </>
  );
}

interface Props {
  projectId: string;
}

export function BookCopyTool({ projectId }: Props) {
  const { getActiveModel, getKeyForModel } = useSettingsStore();
  const { createDoc, loadDocs } = useProjectDocsStore();
  const { projects } = useProjectStore();
  const { nodes: outlineNodes, tree, load: loadOutline, addNode, updateNode } = useOutlineStore();

  const [bookTitle, setBookTitle] = useState("");
  const [volumes, setVolumes] = useState<BookVolume[]>([]);
  const [volStates, setVolStates] = useState<VolumeState[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [totalChars, setTotalChars] = useState(0);
  const [error, setError] = useState("");
  const [insertingIdx, setInsertingIdx] = useState<number | null>(null);
  const [insertParentId, setInsertParentId] = useState<string>("__root__");

  useEffect(() => {
    loadOutline(projectId);
  }, [projectId]);

  const DEFAULT_VOL_STATE: VolumeState = {
    analysis: "", analyzing: false, generating: false, generated: "", parsedOutline: null, saved: false,
  };

  function getState(idx: number): VolumeState {
    return volStates[idx] ?? DEFAULT_VOL_STATE;
  }

  function patchState(idx: number, patch: Partial<VolumeState>) {
    setVolStates(prev => {
      const next = [...prev];
      next[idx] = { ...(prev[idx] ?? DEFAULT_VOL_STATE), ...patch };
      return next;
    });
  }

  async function handlePickFile() {
    setError("");
    const selected = await open({
      multiple: false,
      filters: [{ name: "文本文件", extensions: ["txt"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : (selected as string);
    const filename = path.split(/[\\/]/).pop()?.replace(/\.txt$/i, "") ?? "参考书目";
    const text = await readTextFile(path);
    const chars = text.replace(/\s/g, "").length;
    const chapters = parseTxtIntoChapters(text);
    const vols = splitIntoVolumes(chapters);
    setBookTitle(filename);
    setVolumes(vols);
    setVolStates(vols.map(() => ({ ...DEFAULT_VOL_STATE })));
    setExpandedIdx(null);
    setTotalChars(chars);
  }

  async function handleAnalyze(idx: number) {
    const vol = volumes[idx];
    const model = getActiveModel();
    if (!model) { setError("请先配置 AI 模型"); return; }
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) { setError("请先填写 API Key"); return; }

    patchState(idx, { analyzing: true, analysis: "" });
    const sampleText = vol.chapters
      .flatMap(c => [c.title, c.content.slice(0, 600)])
      .join("\n")
      .slice(0, 6000);

    const prompt = `你是资深网文分析专家。请对以下小说片段进行深度拆书分析。

【书名】${bookTitle}
【本部分】${vol.label}（共${vol.chapters.length}章，约${Math.round(vol.charCount / 10000 * 10) / 10}万字）

【内容样本】
${sampleText}

请按以下维度分析（每项100-200字）：

## 📐 结构节奏
分析起承转合、高潮分布、章节安排。

## 🎭 核心人物
列出本部分主要人物，分析性格特点和关系动态。

## 🌍 世界观设定
总结本部分体现的世界观规则、体系设定、重要场景。

## 📋 大纲提炼
将本部分情节提炼为3-8个章纲节点（格式：节点标题：简要描述）。

## 🎣 亮点技法
分析作者使用的写作技法、爽点设计、钩子设置。

## 💡 借鉴要点
总结可以借鉴的3-5个核心技法或设计理念。`;

    try {
      let full = "";
      await aiStream({
        model, apiKey: key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 2000,
        temperature: 0.7,
        onChunk: (delta) => {
          full += delta;
          patchState(idx, { analysis: full });
        },
      });
      patchState(idx, { analyzing: false });
    } catch (err) {
      setError(String(err));
      patchState(idx, { analyzing: false });
    }
  }

  async function handleSaveToNotes(idx: number) {
    const vol = volumes[idx];
    const state = getState(idx);
    if (!state.analysis || !projectId) return;
    setError("");
    try {
      const content = `# 参考作品：${bookTitle} — ${vol.label}\n\n${state.analysis}`;
      await createDoc(projectId, "reference_notes", `参考作品：${bookTitle}（${vol.label}）`, content, "manual");
      await loadDocs(projectId);
      patchState(idx, { saved: true });
    } catch (err) {
      setError(`存入笔记失败：${String(err)}`);
    }
  }

  async function handleGenerate(idx: number) {
    const vol = volumes[idx];
    const state = getState(idx);
    if (!state.analysis) { setError("请先分析本部分后再借鉴生成大纲"); return; }

    const model = getActiveModel();
    if (!model) { setError("请先配置 AI 模型"); return; }
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) { setError("请先填写 API Key"); return; }

    const currentBook = projects.find(p => p.id === projectId);
    const synopsis = currentBook?.synopsis ?? "";
    const bookOutlineNodes = outlineNodes.filter(n => n.book_id === projectId);
    const existingOutline = bookOutlineNodes.length > 0
      ? bookOutlineNodes.map(n => {
          const labels = ["全书大纲", "卷纲", "章纲"];
          return `${"  ".repeat(n.level - 1)}[${labels[n.level - 1]}] ${n.title}${n.content ? "：" + n.content : ""}`;
        }).join("\n")
      : "（尚无大纲）";

    patchState(idx, { generating: true, generated: "", parsedOutline: null });
    setError("");

    const prompt = `你是专业网文大纲策划师。请根据参考作品的分析结果，结合作者自己的故事信息，生成一份借鉴参考作品风格的卷纲章纲规划。

【作者自己的故事信息】
- 书名：${currentBook?.title ?? "未命名"}
- 类型：${currentBook?.genre ?? "未知"}
- 故事梗概：${synopsis || "（未填写，请参考现有大纲发挥）"}
- 现有大纲：
${existingOutline}

【参考作品分析结果（${bookTitle} — ${vol.label}）】
${state.analysis.slice(0, 3000)}

请为作者的故事生成 1-2 个卷纲节点，每个卷纲下 3-5 个章纲节点。情节完全基于作者自己的故事，只借鉴参考作品的节奏和技法。

请严格用以下 JSON 格式输出，不要有其他文字：
[
  {
    "title": "卷纲标题",
    "content": "本卷核心情节简述（1-2句）",
    "children": [
      { "title": "章纲标题", "content": "本章情节简述（1句）" }
    ]
  }
]`;

    try {
      let full = "";
      await aiStream({
        model, apiKey: key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 2000,
        temperature: 0.8,
        onChunk: (delta) => {
          full += delta;
          patchState(idx, { generated: full });
        },
      });
      const parsed = parseOutlineJson(full);
      patchState(idx, { generating: false, parsedOutline: parsed });
      if (!parsed) setError("JSON 解析失败，可查看原始文本后手动整理");
    } catch (err) {
      setError(String(err));
      patchState(idx, { generating: false });
    }
  }

  async function handleInsertOutline(idx: number) {
    const state = getState(idx);
    if (!state.parsedOutline) return;
    setError("");

    try {
      let parentId: string | null = null;

      if (insertParentId === "__root__") {
        // Always create a level-1 root, then put generated items as level-2 (卷纲) with level-3 children (章纲)
        const root = await addNode(projectId, null, 1);
        await updateNode(root.id, { title: `借鉴生成（${bookTitle}）`, content: "" });
        parentId = root.id;
        for (const item of state.parsedOutline) {
          const n = await addNode(projectId, parentId, 2);
          await updateNode(n.id, { title: item.title ?? "", content: item.content ?? "" });
          if (item.children?.length) {
            for (const child of item.children) {
              const cn = await addNode(projectId, n.id, 3);
              await updateNode(cn.id, { title: child.title ?? "", content: child.content ?? "" });
            }
          }
        }
      } else {
        // Insert under a selected level-1 node as level-2 + level-3
        parentId = insertParentId;
        for (const item of state.parsedOutline) {
          const n = await addNode(projectId, parentId, 2);
          await updateNode(n.id, { title: item.title ?? "", content: item.content ?? "" });
          if (item.children?.length) {
            for (const child of item.children) {
              const cn = await addNode(projectId, n.id, 3);
              await updateNode(cn.id, { title: child.title ?? "", content: child.content ?? "" });
            }
          }
        }
      }

      setInsertingIdx(null);
      patchState(idx, { parsedOutline: null, generated: "" });
    } catch (err) {
      setError(`插入大纲失败：${String(err)}`);
    }
  }

  const rootOutlineNodes = tree
    .filter(n => n.book_id === projectId && n.parent_id == null)
    .sort((a, b) => a.sort_order - b.sort_order);

  const totalChapters = volumes.reduce((s, v) => s + v.chapters.length, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📚</span>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">抄书</h2>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">导入参考作品 TXT，AI 分析拆书，借鉴生成大纲</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {error && (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">关闭</button>
          </div>
        )}

        {/* File picker */}
        {volumes.length === 0 ? (
          <button
            onClick={handlePickFile}
            className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-10 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
          >
            <span className="text-4xl">📄</span>
            <span className="text-sm">选择参考作品 TXT 文件</span>
            <span className="text-xs">超过 10 万字自动分卷分析</span>
          </button>
        ) : (
          <>
            {/* Book info bar */}
            <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{bookTitle}</p>
                <p className="text-xs text-indigo-500 mt-0.5">
                  {totalChapters} 章 · 约 {Math.round(totalChars / 10000 * 10) / 10} 万字 · {volumes.length} 个部分
                </p>
              </div>
              <button
                onClick={() => { setVolumes([]); setVolStates([]); setBookTitle(""); setTotalChars(0); }}
                className="text-xs text-indigo-400 hover:text-indigo-600"
              >
                更换文件
              </button>
            </div>

            {/* Volume cards */}
            {volumes.map((vol, idx) => {
              const state = getState(idx);
              const isExpanded = expandedIdx === idx;
              return (
                <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  {/* Volume header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{vol.label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {vol.chapters.length} 章 · 约 {Math.round(vol.charCount / 10000 * 10) / 10} 万字
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {state.analysis && (
                        <button
                          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                        >
                          {isExpanded ? "收起" : "查看分析"}
                        </button>
                      )}
                      <button
                        onClick={() => handleAnalyze(idx)}
                        disabled={state.analyzing}
                        className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {state.analyzing ? "分析中…" : state.analysis ? "重新分析" : "✦ 分析"}
                      </button>
                    </div>
                  </div>

                  {/* Analysis result */}
                  {(isExpanded || state.analyzing) && (
                    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-4 py-3">
                      {state.analyzing && !state.analysis && (
                        <p className="text-xs text-indigo-500 animate-pulse py-4 text-center">✦ AI 正在分析，请稍候…</p>
                      )}
                      {state.analysis && (
                        <>
                          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                            {state.analysis}
                            {state.analyzing && <span className="inline-block w-1 h-3 bg-indigo-400 ml-0.5 animate-pulse" />}
                          </pre>
                          {!state.analyzing && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                              <button
                                onClick={() => handleSaveToNotes(idx)}
                                disabled={state.saved}
                                className={`text-xs px-3 py-1.5 rounded transition-colors ${state.saved ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300"}`}
                              >
                                {state.saved ? "✓ 已存入笔记" : "💾 存入参考作品笔记"}
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(state.analysis)}
                                className="text-xs px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition-colors"
                              >
                                复制分析结果
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Generate outline section */}
                  {state.analysis && !state.analyzing && (
                    <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">借鉴生成大纲</p>
                        <button
                          onClick={() => handleGenerate(idx)}
                          disabled={state.generating}
                          className="text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                        >
                          {state.generating ? "生成中…" : "✦ 借鉴生成大纲"}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        读取故事梗概 + 现有大纲，结合参考作品分析，生成可插入大纲的卷纲章纲规划
                      </p>
                      {!projects.find(p => p.id === projectId)?.synopsis && (
                        <p className="text-xs text-amber-500 mt-1">⚠️ 建议先填写故事梗概，生成效果更好</p>
                      )}

                      {/* Generated outline preview */}
                      {(state.generated || state.generating) && (
                        <div className="mt-3">
                          {state.parsedOutline ? (
                            /* Structured preview */
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                              <OutlinePreview nodes={state.parsedOutline} />

                              {/* Insert controls */}
                              {insertingIdx === idx ? (
                                <div className="mt-3 flex flex-col gap-2">
                                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">插入位置：</p>
                                  <select
                                    value={insertParentId}
                                    onChange={e => setInsertParentId(e.target.value)}
                                    className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 bg-white dark:bg-gray-800 outline-none focus:border-indigo-400"
                                  >
                                    <option value="__root__">
                                      {rootOutlineNodes.length === 0 ? "追加到大纲（作为卷纲）" : "新建全书大纲节点（追加到末尾）"}
                                    </option>
                                    {rootOutlineNodes.map(n => (
                                      <option key={n.id} value={n.id}>
                                        插入到「{n.title || "未命名全书大纲"}」下（作为卷纲）
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleInsertOutline(idx)}
                                      className="flex-1 text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                    >
                                      确认插入
                                    </button>
                                    <button
                                      onClick={() => setInsertingIdx(null)}
                                      className="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setInsertingIdx(idx); setInsertParentId("__root__"); }}
                                  className="mt-3 w-full text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                >
                                  📥 插入到当前大纲中
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Raw text fallback while streaming or if parse failed */
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 max-h-64 overflow-y-auto">
                              {state.generated}
                              {state.generating && <span className="inline-block w-1 h-3 bg-amber-500 ml-0.5 animate-pulse" />}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
