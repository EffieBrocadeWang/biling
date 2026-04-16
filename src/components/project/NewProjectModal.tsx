import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import { getPresetForGenre } from "../../lib/genrePresets";

const GENRES = [
  "玄幻", "仙侠", "都市", "穿越", "科幻", "历史", "悬疑", "武侠",
  "言情", "系统文", "末世", "奇幻", "其他"
];

interface Props {
  onClose: () => void;
  onCreated: (projectId: number) => void;
}

export function NewProjectModal({ onClose, onCreated }: Props) {
  const { createProject } = useProjectStore();
  const { writingRules, setWritingRules } = useSettingsStore();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("玄幻");
  const [synopsis, setSynopsis] = useState("");
  const [loadPreset, setLoadPreset] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject(name.trim(), genre, synopsis.trim());
      if (loadPreset) {
        const preset = getPresetForGenre(genre);
        const merged = writingRules.trim() ? `${writingRules.trim()}\n\n# ${genre}预设\n${preset}` : `# ${genre}写作规则\n${preset}`;
        await setWritingRules(merged);
      }
      setSubmitting(false);
      onCreated(project.id);
    } catch (err) {
      setSubmitting(false);
      setError(String(err));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">新建作品</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              书名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入书名"
              className="w-full border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">类型</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">简介</label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="一句话介绍你的故事（可选）"
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Preset option */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={loadPreset}
              onChange={(e) => setLoadPreset(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-600">
              自动加载「{genre}」写作规则预设
              <span className="text-xs text-gray-400 dark:text-gray-500 block mt-0.5">帮 AI 更好地理解你的写作风格，可在「写作规则」中随时修改</span>
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
