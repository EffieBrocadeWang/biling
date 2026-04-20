import { create } from "zustand";
import { getDb, generateId } from "../lib/db";
import { BUILTIN_PACKS } from "../lib/builtinPacks";

export type PackCategory = "template" | "material" | "inspiration" | "writing_rule" | "reference";

export const PACK_CATEGORY_LABELS: Record<PackCategory, string> = {
  template:     "模板",
  material:     "素材",
  inspiration:  "灵感",
  writing_rule: "写作规则",
  reference:    "参考",
};

export const PACK_CATEGORY_ICONS: Record<PackCategory, string> = {
  template:     "📐",
  material:     "📝",
  inspiration:  "💡",
  writing_rule: "📜",
  reference:    "📖",
};

export const PACK_CATEGORIES: PackCategory[] = [
  "template", "material", "inspiration", "writing_rule", "reference",
];

export interface PackManifest {
  id: string;
  name: string;
  name_en?: string;
  version: string;
  author?: string;
  description?: string;
  genre?: string;
  icon?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface WritingPack {
  id: string;
  name: string;
  version: string;
  author: string | null;
  description: string | null;
  genre: string | null;
  icon: string | null;
  manifest: string;
  installed_at: string;
}

export interface PackItem {
  id: string;
  pack_id: string;
  category: PackCategory;
  title: string;
  content: string;
  metadata: string;
  sort_order: number;
}

interface WritingPacksStore {
  packs: WritingPack[];
  items: PackItem[];
  loading: boolean;

  loadPacks: () => Promise<void>;
  loadItems: (packId: string) => Promise<void>;
  installPack: (manifest: PackManifest, items: Pick<PackItem, "category" | "title" | "content">[]) => Promise<WritingPack>;
  uninstallPack: (packId: string) => Promise<void>;
  getItemsByCategory: (packId: string, category: PackCategory) => PackItem[];
  seedBuiltinPacks: () => Promise<void>;
}

export const useWritingPacksStore = create<WritingPacksStore>((set, get) => ({
  packs: [],
  items: [],
  loading: false,

  loadPacks: async () => {
    set({ loading: true });
    try {
      const db = await getDb();
      const rows = await db.select<WritingPack[]>(
        "SELECT * FROM writing_packs ORDER BY installed_at DESC"
      );
      set({ packs: rows });
    } finally {
      set({ loading: false });
    }
  },

  loadItems: async (packId) => {
    const db = await getDb();
    const rows = await db.select<PackItem[]>(
      "SELECT * FROM writing_pack_items WHERE pack_id = ? ORDER BY category, sort_order",
      [packId]
    );
    // Merge with existing items for other packs
    set(state => ({
      items: [
        ...state.items.filter(i => i.pack_id !== packId),
        ...rows,
      ],
    }));
  },

  installPack: async (manifest, itemsInput) => {
    const db = await getDb();
    const packId = manifest.id;

    // Upsert the pack (reinstall replaces)
    await db.execute(
      `INSERT OR REPLACE INTO writing_packs (id, name, version, author, description, genre, icon, manifest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        packId,
        manifest.name,
        manifest.version,
        manifest.author ?? null,
        manifest.description ?? null,
        manifest.genre ?? null,
        manifest.icon ?? null,
        JSON.stringify(manifest),
      ]
    );

    // Delete existing items (for reinstall)
    await db.execute("DELETE FROM writing_pack_items WHERE pack_id = ?", [packId]);

    // Insert new items
    for (let i = 0; i < itemsInput.length; i++) {
      const item = itemsInput[i];
      await db.execute(
        `INSERT INTO writing_pack_items (id, pack_id, category, title, content, metadata, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), packId, item.category, item.title, item.content, (item as Partial<PackItem>).metadata ?? "{}", i]
      );
    }

    await get().loadPacks();
    await get().loadItems(packId);

    return get().packs.find(p => p.id === packId)!;
  },

  uninstallPack: async (packId) => {
    const db = await getDb();
    await db.execute("DELETE FROM writing_packs WHERE id = ?", [packId]);
    set(state => ({
      packs: state.packs.filter(p => p.id !== packId),
      items: state.items.filter(i => i.pack_id !== packId),
    }));
  },

  getItemsByCategory: (packId, category) => {
    return get().items.filter(i => i.pack_id === packId && i.category === category);
  },

  seedBuiltinPacks: async () => {
    const db = await getDb();
    for (const { manifest, items } of BUILTIN_PACKS) {
      const existing = await db.select<{ id: string; version: string }[]>(
        "SELECT id, version FROM writing_packs WHERE id = ?", [manifest.id]
      );
      // Re-install when missing or version changed (fixes stale/duplicate items from old seeds)
      if (existing.length > 0 && existing[0].version === manifest.version) continue;
      await get().installPack(manifest, items);
    }
  },
}));
