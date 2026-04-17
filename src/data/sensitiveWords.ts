export type Severity = "block" | "warn";
export type Platform = "all" | "qidian" | "fanqie" | "jinjiang" | "feilu";

export interface SensitiveEntry {
  word: string;
  severity: Severity;
  category: string;   // 'political' | 'violence' | 'adult' | 'other'
  suggestion?: string;
  platform?: Platform; // undefined means all platforms
}

// ── Built-in sensitive word list ─────────────────────────────────────────────
// Focus on common patterns that trigger Chinese web novel platform censors.
// Grouped by category for maintainability.

export const SENSITIVE_WORDS: SensitiveEntry[] = [
  // ── Political & social (block) ───────────────────────────────────────────
  { word: "政变", severity: "block", category: "political", suggestion: "动乱" },
  { word: "颠覆政权", severity: "block", category: "political", suggestion: "谋逆" },
  { word: "分裂国家", severity: "block", category: "political", suggestion: "分裂势力" },
  { word: "推翻政府", severity: "block", category: "political", suggestion: "推翻王朝" },
  { word: "政府腐败", severity: "warn", category: "political", suggestion: "官府昏庸" },
  { word: "腐败政府", severity: "warn", category: "political", suggestion: "腐朽朝廷" },
  { word: "封建制度", severity: "warn", category: "political", suggestion: "旧制" },

  // ── Extreme violence (block) ─────────────────────────────────────────────
  { word: "砍下头颅", severity: "block", category: "violence", suggestion: "手起刀落" },
  { word: "斩下首级", severity: "warn", category: "violence", suggestion: "一击毙命" },
  { word: "鲜血喷涌", severity: "block", category: "violence", suggestion: "温热的液体" },
  { word: "血肉横飞", severity: "block", category: "violence", suggestion: "激烈的战斗" },
  { word: "开膛破肚", severity: "block", category: "violence", suggestion: "重创" },
  { word: "内脏", severity: "warn", category: "violence", suggestion: "五脏" },
  { word: "断肢", severity: "warn", category: "violence", suggestion: "重伤" },
  { word: "自杀", severity: "warn", category: "violence", suggestion: "以身殉道" },
  { word: "割腕", severity: "block", category: "violence", suggestion: "受伤" },
  { word: "上吊", severity: "block", category: "violence", suggestion: "遭遇不测" },
  { word: "跳楼", severity: "warn", category: "violence", suggestion: "坠落" },

  // ── Violent descriptors (warn) ───────────────────────────────────────────
  { word: "弄死", severity: "warn", category: "violence", suggestion: "击败" },
  { word: "杀死", severity: "warn", category: "violence", suggestion: "击杀" },
  { word: "去死", severity: "warn", category: "violence", suggestion: "离开" },
  { word: "死去", severity: "warn", category: "violence", suggestion: "消逝" },
  { word: "活埋", severity: "warn", category: "violence", suggestion: "困住" },
  { word: "凌迟", severity: "warn", category: "violence", suggestion: "严惩" },
  { word: "暴力", severity: "warn", category: "violence", suggestion: "激烈冲突" },
  { word: "虐待", severity: "warn", category: "violence", suggestion: "磨难" },
  { word: "折磨", severity: "warn", category: "violence", suggestion: "考验" },
  { word: "屠杀", severity: "warn", category: "violence", suggestion: "大战" },
  { word: "屠城", severity: "warn", category: "violence", suggestion: "攻城" },
  { word: "灭门", severity: "warn", category: "violence", suggestion: "族灭" },
  { word: "斩草除根", severity: "warn", category: "violence", suggestion: "彻底铲除" },

  // ── Adult content (block) ────────────────────────────────────────────────
  { word: "做爱", severity: "block", category: "adult", suggestion: "亲密" },
  { word: "性爱", severity: "block", category: "adult", suggestion: "情爱" },
  { word: "阴茎", severity: "block", category: "adult", suggestion: "（请改写）" },
  { word: "阴道", severity: "block", category: "adult", suggestion: "（请改写）" },
  { word: "射精", severity: "block", category: "adult", suggestion: "（请改写）" },
  { word: "乳房", severity: "warn", category: "adult", suggestion: "胸前" },
  { word: "裸体", severity: "warn", category: "adult", suggestion: "衣衫褴褛" },
  { word: "裸露", severity: "warn", category: "adult", suggestion: "露出" },
  { word: "情欲", severity: "warn", category: "adult", suggestion: "情感" },
  { word: "肉体", severity: "warn", category: "adult", suggestion: "身体" },
  { word: "春宫", severity: "warn", category: "adult", suggestion: "画卷" },
  { word: "色情", severity: "block", category: "adult", suggestion: "（请删除）" },
  { word: "淫乱", severity: "block", category: "adult", suggestion: "（请删除）" },

  // ── Drugs & gambling (block) ─────────────────────────────────────────────
  { word: "毒品", severity: "block", category: "other", suggestion: "禁药" },
  { word: "海洛因", severity: "block", category: "other", suggestion: "禁药" },
  { word: "吸毒", severity: "block", category: "other", suggestion: "（请删除）" },
  { word: "贩毒", severity: "block", category: "other", suggestion: "走私" },
  { word: "赌博", severity: "warn", category: "other", suggestion: "赌斗" },
  { word: "赌场", severity: "warn", category: "other", suggestion: "擂台" },

  // ── Platform-specific: 起点 (warn) ───────────────────────────────────────
  { word: "胸口", severity: "warn", category: "other", suggestion: "胸前", platform: "qidian" },
  { word: "丰满", severity: "warn", category: "other", suggestion: "健美", platform: "qidian" },
  { word: "修长的腿", severity: "warn", category: "other", suggestion: "步态轻盈", platform: "qidian" },
  { word: "暧昧", severity: "warn", category: "other", suggestion: "情愫", platform: "qidian" },
  { word: "撩", severity: "warn", category: "other", suggestion: "引逗", platform: "qidian" },
  { word: "意淫", severity: "block", category: "adult", suggestion: "（请删除）", platform: "qidian" },

  // ── Platform-specific: 晋江 (warn, typically stricter on some topics) ────
  { word: "兄弟情深", severity: "warn", category: "other", suggestion: "袍泽情谊", platform: "jinjiang" },
  { word: "相拥而泣", severity: "warn", category: "other", suggestion: "并肩而立", platform: "jinjiang" },

  // ── Other common sensitivities (warn) ────────────────────────────────────
  { word: "法轮功", severity: "block", category: "political" },
  { word: "藏独", severity: "block", category: "political" },
  { word: "台独", severity: "block", category: "political" },
  { word: "邪教", severity: "warn", category: "other", suggestion: "妖教" },
  { word: "传销", severity: "warn", category: "other", suggestion: "骗局" },
  { word: "洗脑", severity: "warn", category: "other", suggestion: "蛊惑" },
  { word: "人口贩卖", severity: "block", category: "other", suggestion: "掠夺" },
  { word: "拐卖", severity: "warn", category: "other", suggestion: "掠夺" },
  { word: "拐卖人口", severity: "block", category: "other", suggestion: "掠夺" },
  { word: "器官移植", severity: "warn", category: "other", suggestion: "秘术" },
  { word: "活体器官", severity: "block", category: "other", suggestion: "（请删除）" },

  // ── Suicide methods (block) ──────────────────────────────────────────────
  { word: "服毒自尽", severity: "warn", category: "violence", suggestion: "以身殉节" },
  { word: "饮鸩止渴", severity: "warn", category: "violence", suggestion: "引鸩止渴" },
  { word: "自焚", severity: "block", category: "violence", suggestion: "以身殉道" },
  { word: "引颈就戮", severity: "warn", category: "violence", suggestion: "坦然受死" },
];
