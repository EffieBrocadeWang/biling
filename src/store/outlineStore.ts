import { create } from "zustand";
import { getDb } from "../lib/db";
import type { OutlineNode } from "../types";

function buildTree(flat: OutlineNode[]): OutlineNode[] {
  const map = new Map<number, OutlineNode>();
  flat.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: OutlineNode[] = [];
  flat.forEach((n) => {
    const node = map.get(n.id)!;
    if (n.parent_id == null) {
      roots.push(node);
    } else {
      map.get(n.parent_id)?.children?.push(node);
    }
  });
  return roots;
}

interface OutlineStore {
  nodes: OutlineNode[];       // flat list
  tree: OutlineNode[];        // nested tree
  projectId: number | null;

  load: (projectId: number) => Promise<void>;
  addNode: (projectId: number, parentId: number | null, level: 1 | 2 | 3) => Promise<OutlineNode>;
  updateNode: (id: number, patch: Partial<Pick<OutlineNode, "title" | "content" | "linked_chapter_id">>) => Promise<void>;
  removeNode: (id: number) => Promise<void>;
  moveUp: (id: number) => Promise<void>;
  moveDown: (id: number) => Promise<void>;
}

export const useOutlineStore = create<OutlineStore>((set, get) => ({
  nodes: [],
  tree: [],
  projectId: null,

  load: async (projectId) => {
    const db = await getDb();
    const rows = await db.select<OutlineNode[]>(
      `SELECT * FROM outline_nodes WHERE project_id = ? ORDER BY level, sort_order`,
      [projectId]
    );
    set({ nodes: rows, tree: buildTree(rows), projectId });
  },

  addNode: async (projectId, parentId, level) => {
    const db = await getDb();
    // determine sort_order
    const siblings = get().nodes.filter((n) => n.parent_id === parentId && n.project_id === projectId);
    const sortOrder = siblings.length;
    const result = await db.execute(
      `INSERT INTO outline_nodes (project_id, parent_id, level, title, content, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, parentId, level, "", "", sortOrder]
    );
    const newId = result.lastInsertId ?? 0;
    const newNode: OutlineNode = {
      id: newId, project_id: projectId, parent_id: parentId,
      title: "", content: "", level, linked_chapter_id: null,
      sort_order: sortOrder, created_at: new Date().toISOString(),
    };
    const updated = [...get().nodes, newNode];
    set({ nodes: updated, tree: buildTree(updated) });
    return newNode;
  },

  updateNode: async (id, patch) => {
    const db = await getDb();
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    const next = { ...node, ...patch };
    await db.execute(
      `UPDATE outline_nodes SET title = ?, content = ?, linked_chapter_id = ? WHERE id = ?`,
      [next.title, next.content, next.linked_chapter_id, id]
    );
    const updated = get().nodes.map((n) => (n.id === id ? next : n));
    set({ nodes: updated, tree: buildTree(updated) });
  },

  removeNode: async (id) => {
    const db = await getDb();
    // Collect all descendant IDs
    const all = get().nodes;
    const toDelete: number[] = [];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      toDelete.push(cur);
      all.filter((n) => n.parent_id === cur).forEach((n) => queue.push(n.id));
    }
    for (const nodeId of toDelete) {
      await db.execute(`DELETE FROM outline_nodes WHERE id = ?`, [nodeId]);
    }
    const updated = all.filter((n) => !toDelete.includes(n.id));
    set({ nodes: updated, tree: buildTree(updated) });
  },

  moveUp: async (id) => {
    const db = await getDb();
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const siblings = nodes
      .filter((n) => n.parent_id === node.parent_id && n.project_id === node.project_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((n) => n.id === id);
    if (idx <= 0) return;
    const prev = siblings[idx - 1];
    await db.execute(`UPDATE outline_nodes SET sort_order = ? WHERE id = ?`, [prev.sort_order, id]);
    await db.execute(`UPDATE outline_nodes SET sort_order = ? WHERE id = ?`, [node.sort_order, prev.id]);
    const updated = nodes.map((n) => {
      if (n.id === id) return { ...n, sort_order: prev.sort_order };
      if (n.id === prev.id) return { ...n, sort_order: node.sort_order };
      return n;
    });
    set({ nodes: updated, tree: buildTree(updated) });
  },

  moveDown: async (id) => {
    const db = await getDb();
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const siblings = nodes
      .filter((n) => n.parent_id === node.parent_id && n.project_id === node.project_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((n) => n.id === id);
    if (idx >= siblings.length - 1) return;
    const next = siblings[idx + 1];
    await db.execute(`UPDATE outline_nodes SET sort_order = ? WHERE id = ?`, [next.sort_order, id]);
    await db.execute(`UPDATE outline_nodes SET sort_order = ? WHERE id = ?`, [node.sort_order, next.id]);
    const updated = nodes.map((n) => {
      if (n.id === id) return { ...n, sort_order: next.sort_order };
      if (n.id === next.id) return { ...n, sort_order: node.sort_order };
      return n;
    });
    set({ nodes: updated, tree: buildTree(updated) });
  },
}));
