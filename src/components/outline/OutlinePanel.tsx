import { useEffect, useState, useRef } from "react";
import { useOutlineStore } from "../../store/outlineStore";
import { useEditorStore } from "../../store/editorStore";
import { useSettingsStore } from "../../store/settingsStore";
import { aiStream } from "../../lib/ai";
import type { OutlineNode } from "../../types";

interface ChatMessage { role: "user" | "assistant"; content: string; }

function formatOutlineForPrompt(nodes: OutlineNode[], projectId: string): string {
  const flat = nodes.filter((n) => n.book_id === projectId);
  if (flat.length === 0) return "（尚无大纲节点）";
  // Build nested text
  function render(node: OutlineNode, indent: string): string {
    const levelLabel = ["", "全书大纲", "卷纲", "章纲"][node.level] ?? "";
    const desc = node.content ? `：${node.content}` : "";
    let text = `${indent}[${levelLabel}] ${node.title || "未命名"}${desc}`;
    (node.children ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((c) => { text += "\n" + render(c, indent + "  "); });
    return text;
  }
  // Build proper tree
  const map = new Map<string, OutlineNode>();
  flat.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: OutlineNode[] = [];
  flat.forEach((n) => {
    const node = map.get(n.id)!;
    if (n.parent_id == null) roots.push(node);
    else map.get(n.parent_id)?.children?.push(node);
  });
  return roots
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => render(r, ""))
    .join("\n");
}

const STARTER_PROMPTS = [
  "分析当前大纲的节奏和爽点分布，哪里需要加强？",
  "根据现有大纲，帮我规划第二幕的高潮情节",
  "这个大纲有什么常见的读者会吐槽的问题？",
  "帮我为当前大纲补充 3 个伏笔和对应的回收时机",
];

const LEVEL_LABELS = ["", "全书大纲", "卷纲", "章纲"];
const LEVEL_COLORS = ["", "text-slate-700 dark:text-slate-300 font-semibold", "text-slate-600 dark:text-slate-400 font-medium", "text-gray-600 dark:text-gray-300"];
const LEVEL_BG = ["", "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700", "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700", "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"];
const LEVEL_INDENT = ["", "ml-0", "ml-6", "ml-12"];

interface NodeRowProps {
  node: OutlineNode;
  projectId: string;
  siblings: OutlineNode[];
  idx: number;
}

function NodeRow({ node, projectId, siblings, idx }: NodeRowProps) {
  const { updateNode, removeNode, addNode, moveUp, moveDown } = useOutlineStore();
  const { chapters } = useEditorStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [expanded, setExpanded] = useState(true);   // tree children expand
  const [showDetail, setShowDetail] = useState(false); // detail panel open
  const titleRef = useRef<HTMLInputElement>(null);

  const children = node.children ?? [];

  async function commitTitle() {
    if (title !== node.title) {
      await updateNode(node.id, { title });
    }
    setEditingTitle(false);
  }

  async function commitContent() {
    await updateNode(node.id, { content });
  }

  async function addChild() {
    const childLevel = (node.level + 1) as 1 | 2 | 3;
    if (childLevel > 3) return;
    const newNode = await addNode(projectId, node.id, childLevel);
    setExpanded(true);
    setTimeout(() => {
      const el = document.getElementById(`outline-title-${newNode.id}`);
      el?.focus();
    }, 50);
  }

  return (
    <div className={`${LEVEL_INDENT[node.level]}`}>
      <div className={`rounded border px-2 py-1.5 mb-1 group ${LEVEL_BG[node.level]}`}>
        <div className="flex items-start gap-1">
          {/* tree expand toggle (only when has children) */}
          {children.length > 0 ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs w-4 shrink-0 mt-0.5"
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {/* title row */}
            {editingTitle ? (
              <input
                id={`outline-title-${node.id}`}
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                  if (e.key === "Escape") { setTitle(node.title); setEditingTitle(false); }
                }}
                className="w-full text-sm bg-white dark:bg-gray-900 border border-indigo-300 rounded px-1 py-0.5 outline-none"
                placeholder={`${LEVEL_LABELS[node.level]}标题…`}
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                {/* click title area → toggle detail panel */}
                <button
                  id={`outline-title-${node.id}`}
                  className={`flex-1 text-left text-sm truncate ${LEVEL_COLORS[node.level]} ${!node.title ? "text-gray-400 dark:text-gray-500 italic" : ""}`}
                  onClick={() => setShowDetail(!showDetail)}
                >
                  {node.title || `未命名${LEVEL_LABELS[node.level]}`}
                </button>
                {/* always-visible edit icon */}
                <button
                  onClick={() => { setEditingTitle(true); setTitle(node.title); }}
                  className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-indigo-500 text-xs leading-none"
                  title="编辑标题"
                >✎</button>
              </div>
            )}

            {/* content preview when collapsed */}
            {!showDetail && node.content && (
              <p
                className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 cursor-pointer"
                onClick={() => setShowDetail(true)}
              >
                {node.content}
              </p>
            )}

            {/* detail panel */}
            {showDetail && (
              <div className="mt-2 space-y-1.5">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 resize-none outline-none focus:border-indigo-300 leading-relaxed"
                  placeholder="要点描述（可选）"
                />
                <button
                  onClick={commitContent}
                  className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                >保存</button>
                {node.level === 3 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">关联章节:</span>
                    <select
                      value={node.linked_chapter_id ?? ""}
                      onChange={(e) => updateNode(node.id, { linked_chapter_id: e.target.value || null })}
                      className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-900 outline-none"
                    >
                      <option value="">-- 不关联 --</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {idx > 0 && (
              <button onClick={() => moveUp(node.id)} className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="上移">↑</button>
            )}
            {idx < siblings.length - 1 && (
              <button onClick={() => moveDown(node.id)} className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="下移">↓</button>
            )}
            {node.level < 3 && (
              <button onClick={addChild} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700" title={`添加${LEVEL_LABELS[node.level + 1]}`}>+</button>
            )}
            <button
              onClick={() => removeNode(node.id)}
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              title="删除"
            >✕</button>
          </div>
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div>
          {children
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((child, ci) => (
              <NodeRow
                key={child.id}
                node={child}
                projectId={projectId}
                siblings={children}
                idx={ci}
              />
            ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  projectId: string;
  projectName: string;
  projectGenre: string;
  projectSynopsis: string;
}

export function OutlinePanel({ projectId, projectName, projectGenre, projectSynopsis }: Props) {
  const { tree, nodes, load, addNode, removeNode: _remove } = useOutlineStore();
  const { chapters } = useEditorStore();
  const { getActiveModel, getKeyForModel } = useSettingsStore();
  const [generating, setGenerating] = useState(false);
  const [aiOutput, setAiOutput] = useState("");
  const [aiError, setAiError] = useState("");
  const [showAiPreview, setShowAiPreview] = useState(false);

  // AI chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    load(projectId);
  }, [projectId]);

  const roots = tree
    .filter((n) => n.book_id === projectId && n.parent_id == null)
    .sort((a, b) => a.sort_order - b.sort_order);

  async function handleAddRoot() {
    const newNode = await addNode(projectId, null, 1);
    setTimeout(() => {
      const el = document.getElementById(`outline-title-${newNode.id}`);
      el?.focus();
    }, 50);
  }

  async function handleAiGenerate() {
    const model = getActiveModel();
    if (!model) { setAiError("请先在设置中配置 AI 模型"); return; }
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) { setAiError("请先在设置中填写 API Key"); return; }

    // Build character list from codex if available (basic fallback: just use chapters)
    const chapterList = chapters.slice(0, 20).map((c) => c.title).join("、") || "（暂无章节）";

    const prompt = `你是一位资深网文大纲策划。请根据以下信息，生成一份完整的小说大纲。

作品信息：
- 书名：${projectName}
- 类型：${projectGenre}
- 简介：${projectSynopsis || "（暂无简介）"}
- 已有章节：${chapterList}

要求：
1. 生成 2-4 个大纲节点（全书主线，level 1）
2. 每个大纲下 2-4 个卷纲（level 2）
3. 每个卷纲下 3-6 个章纲（level 3）
4. 每个节点包含标题和简要描述（1-2句话）
5. 符合 ${projectGenre} 类型的套路和读者期待

请用以下 JSON 格式输出，不要有任何其他文字：
[
  {
    "title": "大纲标题",
    "content": "描述",
    "children": [
      {
        "title": "卷纲标题",
        "content": "描述",
        "children": [
          { "title": "章纲标题", "content": "描述" }
        ]
      }
    ]
  }
]`;

    setGenerating(true);
    setAiError("");
    setAiOutput("");
    setShowAiPreview(true);

    try {
      let full = "";
      await aiStream({
        model,
        apiKey: key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 3000,
        temperature: 0.8,
        onChunk: (delta) => {
          full += delta;
          setAiOutput(full);
        },
      });
      setAiOutput(full);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI 生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function importAiOutline() {
    // parse JSON from aiOutput (strip markdown code fences if present)
    let json = aiOutput.trim();
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1].trim();

    interface RawNode { title: string; content?: string; children?: RawNode[] }
    let parsed: RawNode[];
    try {
      parsed = JSON.parse(json);
    } catch {
      setAiError("解析 JSON 失败，请检查 AI 输出格式");
      return;
    }

    async function insertNodes(items: RawNode[], parentId: string | null, level: 1 | 2 | 3) {
      for (const item of items) {
        const n = await addNode(projectId, parentId, level);
        await useOutlineStore.getState().updateNode(n.id, {
          title: item.title ?? "",
          content: item.content ?? "",
        });
        if (item.children?.length && level < 3) {
          await insertNodes(item.children, n.id, (level + 1) as 2 | 3);
        }
      }
    }

    await insertNodes(parsed, null, 1);
    setShowAiPreview(false);
    setAiOutput("");
  }

  async function handleChatSend(text?: string) {
    const userText = (text ?? chatInput).trim();
    if (!userText || chatLoading) return;

    const model = getActiveModel();
    if (!model) return;
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) return;

    const outlineText = formatOutlineForPrompt(nodes, projectId);
    const systemPrompt = `你是专业网文大纲顾问，帮助作者完善《${projectName}》（${projectGenre}类）大纲。

当前大纲：
${outlineText}

简介：${projectSynopsis || "（暂无）"}

回复要求：中文，简洁直接，不超过150字，不废话，给具体建议。`;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: userText }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    // Add placeholder assistant message
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      let full = "";
      await aiStream({
        model,
        apiKey: key,
        messages: [
          { role: "system", content: systemPrompt },
          ...newMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        maxTokens: 600,
        temperature: 0.75,
        onChunk: (delta) => {
          full += delta;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: full };
            return updated;
          });
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        },
      });
    } catch (err) {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `❌ ${err instanceof Error ? err.message : "请求失败"}` };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">大纲</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            三级结构：全书大纲 → 卷纲 → 章纲
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowChat((v) => !v); setTimeout(() => chatInputRef.current?.focus(), 100); }}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${showChat ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            💬 AI 对话
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={generating}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? "AI 生成中…" : "✦ 生成大纲"}
          </button>
          <button
            onClick={handleAddRoot}
            className="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            + 添加大纲
          </button>
        </div>
      </div>

      {/* AI preview panel */}
      {showAiPreview && (
        <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">AI 生成预览</span>
            <button onClick={() => setShowAiPreview(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {aiError && <p className="text-xs text-red-500 mb-2">{aiError}</p>}
          {generating ? (
            <div className="text-xs text-amber-600 dark:text-amber-400 py-4 text-center animate-pulse">
              ✦ AI 正在创作大纲，请稍候…
            </div>
          ) : aiOutput && !aiError ? (
            <div className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded p-2 max-h-48 overflow-y-auto">
              大纲已生成，点击「导入大纲」添加到树中
            </div>
          ) : null}
          {!generating && aiOutput && !aiError && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={importAiOutline}
                className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                导入大纲
              </button>
              <button
                onClick={handleAiGenerate}
                className="text-xs px-3 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300"
              >
                重新生成
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {nodes.filter((n) => n.book_id === projectId).length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">还没有大纲</p>
            <p className="text-xs mt-1">点击「AI 生成大纲」一键生成，或手动「+ 添加大纲」</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {roots.map((node, idx) => (
              <NodeRow
                key={node.id}
                node={node}
                projectId={projectId}
                siblings={roots}
                idx={idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {!showChat && nodes.filter((n) => n.book_id === projectId).length > 0 && (
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-white dark:bg-gray-900 flex gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="text-indigo-600">■ 全书大纲</span>
          <span className="text-blue-500">■ 卷纲</span>
          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">■ 章纲</span>
          <span className="ml-auto">点击标题展开详情 · ✎ 编辑标题</span>
        </div>
      )}

      {/* AI Chat pane */}
      {showChat && (
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col" style={{ height: "42%" }}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">AI 大纲对话</span>
            <button
              onClick={() => { setChatMessages([]); setChatInput(""); }}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              title="清空对话"
            >清空</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">快速提问：</p>
                {STARTER_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleChatSend(p)}
                    className="block w-full text-left text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white ml-6 self-end"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 mr-6"
                  }`}
                >
                  {msg.content || (msg.role === "assistant" && chatLoading ? <span className="opacity-50 animate-pulse">思考中…</span> : "")}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-2 items-end">
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder="关于大纲的问题… (Enter 发送)"
              rows={2}
              className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 resize-none outline-none focus:border-indigo-300 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            />
            <button
              onClick={() => handleChatSend()}
              disabled={chatLoading || !chatInput.trim()}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
            >
              {chatLoading ? "…" : "发送"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
