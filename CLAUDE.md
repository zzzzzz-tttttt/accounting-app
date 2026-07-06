# 记账 App（手机网页版 PWA）

## 技术栈
- React 19 + Vite 8 + Tailwind CSS 3
- 图表：ECharts 6 + echarts-for-react
- 图标：Lucide React
- 数据存储：IndexedDB（浏览器本地），待接入 Supabase

## 后端 OCR 服务
- `server/index.js` — Express（localhost:3001）
- 调用 Dify 工作流 API 做 AI 处理（OCR、文字解析、纠错）
- Dify API 配置在 `.env` 文件中（不提交 Git）
- 三个 Dify 工作流 YAML 见 `dify/` 目录

## AI 架构（全部走 Dify）
| 功能 | Dify 工作流 | 调用方式 |
|------|------------|---------|
| 图片/语音/文字记账 | 多模态记账 | App → server → Dify → 返回 JSON |
| 账单统计+分析 | 账单统计 | App 传交易数据 → Dify 分析 |
| 账单修改纠错 | 账单智能纠错 | App 传对话 → Dify 聊天 |

## 启动
```bash
npm run dev          # 同时启动前端(Vite:5173) + 后端(3001)
npm run server       # 单独启动后端
```

## 页面
- HomePage — 仪表盘
- AddPage — 添加交易
- BillPage — 账单列表
- StatsPage — 统计图表
- ImportPage — 批量导入（支持粘贴截图 Ctrl+V）
- LockScreen — 密码锁屏

## 重要文件
- `src/components/ImportPage.jsx` — 导入页（已改造，删除了 Tesseract.js，换成后端 AI）
- `server/index.js` — OCR 后端服务
- `.env` — API Key 和模型配置
- `src/utils/categories.js` — 收支分类体系

## Supabase（暂未接入）
- Project: `https://ihrxotvyvspnlwhcbvdq.supabase.co`
- 数据目前仅存本地 IndexedDB
