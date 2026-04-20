# 用户反馈功能计划 v2 (2026-04-19)

本文档汇总测试用户反馈的所有功能请求，每项含执行计划和可行性评估。

---

## F1. 故事梗概文档 + 大纲引用简介

**需求描述**
- 创建书籍时填写简介后，在"项目文档"里自动生成一个"故事梗概"文档
- 生成大纲时，prompt 中明确引用故事梗概内容（而非空的占位符）

**现状**
- `Book.synopsis` 字段已有
- `OutlinePanel` 已接受 `projectSynopsis` prop，但生成 prompt 中只有 `${projectSynopsis || "（暂无简介）"}`
- `project_docs` 表已有，`DocType` 包含 `plot_threads`/`writing_rules` 等，但没有 `synopsis` 类型

**执行计划**
1. `src/types/index.ts` — `ProjectDoc.doc_type` 枚举加入 `"story_synopsis"`
2. `src/store/projectDocsStore.ts` — 新增 `ensureSynopsisDoc(bookId, synopsis)` 方法：若不存在则创建，若已存在则更新内容
3. `src/components/project/NewProjectModal.tsx` — `createProject` 成功后调用 `ensureSynopsisDoc`，若 synopsis 非空
4. `src/components/docs/ProjectDocsPanel.tsx` — 在文档类型图标/标签里加 `story_synopsis` 的显示（📖 故事梗概）
5. `OutlinePanel.tsx` — 生成 prompt 中"简介"字段改为从 `projectSynopsis` + docs 里的 `story_synopsis` 文档合并，确保有实质内容
6. 对已有书籍（migration）：打开大纲页时若 synopsis 非空但没有 story_synopsis doc，静默补建一个

**难度**：低-中 | **预估工时**：1–2h

---

## F2. 生成大纲预览 — 显示结构化预览，导入前可审阅

**需求描述**
- 目前预览区只显示"大纲已生成，点击导入大纲"，用户看不到内容
- 用户希望能先看到大纲树结构，满意了再导入，不满意可重新生成

**现状**
- `OutlinePanel.tsx:464–496` 有 `showAiPreview` 区块，但只显示文字提示，不展示解析后的树

**执行计划**
1. 解析 `aiOutput` JSON（同 `importAiOutline` 的逻辑）得到 `previewTree: RawNode[]`，保存到 state
2. 预览区改为渲染 `previewTree`：可折叠的简版树（只读），层级缩进 + 标题 + 简介
3. 生成中显示流式原始 JSON（滚动 textarea），生成完毕切换为树形预览
4. 底部按钮：「导入大纲」「重新生成」「关闭」
5. 若 JSON 解析失败，展示原始文本 + 错误提示

**难度**：低 | **预估工时**：1h

---

## F3. 大纲助手 (Outline Assistant Panel)

**需求描述**
在生成大纲之前，显示一个"大纲助手"面板，检查当前书籍已有的写作素材：
- 绿色 ✅：已有且内容充足
- 黄色 ⚠️：已有但内容较少（<50字）
- 红色 ❌：完全没有

预设检查类别（非必须，仅建议）：
1. 故事梗概
2. 人物关系图
3. 世界观设定
4. 文笔风格指南
5. 百科（关键势力/人物设定）
6. 情节线索追踪
7. 写作日志

每个缺失/黄色项，用户可点击"需要更多帮助"→展开说明如何添加 + AI 建议内容（可复制粘贴）

**执行计划**
1. 新建 `src/components/outline/OutlineAssistant.tsx`
   - 接受 `projectId, synopsis, genre` props
   - 从 `projectDocsStore` 读取所有 docs，对每个预设类别做检查
   - 渲染类别卡片网格（图标 + 名称 + 状态徽章）
2. 每个类别映射到 `DocType`（或复合检查多个 DocType）
3. 点击"需要更多帮助"展开一个 inline 区域：
   - 说明该文档是什么、在哪里添加（链接到文档 tab 对应条目）
   - 「AI 生成建议内容」按钮 → 调用 AI 生成该类别的模板内容（基于书名/类型/梗概）
   - 结果可复制
4. `OutlinePanel.tsx` 顶部加「大纲助手」toggle 按钮，展开 `OutlineAssistant`（collapsible）
5. 整个面板底部注明："以上均为建议，不是必须，丰富的素材有助于 AI 生成更准确的大纲"

**难度**：中 | **预估工时**：3–4h

---

## F4. 写作规则 — 默认只加载当前 genre 预设 + 一键清空

**需求描述**
1. 新建书籍时，只自动加载当前 genre 对应的写作规则预设（目前逻辑已是如此，但 `WritingRulesPanel` 的下拉"加载预设"是所有 genre，要改为：先检查当前书的 genre，默认高亮/选中该 genre 的预设）
2. 加一个「一键清空」按钮，清空 textarea

**现状**
- `NewProjectModal.tsx:41` 已有 `getPresetForGenre(genre)` 自动注入
- `WritingRulesPanel.tsx` 的预设下拉是手动选的，没有默认选中当前 genre

**执行计划**
1. `WritingRulesPanel` 接受 `projectGenre?: string` prop（从 `EditorLayout`/`TabContent` 传入）
2. 渲染时如果 `draft` 为空，自动把当前 genre 的预设作为 placeholder 提示（不自动填入，由用户点击"加载此 genre 预设"一键填入）
3. 预设下拉：当前 genre 的选项排在最上面，并标注"（当前书籍类型）"
4. 在「重置」按钮旁边加「清空」按钮 → `setDraft("")`（有确认 dialog 防误操作）

**难度**：低 | **预估工时**：30min

---

## F5. Windows 上 AI 对话输入框被任务栏遮挡

**需求描述**
在 Windows 上，AI 对话输入框被底部任务栏挡住

**现状**
- `AiPanel.tsx` 底部 input 区域用 `absolute bottom-0` 或 flex 布局
- Tauri 窗口在 Windows 上可能未加 `padding-bottom` 适配任务栏

**执行计划**
1. 检查 `AiPanel.tsx` 的输入框容器，确保使用 `pb-safe` 或固定 `pb-4`
2. 在 `src-tauri/tauri.conf.json` 检查窗口配置，确认没有 `decorations: false` 导致的布局问题
3. 对 AI panel 的底部 sticky input 区域加 `env(safe-area-inset-bottom)` 兼容（CSS）
4. 考虑在 Windows 下加 `padding-bottom: max(12px, env(safe-area-inset-bottom))`
5. 测试：在 Windows VM 或截图确认

**难度**：低 | **预估工时**：30min

---

## F6. 章节编辑器 AI 面板 — 根据大纲生成正文

**需求描述**
在正文编辑界面的 AI 对话面板，加一个"根据大纲生成本章"选项：
- 读取整个大纲
- 读取前一章内容（有的话）
- 读取后一章大纲节点（有的话）
- 生成本章正文

**现状**
- `AiPanel.tsx` 已有 9 种 AI 模式（续写/润色/扩写等）
- `OutlineStore` 有 `nodes`，可按 `linked_chapter_id` 查找当前章节关联的章纲

**执行计划**
1. `AiPanel.tsx` 增加一个 mode：`"generate_from_outline"`（根据大纲生成）
2. 该 mode 触发时：
   - 从 `outlineStore` 找到 `linked_chapter_id === currentChapterId` 的章纲节点，取其 title + content
   - 从 `editorStore.chapters` 找前一章，读取其正文摘要（或前500字）
   - 找后一章的章纲节点（通过大纲树 sort_order）
   - 组装 prompt：书名/类型/写作规则 + 大纲上下文 + 前章摘要 + 本章章纲 + 后章预告
3. 生成结果显示在 AI panel 右侧，用户可"替换全文"或"追加到末尾"或"仅参考"
4. 在 AI 模式选择 UI 里加这个选项，带 📋 图标，标注"（读取大纲+上下文）"

**难度**：中 | **预估工时**：2–3h

---

## F7. 工具箱 — 抄书功能

**需求描述**
用户选择本地 TXT 文件作为参考作品：
1. 若超10万字，自动按章节分成若干"卷"（每卷约5–10万字）
2. 每卷可独立点击"分析" → AI 拆书（提取大纲/人物/世界观等）
3. 分析完成后，用户可选择"抄写/借鉴" → AI 根据用户自己的简介/大纲生成类似风格的大纲（需要用户至少有故事梗概，否则提示补充）
4. 拆书分析结果存入"参考作品笔记"（按书名分类，在 project_docs 里以 reference_notes 类型存储）

**执行计划**
1. 新建 `src/components/toolbox/BookCopyTool.tsx`
2. 读取 TXT 文件（Tauri `fs` API），检测字符数
3. 若 >10万字，按章节标题（正则匹配"第X章"）自动分卷，每卷 ~5-10 章或按字数分段
4. 渲染分卷列表，每卷显示：章节范围 + 字数 + 「分析」按钮 + 状态（未分析/分析中/已完成）
5. 「分析」→ 调用 AI（拆书 prompt，类似 DeconstructPanel），返回结构化分析（人物/世界观/节奏/大纲）
6. 分析结果渲染在下方折叠区，可复制
7. 「借鉴生成大纲」按钮：
   - 检查当前项目是否有 story_synopsis（没有则弹提示）
   - 组装 prompt：参考作品的分析结果 + 用户自己的简介/类型 → 生成借鉴风格的大纲
   - 结果可"导入大纲"（走现有 OutlinePanel 的 importAiOutline 流程）
8. 分析结果保存到 `project_docs`：type=`reference_notes`，title=`参考作品：{书名}`
9. `ToolboxPanel` 工具列表加入"抄书"工具

**难度**：高 | **预估工时**：5–6h

---

## F8. 项目文件导出/导入（完整备份恢复）

**需求描述**
导出"项目文件"格式（`.biling-project`），在新版本软件里导入后能恢复所有状态：
- 章节内容、大纲、人物典藏、灵感、预示、项目文档
- 版本升级后不会丢失

**现状**
- `ImportExportPanel` 已有"导出 TXT"但没有完整项目导出
- `exportProject` 函数在 `importExport.ts` 里做了基础导出

**执行计划**
1. 新建 `src/lib/projectBackup.ts`：
   - `exportProjectBackup(bookId)` → 读取所有相关表（books, volumes, chapters, outline_nodes, codex_entities, foreshadowing, inspirations, project_docs, ai_conversations）→ 序列化为 JSON
   - 加入 `schema_version` 和 `export_time` 字段
   - 用 fflate 压缩为 `.biling-project` ZIP 文件（内含 `backup.json`）
2. `importProjectBackup(file)` → 解压 → 检查 schema_version → 执行数据迁移（若版本较旧）→ 写入数据库
3. 数据迁移策略：向前兼容，旧字段用 null 填充，新字段忽略
4. `ImportExportPanel` 的"导出"区域加「导出项目文件」按钮，说明用途
5. 「导入项目文件」入口（可在项目列表页新建项目旁边，或 IO 面板顶部）
6. 导入前显示预览：书名/章节数/大纲节点数/导出时间，确认后执行

**难度**：中-高 | **预估工时**：4–5h

---

## F9. AI 设置页显示 DeepSeek 余额

**需求描述**
在 AI 设置里显示当前 DeepSeek 账户余额

**可行性评估**
DeepSeek 官方 API 有余额查询接口：`GET https://api.deepseek.com/user/balance`，需要 Bearer token。

**执行计划**
1. `src/lib/ai.ts` 或新建 `src/lib/deepseekBalance.ts`：`fetchDeepSeekBalance(apiKey)` → fetch API → 返回 `{available: string, currency: string}`
2. `SettingsModal.tsx` DeepSeek 配置区：key 填写后，显示「查询余额」按钮 + 余额展示（上次查询时间 + 金额）
3. 打开设置时若有 key 且 lastChecked >1h，自动刷新
4. 处理错误：无效 key / 网络失败 → 显示 "—" 不崩溃

**难度**：低 | **预估工时**：1h

---

## 总结与计划安排

| # | 功能 | 难度 | 预估工时 | 优先级 |
|---|------|------|----------|--------|
| F1 | 故事梗概文档 | 低-中 | 1–2h | P0 |
| F2 | 大纲预览改进 | 低 | 1h | P0 |
| F3 | 大纲助手 | 中 | 3–4h | P1 |
| F4 | 写作规则改进 | 低 | 0.5h | P0 |
| F5 | Windows输入框遮挡 | 低 | 0.5h | P0 |
| F6 | 根据大纲生成正文 | 中 | 2–3h | P1 |
| F7 | 抄书功能 | 高 | 5–6h | P2 |
| F8 | 项目文件备份恢复 | 中-高 | 4–5h | P1 |
| F9 | DeepSeek余额显示 | 低 | 1h | P2 |

**建议执行顺序**
- Session A（2–3h）：F1 + F2 + F4 + F5（小改动，高回报）
- Session B（3–4h）：F3 大纲助手 + F6 根据大纲生成正文
- Session C（4–5h）：F8 项目文件备份
- Session D（5–6h）：F7 抄书功能
- Session E（1h）：F9 DeepSeek 余额
