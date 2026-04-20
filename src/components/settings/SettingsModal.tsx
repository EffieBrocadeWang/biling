import { useEffect, useState, useRef } from "react";
import { useSettingsStore, type ThemeMode } from "../../store/settingsStore";
import { AI_MODELS, type AIProvider } from "../../lib/ai";

const PROVIDERS: { id: AIProvider; label: string; placeholder: string; noKey?: boolean }[] = [
  { id: "ollama",   label: "Ollama (本地)",  placeholder: "",        noKey: true },
  { id: "deepseek", label: "DeepSeek",       placeholder: "sk-..." },
  { id: "qwen",     label: "通义千问",        placeholder: "sk-..." },
  { id: "kimi",     label: "Kimi",           placeholder: "sk-..." },
  { id: "glm",      label: "智谱 GLM",       placeholder: "..." },
  { id: "openai",   label: "OpenAI",         placeholder: "sk-..." },
  { id: "claude",   label: "Anthropic",      placeholder: "sk-ant-..." },
  { id: "remote",   label: "远程代理",        placeholder: "access-token..." },
];

const FONT_SIZES = [16, 18, 20, 22];
const LINE_HEIGHTS = [1.8, 2.0, 2.2, 2.4];
const MAX_WIDTHS = [
  { value: 640,  label: "窄 640px" },
  { value: 768,  label: "标准 768px" },
  { value: 900,  label: "宽 900px" },
  { value: 1100, label: "全宽 1100px" },
];

type Tab = "ai" | "appearance" | "writing" | "general";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const {
    activeModelId, providerKeys, load, setActiveModel, setProviderKey, loaded,
    appearance, setAppearance,
    theme, setTheme,
    dailyGoal, setDailyGoal,
    remoteUrl, setRemoteUrl,
    showHelpButtons, setShowHelpButtons, resetTutorial,
  } = useSettingsStore();

  const [tab, setTab] = useState<Tab>("ai");
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal));
  const [remoteUrlDraft, setRemoteUrlDraft] = useState(remoteUrl);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [dsBalance, setDsBalance] = useState<string | null>(null);
  const [dsBalanceLoading, setDsBalanceLoading] = useState(false);
  const probed = useRef(false);

  useEffect(() => {
    if (!loaded) load();
  }, []);

  // Probe Ollama once when modal opens
  useEffect(() => {
    if (probed.current) return;
    probed.current = true;
    fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) })
      .then((r) => setOllamaAvailable(r.ok))
      .catch(() => setOllamaAvailable(false));
  }, []);

  useEffect(() => {
    const draft: Record<string, string> = {};
    for (const p of providerKeys) draft[p.provider] = p.key;
    setKeyDraft(draft);
  }, [providerKeys]);

  useEffect(() => {
    setRemoteUrlDraft(remoteUrl);
  }, [remoteUrl]);

  useEffect(() => {
    setGoalDraft(String(dailyGoal));
  }, [dailyGoal]);

  async function saveKey(provider: string) {
    await setProviderKey(provider, keyDraft[provider] ?? "");
  }

  async function testRemoteConnection() {
    const url = remoteUrlDraft.trim().replace(/\/$/, "");
    if (!url) return;
    // Auto-save URL and token before testing
    await setRemoteUrl(url);
    const token = keyDraft["remote"] ?? "";
    await setProviderKey("remote", token);
    setTestStatus("testing");
    try {
      const res = await fetch(`${url}/v1/models`, {
        headers: {
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(5000),
      });
      setTestStatus(res.ok ? "ok" : "fail");
    } catch {
      setTestStatus("fail");
    }
  }

  async function fetchDsBalance() {
    const key = ((keyDraft["deepseek"] ?? "").trim()) || (providerKeys.find(p => p.provider === "deepseek")?.key ?? "");
    if (!key) return;
    setDsBalanceLoading(true);
    setDsBalance(null);
    try {
      const res = await fetch("https://api.deepseek.com/user/balance", {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { setDsBalance("查询失败"); return; }
      const data = await res.json() as { balance_infos?: { total_balance?: string; currency?: string }[] };
      const info = data.balance_infos?.[0];
      if (info?.total_balance !== undefined) {
        setDsBalance(`${info.total_balance} ${info.currency ?? "CNY"}`);
      } else {
        setDsBalance("—");
      }
    } catch {
      setDsBalance("查询失败");
    } finally {
      setDsBalanceLoading(false);
    }
  }

  // Only show models where the provider is configured/available
  function isProviderAvailable(provider: AIProvider): boolean {
    if (provider === "ollama") return ollamaAvailable;
    if (provider === "remote") return !!remoteUrl.trim();
    return providerKeys.some((p) => p.provider === provider && p.key.trim());
  }

  const modelsForProvider = (provider: AIProvider) =>
    AI_MODELS.filter((m) => m.provider === provider);

  const TABS: { id: Tab; label: string }[] = [
    { id: "ai",         label: "AI 模型" },
    { id: "appearance", label: "外观" },
    { id: "writing",    label: "写作" },
    { id: "general",    label: "通用" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-indigo-500 text-indigo-600 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── AI Tab ──────────────────────────────── */}
          {tab === "ai" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  当前使用模型
                </label>
                <select
                  value={activeModelId}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PROVIDERS.filter((p) => isProviderAvailable(p.id)).map((p) => (
                    <optgroup key={p.id} label={p.label}>
                      {modelsForProvider(p.id).map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  仅显示已配置的模型。配置 API 密钥或代理后自动出现。
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  API 密钥
                </label>
                <div className="space-y-3">
                  {PROVIDERS.map((p) => (
                    <div key={p.id}>
                      <label className="block text-xs text-gray-600 mb-1">{p.label}</label>
                      {p.noKey ? (
                        <div className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                          无需 API 密钥 — 直接使用本地 Ollama 服务 (localhost:11434)
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={keyDraft[p.id] ?? ""}
                              onChange={(e) => setKeyDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                              placeholder={p.placeholder}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => saveKey(p.id)}
                              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                            >
                              保存
                            </button>
                          </div>
                          {p.id === "deepseek" && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                onClick={fetchDsBalance}
                                disabled={dsBalanceLoading || !(keyDraft["deepseek"] || providerKeys.find(pk => pk.provider === "deepseek")?.key)}
                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors disabled:opacity-40"
                              >
                                {dsBalanceLoading ? "查询中…" : "查询余额"}
                              </button>
                              {dsBalance && (
                                <span className={`text-xs font-medium ${dsBalance === "查询失败" ? "text-red-500" : "text-green-600"}`}>
                                  💰 {dsBalance}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-400">
                API 密钥仅存储在本地，不经过任何服务器。AI 请求直接从你的设备发往各供应商。
              </p>

              {/* ── Remote Proxy Config ─────────────────────── */}
              <div className="pt-3 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  远程 LLM 代理
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  连接自建的代理服务器（如家里的 Mac Mini 运行 Ollama），无需 API 费用。
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">代理服务器地址</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={remoteUrlDraft}
                        onChange={(e) => { setRemoteUrlDraft(e.target.value); setTestStatus("idle"); }}
                        placeholder="https://xxxx.ngrok-free.app"
                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={async () => { await setRemoteUrl(remoteUrlDraft); }}
                        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">访问令牌</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyDraft["remote"] ?? ""}
                        onChange={(e) => { setKeyDraft((d) => ({ ...d, remote: e.target.value })); setTestStatus("idle"); }}
                        placeholder="biling-test-2026"
                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => saveKey("remote")}
                        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={testRemoteConnection}
                      disabled={!remoteUrlDraft.trim() || testStatus === "testing"}
                      className="px-3 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {testStatus === "testing" ? "检测中…" : "测试连接"}
                    </button>
                    {testStatus === "ok" && (
                      <span className="text-xs text-green-600">✓ 连接成功</span>
                    )}
                    {testStatus === "fail" && (
                      <span className="text-xs text-red-500">✗ 连接失败，请检查地址或令牌</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Appearance Tab ───────────────────────── */}
          {tab === "appearance" && (
            <>
              {/* Theme */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  主题
                </label>
                <div className="flex gap-2">
                  {([
                    { value: "light",  label: "☀️ 浅色" },
                    { value: "dark",   label: "🌙 深色" },
                    { value: "system", label: "💻 跟随系统" },
                  ] as { value: ThemeMode; label: string }[]).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`flex-1 py-2 text-sm rounded-lg border-2 transition-colors ${
                        theme === t.value
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font family */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  字体
                </label>
                <div className="flex gap-3">
                  {([
                    { value: "sans", label: "黑体 / 无衬线", sample: "落笔处，世界始" },
                    { value: "serif", label: "宋体 / 衬线", sample: "落笔处，世界始" },
                  ] as const).map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setAppearance({ fontFamily: f.value })}
                      className={`flex-1 border-2 rounded-xl px-4 py-3 text-left transition-colors ${
                        appearance.fontFamily === f.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p
                        className="text-base mb-1"
                        style={{
                          fontFamily: f.value === "serif"
                            ? "'Noto Serif SC', 'SimSun', 'STSong', Georgia, serif"
                            : undefined,
                        }}
                      >
                        {f.sample}
                      </p>
                      <p className="text-xs text-gray-500">{f.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    字号
                  </label>
                  <span className="text-sm font-medium text-gray-700">{appearance.fontSize}px</span>
                </div>
                <div className="flex gap-2">
                  {FONT_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setAppearance({ fontSize: s })}
                      className={`flex-1 py-2 text-sm rounded-lg border-2 transition-colors ${
                        appearance.fontSize === s
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line height */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    行距
                  </label>
                  <span className="text-sm font-medium text-gray-700">{appearance.lineHeight}×</span>
                </div>
                <div className="flex gap-2">
                  {LINE_HEIGHTS.map((lh) => (
                    <button
                      key={lh}
                      onClick={() => setAppearance({ lineHeight: lh })}
                      className={`flex-1 py-2 text-sm rounded-lg border-2 transition-colors ${
                        appearance.lineHeight === lh
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {lh}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max width */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  编辑区宽度
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MAX_WIDTHS.map((w) => (
                    <button
                      key={w.value}
                      onClick={() => setAppearance({ maxWidth: w.value })}
                      className={`py-2 text-sm rounded-lg border-2 transition-colors ${
                        appearance.maxWidth === w.value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-xs text-gray-400 mb-2">预览</p>
                <p
                  style={{
                    fontSize: appearance.fontSize,
                    lineHeight: appearance.lineHeight,
                    maxWidth: appearance.maxWidth,
                    fontFamily: appearance.fontFamily === "serif"
                      ? "'Noto Serif SC', 'SimSun', 'STSong', Georgia, serif"
                      : "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
                  }}
                  className="text-gray-800"
                >
                  落笔处，世界始。林峰握紧了手中的长剑，感受着丹田中那股滚烫的灵力。眼前，敌人的阵列如铁壁铜墙，却在他眼中不过是薄薄的一层纸。
                </p>
              </div>
            </>
          )}

          {/* ── Writing Tab ───────────────────────────── */}
          {tab === "writing" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  每日写作目标
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                    min={100}
                    max={50000}
                    step={100}
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-500">字 / 天</span>
                  <button
                    onClick={() => {
                      const val = parseInt(goalDraft);
                      if (val > 0) setDailyGoal(val);
                    }}
                    className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                  >
                    保存
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {[1000, 2000, 3000, 5000].map((g) => (
                    <button
                      key={g}
                      onClick={() => { setGoalDraft(String(g)); setDailyGoal(g); }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        dailyGoal === g
                          ? "border-indigo-400 text-indigo-600 bg-indigo-50"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {g.toLocaleString()}字
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 leading-relaxed">
                  每日目标在「统计」面板中显示进度条。目标仅用于激励，不影响任何功能。
                </p>
              </div>
            </>
          )}

          {/* ── General Tab ──────────────────────────────── */}
          {tab === "general" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  帮助提示
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHelpButtons}
                      onChange={(e) => setShowHelpButtons(e.target.checked)}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <div>
                      <p className="text-sm text-gray-700">显示功能旁的 ⓘ 帮助按钮</p>
                      <p className="text-xs text-gray-400 mt-0.5">点击可查看各功能的使用说明</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  新手引导
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  重置后，下次启动会重新显示新手引导和功能发现提示。
                </p>
                <button
                  onClick={async () => {
                    if (confirm("确定要重置所有引导状态吗？")) {
                      await resetTutorial();
                    }
                  }}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  重置所有引导
                </button>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
