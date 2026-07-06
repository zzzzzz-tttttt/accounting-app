# 记账 App（手机网页版 PWA）

## 技术栈
- React 19 + Vite 8 + Tailwind CSS 3
- 图表：ECharts 6 + echarts-for-react
- 图标：Lucide React
- 数据存储：IndexedDB（浏览器本地），待接入 Supabase

## 后端 OCR 服务
- `server/index.js` — Express（localhost:3001）
- 调用硅基流动视觉模型识别账单截图
- 模型：`Qwen/Qwen3-VL-32B-Instruct`
- API 配置在 `.env` 文件中（不提交 Git）

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
