import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import {
  pickAndReadTxt,
  exportProject,
  textToTiptapDoc,
  getImportStats,
  type ParsedChapter,
} from "../../lib/importExport";
import { getDb } from "../../lib/db";
import type { Project } from "../../types";

interface Props {
  project: Project;
}

type ExportPlatform = "generic" | "qidian" | "fanqie";

const PLATFORMS: { id: ExportPlatform; label: string; desc: string }[] = [
  { id: "generic",  label: "通用 TXT",  desc: "原始排版，无特殊格式" },
  { id: "qidian",   label: "起点格式",  desc: "段落缩进两个全角空格" },
  { id: "fanqie",   label: "番茄格式",  desc: "段落间空行，无缩进" },
];

export function ImportExportPanel({ project }: Props) {
  const { volumes, chapters, loadProjectData } = useEditorStore();

  // Import state
  const [importPreview, setImportPreview] = useState<ParsedChapter[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  // Export state
  const [exportPlatform, setExportPlatform] = useState<ExportPlatform>("generic");
  const [exporting, setExporting] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);

  async function handlePickFile() {
    const result = await pickAndReadTxt();
    if (!result) return;
    setImportPreview(result.chapters);
    setImportDone(false);
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setImporting(true);
    const db = await getDb();

    // Use first volume, or create one if needed
    let volumeId = volumes[0]?.id;
    if (!volumeId) {
      const r = await db.execute(
        "INSERT INTO volumes (project_id, title, sort_order) VALUES (?, ?, 0)",
        [project.id, "导入内容"]
      );
      volumeId = r.lastInsertId as number;
    }

    // Get current max sort_order for the volume
    const existing = chapters.filter((c) => c.volume_id === volumeId);
    let sortOrder = existing.length;

    for (const ch of importPreview) {
      const content = textToTiptapDoc(ch.content);
      const wc = ch.content.replace(/\s/g, "").length;
      await db.execute(
        "INSERT INTO chapters (volume_id, title, content, word_count, sort_order) VALUES (?, ?, ?, ?, ?)",
        [volumeId, ch.title, content, wc, sortOrder++]
      );
    }

    // Refresh project word count
    await db.execute(
      `UPDATE projects SET word_count = (
         SELECT COALESCE(SUM(c.word_count), 0)
         FROM chapters c JOIN volumes v ON c.volume_id = v.id
         WHERE v.project_id = ?
       ), updated_at = datetime('now') WHERE id = ?`,
      [project.id, project.id]
    );

    await loadProjectData(project.id);
    setImporting(false);
    setImportDone(true);
    setImportPreview(null);
  }

  async function handleExport() {
    if (chapters.length === 0) return;
    setExporting(true);
    setExportPath(null);
    try {
      const path = await exportProject(project.name, volumes, chapters, exportPlatform);
      if (path) setExportPath(path);
    } finally {
      setExporting(false);
    }
  }

  const stats = importPreview ? getImportStats(importPreview) : null;
  const totalExportWords = chapters.reduce((s, c) => s + c.word_count, 0);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">导入 / 导出</h2>

      {/* ── Import ── */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">导入 TXT</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          支持按章节标题自动拆分（第X章、Chapter X 等格式）。导入内容追加到当前项目。
        </p>

        {!importPreview ? (
          <button
            onClick={handlePickFile}
            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-600 w-full justify-center transition-colors"
          >
            <span className="text-xl">📄</span>
            选择 TXT 文件…
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700">解析完成</p>
                <p className="text-xs text-indigo-500 mt-0.5">
                  识别到 {stats?.chapterCount} 个章节，共约 {stats?.totalWords.toLocaleString()} 字
                </p>
              </div>
              <button onClick={handlePickFile} className="text-xs text-indigo-400 hover:text-indigo-600">
                重新选择
              </button>
            </div>

            {/* Preview list */}
            <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg divide-y divide-gray-50">
              {importPreview.slice(0, 50).map((ch, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate flex-1">{ch.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 shrink-0">
                    {ch.content.replace(/\s/g, "").length} 字
                  </span>
                </div>
              ))}
              {importPreview.length > 50 && (
                <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                  …还有 {importPreview.length - 50} 章
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setImportPreview(null)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? "导入中…" : `确认导入 ${stats?.chapterCount} 章`}
              </button>
            </div>
          </div>
        )}

        {importDone && (
          <div className="mt-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2">
            ✓ 导入成功，请切换到「写作」查看导入的章节
          </div>
        )}
      </section>

      {/* ── Export ── */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">导出 TXT</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          导出全部 {chapters.length} 章，共 {totalExportWords.toLocaleString()} 字
        </p>

        {chapters.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">暂无章节可导出</p>
        ) : (
          <div className="space-y-4">
            {/* Platform selector */}
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setExportPlatform(p.id)}
                  className={`border rounded-xl p-3 text-left transition-colors ${
                    exportPlatform === p.id
                      ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 dark:border-gray-600"
                  }`}
                >
                  <p className={`text-sm font-medium ${exportPlatform === p.id ? "text-indigo-700" : "text-gray-700 dark:text-gray-200"}`}>
                    {p.label}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? "导出中…" : "选择保存位置并导出"}
            </button>

            {exportPath && (
              <p className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 break-all">
                ✓ 已保存到：{exportPath}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
