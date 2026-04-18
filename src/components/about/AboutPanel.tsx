import { useState } from "react";

const APP_VERSION = "0.1.0";
const COPYRIGHT_YEAR = "2026";
const COPYRIGHT_OWNER = "王昱辰";

type Tab = "about" | "license" | "privacy" | "oss";

const OSS_LICENSES = [
  { name: "React", version: "19.x", license: "MIT", url: "https://react.dev" },
  { name: "Tauri", version: "2.x", license: "MIT / Apache-2.0", url: "https://tauri.app" },
  { name: "Tiptap", version: "2.x", license: "MIT", url: "https://tiptap.dev" },
  { name: "Tailwind CSS", version: "4.x", license: "MIT", url: "https://tailwindcss.com" },
  { name: "Zustand", version: "5.x", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "@dnd-kit", version: "6.x", license: "MIT", url: "https://dndkit.com" },
  { name: "fflate", version: "0.8.x", license: "MIT", url: "https://github.com/101arrowz/fflate" },
  { name: "tauri-plugin-sql", version: "2.x", license: "MIT / Apache-2.0", url: "https://github.com/tauri-apps/tauri-plugin-sql" },
];

export function AboutPanel() {
  const [tab, setTab] = useState<Tab>("about");

  const TAB_LABELS: Record<Tab, string> = {
    about:   "关于",
    license: "许可协议",
    privacy: "隐私政策",
    oss:     "开源声明",
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl shadow-md select-none">
            ✍️
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">笔灵</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI 网文创作助手</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">版本 {APP_VERSION}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === t
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── About ── */}
        {tab === "about" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
              笔灵是专为中文网文作者设计的 AI 写作助手。帮你管角色、记伏笔、对话大纲，写到第 500 章也不会忘记第 1 章的设定。
            </div>

            <div>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">版权信息</h2>
              <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                <p>版权所有 © {COPYRIGHT_YEAR} {COPYRIGHT_OWNER}</p>
                <p>保留所有权利。</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mt-2">
                  本软件受中华人民共和国《著作权法》及国际版权公约保护。未经书面授权，
                  禁止复制、修改、发布或以任何方式传播本软件。
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">技术规格</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["版本", APP_VERSION],
                  ["框架", "Tauri 2.0 + React 19"],
                  ["编辑器", "Tiptap v2 (ProseMirror)"],
                  ["数据库", "SQLite (本地)"],
                  ["AI 接入", "用户自配 API Key"],
                  ["数据隐私", "完全本地，不上传"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                    <p className="text-gray-400 dark:text-gray-500">{k}</p>
                    <p className="text-gray-700 dark:text-gray-200 font-medium mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                如需商业授权、报告盗版或产品咨询，请联系 yuchenwangeffie@gmail.com
              </p>
            </div>
          </div>
        )}

        {/* ── License ── */}
        {tab === "license" && (
          <div className="p-6 max-w-2xl">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">最终用户许可协议 (EULA)</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">版本 1.0 · {COPYRIGHT_YEAR}</p>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-gray-600 dark:text-gray-400 leading-relaxed space-y-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              <p className="font-semibold text-gray-800 dark:text-gray-200">
                在安装、复制或使用本软件前，请仔细阅读本协议。安装或使用本软件即表示您接受本协议的全部条款。
              </p>

              <Section title="一、著作权声明">
                本软件（笔灵）及其所有组成部分，包括但不限于源代码、界面设计、图标、文档、内置写作资源包，均受《著作权法》保护。版权所有 © {COPYRIGHT_YEAR} {COPYRIGHT_OWNER}，保留所有权利。
              </Section>

              <Section title="二、许可范围">
                著作权人授予您在已授权设备上安装并使用本软件一个副本的有限、非独占、不可转让权利。
              </Section>

              <Section title="三、禁止行为">
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>破解、反编译、反汇编或试图获取本软件源代码</li>
                  <li>移除或修改软件中的版权声明</li>
                  <li>将软件转售、分发、出租或再许可</li>
                  <li>制作、分发或使用破解版、注册机或激活补丁</li>
                  <li>将内置写作资源包提取后单独分发或出售</li>
                </ul>
              </Section>

              <Section title="四、写作资源包专项条款">
                资源包内容仅供已授权用户在本软件内使用。严禁将资源包内容在本软件以外的平台传播。付费资源包须持有对应授权码方可激活。未经授权传播付费资源包，著作权人有权依法追究民事及刑事责任。
              </Section>

              <Section title="五、违约责任">
                违反本协议任何条款，许可立即终止，著作权人保留依据《著作权法》《计算机软件保护条例》索赔的权利，包括实际损失及法律规定的法定赔偿。
              </Section>

              <Section title="六、免责声明">
                本软件按"现状"提供，不作任何明示或暗示保证。AI 生成内容须用户自行审核，著作权人不对 AI 输出内容承担责任。
              </Section>

              <Section title="七、适用法律">
                本协议受中华人民共和国法律管辖。争议提交著作权人所在地有管辖权的人民法院解决。
              </Section>
            </div>
          </div>
        )}

        {/* ── Privacy ── */}
        {tab === "privacy" && (
          <div className="p-6 max-w-2xl">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">隐私政策</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">版本 1.0 · {COPYRIGHT_YEAR}</p>
            </div>
            <div className="space-y-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-green-700 dark:text-green-300 font-medium text-sm">
                🔒 本地优先 — 您的创作数据只在您自己的设备上，我们看不到。
              </div>

              <Section title="我们不收集">
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>您的作品内容（章节、大纲、角色设定等）</li>
                  <li>您输入给 AI 的任何内容</li>
                  <li>AI 的回复内容</li>
                  <li>您的 API Key</li>
                </ul>
                <p className="mt-2">以上内容仅存储于您本机的 SQLite 数据库，笔灵团队无法访问。</p>
              </Section>

              <Section title="AI 请求流向">
                <code className="block bg-gray-100 dark:bg-gray-700 rounded p-2 mt-1 text-xs">
                  您的设备 → 您配置的 AI 服务商（DeepSeek / Ollama 等）
                </code>
                <p className="mt-1">笔灵服务器不在此链路中。</p>
              </Section>

              <Section title="数据存储位置">
                <p>所有数据存储于本机 SQLite 数据库：</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>macOS：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">~/Library/Application Support/com.shrimp.biling/biling.db</code></li>
                  <li>Windows：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">%APPDATA%\com.shrimp.biling\biling.db</code></li>
                </ul>
              </Section>
            </div>
          </div>
        )}

        {/* ── OSS Licenses ── */}
        {tab === "oss" && (
          <div className="p-6 max-w-2xl">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">开源组件声明</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                笔灵使用了以下开源组件，在此表示感谢。
              </p>
            </div>
            <div className="space-y-2">
              {OSS_LICENSES.map((lib) => (
                <div key={lib.name} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{lib.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{lib.version}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                    {lib.license}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
              各组件均依其各自许可证条款使用。
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</p>
      <div>{children}</div>
    </div>
  );
}
