import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import {
  pickAndReadTxt,
  exportProject,
  chaptersToTxt,
  textToTiptapDoc,
  getImportStats,
  type ParsedChapter,
} from "../../lib/importExport";
import { getDb } from "../../lib/db";
import type { Book } from "../../types";
import { generateId } from "../../lib/db";
import { docToText } from "../../lib/context";
import { scanText } from "../../lib/scanner";
import { SensitivityScanner } from "../scanner/SensitivityScanner";
import type { Platform } from "../../data/sensitiveWords";

interface Props {
  project: Book;
}

type ExportPlatform = "generic" | "qidian" | "fanqie";

const PLATFORMS: { id: ExportPlatform; label: string; desc: string }[] = [
  { id: "generic",  label: "通用 TXT",  desc: "原始排版，无特殊格式" },
  { id: "qidian",   label: "起点格式",  desc: "段落缩进两个全角空格" },
  { id: "fanqie",   label: "番茄格式",  desc: "段落间空行，无缩进" },
];

type PublishPlatform = "qidian" | "fanqie" | "jinjiang" | "feilu";

const PUBLISH_PLATFORMS: { id: PublishPlatform; label: string; maxWords: number; scanPlatform: Platform }[] = [
  { id: "qidian",   label: "起点",  maxWords: 6000, scanPlatform: "qidian" },
  { id: "fanqie",   label: "番茄",  maxWords: 5000, scanPlatform: "fanqie" },
  { id: "jinjiang", label: "晋江",  maxWords: 8000, scanPlatform: "jinjiang" },
  { id: "feilu",    label: "飞卢",  maxWords: 5000, scanPlatform: "feilu" },
];

export function ImportExportPanel({ project }: Props) {
  const { volumes, chapters, activeChapter, loadProjectData } = useEditorStore();

  // Import state
  const [importPreview, setImportPreview] = useState<ParsedChapter[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  // Export state
  const [exportPlatform, setExportPlatform] = useState<ExportPlatform>("generic");
  const [exporting, setExporting] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);

  // Publish state
  const [publishPlatform, setPublishPlatform] = useState<PublishPlatform>("qidian");
  const [publishScope, setPublishScope] = useState<"chapter" | "all">("chapter");
  const [copiedStatus, setCopiedStatus] = useState<"idle" | "copied" | "error">("idle");
  const [scannerText, setScannerText] = useState<string | null>(null);

  async function handlePickFile() {
    const result = await pickAndReadTxt();
    if (!result) return;
    setImportPreview(result.chapters);
    setImportDone(false);
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const db = await getDb();

      // Use first volume, or create one if needed
      let volumeId: string = volumes[0]?.id ?? "";
      if (!volumeId) {
        volumeId = generateId();
        await db.execute(
          "INSERT INTO volumes (id, book_id, title, sort_order) VALUES (?, ?, ?, 0)",
          [volumeId, project.id, "导入内容"]
        );
      }

      // Get current max sort_order for the volume
      const existing = chapters.filter((c) => c.volume_id === volumeId);
      let sortOrder = existing.length;

      for (const ch of importPreview) {
        const content = textToTiptapDoc(ch.content);
        const wc = ch.content.replace(/\s/g, "").length;
        const chapterId = generateId();
        await db.execute(
          "INSERT INTO chapters (id, book_id, volume_id, title, content, word_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [chapterId, project.id, volumeId, ch.title, content, wc, sortOrder++]
        );
      }

      await loadProjectData(project.id);
      setImportDone(true);
      setImportPreview(null);
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    if (chapters.length === 0) return;
    setExporting(true);
    setExportPath(null);
    try {
      const path = await exportProject(project.title, volumes, chapters, exportPlatform);
      if (path) setExportPath(path);
    } finally {
      setExporting(false);
    }
  }

  function getPublishText(): string {
    const platform = PUBLISH_PLATFORMS.find((p) => p.id === publishPlatform)!;
    const exportFmt = platform.id === "qidian" ? "qidian" : platform.id === "fanqie" ? "fanqie" : "generic";
    if (publishScope === "chapter") {
      if (!activeChapter) return "";
      const text = docToText(activeChapter.content);
      if (exportFmt === "qidian") {
        const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
        return `${activeChapter.title}\n\n${paras.map((p) => `　　${p}`).join("\n")}`;
      } else if (exportFmt === "fanqie") {
        const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
        return `${activeChapter.title}\n\n${paras.join("\n\n")}`;
      }
      return `${activeChapter.title}\n\n${text}`;
    }
    return chaptersToTxt(project.title, volumes, chapters, exportFmt as ExportPlatform);
  }

  async function handleCopyForPublish() {
    const text = getPublishText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStatus("copied");
      setTimeout(() => setCopiedStatus("idle"), 2500);
    } catch {
      setCopiedStatus("error");
      setTimeout(() => setCopiedStatus("idle"), 2500);
    }
  }

  function handleScan() {
    const text = getPublishText();
    if (text) setScannerText(text);
  }

  const stats = importPreview ? getImportStats(importPreview) : null;
  const totalExportWords = chapters.reduce((s, c) => s + c.word_count, 0);

  // Publish preflight
  const currentPlatformCfg = PUBLISH_PLATFORMS.find((p) => p.id === publishPlatform)!;
  const publishWordCount = publishScope === "chapter"
    ? (activeChapter?.word_count ?? 0)
    : chapters.reduce((s, c) => s + c.word_count, 0);
  const overWordLimit = publishWordCount > currentPlatformCfg.maxWords;
  const publishScanResult = publishScope === "chapter" && activeChapter
    ? scanText(docToText(activeChapter.content), currentPlatformCfg.scanPlatform)
    : publishScope === "all"
    ? scanText(chapters.map((c) => docToText(c.content)).join(" "), currentPlatformCfg.scanPlatform)
    : null;

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
      {/* ── Publish ── */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">一键排版发布</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          按平台格式排版后复制到剪贴板，粘贴到网站投稿框即可
        </p>

        {/* Platform selector */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PUBLISH_PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPublishPlatform(p.id)}
              className={`border rounded-xl py-2.5 text-center transition-colors ${
                publishPlatform === p.id
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <p className={`text-sm font-medium ${publishPlatform === p.id ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-200"}`}>
                {p.label}
              </p>
            </button>
          ))}
        </div>

        {/* Scope selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPublishScope("chapter")}
            className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
              publishScope === "chapter"
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
            }`}
          >
            当前章节
          </button>
          <button
            onClick={() => setPublishScope("all")}
            className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
              publishScope === "all"
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
            }`}
          >
            全部章节
          </button>
        </div>

        {/* Preflight checks */}
        <div className="space-y-2 mb-4">
          {/* Word count check */}
          <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
            publishScope === "chapter" && !activeChapter
              ? "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
              : overWordLimit
              ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
              : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          }`}>
            <span>字数</span>
            <span>
              {publishScope === "chapter" && !activeChapter
                ? "未打开章节"
                : `${publishWordCount.toLocaleString()} 字${overWordLimit ? `（超出${currentPlatformCfg.label}建议上限 ${currentPlatformCfg.maxWords.toLocaleString()} 字）` : ""}`
              }
            </span>
          </div>

          {/* Sensitivity check */}
          {publishScanResult && (
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              publishScanResult.blockCount > 0
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                : publishScanResult.warnCount > 0
                ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
                : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
            }`}>
              <span>敏感词</span>
              <span>
                {publishScanResult.matches.length === 0
                  ? "无"
                  : `${publishScanResult.blockCount > 0 ? `${publishScanResult.blockCount} 个屏蔽词` : ""}${publishScanResult.blockCount > 0 && publishScanResult.warnCount > 0 ? " + " : ""}${publishScanResult.warnCount > 0 ? `${publishScanResult.warnCount} 个警告词` : ""}`
                }
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={publishScope === "chapter" && !activeChapter}
            className="flex-1 py-2.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            查看敏感词
          </button>
          <button
            onClick={handleCopyForPublish}
            disabled={publishScope === "chapter" && !activeChapter}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors disabled:opacity-40 ${
              copiedStatus === "copied"
                ? "bg-green-500 text-white"
                : copiedStatus === "error"
                ? "bg-red-500 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {copiedStatus === "copied" ? "✓ 已复制" : copiedStatus === "error" ? "复制失败" : "复制内容"}
          </button>
        </div>
      </section>

      {/* Scanner modal */}
      {scannerText !== null && (
        <SensitivityScanner
          text={scannerText}
          initialPlatform={currentPlatformCfg.scanPlatform}
          onClose={() => setScannerText(null)}
        />
      )}
    </div>
  );
}
