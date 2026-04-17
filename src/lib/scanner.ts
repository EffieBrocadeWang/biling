import { SENSITIVE_WORDS, type SensitiveEntry, type Severity, type Platform } from "../data/sensitiveWords";

export interface ScanMatch {
  entry: SensitiveEntry;
  index: number;       // char offset in text
  context: string;     // ~30 chars around the match
}

export interface ScanResult {
  matches: ScanMatch[];
  blockCount: number;
  warnCount: number;
}

/** Return entries applicable to this platform (all-platform + platform-specific). */
function getApplicableEntries(platform?: Platform): SensitiveEntry[] {
  if (!platform || platform === "all") return SENSITIVE_WORDS;
  return SENSITIVE_WORDS.filter(
    (e) => e.platform === undefined || e.platform === platform
  );
}

export function scanText(text: string, platform?: Platform): ScanResult {
  const entries = getApplicableEntries(platform);

  // De-duplicate matches at the same index (longest match wins)
  const matchMap = new Map<number, ScanMatch>();

  for (const entry of entries) {
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(entry.word, pos);
      if (idx === -1) break;

      const existing = matchMap.get(idx);
      // Keep longest word match at same position
      if (!existing || entry.word.length > existing.entry.word.length) {
        const start = Math.max(0, idx - 15);
        const end = Math.min(text.length, idx + entry.word.length + 15);
        const raw = text.slice(start, end);
        const prefix = start > 0 ? "…" : "";
        const suffix = end < text.length ? "…" : "";
        matchMap.set(idx, {
          entry,
          index: idx,
          context: prefix + raw + suffix,
        });
      }

      pos = idx + entry.word.length;
    }
  }

  const matches = [...matchMap.values()].sort((a, b) => a.index - b.index);
  const blockCount = matches.filter((m) => m.entry.severity === "block").length;
  const warnCount = matches.filter((m) => m.entry.severity === "warn").length;

  return { matches, blockCount, warnCount };
}

export function severityLabel(s: Severity) {
  return s === "block" ? "屏蔽词" : "警告词";
}

export function categoryLabel(cat: string) {
  switch (cat) {
    case "political": return "政治";
    case "violence":  return "暴力";
    case "adult":     return "成人";
    default:          return "其他";
  }
}
