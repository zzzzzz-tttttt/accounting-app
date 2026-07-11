# 记账 App（手机网页版 PWA）— 技术详解

## 技术栈
- React 19 + Vite 8 + Tailwind CSS 3
- 图表：ECharts 6 + echarts-for-react
- 图标：Lucide React
- 数据存储：Supabase（PostgreSQL，云端）+ localStorage 降级
- AI：Dify 工作流 ×3，通过 Supabase Edge Function 代理
- 认证：Supabase Auth（邮箱+密码）
- 部署：GitHub Pages（GitHub Actions）+ Supabase Edge Functions

---

## 一、AI 架构

### 1.1 双路径设计
```
前端 api.js
  │
  ├── 优先路径 ──→ Supabase Edge Function (clever-endpoint)
  │                   │
  │                   └──→ Dify API (api.dify.ai/v1)
  │                           ├── /workflows/run     (记账、统计)
  │                           ├── /chat-messages     (纠错对话)
  │                           └── /files/upload      (图片上传)
  │
  └── 降级路径 ──→ 本地 Express (localhost:3001)
                      │
                      └──→ Dify API（同上）
```

**为什么双路径？**
- Edge Function 跑在 Supabase 云端，公网可访问，你朋友能用
- Supabase 免费版 7 天无请求会暂停项目
- 暂停时降级到本地 Express，`npm run dev` 启动就能用
- Express 保留也有简历价值

### 1.2 降级判断逻辑（api.js）
```javascript
// 每个 API 方法都是这个模式：
export async function ocrImage(file) {
  // 1️⃣ try { Edge Function } → 成功直接返回
  try {
    const base64 = await fileToBase64(file)
    const { data } = await supabase.functions.invoke('clever-endpoint', {
      body: { action: 'ocr', image: base64, filename: file.name }
    })
    if (data?.data?.outputs) { /* 解析并返回 */ }
  } catch (e) {
    console.log('Edge Function 不可用，降级 Express:', e.message)
  }
  // 2️⃣ catch { Express }
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch('http://localhost:3001/api/ocr', {
    method: 'POST', body: fd, signal: AbortSignal.timeout(60000)
  })
  return res.json()
}
```

### 1.3 Edge Function 详解

**部署信息：**
- 名称：`clever-endpoint`（Supabase 自动生成）
- 本地源码：`supabase/functions/dify-proxy/index.ts`
- 格式：新版 `export default { fetch }`（非旧版 `serve()`）
- 认证：`verify_jwt: false`（代理不需要 Supabase 登录态）

**四个 action：**

| action | 用途 | Dify API | 使用 Key |
|--------|------|---------|---------|
| `ocr` | 图片识别 | POST /files/upload → POST /workflows/run | accounting |
| `parse` | 文字解析 | POST /workflows/run | accounting |
| `chat` | 纠错对话 | POST /chat-messages | correction → accounting |
| `stats` | 统计分析 | POST /workflows/run | stats → accounting |

**OCR 两步流程（Edge Function 内部）：**
```
1. 接收 base64 图片 → 解码为二进制 → 上传到 Dify /files/upload → 获取 file_id
2. 调用 /workflows/run，传 image_file: { upload_file_id, type: "image" }
3. 返回工作流结果（JSON）
```

**三个 Key 的层级关系：**
```
accounting  ← 基础 Key（必须配置）
    ↑
correction  ← 可选，没有时降级用 accounting
    ↑
stats       ← 可选，没有时降级用 accounting
```

### 1.4 Dify 输出格式与前端解析

**Dify 工作流返回：**
```json
{
  "data": {
    "outputs": {
      "records": "{\"transactions\": [{\"date\":\"2026-07-11\",\"amount\":58,\"type\":\"expense\",\"tag\":\"餐饮\",\"note\":\"午餐\"}]}"
    }
  }
}
```

**前端解析（api.js parseDifyOutput）：**
```javascript
function parseDifyOutput(data) {
  const recordsStr = data?.data?.outputs?.records  // 取嵌套字段
  if (!recordsStr) return []
  const parsed = JSON.parse(recordsStr)            // JSON 字符串 → 对象
  return (parsed.transactions || []).map(t => ({
    date: t.date || '',
    amount: +t.amount || 0,
    type: t.type === 'income' ? 'income' : 'expense',
    tag: t.tag || '其他',
    note: (t.note || '').slice(0, 20),
  }))
}
```

**分类补充（api.js enrichTransactions）：**
```javascript
function enrichTransactions(transactions) {
  return transactions.map(t => {
    const cat = getSuperCategory(t.tag)  // 查分类表：tag → { name: "吃喝", emoji: "🍽" }
    return { ...t, superCat: cat.name, superEmoji: cat.emoji }
  })
}
```

### 1.5 聊天/记账判断逻辑
```javascript
// 判断用户输入是「对话」还是「记账」
const isChat = !/\d/.test(text)                          // 无数字 → 聊天
  || /修改|改成|改为|换成|更新|调整|删除|去掉|移除|清除|删掉/.test(text)  // 修改命令 → 聊天

// 有数字且不是修改命令 → 走记账工作流
// 无数字或是修改命令 → 走纠错对话
```

---

## 二、数据存储架构

### 2.1 双写策略
```
saveTransaction(tx)
  │
  ├── getUserId() → userId
  │
  ├── userId 存在 → record = { ...tx, user_id: userId }
  │     └── supabase.from('transactions').upsert(record)
  │           ├── 成功 → 完成
  │           └── 失败 → fallbackSave(record)  ← 存带 user_id 的版本
  │
  └── userId 不存在 → fallbackSave(tx)  ← 存原始版本（恢复时补 user_id）
```

### 2.2 读取与自动恢复
```
loadTransactions()
  │
  ├── getUserId() → userId
  │
  ├── supabase.from('transactions')
  │     .select('*')
  │     .eq('user_id', userId)     ← 代码层过滤
  │     .order('date', desc)
  │
  ├── 检查 localStorage 积压数据
  │     └── 有积压 → 上传到 Supabase（补 user_id）→ 清空积压
  │
  ├── 首次加载（云端为空）
  │     └── 尝试从旧 IndexedDB 迁移 → 上传到 Supabase
  │
  └── 合并云端数据 + 积压数据（去重）→ 返回
```

### 2.3 三层存储
| 层 | 存储位置 | 触发条件 | 数据范围 |
|------|---------|---------|---------|
| **云端** | Supabase PostgreSQL | 正常在线 | 按 user_id 隔离 |
| **降级** | localStorage `transactions_fallback` | Supabase 写入失败 | 单设备，带 user_id |
| **备份** | 用户手动导出的 JSON 文件 | 手动触发 | 全量导出 |

### 2.4 安全隔离（双重保障）

**代码层（api.js / storage.js）：**
```javascript
// 增：保存时带 user_id
const record = { ...tx, user_id: userId }

// 查：读取时过滤 user_id
supabase.from('transactions').select('*').eq('user_id', userId)

// 删：双重校验
supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
```

**数据库层（Supabase RLS）：**
```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的数据" ON transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2.5 数据库表结构
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,           -- tx_时间戳_随机串
  user_id UUID NOT NULL,          -- 外键 → auth.users(id)
  type TEXT NOT NULL,             -- 'income' | 'expense'
  amount FLOAT8 NOT NULL,
  date TEXT NOT NULL,             -- '2026-07-11'
  tag TEXT NOT NULL,              -- '餐饮' | '交通' | ...
  "superCat" TEXT,                -- '吃喝' | '出行交通' | ...
  "superEmoji" TEXT,              -- '🍚' | '🚇' | ...
  note TEXT,                      -- 备注，最长 20 字
  "createdAt" TEXT                -- ISO 时间戳
);

CREATE INDEX idx_transactions_user_date
  ON transactions (user_id, date DESC);
```

---

## 三、前端组件架构

### 3.1 页面路由（App.jsx 状态机）
```
App.jsx
  ├── 未登录 → LoginPage
  ├── 加载中 → 加载动画
  └── 已登录 → tab 状态切换
        ├── 'home' → HomePage
        ├── 'add' → AddPage
        ├── 'bill' → BillPage
        └── 'stats' → StatsPage
```

### 3.2 数据流
```
App.jsx
  ├── useTransactions() hook
  │     ├── transactions[] ← loadTransactions()
  │     ├── add(tx)        → saveTransaction() + setState
  │     ├── update(id, u)  → saveTransaction() + setState
  │     └── remove(id)     → deleteTransaction() + setState
  │
  └── props 向下传递
        ├── HomePage ← transactions, onEdit, onDelete
        ├── AddPage  ← onSave, onBatchImport, transactions, onUpdate, onDelete
        ├── BillPage ← transactions, onEdit, onDelete
        └── StatsPage ← transactions
```

### 3.3 AddPage 结构（730行，待拆分）
```
AddPage
  ├── mode = 'manual'
  │     ├── 类型选择（支出/收入）
  │     ├── 金额输入
  │     ├── 分类选择 → CategoryPicker 弹窗
  │     ├── 备注输入
  │     ├── 日期选择
  │     └── 保存按钮
  │
  ├── mode = 'ai'
  │     ├── 聊天消息列表
  │     │     ├── user → 用户消息气泡
  │     │     └── assistant → 4 种卡片
  │     │           ├── action='create'   → 交易列表 + 导入按钮
  │     │           ├── action='modify'   → 修改对比 + 确认按钮
  │     │           ├── action='delete'   → 删除列表 + 确认按钮
  │     │           ├── action='chat'     → 纯文字回复
  │     │           └── action='none'     → 理解失败提示
  │     └── 输入栏
  │           ├── 📷 图片上传按钮 → sendAiImage()
  │           ├── 🎤 语音按钮 → Web Speech API
  │           ├── 文字输入框
  │           └── 发送按钮 → sendAiMessage()
  │
  └── 弹窗
        ├── 批量导入（文本/CSV/文件）
        └── AI 对话历史（7天保留，50条上限）
```

### 3.4 AI 对话消息类型
| action | 触发条件 | 用户看到 | 用户操作 |
|--------|---------|---------|---------|
| `create` | AI 解析出交易 | 交易列表（emoji+分类+金额） | 点「导入」→ add() |
| `modify` | AI 找到匹配的修改 | 原始 vs 修改对比 | 点「确认修改」→ update() |
| `delete` | AI 找到要删除的 | 匹配的交易列表 | 点「确认删除」→ remove() |
| `chat` | 聊天/无匹配操作 | AI 回复文本 | 无，纯展示 |
| `none` | AI 没理解 | 提示语 + 示例 | 无，重新输入 |

### 3.5 App.jsx 全局功能
- **登录守卫**：未登录 → LoginPage，已登录 → 主界面
- **右上角 ··· 菜单**：API 设置 / 导出备份 / 恢复备份 / 退出登录
- **Toast 提示**：导入成功、备份下载等，2.5秒自动消失
- **编辑模式**：从 HomePage/BillPage 点编辑 → 切到 AddPage 手动模式，预填数据

---

## 四、Express 服务器详情

### 4.1 三个路由
| 路由 | 方法 | 功能 | 调用 Dify |
|------|------|------|----------|
| `/api/ocr` | POST | 接收图片 → 返回交易列表 | 上传 + workflow |
| `/api/parse-text` | POST | 接收文字 → 返回交易/对话/修改/删除 | workflow 或 chat |
| `/api/stats-analysis` | POST | 接收交易数据 → 返回分析文本 | workflow |

### 4.2 /api/parse-text 路由逻辑
```
收到文字
  │
  ├── 含数字 且 非修改命令 → 记账工作流 → 返回 transactions
  │
  └── 无数字 或 修改命令 → 纠错对话
        └── 打包：现有账单(前50条) + 对话历史(前6轮) + 用户输入
        └── 调 Dify chat-messages
        └── 返回 { action: 'chat', reply, conversation_id }
```

### 4.3 配置
```env
# .env 文件（不提交 Git）
DIFY_API_URL=https://api.dify.ai/v1
DIFY_ACCOUNTING_KEY=app-xxx
DIFY_CORRECTION_KEY=app-xxx
DIFY_STATS_KEY=app-xxx
PORT=3001
```

---

## 五、部署架构

### 5.1 前端部署
```
GitHub Push → GitHub Actions (.github/workflows/deploy.yml)
  ├── checkout + npm install + npm run build
  └── peaceiris/actions-gh-pages → 推到 gh-pages 分支
        └── GitHub Pages 自动上线
```

### 5.2 Edge Function 部署
```
手动部署（Supabase CLI 不支持 Windows）：
  Supabase Dashboard → Edge Functions → New Function
    → 粘贴 supabase/functions/dify-proxy/index.ts
    → 设置 3 个 Secrets
    → Deploy
```

### 5.3 数据库部署
```
supabase-setup.sql → Supabase SQL Editor → Run
  → 建表 + 索引 + RLS 策略 + app_config 表
```

---

## 六、用户认证

### 6.1 认证流程
```
App 加载 → supabase.auth.getSession() → 有 session → 进主界面
                                         └── 无 session → LoginPage
                                              ├── 注册: signUp(email, password)
                                              ├── 登录: signInWithPassword(email, password)
                                              └── 忘记密码: resetPasswordForEmail → 邮件 → 重设
```

### 6.2 LoginPage 五个状态
| 状态 | 触发 | 界面 |
|------|------|------|
| 登录 | 默认 | 邮箱 + 密码 → 登录/注册切换 |
| 注册 | 点「去注册」 | 邮箱 + 密码 → 注册 |
| 忘记密码 | 点「忘记密码？」 | 邮箱 → 发送重置邮件 |
| 邮件已发送 | 发送成功 | 提示去邮箱点链接 |
| 重设密码 | 从邮件链接跳回 | 新密码 → 确认修改 |

---

## 七、分类体系

### 7.1 支出分类
| 大类 | emoji | 标签 |
|------|-------|------|
| 吃喝 | 🍽 | 餐饮、水果零食、买菜、烟酒 |
| 购物消费 | 🛍 | 购物、穿搭、美容、生活日用、家居家电 |
| 出行交通 | 🚌 | 交通、爱车、酒店旅行 |
| 休闲娱乐 | 🎮 | 休闲娱乐、网络虚拟、运动 |
| 居住生活 | 🏠 | 住房、生活服务 |
| 家庭人际 | 👨‍👩‍👧 | 养娃、宠物、人情社交、发红包 |
| 成长提升 | 📚 | 学习教育、医疗保健 |
| 金融财务 | 💰 | 金融保险、转账、互助保障 |
| 公益其他 | ❤️ | 公益、其他 |

### 7.2 收入分类
| 大类 | emoji | 标签 |
|------|-------|------|
| 收入 | 💵 | 工资薪资、奖金、兼职收入、投资收益、其他收入 |

### 7.3 分类查找
```javascript
// categories.js
export function getSuperCategory(tag) {
  // 遍历 CATEGORIES + INCOME_CATEGORIES
  // 找到 tag 属于哪个大类 → 返回 { name, emoji }
}
```

---

## 八、关键文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/App.jsx` | 186 | 路由、状态管理、登录守卫、菜单 |
| `src/utils/api.js` | 179 | **统一 API 层**，所有 AI 调用唯一入口 |
| `src/utils/storage.js` | 167 | 数据持久化，Supabase + local 降级 |
| `src/hooks/useTransactions.js` | 42 | 交易状态管理 |
| `src/utils/categories.js` | 63 | 分类体系 + getSuperCategory() |
| `src/components/AddPage.jsx` | 730 | 记账页（手动+AI+批量+历史） |
| `src/components/StatsPage.jsx` | 211 | 统计图表 + AI 分析 |
| `src/components/BillPage.jsx` | 180 | 账单列表（筛选+搜索+分日汇总） |
| `src/components/HomePage.jsx` | 77 | 仪表盘（今日概览+最近记录） |
| `src/components/LoginPage.jsx` | 230 | 邮箱登录/注册/忘记密码/重设密码 |
| `src/components/SettingsModal.jsx` | 72 | API Key 设置弹窗 |
| `server/index.js` | 285 | Express 后端（降级方案） |
| `supabase/functions/dify-proxy/index.ts` | 183 | Edge Function 源码 |
| `supabase-setup.sql` | 50 | 数据库建表 SQL |

---

## 九、启动与开发

```bash
npm run dev          # 同时启动前端(Vite:5173) + 后端(3001)
npm run server       # 单独启动后端
npm run build        # 构建生产版本 → dist/
```

### 浏览器访问
- 开发：`http://localhost:5173/accounting-app/`
- 生产：GitHub Pages URL
- 后端：`http://localhost:3001`

### PWA 安装
- 手机浏览器打开网址 → 添加到主屏幕
- 支持离线缓存（service worker）

---

## 十、已知限制与待改进

| 问题 | 影响 | 优先级 |
|------|------|------|
| AddPage.jsx 730 行，4 个职责混在一起 | 改 AI 可能搞崩手动输入 | 高 |
| 全局状态用 props 传递，没用状态管理库 | 加功能要改多层组件 | 中 |
| 没有 URL 路由（用 tab 状态切换） | 不能分享链接、前进后退 | 低 |
| 零测试 | 重构时心虚 | 低 |
| Supabase 7 天暂停 | 朋友可能用不了 | 已有降级方案 |
