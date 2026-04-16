import { useEffect, useRef, useState } from "react";
import { useInspirationStore } from "../../store/inspirationStore";
import { useEditorStore } from "../../store/editorStore";

interface Props {
  projectId: number;
  onClose: () => void;
}

export function InspirationCapture({ projectId, onClose }: Props) {
  const { add } = useInspirationStore();
  const { activeChapter } = useEditorStore();
  const [content, setContent] = useState("");
  const [linkCurrent, setLinkCurrent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!content.trim() || saving) return;
    setSaving(true);
    await add(projectId, content.trim(), {
      linkedChapterId: linkCurrent && activeChapter ? activeChapter.id : null,
      linkedChapterTitle: linkCurrent && activeChapter ? activeChapter.title : "",
    });
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/20"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-lg">💡</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">捕捉灵感</span>
          <span className="ml-auto text-xs text-gray-300 dark:text-gray-600">⌘Enter 保存 · ESC 关闭</span>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKey}
          placeholder="记录你的灵感、情节想法、人物设定…"
          rows={4}
          className="w-full px-4 py-2 text-sm outline-none resize-none placeholder-gray-300 leading-relaxed"
          style={{ fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}
        />

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            {activeChapter && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkCurrent}
                  onChange={(e) => setLinkCurrent(e.target.checked)}
                  className="rounded"
                />
                关联到「{activeChapter.title}」
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                saved
                  ? "bg-green-500 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {saved ? "已保存 ✓" : saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
