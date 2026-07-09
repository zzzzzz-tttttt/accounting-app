# Dify 工作流知识总结

> 日期：2026-07-09 | 项目：记账 App

---

## 一、三个工作流概览

| 工作流 | 模式 | 文件 | 用途 | API 端点 |
|--------|------|------|------|----------|
| 多模态记账 | workflow | `多模态记账.yml` | 文字/语音/图片 → 提取交易 JSON | `/v1/workflows/run` |
| 账单统计 | workflow | `账单统计.yml` | 传入交易数据 → AI 分析建议 | `/v1/workflows/run` |
| 账单智能纠错 | advanced-chat | `账单智能纠错.yml` | 对话式账单修改/删除 | `/v1/chat-messages` |

---

## 二、Dify 环境变量

### 语法
```
{{#env.变量名#}}
```

### 在 HTTP 节点中使用
```
Authorization: Bearer {{#env.SILICONFLOW_API_KEY#}}
```

### 配置要点
- 类型选择 **Secret**（加密存储，日志不打码）
- 导出 YAML 时**不要**勾选「导出秘密环境变量」，否则 Key 会写进文件
- 重新导入工作流后环境变量保留，不需要重新配置

### 本项目用到的环境变量
| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SILICONFLOW_API_KEY` | `sk-adya...` | 硅基流动 API Key，语音识别和图片识别共用 |

---

## 三、工作流节点类型

### 1. Start 节点 — 接收输入
- 定义工作流的输入变量（text、file 等）
- App 通过 API 传入对应字段

### 2. IF-ELSE 节点 — 条件分支
- 常用条件：`exists` 判断文件是否上传
- 本项目用 `audio_file exists` → 语音分支，`image_file exists` → 图片分支

### 3. HTTP 请求节点 — 调用外部 API
- **语音识别**：POST `https://api.siliconflow.cn/v1/audio/transcriptions`
  - Model: `FunAudioLLM/SenseVoiceSmall`
  - Body 类型: `form-data`，文件字段用 `type: file` 引用 Start 节点的文件变量
- **图片识别**：POST `https://api.siliconflow.cn/v1/chat/completions`
  - Model: `Qwen/Qwen3-VL-8B-Instruct`
  - Body 类型: `raw-text`（JSON），图片通过 `{{#节点ID.变量名.url#}}` 传 URL

### 4. 代码执行节点 — Python 数据处理
- 接收上游变量，返回字典
- 常用场景：解析 JSON、计算日期、格式化输出

### 5. 变量聚合器 — 合并分支
- 将多条路径的输出合并为一个变量
- 后续节点引用聚合器的 `output` 即可

### 6. LLM 节点 — 大模型推理
- 使用 Dify 内置模型提供商（硅基流动）
- System prompt 放分类规则和格式要求
- User prompt 引用上游变量 `{{#节点ID.output#}}`

### 7. End 节点 — 输出
- 定义工作流返回给 App 的字段
- 本项目输出 `records`（JSON 字符串）

---

## 四、API 调用方式

### Workflow 模式（多模态记账、账单统计）
```javascript
POST /v1/workflows/run
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "inputs": {
    "text_input": "午餐58元 打车30元",
    "audio_file": null,
    "image_file": null
  },
  "response_mode": "blocking",
  "user": "accounting-app"
}
```

返回格式：
```json
{
  "data": {
    "outputs": {
      "records": "{\"transactions\": [...]}"
    }
  }
}
```

### Chat 模式（账单智能纠错）
```javascript
POST /v1/chat-messages
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "query": "现有账单：[...]\n\n用户说：把午饭改成餐饮",
  "response_mode": "blocking",
  "user": "accounting-app"
}
```

返回格式：
```json
{
  "answer": "好的，帮你修改..."
}
```

---

## 五、App 端架构

### 后端 server/index.js
| 端点 | 方法 | 对应工作流 | Dify API |
|------|------|-----------|----------|
| `/api/ocr` | POST | 多模态记账 | `/workflows/run` |
| `/api/parse-text` | POST | 多模态记账 或 账单智能纠错 | `/workflows/run` 或 `/chat-messages` |
| `/api/stats-analysis` | POST | 账单统计 | `/workflows/run` |

### 路由逻辑（parse-text）
```
用户输入文字
  ├─ 含数字 → 多模态记账（新建交易）
  └─ 无数字 / 含"修改""删除"等关键词 → 账单智能纠错（对话处理）
```

### .env 配置
```
DIFY_API_URL=https://api.dify.ai/v1
DIFY_ACCOUNTING_KEY=app-xxxx   # 多模态记账
DIFY_CORRECTION_KEY=app-xxxx   # 账单智能纠错
DIFY_STATS_KEY=app-xxxx        # 账单统计
```

---

## 六、今天踩过的坑

### 1. Dify 内置 Vision 节点无法正确传图给硅基流动
- **现象**：Dify LLM+Vision 节点选择硅基流动 Qwen3-VL 模型，图片传不过去
- **解决**：改用手写 HTTP 节点直接调硅基流动 `/v1/chat/completions` API

### 2. YAML 中的双引号转义
- **现象**：修改代码节点后导入报 `Invalid YAML format`
- **原因**：YAML 双引号字符串内的 `"` 必须写成 `\"`
- **解决**：手动检查转义，或直接在 Dify 界面改

### 3. API Key 硬编码在 YAML 中
- **风险**：上传 GitHub 会泄露
- **解决**：用 `{{#env.SILICONFLOW_API_KEY#}}` 环境变量替代，导出时不导出秘密变量

### 4. Workflow 和 Chat 模式 API 端点不同
- **现象**：纠错工作流报 `not_workflow_app`
- **原因**：Chat 模式要用 `/chat-messages`，不能用 `/workflows/run`
- **解决**：Server 端分两个函数 `callDifyWorkflow` 和 `callDifyChat`

### 5. 账单统计 JSON 结构不匹配
- **现象**：多模态记账返回 `{"transactions": [...]}`，账单统计代码直接当数组用
- **解决**：加兼容逻辑 `data.get("transactions", data) if isinstance(data, dict) else data`

### 6. Dify prompt 修改后需要重新「发布」
- 修改 prompt 后必须点右上角「发布」→ API 才会用新版本

### 7. 免费版 Dify 只有 5 个工作流额度
- 导入新工作流前需先删除旧的腾出位置

### 8. 别在 Dify 前面加本地解析器
- App 里自己写的正则解析器会抢在 Dify 前拦截请求，导致识别质量极差
- 全部走 Dify 才是正解

---

## 七、工作流维护流程

### 修改 prompt（推荐在 Dify 界面改）
1. 打开工作流 → 点击 LLM 节点 → 修改 System Prompt
2. 点右上角「发布」
3. 完事，不需要重新导入或改代码

### 修改工作流结构（需重新导入）
1. 在 Dify 界面修改并测试通过
2. 导出 YAML（**不导出**秘密环境变量）
3. 放到 `dify/` 文件夹
4. 提交 GitHub
5. 在 Dify 中「导入 DSL」覆盖更新

### 修改后验证
1. 在 Dify 内直接测试
2. 如果 Dify 测试正确但 App 不对 → 检查 App 代码
3. 用 curl 测试 server API 排除前端干扰
