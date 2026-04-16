import { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { NewProjectModal } from "./NewProjectModal";
import type { Project } from "../../types";

interface Props {
  onOpenProject: (project: Project) => void;
}

export function ProjectList({ onOpenProject }: Props) {
  const { projects, loading, loadProjects, deleteProject } = useProjectStore();
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-indigo-600">笔灵</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">AI 写作伙伴</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + 新建作品
        </button>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-20">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="max-w-2xl mx-auto py-16">
            <div className="text-center mb-10">
              <div className="text-6xl mb-4">✍️</div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">欢迎使用笔灵</h2>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mb-6">专为中文网文作者打造的 AI 写作伙伴</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                新建第一部作品
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: "🔒", title: "永不丢字", desc: "三层自动保存 + 版本快照，比纯纯写作更可靠" },
                { icon: "🧠", title: "AI 有记忆", desc: "世界百科 + 前情摘要注入上下文，续写不跑偏" },
                { icon: "🗺️", title: "大纲管理", desc: "三级大纲 + 伏笔追踪，故事结构一目了然" },
                { icon: "🔍", title: "全文搜索", desc: "Cmd+Shift+F 搜索全书，快速定位任意内容" },
                { icon: "🧭", title: "卡文锦囊", desc: "AI 分析剧情 + 伏笔，给出 5 个发展方向" },
                { icon: "📤", title: "一键导出", desc: "支持起点、番茄等平台格式，直接粘贴发布" },
              ].map((f) => (
                <div key={f.title} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">{f.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => onOpenProject(project)}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full ml-2 shrink-0">
                    {project.genre}
                  </span>
                </div>

                {project.synopsis && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-2 mb-3">
                    {project.synopsis}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {project.word_count > 0
                      ? `${project.word_count.toLocaleString()} 字`
                      : "尚未开始"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(project.updated_at)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(project.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New project modal */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => {
            setShowModal(false);
            // Use store directly to avoid stale closure
            const { projects: fresh } = useProjectStore.getState();
            const project = fresh.find((p) => p.id === id);
            if (project) onOpenProject(project);
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">确认删除</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">
              删除后无法恢复，包括所有章节内容。确定要删除吗？
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await deleteProject(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
