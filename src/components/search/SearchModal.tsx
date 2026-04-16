import { useEffect, useRef, useState, useCallback } from "react";
import { getDb } from "../../lib/db";
import { useEditorStore } from "../../store/editorStore";

interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  volumeTitle: string;
  snippet: string;
  matchStart: number; // position within snippet where match begins
  matchLen: number;
}

// Extract plain text from Tiptap JSON doc
function extractText(jsonStr: string): string {
  try {
    const doc = JSON.parse(jsonStr);
    const parts: string[] = [];
    function walk(node: { type?: string; text?: string; content?: unknown[] }) {
      if (node.text) parts.push(node.text);
      if (node.content) (node.content as typeof node[]).forEach(walk);
    }
    walk(doc);
    return parts.join("");
  } catch {
    return jsonStr; // fallback: treat as raw text
  }
}

// Build snippet around first match (≤60 chars before, ≤80 chars after)
function buildSnippet(text: string, query: string): { snippet: string; matchStart: number; matchLen: number } | null {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const pos = lower.indexOf(qLower);
  if (pos === -1) return null;
  const before = Math.max(0, pos - 60);
  const after = Math.min(text.length, pos + query.length + 80);
  const snippet = (before > 0 ? "…" : "") + text.slice(before, after) + (after < text.length ? "…" : "");
  const matchStart = pos - before + (before > 0 ? 1 : 0); // +1 for ellipsis char
  return { snippet, matchStart, matchLen: query.length };
}

interface Props {
  projectId: string;
  onClose: () => void;
  onNavigate: () => void; // switch to editor view
}

export function SearchModal({ projectId, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setActiveChapter } = useEditorStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    setSearched(false);
    try {
      const db = await getDb();
      // Fetch all chapters for this project with their content
      const rows = await db.select<{ id: string; title: string; content: string; volume_title: string }[]>(
        `SELECT c.id, c.title, c.content,
                v.title AS volume_title
         FROM chapters c
         JOIN volumes v ON c.volume_id = v.id
         WHERE v.book_id = ?
         ORDER BY v.sort_order, c.sort_order`,
        [projectId]
      );

      const hits: SearchResult[] = [];
      for (const row of rows) {
        const text = extractText(row.content);
        const hit = buildSnippet(text, q.trim());
        if (hit) {
          hits.push({
            chapterId: row.id,
            chapterTitle: row.title,
            volumeTitle: row.volume_title,
            snippet: hit.snippet,
            matchStart: hit.matchStart,
            matchLen: hit.matchLen,
          });
        }
      }
      setResults(hits);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [projectId]);

  // Debounced search
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  }

  async function handleSelect(chapterId: string) {
    await setActiveChapter(chapterId);
    onNavigate();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/30"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-gray-400 dark:text-gray-500 text-lg">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(query); }}
            className="flex-1 text-sm outline-none placeholder-gray-400"
            placeholder="搜索全书内容…"
          />
          {searching && <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">搜索中…</span>}
          <kbd className="text-xs text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <ul>
              {results.map((r) => {
                const before = r.snippet.slice(0, r.matchStart);
                const match = r.snippet.slice(r.matchStart, r.matchStart + r.matchLen);
                const after = r.snippet.slice(r.matchStart + r.matchLen);
                return (
                  <li key={r.chapterId}>
                    <button
                      onClick={() => handleSelect(r.chapterId)}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:bg-indigo-900/30 border-b border-gray-50 transition-colors"
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{r.chapterTitle}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{r.volumeTitle}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-relaxed">
                        {before}
                        <mark className="bg-yellow-200 text-yellow-900 rounded-sm">{match}</mark>
                        {after}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : searched && query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              未找到「{query}」的相关内容
            </div>
          ) : !query.trim() ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              输入关键词搜索全书章节
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
            找到 {results.length} 个章节包含「{query}」
          </div>
        )}
      </div>
    </div>
  );
}
