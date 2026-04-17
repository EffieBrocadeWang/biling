import { useEffect, useState } from "react";
import {
  useWritingPacksStore,
  type WritingPack,
  type PackCategory,
  type PackItem,
  PACK_CATEGORIES,
  PACK_CATEGORY_LABELS,
  PACK_CATEGORY_ICONS,
} from "../../store/writingPacksStore";
import {
  useProjectDocsStore,
  type DocType,
} from "../../store/projectDocsStore";
import { useTabStore } from "../../store/tabStore";
import { pickAndParsePack } from "../../lib/packImport";

// Map pack category to the best project doc type
const CATEGORY_TO_DOC_TYPE: Record<PackCategory, DocType> = {
  template:     "custom",
  material:     "reference_notes",
  inspiration:  "custom",
  writing_rule: "writing_rules",
  reference:    "reference_notes",
};

// ── Preview modal ──────────────────────────────────────────────────────────

function PreviewModal({ item, onClose }: { item: PackItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[600px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</span>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
            {item.content}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Pack detail view ────────────────────────────────────────────────────────

interface PackDetailProps {
  pack: WritingPack;
  projectId: string;
  onBack: () => void;
}

function PackDetail({ pack, projectId, onBack }: PackDetailProps) {
  const { items, loadItems, getItemsByCategory } = useWritingPacksStore();
  const { createDoc } = useProjectDocsStore();
  const [activeCategory, setActiveCategory] = useState<PackCategory>("template");
  const [previewItem, setPreviewItem] = useState<PackItem | null>(null);
  // Maps item.id → "added" | "adding"
  const [itemState, setItemState] = useState<Record<string, "adding" | "added">>({});
  // Toast: title of the last added doc
  const [toast, setToast] = useState<string | null>(null);

  const packItems = items.filter(i => i.pack_id === pack.id);

  useEffect(() => {
    if (packItems.length === 0) {
      loadItems(pack.id);
    }
  }, [pack.id]);

  const categoryItems = getItemsByCategory(pack.id, activeCategory);
  const availableCategories = PACK_CATEGORIES.filter(
    cat => items.some(i => i.pack_id === pack.id && i.category === cat)
  );

  async function handleUseItem(item: PackItem) {
    setItemState(s => ({ ...s, [item.id]: "adding" }));
    try {
      const docType = CATEGORY_TO_DOC_TYPE[item.category];
      await createDoc(projectId, docType, item.title, item.content, "none");
      setItemState(s => ({ ...s, [item.id]: "added" }));
      setToast(item.title);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setItemState(s => { const n = { ...s }; delete n[item.id]; return n; });
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
        >
          ← 资源库
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-base">{pack.icon ?? "📦"}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{pack.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">v{pack.version}</span>
        {pack.author && (
          <span className="text-xs text-gray-400 dark:text-gray-500">by {pack.author}</span>
        )}
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {packItems.length} 项内容
        </span>
      </div>

      {/* Category tabs */}
      <div className="shrink-0 flex gap-0.5 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        {availableCategories.map(cat => {
          const count = items.filter(i => i.pack_id === pack.id && i.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeCategory === cat
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <span>{PACK_CATEGORY_ICONS[cat]}</span>
              <span>{PACK_CATEGORY_LABELS[cat]}</span>
              <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {packItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
            加载中…
          </div>
        ) : categoryItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
            暂无{PACK_CATEGORY_LABELS[activeCategory]}内容
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {categoryItems.map(item => {
              const state = itemState[item.id];
              return (
                <div
                  key={item.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex flex-col gap-2 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm shrink-0">{PACK_CATEGORY_ICONS[item.category]}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-100 leading-tight">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-3 leading-relaxed flex-1">
                    {item.content.slice(0, 120)}
                  </p>
                  <div className="flex gap-1.5 mt-auto">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="flex-1 text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      预览
                    </button>
                    <button
                      onClick={() => state !== "added" && handleUseItem(item)}
                      disabled={state === "adding"}
                      className={`flex-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                        state === "added"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default"
                          : state === "adding"
                          ? "bg-indigo-300 text-white cursor-wait"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {state === "added" ? "已添加 ✓" : state === "adding" ? "添加中…" : "添加到文档"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-4 py-2.5 rounded-xl shadow-lg">
          <span>✓ 已添加到「项目文档」：{toast}</span>
          <button
            onClick={() => {
              useTabStore.getState().openTab({ type: "docs", title: "项目文档" });
              setToast(null);
            }}
            className="underline opacity-80 hover:opacity-100 shrink-0"
          >
            去查看
          </button>
        </div>
      )}

      {previewItem && (
        <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </div>
  );
}

// ── Pack library (main view) ────────────────────────────────────────────────

interface Props {
  projectId: string;
}

export function WritingPacksPanel({ projectId }: Props) {
  const { packs, loading, loadPacks, uninstallPack } = useWritingPacksStore();
  const [selectedPack, setSelectedPack] = useState<WritingPack | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const { installPack } = useWritingPacksStore();

  useEffect(() => {
    const { seedBuiltinPacks } = useWritingPacksStore.getState();
    seedBuiltinPacks().then(() => loadPacks());
  }, []);

  async function handleImport() {
    setImportError(null);
    setImporting(true);
    try {
      const parsed = await pickAndParsePack();
      if (!parsed) return;
      const pack = await installPack(parsed.manifest, parsed.items);
      setSelectedPack(pack);
    } catch (err) {
      setImportError(String(err));
    } finally {
      setImporting(false);
    }
  }

  async function handleUninstall(pack: WritingPack) {
    if (!confirm(`确定卸载「${pack.name}」吗？`)) return;
    if (selectedPack?.id === pack.id) setSelectedPack(null);
    await uninstallPack(pack.id);
  }

  if (selectedPack) {
    // Verify the pack is still installed (wasn't deleted)
    const stillInstalled = packs.some(p => p.id === selectedPack.id);
    if (stillInstalled) {
      return (
        <PackDetail
          pack={selectedPack}
          projectId={projectId}
          onBack={() => setSelectedPack(null)}
        />
      );
    }
    setSelectedPack(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">📦 资源库</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              专题写作包：素材、模板、灵感、写作规则
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {importing ? "导入中…" : "+ 导入写作包"}
          </button>
        </div>
        {importError && (
          <p className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">
            导入失败：{importError}
          </p>
        )}
      </div>

      {/* Pack list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">加载中…</p>
        )}

        {!loading && packs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">
              还没有安装任何写作包
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              写作包包含专题素材、灵感、模板和写作规则
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              + 导入 .biling-pack 文件
            </button>
          </div>
        )}

        {packs.length > 0 && (
          <div className="space-y-3">
            {packs.map(pack => (
              <div
                key={pack.id}
                className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{pack.icon ?? "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {pack.name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        v{pack.version}
                      </span>
                      {pack.genre && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                          {pack.genre}
                        </span>
                      )}
                    </div>
                    {pack.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {pack.description}
                      </p>
                    )}
                    {pack.author && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">by {pack.author}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setSelectedPack(pack)}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      浏览
                    </button>
                    <button
                      onClick={() => handleUninstall(pack)}
                      className="text-xs px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      卸载
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          写作包是 .biling-pack 格式的 ZIP 文件，可包含素材、模板、灵感和写作规则
        </p>
      </div>
    </div>
  );
}
