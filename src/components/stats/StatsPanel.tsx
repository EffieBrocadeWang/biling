import { useEffect, useState } from "react";
import { getDb } from "../../lib/db";
import { useEditorStore } from "../../store/editorStore";
import { useSettingsStore } from "../../store/settingsStore";

interface DailyStat {
  date: string;
  words_written: number;
}

interface StatsData {
  totalWords: number;
  totalChapters: number;
  publishedChapters: number;
  avgWordsPerChapter: number;
  todayWords: number;
  last30Days: DailyStat[];
  streak: number;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function calcStreak(days: DailyStat[], goal: number): number {
  const set = new Set(days.filter((d) => d.words_written >= goal).map((d) => d.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (set.has(toDateStr(d))) streak++;
    else if (i > 0) break; // allow today to be incomplete
  }
  return streak;
}

// Simple bar chart using divs
function MiniBarChart({ days, goal }: { days: DailyStat[]; goal: number }) {
  if (days.length === 0) return <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">暂无数据</div>;
  const max = Math.max(...days.map((d) => d.words_written), goal, 1);
  const last14 = days.slice(-14);

  return (
    <div className="flex items-end gap-1 h-20">
      {last14.map((d) => {
        const height = Math.round((d.words_written / max) * 100);
        const hitGoal = d.words_written >= goal;
        const label = d.date.slice(5); // MM-DD
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${label}: ${d.words_written} 字`}>
            <div className="w-full flex flex-col justify-end" style={{ height: "60px" }}>
              <div
                className={`w-full rounded-sm transition-all ${hitGoal ? "bg-indigo-500" : "bg-indigo-200"}`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
            <span className="text-gray-300 dark:text-gray-600 rotate-90 origin-center" style={{ fontSize: "8px" }}>{label.slice(3)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsPanel({ projectId }: { projectId: number }) {
  const { chapters, volumes } = useEditorStore();
  const { dailyGoal, setDailyGoal, loaded, load } = useSettingsStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal));
  const [editingGoal, setEditingGoal] = useState(false);

  useEffect(() => {
    if (!loaded) load();
  }, []);

  useEffect(() => {
    setGoalDraft(String(dailyGoal));
  }, [dailyGoal]);

  useEffect(() => {
    loadStats();
  }, [projectId, chapters]);

  async function loadStats() {
    const db = await getDb();
    const today = toDateStr(new Date());
    const thirtyDaysAgo = toDateStr(new Date(Date.now() - 30 * 86400000));

    const dailyRows = await db.select<DailyStat[]>(
      "SELECT date, words_written FROM daily_stats WHERE project_id = ? AND date >= ? ORDER BY date",
      [projectId, thirtyDaysAgo]
    );

    const totalWords = chapters.reduce((s, c) => s + c.word_count, 0);
    const published = chapters.filter((c) => c.status === "published").length;
    const todayStat = dailyRows.find((d) => d.date === today);

    setStats({
      totalWords,
      totalChapters: chapters.length,
      publishedChapters: published,
      avgWordsPerChapter: chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0,
      todayWords: todayStat?.words_written ?? 0,
      last30Days: dailyRows,
      streak: calcStreak(dailyRows, dailyGoal),
    });
  }

  async function saveGoal() {
    const n = parseInt(goalDraft);
    if (n > 0) await setDailyGoal(n);
    setEditingGoal(false);
  }

  if (!stats) return <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">加载中...</div>;

  const goalPct = Math.min(100, Math.round((stats.todayWords / dailyGoal) * 100));
  const hitGoalToday = stats.todayWords >= dailyGoal;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">写作统计</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</span>
      </div>

      {/* Today card */}
      <div className={`rounded-xl p-5 ${hitGoalToday ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`text-xs font-medium ${hitGoalToday ? "text-indigo-200" : "text-gray-500 dark:text-gray-400 dark:text-gray-500"}`}>今日已写</p>
            <p className={`text-3xl font-bold ${hitGoalToday ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>
              {stats.todayWords.toLocaleString()}
              <span className={`text-base font-normal ml-1 ${hitGoalToday ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"}`}>字</span>
            </p>
          </div>
          <div className="text-right">
            {editingGoal ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={saveGoal}
                  onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                  className="w-20 text-sm text-right border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded px-2 py-1 text-gray-800 dark:text-gray-100 outline-none"
                />
                <span className={`text-xs ${hitGoalToday ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"}`}>字/天</span>
              </div>
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className={`text-right ${hitGoalToday ? "text-indigo-200 hover:text-white" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:text-gray-600"}`}
              >
                <p className="text-xs">目标</p>
                <p className="text-lg font-semibold">{dailyGoal.toLocaleString()}</p>
              </button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className={`h-1.5 rounded-full ${hitGoalToday ? "bg-indigo-400" : "bg-gray-100 dark:bg-gray-700"}`}>
          <div
            className={`h-full rounded-full transition-all ${hitGoalToday ? "bg-white dark:bg-gray-900" : "bg-indigo-500"}`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <p className={`text-xs mt-1.5 ${hitGoalToday ? "text-indigo-200" : "text-gray-400 dark:text-gray-500"}`}>
          {hitGoalToday ? `已完成目标！超出 ${(stats.todayWords - dailyGoal).toLocaleString()} 字` : `还差 ${(dailyGoal - stats.todayWords).toLocaleString()} 字完成今日目标`}
        </p>
      </div>

      {/* Streak + totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">连续写作</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.streak}<span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">天</span></p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">达成每日目标</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">总字数</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(stats.totalWords / 10000).toFixed(1)}<span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">万字</span></p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stats.totalChapters} 章 · {volumes.length} 卷</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">章均字数</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.avgWordsPerChapter.toLocaleString()}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">字/章</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">发布进度</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.publishedChapters}<span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">/ {stats.totalChapters}</span></p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">章已发布</p>
        </div>
      </div>

      {/* 30-day chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-3">最近 14 天 · 每日字数</p>
        <MiniBarChart days={stats.last30Days} goal={dailyGoal} />
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-indigo-500" />
            <span className="text-xs text-gray-400 dark:text-gray-500">达标</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-indigo-200" />
            <span className="text-xs text-gray-400 dark:text-gray-500">未达标</span>
          </div>
        </div>
      </div>
    </div>
  );
}
