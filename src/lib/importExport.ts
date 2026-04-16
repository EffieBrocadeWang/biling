import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Chapter, Volume } from "../types";
import { docToText } from "./context";

// ── Chapter heading detection ──────────────────────────────────────────────

// Matches: 第一章、第1章、Chapter 1、CHAPTER ONE、第一回、=== 标题 ===
const CHAPTER_PATTERNS = [
  /^第[零一二三四五六七八九十百千\d]+[章节回]/,
  /^Chapter\s+\d+/i,
  /^CHAPTER\s+[A-Z\s]+$/i,
  /^={2,}\s*.+\s*={2,}$/,
  /^【.+】$/,
];

function isChapterHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return CHAPTER_PATTERNS.some((p) => p.test(trimmed));
}

export interface ParsedChapter {
  title: string;
  content: string;
}

export function parseTxtIntoChapters(text: string): ParsedChapter[] {
  const lines = text.split(/\r?\n/);
  const chapters: ParsedChapter[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isChapterHeading(line)) {
      // Save previous chapter
      if (currentLines.some((l) => l.trim())) {
        chapters.push({ title: currentTitle || "未命名章节", content: currentLines.join("\n").trim() });
      }
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Last chapter
  if (currentLines.some((l) => l.trim())) {
    chapters.push({ title: currentTitle || "未命名章节", content: currentLines.join("\n").trim() });
  }

  // If no headings detected, treat the whole file as one chapter
  if (chapters.length === 0 && text.trim()) {
    chapters.push({ title: "第一章", content: text.trim() });
  }

  return chapters;
}

// Convert plain text content into a minimal Tiptap JSON doc
export function textToTiptapDoc(text: string): string {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      type: "paragraph",
      content: p ? [{ type: "text", text: p }] : [],
    }));
  return JSON.stringify({ type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] });
}

// Count CJK + latin words
function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "").trim().split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}

// ── Import ─────────────────────────────────────────────────────────────────

export async function pickAndReadTxt(): Promise<{ chapters: ParsedChapter[]; filename: string } | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "文本文件", extensions: ["txt"] }],
  });
  if (!selected) return null;
  const path = typeof selected === "string" ? selected : selected;
  const text = await readTextFile(path as string);
  const filename = (path as string).split(/[\\/]/).pop() ?? "import.txt";
  const chapters = parseTxtIntoChapters(text);
  return { chapters, filename };
}

// ── Export ─────────────────────────────────────────────────────────────────

export interface ExportChapter {
  title: string;
  content: string; // Tiptap JSON
}

export function chaptersToTxt(
  projectName: string,
  volumes: Volume[],
  chapters: Chapter[],
  platform: "generic" | "qidian" | "fanqie"
): string {
  const lines: string[] = [];

  if (platform !== "generic") {
    lines.push(projectName, "");
  }

  // Group by volume
  const volumeMap = new Map(volumes.map((v) => [v.id, v]));
  let lastVolumeId: number | null = null;

  const sorted = [...chapters].sort((a, b) => {
    const va = volumeMap.get(a.volume_id);
    const vb = volumeMap.get(b.volume_id);
    if (!va || !vb) return 0;
    if (va.sort_order !== vb.sort_order) return va.sort_order - vb.sort_order;
    return a.sort_order - b.sort_order;
  });

  for (const ch of sorted) {
    if (ch.volume_id !== lastVolumeId) {
      const vol = volumeMap.get(ch.volume_id);
      if (vol && volumes.length > 1) {
        lines.push("", `===== ${vol.title} =====`, "");
      }
      lastVolumeId = ch.volume_id;
    }

    lines.push(ch.title, "");

    const text = docToText(ch.content);
    if (platform === "qidian") {
      // 起点: indent paragraphs with 2 full-width spaces
      const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
      lines.push(...paras.map((p) => `　　${p}`));
    } else if (platform === "fanqie") {
      // 番茄: blank line between paragraphs, no indent
      const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
      lines.push(...paras.flatMap((p) => [p, ""]));
    } else {
      lines.push(text);
    }
    lines.push("", "");
  }

  return lines.join("\n");
}

export async function exportProject(
  projectName: string,
  volumes: Volume[],
  chapters: Chapter[],
  platform: "generic" | "qidian" | "fanqie"
) {
  const defaultName = `${projectName}${platform === "qidian" ? "_起点版" : platform === "fanqie" ? "_番茄版" : ""}.txt`;
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "文本文件", extensions: ["txt"] }],
  });
  if (!filePath) return;

  const content = chaptersToTxt(projectName, volumes, chapters, platform);
  await writeTextFile(filePath, content);
  return filePath;
}

export function getImportStats(chapters: ParsedChapter[]) {
  const totalWords = chapters.reduce((s, c) => s + countWords(c.content), 0);
  return { chapterCount: chapters.length, totalWords };
}
