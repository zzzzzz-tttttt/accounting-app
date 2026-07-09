import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Dify 配置
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1'
const DIFY_ACCOUNTING_KEY = process.env.DIFY_ACCOUNTING_KEY || ''
const DIFY_CORRECTION_KEY = process.env.DIFY_CORRECTION_KEY || ''
const DIFY_STATS_KEY = process.env.DIFY_STATS_KEY || ''

// 分类映射表（由 App 自己维护，不靠 AI）
const CATEGORY_MAP = {
  '餐饮': { superCat: '吃喝', emoji: '🍚' },
  '水果零食': { superCat: '吃喝', emoji: '🍎' },
  '买菜': { superCat: '吃喝', emoji: '🥬' },
  '烟酒': { superCat: '吃喝', emoji: '🍺' },
  '购物': { superCat: '购物消费', emoji: '🛒' },
  '穿搭': { superCat: '购物消费', emoji: '👗' },
  '美容': { superCat: '购物消费', emoji: '💄' },
  '生活日用': { superCat: '购物消费', emoji: '🧴' },
  '家居家电': { superCat: '购物消费', emoji: '🏠' },
  '交通': { superCat: '出行交通', emoji: '🚇' },
  '爱车': { superCat: '出行交通', emoji: '🚗' },
  '酒店旅行': { superCat: '出行交通', emoji: '🏨' },
  '休闲娱乐': { superCat: '休闲娱乐', emoji: '🎮' },
  '网络虚拟': { superCat: '休闲娱乐', emoji: '📱' },
  '运动': { superCat: '休闲娱乐', emoji: '⚽' },
  '住房': { superCat: '居住生活', emoji: '🏡' },
  '生活服务': { superCat: '居住生活', emoji: '📦' },
  '养娃': { superCat: '家庭人际', emoji: '👶' },
  '宠物': { superCat: '家庭人际', emoji: '🐱' },
  '人情社交': { superCat: '家庭人际', emoji: '🎁' },
  '发红包': { superCat: '家庭人际', emoji: '🧧' },
  '学习教育': { superCat: '成长提升', emoji: '📚' },
  '医疗保健': { superCat: '成长提升', emoji: '💊' },
  '金融保险': { superCat: '金融财务', emoji: '💰' },
  '转账': { superCat: '金融财务', emoji: '💳' },
  '公益': { superCat: '公益其他', emoji: '❤️' },
  '其他': { superCat: '公益其他', emoji: '📝' },
  '工资薪资': { superCat: '收入', emoji: '💼' },
  '奖金': { superCat: '收入', emoji: '🎉' },
  '兼职收入': { superCat: '收入', emoji: '💻' },
  '投资收益': { superCat: '收入', emoji: '📈' },
  '其他收入': { superCat: '收入', emoji: '💵' },
}

function enrichTransactions(transactions) {
  return transactions.map(t => {
    const cat = CATEGORY_MAP[t.tag] || { superCat: '公益其他', emoji: '📝' }
    return { ...t, superCat: cat.superCat, superEmoji: cat.emoji }
  })
}

// ===== Dify API 封装 =====

async function callDifyWorkflow(inputs, apiKey) {
  const res = await fetch(`${DIFY_API_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user: 'accounting-app',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dify 响应 ${res.status}: ${text}`)
  }
  return res.json()
}

// Chat 工作流专用（账单智能纠错是 advanced-chat 模式）
async function callDifyChat(query, apiKey) {
  const res = await fetch(`${DIFY_API_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      response_mode: 'blocking',
      user: 'accounting-app',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dify 响应 ${res.status}: ${text}`)
  }
  return res.json()
}

async function uploadFileToDify(buffer, filename, mimeType) {
  // 手动构建 multipart/form-data，无需额外依赖
  const boundary = '----DifyUpload' + Math.random().toString(36).slice(2)
  const encoder = new TextEncoder()
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    buffer,
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="user"\r\n\r\naccounting-app\r\n--${boundary}--\r\n`,
  ]
  const body = new Uint8Array(
    parts.reduce((acc, p) => acc + (typeof p === 'string' ? encoder.encode(p).length : p.length), 0)
  )
  let offset = 0
  for (const p of parts) {
    const bytes = typeof p === 'string' ? encoder.encode(p) : new Uint8Array(p)
    body.set(bytes, offset)
    offset += bytes.length
  }

  const res = await fetch(`${DIFY_API_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_ACCOUNTING_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dify 文件上传失败 ${res.status}: ${text}`)
  }
  return res.json()
}

function parseDifyOutput(data) {
  // Dify workflow 返回格式: { data: { outputs: { records: "..." } } }
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

// ===== OCR 截图识别 =====
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: '未收到图片文件' })
    if (!DIFY_ACCOUNTING_KEY) return res.status(500).json({ ok: false, error: '未配置 DIFY_ACCOUNTING_KEY' })

    // 上传图片到 Dify
    const uploadResult = await uploadFileToDify(
      req.file.buffer,
      req.file.originalname || 'receipt.png',
      req.file.mimetype || 'image/png'
    )

    // 调用多模态记账工作流
    const result = await callDifyWorkflow({
      text_input: '',
      audio_file: null,
      image_file: {
        transfer_method: 'local_file',
        upload_file_id: uploadResult.id,
        type: 'image',
      },
    }, DIFY_ACCOUNTING_KEY)

    const txs = parseDifyOutput(result)
    res.json({ ok: true, transactions: enrichTransactions(txs) })
  } catch (err) {
    console.error('OCR error:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ===== 文字解析（创建 + 修改 + 删除）=====
app.post('/api/parse-text', async (req, res) => {
  try {
    const { text, transactions } = req.body
    if (!text) return res.status(400).json({ ok: false, error: '未收到文字' })

    const isModifyCmd = /修改|改成|改为|换成|更新|调整|删除|去掉|移除|清除|删掉/.test(text)
    const hasAmount = /\d/.test(text)  // 是否含数字

    if ((isModifyCmd || !hasAmount) && transactions?.length > 0 && DIFY_CORRECTION_KEY) {
      // 修改/删除命令 → 调账单智能纠错（Chat 工作流）
      const summary = transactions.slice(0, 50).map(t => ({
        id: t.id, date: t.date, amount: t.amount, type: t.type, tag: t.tag, superCat: t.superCat, note: t.note,
      }))

      const result = await callDifyChat(
        `现有账单：${JSON.stringify(summary)}\n\n用户说：${text}`,
        DIFY_CORRECTION_KEY
      )

      const reply = result?.answer || result?.data?.outputs?.text || ''
      console.log('=== 纠错回复 ===', reply)
      res.json({ ok: true, action: 'chat', reply })
      return
    }

    // 新建交易 → 调多模态记账工作流
    if (!DIFY_ACCOUNTING_KEY) return res.status(500).json({ ok: false, error: '未配置 DIFY_ACCOUNTING_KEY' })

    const result = await callDifyWorkflow({
      text_input: text,
      audio_file: null,
      image_file: null,
    }, DIFY_ACCOUNTING_KEY)

    const txs = parseDifyOutput(result)
    console.log('=== 文字记账 解析结果 ===', JSON.stringify(txs, null, 2))
    const enriched = enrichTransactions(txs)
    res.json({ ok: true, action: 'create', transactions: enriched })
  } catch (err) {
    console.error('AI error:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ===== 账单统计分析 =====
app.post('/api/stats-analysis', async (req, res) => {
  try {
    const { transactions, start_date, end_date } = req.body
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ ok: false, error: '未收到有效的交易数据' })
    }
    if (!DIFY_STATS_KEY) {
      return res.status(500).json({ ok: false, error: '未配置 DIFY_STATS_KEY' })
    }

    // 精简字段，减少传输量
    const slim = transactions.map(t => ({
      date: t.date,
      amount: t.amount,
      type: t.type,
      tag: t.tag,
      note: t.note || '',
    }))

    const result = await callDifyWorkflow({
      transactions_json: JSON.stringify(slim),
      start_date: start_date || '',
      end_date: end_date || '',
    }, DIFY_STATS_KEY)

    const outputs = result?.data?.outputs || {}
    res.json({
      ok: true,
      summary: outputs.summary || '',
      chart_data: outputs.chart_data || [],
      output: outputs.output || '',
    })
  } catch (err) {
    console.error('Stats analysis error:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🧠 后端已启动: http://localhost:${PORT}`)
  if (!DIFY_ACCOUNTING_KEY) console.warn('⚠ 未配置 DIFY_ACCOUNTING_KEY，OCR/解析功能不可用')
  if (!DIFY_CORRECTION_KEY) console.warn('⚠ 未配置 DIFY_CORRECTION_KEY，纠错功能不可用')
  if (!DIFY_STATS_KEY) console.warn('⚠ 未配置 DIFY_STATS_KEY，统计分析功能不可用')
})
