# 笔灵隐私政策

**版本：1.0**  
**生效日期：2026 年**

---

## 核心原则

笔灵采用**本地优先**架构。您的创作数据永远在您自己的设备上，我们没有服务器能看到您写了什么。

---

## 我们收集什么

### 不收集的内容
- 您的作品内容（章节正文、大纲、角色设定等）
- 您输入给 AI 的任何内容
- AI 的回复内容
- 您的 API Key

以上所有内容**仅存储于您的本机数据库**（`~/Library/Application Support/com.shrimp.biling/biling.db`），笔灵团队无法访问。

### 可能收集的内容
- **匿名崩溃报告**：软件崩溃时，系统可能发送不含个人信息的崩溃堆栈，用于修复 bug
- **匿名使用统计**（如未来启用）：功能使用频率等聚合数据，不含任何个人身份信息

---

## AI 数据流向

您在笔灵中发起的 AI 请求：

```
您的设备 → 您配置的 AI 服务商（DeepSeek / OpenAI / Ollama 等）
```

笔灵服务器**不在**这个链路中。您的对话内容受您所选 AI 服务商的隐私政策约束，请自行查阅。

---

## 数据存储位置

| 数据类型 | 存储位置 |
|----------|----------|
| 作品、章节、大纲 | 本机 SQLite 数据库 |
| 设置、API Key | 本机 SQLite 数据库 |
| 快照、历史记录 | 本机 SQLite 数据库 |
| 写作资源包 | 本机 SQLite 数据库 |

**数据库位置**：
- macOS：`~/Library/Application Support/com.shrimp.biling/biling.db`
- Windows：`C:\Users\<用户名>\AppData\Roaming\com.shrimp.biling\biling.db`

您可以随时备份或删除此文件。

---

## 联系我们

如有隐私相关问题，请联系：yuchenwangeffie@gmail.com
