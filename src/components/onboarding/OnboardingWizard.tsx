import { useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";

interface Props {
  onComplete: () => void;
}

type Genre = { label: string; icon: string; modelHint?: string };

const GENRES: Genre[] = [
  { label: "玄幻", icon: "⚔️" },
  { label: "言情", icon: "🌸" },
  { label: "都市", icon: "🏙️" },
  { label: "仙侠", icon: "☁️" },
  { label: "种田", icon: "🌾" },
  { label: "娱乐圈", icon: "🎬" },
  { label: "其他", icon: "📝" },
];

const TOTAL_STEPS = 5;

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex gap-1.5 justify-center mt-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i === current ? "bg-indigo-500" : i < current ? "bg-indigo-300" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export function OnboardingWizard({ onComplete }: Props) {
  const { setProviderKey, setActiveModel, completeOnboarding } = useSettingsStore();
  const [step, setStep] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  async function finish() {
    await completeOnboarding();
    onComplete();
  }

  async function handleAiNext() {
    if (apiKey.trim()) {
      await setProviderKey("deepseek", apiKey.trim());
      await setActiveModel("deepseek-chat");
    }
    setStep(2);
  }

  async function testDeepSeek() {
    if (!apiKey.trim()) return;
    setTestStatus("testing");
    try {
      const res = await fetch("https://api.deepseek.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        signal: AbortSignal.timeout(6000),
      });
      setTestStatus(res.ok ? "ok" : "fail");
    } catch {
      setTestStatus("fail");
    }
  }

  // ── Step 0: Welcome + Genre ─────────────────────────────────────────────
  if (step === 0) {
    return (
      <Overlay>
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✍️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">欢迎来到笔灵</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            你的 AI 写作伙伴，帮你管角色、记伏笔、<br />
            写到第 500 章也不会忘记第 1 章的设定。
          </p>
        </div>

        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 text-center">你主要写什么类型？</p>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {GENRES.map((g) => (
            <button
              key={g.label}
              onClick={() => setSelectedGenre(g.label)}
              className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 text-sm transition-all ${
                selectedGenre === g.label
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
              }`}
            >
              <span className="text-xl mb-1">{g.icon}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-6">
          选择后会自动加载该类型的写作规则预设
        </p>

        <div className="flex justify-between items-center">
          <button onClick={finish} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            跳过引导
          </button>
          <button
            onClick={() => setStep(1)}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            下一步 →
          </button>
        </div>
        <StepDots current={0} />
      </Overlay>
    );
  }

  // ── Step 1: Connect AI ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Overlay>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">连接你的 AI 助手</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          笔灵需要一个 AI 模型来帮你续写、润色、生成对话。
        </p>

        {/* Option A: API Key */}
        <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">方式一：用自己的 API Key（推荐）</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            推荐 DeepSeek — 中文最强，最便宜。写完一本百万字，AI 费用约 ¥7-48。
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={testDeepSeek}
              disabled={!apiKey.trim() || testStatus === "testing"}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-40"
            >
              {testStatus === "testing" ? "检测中…" : "测试连接"}
            </button>
            {testStatus === "ok" && <span className="text-xs text-green-600 dark:text-green-400">✓ 连接成功</span>}
            {testStatus === "fail" && <span className="text-xs text-red-500">✗ 无效 Key</span>}
          </div>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
            没有 Key？→ 打开 platform.deepseek.com，注册并充值 ¥10，创建 API Key 后粘贴到这里
          </p>
        </div>

        {/* Option B: Local Ollama */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">方式二：本地 Ollama（免费）</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            本机已安装 Ollama + Qwen 模型，无需 API Key。
          </p>
          <button
            onClick={async () => {
              await setActiveModel("qwen2.5:14b");
              setStep(2);
            }}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            使用本地 Ollama
          </button>
        </div>

        {/* Option C: Skip */}
        <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-5">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            <span className="font-medium text-gray-500 dark:text-gray-400">方式三：先不配 AI</span> —
            笔灵也能当纯编辑器用，随时在「设置」中添加。
          </p>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(0)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ← 返回
          </button>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              跳过
            </button>
            <button
              onClick={handleAiNext}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              {apiKey.trim() ? "保存并继续 →" : "继续 →"}
            </button>
          </div>
        </div>
        <StepDots current={1} />
      </Overlay>
    );
  }

  // ── Step 2: Create first character (guidance) ──────────────────────────
  if (step === 2) {
    return (
      <Overlay>
        <div className="text-4xl text-center mb-4">📚</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">世界百科 — 让 AI 记住你的世界</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 leading-relaxed">
          在「世界百科」中添加角色、地点、势力的设定。<br />
          AI 续写时会自动参考，写到第 500 章也不会忘记第 1 章的人设。
        </p>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-5 text-sm space-y-2">
          <p className="font-medium text-gray-700 dark:text-gray-200">创建第一个角色时，记得填写：</p>
          <div className="space-y-1.5 text-gray-500 dark:text-gray-400">
            <p>📛 <span className="text-gray-700 dark:text-gray-300 font-medium">触发关键词</span> — 角色的所有称呼（如：林远、小远、林师弟）</p>
            <p>🗣️ <span className="text-gray-700 dark:text-gray-300 font-medium">说话风格</span> — 让 AI 写对话时有辨识度（如：言简意赅、不说废话）</p>
            <p>📜 <span className="text-gray-700 dark:text-gray-300 font-medium">AI 指令</span> — 不可违反的角色设定（如：林远从不主动示弱）</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-6">
          进入作品后，点击左侧边栏的「百科」创建角色
        </p>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ← 返回
          </button>
          <button
            onClick={() => setStep(3)}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            下一步 →
          </button>
        </div>
        <StepDots current={2} />
      </Overlay>
    );
  }

  // ── Step 3: How to use AI ──────────────────────────────────────────────
  if (step === 3) {
    return (
      <Overlay>
        <div className="text-4xl text-center mb-4">🤖</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">三种使用 AI 的方式</h2>

        <div className="space-y-3 mb-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-3">
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">✏️ 选中文字 → 浮动工具条</p>
            <p className="text-xs text-indigo-600/70 dark:text-indigo-400">选中一段正文，点击「润色」「续写」「扩写」，AI 直接处理选中的文字。</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-3">
            <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">💬 右侧 AI 面板</p>
            <p className="text-xs text-green-600/70 dark:text-green-400">切换「续写」「对话生成」「头脑风暴」等模式，用对话方式和 AI 协作。</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">📜 写作铁律 → 自动注入</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400">在「项目文档」中设置写作铁律，AI 每次续写都会自动遵守你的规则。</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-6">
          每个功能旁边都有 ⓘ 按钮，点击查看详细说明
        </p>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ← 返回
          </button>
          <button
            onClick={() => setStep(4)}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            下一步 →
          </button>
        </div>
        <StepDots current={3} />
      </Overlay>
    );
  }

  // ── Step 4: Done ────────────────────────────────────────────────────────
  return (
    <Overlay>
      <div className="text-center mb-6">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">你已经上手了！</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">接下来你可以：</p>
      </div>

      <div className="space-y-3 mb-8">
        {[
          { icon: "📚", title: "添加角色到世界百科", desc: "AI 就不会搞混角色关系" },
          { icon: "📋", title: "用大纲规划剧情", desc: "AI 可以帮你展开大纲要点" },
          { icon: "🔗", title: "标记伏笔", desc: "笔灵会提醒你哪些伏笔还没回收" },
          { icon: "📜", title: "设置写作铁律", desc: "AI 每次写作都会遵守你的规则" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="text-lg">{item.icon}</span>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.title}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-6">
        每个功能旁边都有 ⓘ 按钮，随时可以查看帮助
      </p>

      <button
        onClick={finish}
        className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
      >
        开始写作 →
      </button>
      <StepDots current={4} />
    </Overlay>
  );
}

// ── Shared overlay wrapper ──────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        {children}
      </div>
    </div>
  );
}
