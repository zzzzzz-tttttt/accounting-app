# Dify 工作流说明

## 三个工作流

| YAML | 功能 | 输入 | 输出 |
|------|------|------|------|
| 多模态记账.yml | 文字/语音/图片 → AI 提取结构化交易 | text_input / audio_file / image_file | `{"transactions": [...]}` JSON |
| 账单统计.yml | App 传交易数据 → 统计 + AI 分析建议 | transactions_json + 可选日期范围 | summary + chart_data + AI 分析 |
| 账单智能纠错.yml | 对话式账单修改助手 | 用户对话 | 自然语言回复 |

## 导入到 Dify 后的配置

### 1. 在 Dify 中导入 YAML

每个 YAML 作为独立 App 导入。

### 2. 配置环境变量

导入 YAML 后，**不需要手动改任何节点**。只需在工作流设置中添加环境变量：

**在哪里设置？** 打开工作流编辑器 → 左侧边栏或右上角 ⚙️ → **环境变量（Environment Variables）**

添加：

| 变量名 | 值 |
|--------|-----|
| `SILICONFLOW_API_KEY` | `sk-gbemquwazod...`（你硅基流动的 Key） |

> YAML 里已经写好了 `{{#env.SILICONFLOW_API_KEY#}}` 引用，导入后自动关联，不用逐个节点改。

### 3. 发布并获取 API Key

每个工作流发布后，在「API 访问」页面获取 API Key：
- 多模态记账 → 填入 `.env` 的 `DIFY_ACCOUNTING_KEY`
- 账单智能纠错 → 填入 `.env` 的 `DIFY_CORRECTION_KEY`

### 4. 配置 App 的 `.env`

```env
DIFY_API_URL=https://api.dify.ai/v1    # 或你的自部署地址
DIFY_ACCOUNTING_KEY=app-xxxx            # 多模态记账的 API Key
DIFY_CORRECTION_KEY=app-xxxx            # 账单智能纠错的 API Key
PORT=3001
```

## 数据流

```
App 前端 → server/index.js → Dify 工作流 API → AI 处理 → 返回 JSON → App 写入 Supabase
```

Dify 工作流**不直接读写数据库**，所有数据存取由 App 统一管理。
