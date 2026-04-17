import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { unzipSync, strFromU8 } from "fflate";
import type { PackManifest, PackCategory } from "../store/writingPacksStore";

// Map directory names in the ZIP to pack categories
const DIR_TO_CATEGORY: Record<string, PackCategory> = {
  templates:     "template",
  materials:     "material",
  inspirations:  "inspiration",
  writing_rules: "writing_rule",
  references:    "reference",
};

export interface ParsedPackItem {
  category: PackCategory;
  title: string;
  content: string;
}

export interface ParsedPack {
  manifest: PackManifest;
  items: ParsedPackItem[];
}

export async function pickAndParsePack(): Promise<ParsedPack | null> {
  const filePath = await open({
    multiple: false,
    filters: [
      { name: "笔灵写作包", extensions: ["biling-pack", "zip"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });

  if (!filePath) return null;

  const pathStr = typeof filePath === "string" ? filePath : filePath[0];
  const bytes = await readFile(pathStr);
  return parsePack(bytes);
}

export function parsePack(bytes: Uint8Array): ParsedPack {
  const files = unzipSync(bytes);

  // Find manifest.json
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes) throw new Error("写作包缺少 manifest.json");

  const manifest: PackManifest = JSON.parse(strFromU8(manifestBytes));
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error("manifest.json 格式错误：缺少 id / name / version");
  }

  const items: ParsedPackItem[] = [];

  for (const [path, fileBytes] of Object.entries(files)) {
    if (path === "manifest.json") continue;
    if (!path.endsWith(".md") && !path.endsWith(".txt") && !path.endsWith(".json")) continue;

    const parts = path.split("/");
    if (parts.length < 2) continue;

    const dirName = parts[0];
    const category = DIR_TO_CATEGORY[dirName];
    if (!category) continue;

    const fileName = parts[parts.length - 1];
    const title = fileName.replace(/\.(md|txt|json)$/, "").replace(/_/g, " ");
    const content = strFromU8(fileBytes);

    items.push({ category, title, content });
  }

  return { manifest, items };
}
