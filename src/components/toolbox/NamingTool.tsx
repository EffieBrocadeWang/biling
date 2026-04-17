import { useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { aiStream } from "../../lib/ai";

interface NameResult {
  name: string;
  meaning: string;
}

interface Props {
  projectGenre: string;
}

// ── Shared data ────────────────────────────────────────────────────────────

const GENRES = ["玄幻", "修仙", "都市", "古风", "武侠", "科幻", "末世", "游戏", "历史", "现代"];

// ── 人名 config ───────────────────────────────────────────────────────────

const CHAR_GENDERS = [
  { id: "male",    label: "男" },
  { id: "female",  label: "女" },
  { id: "neutral", label: "不限" },
];

const CHAR_STYLES = [
  { id: "heroic",  label: "霸气" },
  { id: "gentle",  label: "温雅" },
  { id: "cold",    label: "冷傲" },
  { id: "witty",   label: "机敏" },
  { id: "dark",    label: "阴鸷" },
  { id: "pure",    label: "清澈" },
];

// ── 地名 config ────────────────────────────────────────────────────────────

const PLACE_TYPES = [
  { id: "city",      label: "城池/城市" },
  { id: "sect",      label: "门派/势力" },
  { id: "mountain",  label: "山脉/险地" },
  { id: "realm",     label: "秘境/界域" },
  { id: "country",   label: "国家/王朝" },
  { id: "river",     label: "河流/海域" },
  { id: "building",  label: "楼阁/场所" },
  { id: "other",     label: "其他" },
];

const PLACE_STYLES = [
  { id: "grand",    label: "宏伟" },
  { id: "ancient",  label: "古朴" },
  { id: "mystical", label: "神秘" },
  { id: "fierce",   label: "险峻" },
  { id: "elegant",  label: "清雅" },
  { id: "dark",     label: "阴森" },
];

// ── Prompts ────────────────────────────────────────────────────────────────

function buildCharPrompt(genre: string, gender: string, style: string, notes: string, count: number) {
  const genderLabel = { male: "男性", female: "女性", neutral: "中性/不限" }[gender] ?? "不限";
  const styleLabel = CHAR_STYLES.find((s) => s.id === style)?.label ?? style;
  return `你是一位精通中文网文起名的大师，专门为${genre}类小说角色取名。

请为一位${genderLabel}角色起 ${count} 个名字，要求：
- 风格：${styleLabel}
- 类型：${genre}${notes ? `\n- 备注：${notes}` : ""}
- 名字符合${genre}世界观，朗朗上口，有记忆点
- 可以是单名（一字）或双名（两字）

请用以下 JSON 格式输出，不要有任何额外文字：
[{ "name": "名字", "meaning": "字义/寓意（1句话）" }]`;
}

function buildPlacePrompt(genre: string, placeType: string, style: string, notes: string, count: number) {
  const typeLabel = PLACE_TYPES.find((t) => t.id === placeType)?.label ?? placeType;
  const styleLabel = PLACE_STYLES.find((s) => s.id === style)?.label ?? style;
  return `你是一位精通中文网文世界观构建的大师，专门为${genre}类小说设计地名。

请为${genre}类小说创造 ${count} 个「${typeLabel}」类型的地名，要求：
- 风格：${styleLabel}
- 类型：${genre}${notes ? `\n- 备注：${notes}` : ""}
- 地名符合${genre}世界观，有辨识度，听起来有画面感
- 2-5个字为宜

请用以下 JSON 格式输出，不要有任何额外文字：
[{ "name": "地名", "meaning": "简介/寓意（1句话）" }]`;
}

// ── Sub-form: 人名 ─────────────────────────────────────────────────────────

function CharNameForm({ genre, onGenerate }: {
  genre: string;
  onGenerate: (prompt: string) => void;
}) {
  const [gender, setGender] = useState("neutral");
  const [style, setStyle] = useState("heroic");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">性别</label>
        <div className="flex gap-2">
          {CHAR_GENDERS.map((g) => (
            <button key={g.id} onClick={() => setGender(g.id)}
              className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${gender === g.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">风格</label>
        <div className="flex flex-wrap gap-2">
          {CHAR_STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${style === s.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">备注（可选）</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="例：主角，剑修，来自北方大族"
          className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-300" />
      </div>
      <CountAndButton count={count} setCount={setCount}
        onGenerate={() => onGenerate(buildCharPrompt(genre, gender, style, notes, count))} />
    </div>
  );
}

// ── Sub-form: 地名 ─────────────────────────────────────────────────────────

function PlaceNameForm({ genre, onGenerate }: {
  genre: string;
  onGenerate: (prompt: string) => void;
}) {
  const [placeType, setPlaceType] = useState("city");
  const [style, setStyle] = useState("grand");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">地点类型</label>
        <div className="flex flex-wrap gap-2">
          {PLACE_TYPES.map((t) => (
            <button key={t.id} onClick={() => setPlaceType(t.id)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${placeType === t.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">风格</label>
        <div className="flex flex-wrap gap-2">
          {PLACE_STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${style === s.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">备注（可选）</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="例：主角门派所在，北方大陆，名字要带「剑」"
          className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-300" />
      </div>
      <CountAndButton count={count} setCount={setCount}
        onGenerate={() => onGenerate(buildPlacePrompt(genre, placeType, style, notes, count))} />
    </div>
  );
}

// ── Shared count + button ─────────────────────────────────────────────────

function CountAndButton({ count, setCount, onGenerate }: {
  count: number; setCount: (n: number) => void; onGenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">数量</span>
      {[5, 10, 15, 20].map((n) => (
        <button key={n} onClick={() => setCount(n)}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${count === n ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}>
          {n}
        </button>
      ))}
      <button onClick={onGenerate}
        className="ml-auto px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
        ✦ 生成
      </button>
    </div>
  );
}

// ── Results grid ──────────────────────────────────────────────────────────

function ResultsGrid({ results, loading, error, onRegenerate }: {
  results: NameResult[];
  loading: boolean;
  error: string;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyName(name: string) {
    await navigator.clipboard.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400 dark:text-gray-500 gap-2">
        <span className="animate-spin inline-block text-indigo-500">⟳</span> 生成中…
      </div>
    );
  }
  if (error) {
    return <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>;
  }
  if (results.length === 0) return null;

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">生成结果 · 点击复制</p>
        <button onClick={onRegenerate} className="text-xs text-indigo-500 hover:text-indigo-700">重新生成</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {results.map((r, i) => (
          <button key={i} onClick={() => copyName(r.name)}
            className={`text-left border rounded-xl px-4 py-3 transition-colors group ${copied === r.name ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"}`}>
            <p className={`text-base font-semibold ${copied === r.name ? "text-green-700 dark:text-green-400" : "text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300"}`}>
              {copied === r.name ? "✓ 已复制" : r.name}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed line-clamp-2">{r.meaning}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main NamingTool ────────────────────────────────────────────────────────

export function NamingTool({ projectGenre }: Props) {
  const { getActiveModel, getKeyForModel } = useSettingsStore();

  const [genre, setGenre] = useState(GENRES.includes(projectGenre) ? projectGenre : GENRES[0]);
  const [mode, setMode] = useState<"char" | "place">("char");
  const [results, setResults] = useState<NameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");

  async function runGenerate(prompt: string) {
    const model = getActiveModel();
    if (!model) { setError("请先在设置中配置 AI 模型"); return; }
    const key = model.provider === "ollama" ? "ollama" : getKeyForModel(model);
    if (!key) { setError("请先配置 API 密钥"); return; }

    setLastPrompt(prompt);
    setLoading(true);
    setError("");
    setResults([]);

    try {
      let full = "";
      await aiStream({
        model, apiKey: key,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 1000,
        temperature: 0.9,
        onChunk: (d) => { full += d; },
      });
      let json = full.trim();
      const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) json = fence[1].trim();
      setResults(JSON.parse(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Genre */}
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">小说类型</label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button key={g} onClick={() => setGenre(g)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${genre === g ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([["char", "人名"], ["place", "地名"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setMode(id); setResults([]); setError(""); }}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${mode === id ? "border-indigo-500 text-indigo-600 dark:text-indigo-300 font-medium" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      {mode === "char"
        ? <CharNameForm genre={genre} onGenerate={runGenerate} />
        : <PlaceNameForm genre={genre} onGenerate={runGenerate} />
      }

      {/* Results */}
      <ResultsGrid
        results={results}
        loading={loading}
        error={error}
        onRegenerate={() => lastPrompt && runGenerate(lastPrompt)}
      />
    </div>
  );
}
