import { supabase } from '../supabase'
import { getSuperCategory } from './categories'

// ============================================================
// 统一 API 层
// 优先：Supabase Edge Function（公网，朋友也能用）
// 降级：本地 Express（你自己用，不依赖 Supabase）
// ============================================================

const EXPRESS_URL = 'http://localhost:3001'

// ===== 内部：Dify 输出解析（原来在 server/index.js 里）=====

function parseDifyOutput(data) {
  const recordsStr = data?.data?.outputs?.records
  if (!recordsStr) return []
  try {
    const parsed = JSON.parse(recordsStr)
    return (parsed.transactions || []).map(t => ({
      date: t.date || '',
      amount: +t.amount || 0,
      type: t.type === 'income' ? 'income' : 'expense',
      tag: t.tag || '其他',
      note: (t.note || '').slice(0, 20),
    }))
  } catch {
    return []
  }
}

function enrichTransactions(transactions) {
  return transactions.map(t => {
    const cat = getSuperCategory(t.tag)
    return { ...t, superCat: cat.name, superEmoji: cat.emoji }
  })
}

// ===== 内部：图片转 base64 =====

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 去掉 data:image/xxx;base64, 前缀
      resolve(reader.result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ===== 公开 API =====

/** OCR 图片识别 → 返回交易列表 */
export async function ocrImage(file) {
  // 1️⃣ 优先：Edge Function
  try {
    const base64 = await fileToBase64(file)
    const { data } = await supabase.functions.invoke('clever-endpoint', {
      body: { action: 'ocr', image: base64, filename: file.name },
    })
    if (data?.data?.outputs) {
      const txs = parseDifyOutput(data)
      if (txs.length > 0) return { ok: true, transactions: enrichTransactions(txs) }
    }
    // Edge Function 返回了数据但解析不出交易，继续降级
    console.log('Edge Function OCR 未识别到交易')
  } catch (e) {
    console.log('Edge Function 不可用，降级 Express:', e.message)
  }

  // 2️⃣ 降级：本地 Express
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`${EXPRESS_URL}/api/ocr`, {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(60000),
  })
  return res.json()
}

/** 文字解析 / 纠错对话 → 返回交易列表或对话回复 */
export async function parseText(text, { transactions = [], conversationId = null, chatHistory = [] } = {}) {
  // 判断是聊天还是记账
  const isChat = !/\d/.test(text) || /修改|改成|改为|换成|更新|调整|删除|去掉|移除|清除|删掉/.test(text)

  // 1️⃣ 优先：Edge Function
  try {
    if (isChat) {
      const context = chatHistory.slice(-6).map(m =>
        `${m.role === 'user' ? '用户' : '助手'}: ${m.text}`
      ).join('\n')
      const summary = transactions.slice(0, 50).map(t => ({
        id: t.id, date: t.date, amount: t.amount, type: t.type, tag: t.tag, superCat: t.superCat, note: t.note,
      }))
      const query = `现有账单：${JSON.stringify(summary)}\n\n对话历史：\n${context}\n\n用户说：${text}`

      const { data } = await supabase.functions.invoke('clever-endpoint', {
        body: { action: 'chat', query, conversation_id: conversationId },
      })
      const reply = data?.answer || data?.data?.outputs?.text || ''
      return { ok: true, action: 'chat', reply, conversation_id: data?.conversation_id }
    }

    // 新建交易
    const { data } = await supabase.functions.invoke('clever-endpoint', {
      body: { action: 'parse', text },
    })
    if (data?.data?.outputs) {
      const txs = parseDifyOutput(data)
      return { ok: true, action: 'create', transactions: enrichTransactions(txs) }
    }
  } catch (e) {
    console.log('Edge Function 不可用，降级 Express:', e.message)
  }

  // 2️⃣ 降级：本地 Express
  const res = await fetch(`${EXPRESS_URL}/api/parse-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      transactions,
      api_key: '',
      conversation_id: conversationId,
      chat_history: chatHistory.slice(-10),
    }),
    signal: AbortSignal.timeout(30000),
  })
  return res.json()
}

/** 统计分析 → 返回 AI 分析文本 */
export async function analyzeStats(transactions, startDate, endDate) {
  const slim = transactions.map(t => ({
    date: t.date, amount: t.amount, type: t.type, tag: t.tag, note: t.note || '',
  }))

  // 1️⃣ 优先：Edge Function
  try {
    const { data } = await supabase.functions.invoke('clever-endpoint', {
      body: {
        action: 'stats',
        transactions_json: JSON.stringify(slim),
        start_date: startDate || '',
        end_date: endDate || '',
      },
    })
    const outputs = data?.data?.outputs || {}
    return { ok: true, output: outputs.output || '', summary: outputs.summary || '' }
  } catch (e) {
    console.log('Edge Function 不可用，降级 Express:', e.message)
  }

  // 2️⃣ 降级：本地 Express
  const res = await fetch(`${EXPRESS_URL}/api/stats-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: slim, start_date: startDate, end_date: endDate }),
    signal: AbortSignal.timeout(30000),
  })
  return res.json()
}

// ===== 用户自配 API Key（暂时保留，给本地 Express 降级用）=====

export function getUserApiKey() {
  return localStorage.getItem('user_api_key') || ''
}

export function setUserApiKey(key) {
  localStorage.setItem('user_api_key', key.trim())
}

export function hasUserApiKey() {
  return !!getUserApiKey()
}
