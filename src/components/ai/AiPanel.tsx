import { useEffect, useRef, useState } from "react";
import { useAiStore, CHAT_MODES, MODE_HINTS, type ChatMode } from "../../store/aiStore";
import { useEditorStore } from "../../store/editorStore";
import { useCodexStore } from "../../store/codexStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useProjectDocsStore } from "../../store/projectDocsStore";
import { useOutlineStore } from "../../store/outlineStore";
import { useProjectStore } from "../../store/projectStore";
import { aiStream } from "../../lib/ai";
import { assembleContext, docToText } from "../../lib/context";
import { dispatchInsertText, dispatchReplaceContent } from "../editor/ChapterEditor";
import { WriterBlockPanel } from "./WriterBlockPanel";
import { InfoButton } from "../common/InfoButton";
import { FeatureTip } from "../common/FeatureTip";

// Quick-action buttons per mode
const MODE_ACTIONS: Partial<Record<ChatMode, { label: string; prompt: string }[]>> = {
  续写: [{ label: "续写当前章节", prompt: "请根据当前章节内容，续写接下来的情节。" }],
  情节: [{ label: "生成情节建议", prompt: "请根据当前剧情，提供 3 个下一步情节发展方向。" }],
  一致性: [
    { label: "全面检查", prompt: "请对当前章节进行全面的一致性审查。" },
    { label: "只查人物", prompt: "请只检查当前章节中人物相关的一致性问题（外貌、性格、能力、关系）。" },
    { label: "只查世界观", prompt: "请只检查当前章节中世界观设定的一致性（地名、规则、势力、道具）。" },
  ],
  章节标题: [{ label: "生成标题候选", prompt: "请根据本章内容生成 8 个候选章节标题。" }],
  爽点检测: [{ label: "检测本章爽点", prompt: "请分析本章节的节奏和爽点分布。" }],
};

// Render message content with basic markdown-like formatting
function MessageContent({ content, loading }: { content: string; loading?: boolean }) {
  if (loading && !content) {
    return <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />;
  }
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {content}
      {loading && <span className="inline-block w-1 h-4 bg-indigo-400 ml-0.5 animate-pulse" />}
    </div>
  );
}

export function AiPanel() {
  const { messages, mode, pendingQuote, setMode, setPendingQuote, addMessage, updateMessage, clearMessages } = useAiStore();
  const { activeChapter, chapters, projectId } = useEditorStore();
  const { entries } = useCodexStore();
  const { getActiveModel, getKeyForModel, loaded, load, remoteUrl } = useSettingsStore();
  const { getAlwaysDocs } = useProjectDocsStore();
  const { nodes: outlineNodes } = useOutlineStore();
  const { projects } = useProjectStore();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [contextInfo, setContextInfo] = useState<{ entries: number; chars: number; summaries: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loaded) load();
  }, []);

  // Listen for writer's block "continue" event — prefill input and switch to 续写
  useEffect(() => {
    function onContinue(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      setInput(text);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        textareaRef.current.focus();
      }
    }
    window.addEventListener("writerblock:continue", onContinue);
    return () => window.removeEventListener("writerblock:continue", onContinue);
  }, []);

  // Handle selected text sent from editor
  useEffect(() => {
    if (!pendingQuote) return;
    const { text, mode: newMode, autoSend } = pendingQuote;
    setPendingQuote(null);
    setMode(newMode);
    if (autoSend) {
      // Directly send without going through input state
      send(text, newMode);
    } else {
      setInput(text);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
          textareaRef.current.focus();
        }
      }, 0);
    }
  }, [pendingQuote]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update context info when chapter/entries change
  useEffect(() => {
    const ctx = assembleContext(activeChapter ?? null, chapters, entries, mode, useSettingsStore.getState().writingRules, getAlwaysDocs());
    setContextInfo({ entries: ctx.injectedEntries.length, chars: ctx.recentText.length, summaries: ctx.injectedSummaries });
  }, [activeChapter?.id, entries.length, mode]);

  // Reset messages when chapter changes
  useEffect(() => {
    clearMessages();
  }, [activeChapter?.id]);

  async function sendOutlineGenerate() {
    if (isStreaming || !activeChapter) return;
    const model = getActiveModel();
    if (!model) { addMessage({ role: "assistant", content: "请先在 ⚙ 设置中配置 AI 模型。" }); return; }
    const apiKey = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!apiKey && model.provider !== "remote") { addMessage({ role: "assistant", content: "请先在 ⚙ 设置中填写 API 密钥。" }); return; }

    const currentBook = projects.find(p => p.id === projectId);

    // Find outline nodes linked to current chapter
    const linkedNodes = outlineNodes.filter(n => n.linked_chapter_id === activeChapter.id);

    // Full outline tree as text
    function renderOutlineNode(n: typeof outlineNodes[0], depth: number): string {
      const indent = "  ".repeat(depth);
      const labels = ["全书大纲", "卷纲", "章纲"];
      const label = labels[n.level - 1] ?? "";
      const desc = n.content ? `：${n.content}` : "";
      return `${indent}[${label}] ${n.title}${desc}`;
    }
    const bookNodes = outlineNodes.filter(n => n.book_id === projectId);
    const outlineText = bookNodes.length > 0
      ? bookNodes.map(n => renderOutlineNode(n, n.level - 1)).join("\n")
      : "（暂无大纲）";

    // Previous chapter text (most recent chapter before this one)
    const currentIdx = chapters.findIndex(c => c.id === activeChapter.id);
    const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null;
    const prevText = prevChapter ? docToText(prevChapter.content).slice(-1500) : null;
    const prevSummary = prevChapter?.summary || null;

    // Next chapter's linked outline node (if any)
    const nextChapter = currentIdx >= 0 && currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;
    const nextLinkedNode = nextChapter
      ? outlineNodes.find(n => n.linked_chapter_id === nextChapter.id)
      : null;

    const writingRules = useSettingsStore.getState().writingRules;
    const alwaysDocs = getAlwaysDocs();

    const parts: string[] = [
      "你是专业中文网文写作助手，请根据以下信息为当前章节生成正文初稿。",
      "要求：符合网文节奏，保持适当爽点密度，字数约1500-2500字。",
    ];
    if (writingRules) parts.push(`\n【写作规则】\n${writingRules}`);
    for (const doc of alwaysDocs) {
      if (doc.content.trim()) parts.push(`\n【${doc.title}】\n${doc.content.trim()}`);
    }
    if (currentBook) {
      parts.push(`\n【书名】${currentBook.title}（${currentBook.genre}）`);
    }
    parts.push(`\n【完整大纲】\n${outlineText}`);
    if (linkedNodes.length > 0) {
      parts.push(`\n【本章大纲节点】`);
      linkedNodes.forEach(n => parts.push(`- ${n.title}${n.content ? `：${n.content}` : ""}`));
    }
    parts.push(`\n【本章标题】${activeChapter.title}`);
    if (prevChapter) {
      parts.push(`\n【前一章】${prevChapter.title}`);
      if (prevSummary) parts.push(`摘要：${prevSummary}`);
      else if (prevText) parts.push(`结尾内容：\n${prevText}`);
    }
    if (nextChapter) {
      parts.push(`\n【后一章预告】${nextChapter.title}`);
      if (nextLinkedNode) parts.push(`大纲：${nextLinkedNode.title}${nextLinkedNode.content ? "：" + nextLinkedNode.content : ""}`);
    }
    parts.push(`\n请直接生成正文，不要加任何前言或解释。`);

    const systemPrompt = parts.join("\n");
    addMessage({ role: "user", content: `根据大纲生成：${activeChapter.title}` });
    const replyId = addMessage({ role: "assistant", content: "", loading: true });
    setIsStreaming(true);

    try {
      const fullText = await aiStream({
        model,
        apiKey,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "请生成本章正文。" }],
        maxTokens: 3000,
        temperature: 0.8,
        ...(model.provider === "remote" ? { remoteUrl } : {}),
        onChunk: (delta) => { updateMessage(replyId, delta, true); },
      });
      updateMessage(replyId, fullText, false);
    } catch (err) {
      updateMessage(replyId, `错误：${String(err)}`, false);
    } finally {
      setIsStreaming(false);
    }
  }

  async function send(promptOverride?: string, modeOverride?: string) {
    const userText = (promptOverride ?? input).trim();
    if (!userText || isStreaming) return;
    setInput("");

    const model = getActiveModel();
    if (!model) {
      addMessage({ role: "assistant", content: "请先在 ⚙ 设置中配置 AI 模型。" });
      return;
    }
    const apiKey = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (model.provider === "remote" && !remoteUrl) {
      addMessage({ role: "assistant", content: "请先在 ⚙ 设置中填写远程代理服务器地址。" });
      return;
    }
    if (!apiKey && model.provider !== "remote") {
      addMessage({ role: "assistant", content: "请先在 ⚙ 设置中填写 API 密钥。" });
      return;
    }

    addMessage({ role: "user", content: userText });
    const replyId = addMessage({ role: "assistant", content: "", loading: true });
    setIsStreaming(true);

    const ctx = assembleContext(activeChapter ?? null, chapters, entries, modeOverride ?? mode, useSettingsStore.getState().writingRules, getAlwaysDocs());

    // Build message history for multi-turn (last 6 messages + new)
    const history = messages
      .slice(-6)
      .filter((m) => !m.loading)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const fullText = await aiStream({
        model,
        apiKey,
        messages: [
          { role: "system", content: ctx.systemPrompt },
          ...history,
          { role: "user", content: userText },
        ],
        maxTokens: 1500,
        temperature: 0.75,
        ...(model.provider === "remote" ? { remoteUrl } : {}),
        onChunk: (delta) => {
          updateMessage(replyId, delta, true);
        },
      });
      // Mark done — pass full text so loading=false path sets it cleanly
      updateMessage(replyId, fullText, false);
    } catch (err) {
      updateMessage(replyId, `错误：${String(err)}`, false);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  const quickActions = MODE_ACTIONS[mode] ?? [];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800 relative">
      <FeatureTip
        featureId="ai_panel"
        title="AI 面板 — 你的写作助手"
        body="在这里和 AI 对话，选择「续写」「润色」「对话生成」等模式。也可以在编辑器中选中文字，点击「发到AI」快速发送。"
        cta="选一种模式，发送第一条消息"
      />

      {/* Mode selector */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shrink-0">
        <div className="flex flex-wrap gap-1 items-center">
          {CHAT_MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                mode === m
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {m}
            </button>
          ))}
          <InfoButton id="ai.modes" className="ml-1" />
        </div>

        {/* Context badge */}
        {contextInfo && (contextInfo.entries > 0 || contextInfo.chars > 0 || contextInfo.summaries > 0) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {contextInfo.chars > 0 && (
              <span className="text-xs text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                {mode === "一致性" ? "全文" : "章节"} {contextInfo.chars} 字
              </span>
            )}
            {contextInfo.summaries > 0 && (
              <span className="text-xs text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                前情 {contextInfo.summaries} 章
              </span>
            )}
            {contextInfo.entries > 0 && (
              <span className="text-xs text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                百科 {contextInfo.entries} 条
              </span>
            )}
          </div>
        )}
      </div>

      {/* Writer's block panel — replaces chat when mode is 卡文 */}
      {mode === "卡文" && (
        <div className="flex-1 overflow-hidden">
          <WriterBlockPanel />
        </div>
      )}

      {/* Messages */}
      {mode !== "卡文" && <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-6">
            {mode === "大纲生成" ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 dark:text-gray-500">{MODE_HINTS[mode]}</p>
                {activeChapter ? (
                  <>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-left">
                      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">当前章节</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">{activeChapter.title}</p>
                      {outlineNodes.filter(n => n.linked_chapter_id === activeChapter.id).length > 0 && (
                        <p className="text-xs text-indigo-500 dark:text-indigo-500 mt-1">
                          📋 已关联 {outlineNodes.filter(n => n.linked_chapter_id === activeChapter.id).length} 个大纲节点
                        </p>
                      )}
                    </div>
                    <button
                      onClick={sendOutlineGenerate}
                      disabled={isStreaming}
                      className="block w-full text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 font-medium"
                    >
                      📋 生成本章正文
                    </button>
                    <p className="text-xs text-gray-400 dark:text-gray-500">生成后可用「扩写」模式扩充细节</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">请先打开一个章节</p>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{MODE_HINTS[mode]}</p>
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => send(action.prompt)}
                    disabled={isStreaming}
                    className="block w-full text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 rounded-lg px-3 py-2 mb-2 transition-colors disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
              }`}
            >
              <MessageContent content={msg.content} loading={msg.loading} />
            </div>
            {msg.role === "assistant" && !msg.loading && msg.content && (
              <div className="flex gap-2 mt-1">
                {mode === "大纲生成" && (
                  <button
                    onClick={() => dispatchReplaceContent(msg.content)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 px-1 transition-colors font-medium"
                    title="替换当前章节全部内容"
                  >
                    ↻ 替换全文
                  </button>
                )}
                <button
                  onClick={() => dispatchInsertText(msg.content)}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 px-1 transition-colors"
                  title="追加到编辑器末尾"
                >
                  ↩ {mode === "大纲生成" ? "追加到末尾" : "插入编辑器"}
                </button>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>}

      {/* Quick actions when there are messages */}
      {mode !== "卡文" && messages.length > 0 && (quickActions.length > 0 || mode === "大纲生成") && (
        <div className="px-3 pb-1 flex gap-1 shrink-0 flex-wrap">
          {mode === "大纲生成" && (
            <button
              onClick={sendOutlineGenerate}
              disabled={isStreaming || !activeChapter}
              className="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
            >
              📋 重新生成
            </button>
          )}
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => send(action.prompt)}
              disabled={isStreaming}
              className="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={clearMessages}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-auto px-2 py-1"
          >
            清空
          </button>
        </div>
      )}

      {/* Input — hidden in 卡文 mode */}
      {mode !== "卡文" && <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 pt-2 pb-3 shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={MODE_HINTS[mode]}
            rows={2}
            disabled={isStreaming}
            className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none disabled:bg-gray-50 dark:bg-gray-800"
            style={{ minHeight: "52px", maxHeight: "120px" }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || isStreaming}
            className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0 text-sm"
          >
            {isStreaming ? "…" : "发送"}
          </button>
        </div>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Enter 发送 · Shift+Enter 换行</p>
      </div>}
    </div>
  );
}
