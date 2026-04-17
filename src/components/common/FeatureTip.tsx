import { useEffect, useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";

interface Props {
  featureId: string;        // e.g. "codex", "outline", "ai_panel"
  title: string;
  body: string;
  cta?: string;             // optional call-to-action text
  onCta?: () => void;
}

/**
 * Shows once per feature. Dismissed on "知道了" or "不再提示".
 * Renders nothing if already seen or all tips disabled.
 */
export function FeatureTip({ featureId, title, body, cta, onCta }: Props) {
  const { seenFeatures, allTipsDisabled, markFeatureSeen, disableAllTips, loaded } = useSettingsStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!allTipsDisabled && !seenFeatures.includes(featureId)) {
      // small delay so the panel animation finishes first
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, [loaded, featureId]);

  if (!visible) return null;

  async function dismiss() {
    setVisible(false);
    await markFeatureSeen(featureId);
  }

  async function dismissAll() {
    setVisible(false);
    await disableAllTips();
  }

  return (
    <div className="absolute inset-x-3 top-3 z-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-indigo-200 dark:border-indigo-700 p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
          {cta && (
            <button
              onClick={() => { onCta?.(); dismiss(); }}
              className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              👉 {cta}
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <button
          onClick={dismissAll}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          不再提示
        </button>
        <button
          onClick={dismiss}
          className="text-xs px-3 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
