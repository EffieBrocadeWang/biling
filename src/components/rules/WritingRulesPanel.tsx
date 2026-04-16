import { useEffect, useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { GENRE_PRESETS } from "../../lib/genrePresets";

const PRESETS = Object.entries(GENRE_PRESETS).map(([label, text]) => ({ label, text }));

export function WritingRulesPanel() {
  const { writingRules, setWritingRules, loaded, load } = useSettingsStore();
  const [draft, setDraft] = useState(writingRules);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, []);

  useEffect(() => {
    setDraft(writingRules);
  }, [writingRules]);

  async function save() {
    await setWritingRules(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function applyPreset(text: string) {
    const merged = draft.trim() ? `${draft.trim()}\n${text}` : text;
    setDraft(merged);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">写作规则</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
          这些规则会注入所有 AI 请求的系统提示，约束 AI 的写作风格和行为。
        </p>
      </div>

      {/* Presets */}
      <div className="mb-4 flex items-center gap-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 shrink-0">加载预设</p>
        <select
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 outline-none focus:border-indigo-400 text-gray-600 dark:text-gray-300 dark:text-gray-600"
          defaultValue=""
          onChange={(e) => { if (e.target.value) { applyPreset(e.target.value); e.target.value = ""; } }}
        >
          <option value="" disabled>选择类型…</option>
          {PRESETS.map((p) => (
            <option key={p.label} value={p.text}>{p.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 dark:text-gray-500">（追加到现有规则末尾）</span>
      </div>

      {/* Rules textarea */}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={"在这里写下你的写作规则，每行一条，例如：\n- 主角的说话风格是简短有力，不废话\n- 战斗场景要有动作感，避免说教\n- 禁止出现的内容：XXX\n- 保持第三人称有限视角"}
        rows={14}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {draft.trim() ? `${draft.trim().split("\n").filter(Boolean).length} 条规则` : "暂无规则"}
        </p>
        <div className="flex items-center gap-3">
          {draft !== writingRules && (
            <button
              onClick={() => setDraft(writingRules)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:text-gray-600"
            >
              重置
            </button>
          )}
          <button
            onClick={save}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              saved
                ? "bg-green-100 text-green-700"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {saved ? "已保存 ✓" : "保存"}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100">
        <p className="text-xs font-medium text-amber-700 mb-1">提示</p>
        <p className="text-xs text-amber-600 leading-relaxed">
          规则对所有 AI 模式（续写、润色、对话等）都生效。写得越具体，AI 表现越稳定。
          建议每本书单独设置，因为不同类型的小说规则差异较大。
        </p>
      </div>
    </div>
  );
}
