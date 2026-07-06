import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import OpenAI from 'openai'

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const DEFAULT_API_KEY = process.env.SILICONFLOW_API_KEY
const VISION_MODEL = process.env.VISION_MODEL || 'Qwen/Qwen3-VL-32B-Instruct'
const TEXT_MODEL = process.env.TEXT_MODEL || 'deepseek-ai/DeepSeek-V3'

function getClient(apiKey) {
  const key = apiKey || DEFAULT_API_KEY
  if (!key) throw new Error('未配置 API Key')
  return new OpenAI({ apiKey: key, baseURL: 'https://api.siliconflow.cn/v1' })
}

const CATEGORY_MAP = {
  '餐饮': { superCat: '吃喝', emoji: '🍚' },
  '水果零食': { superCat: '吃喝', emoji: '🍎' },
  '买菜': { superCat: '吃喝', emoji: '🥬' },
  '烟酒': { superCat: '吃喝', emoji: '🍺' },
  '购物': { superCat: '购物消费', emoji: '🛒' },
  '穿搭美容': { superCat: '购物消费', emoji: '👗' },
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

function extractJSON(raw) {
  let jsonStr = raw.trim()
  const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) jsonStr = m[1].trim()
  let parsed
  try { parsed = JSON.parse(jsonStr) } catch {
    parsed = JSON.parse(jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'))
  }
  return parsed
}

// ===== OCR 截图识别 =====
app.post('/api/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: '未收到图片文件' })
    const cli = getClient(req.body.apiKey)
    const base64 = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype || 'image/png'
    const today = new Date().toISOString().split('T')[0]
    const thisYear = new Date().getFullYear()

    const response = await cli.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: `你是一个专业的记账助手。今天的日期是 ${today}。分析账单截图提取交易记录。只返回 JSON：{"transactions":[{"date":"${today}","amount":238.50,"type":"expense","tag":"餐饮","note":"海底捞"}]}。支出分类：餐饮、水果零食、买菜、烟酒、购物、穿搭美容、生活日用、家居家电、交通、爱车、酒店旅行、休闲娱乐、网络虚拟、运动、住房、生活服务、养娃、宠物、人情社交、发红包、学习教育、医疗保健、金融保险、转账、公益、其他。收入分类：工资薪资、奖金、兼职收入、投资收益、其他收入。如果不确定年份用 ${thisYear}。没有交易返回 {"transactions":[]}` },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }, { type: 'text', text: '识别这张截图中的所有交易' }] },
      ],
      max_tokens: 2048, temperature: 0.1,
    })

    const raw = response.choices?.[0]?.message?.content || ''
    console.log('=== OCR ===', raw)
    const parsed = extractJSON(raw)
    const txs = (parsed.transactions || []).map(t => ({
      date: t.date || today, amount: +t.amount || 0,
      type: t.type === 'income' ? 'income' : 'expense',
      tag: t.tag || '其他', note: (t.note || '').slice(0, 20),
    }))
    res.json({ ok: true, transactions: enrichTransactions(txs) })
  } catch (err) {
    console.error('OCR error:', err.message)
    res.status(500).json({ ok: false, error: err.status === 401 ? 'API Key 无效' : '服务内部错误' })
  }
})

// ===== AI 统一入口（文字解析 + 修改命令 + 删除命令）=====
app.post('/api/parse-text', async (req, res) => {
  try {
    const { text, transactions, apiKey } = req.body
    if (!text) return res.status(400).json({ ok: false, error: '未收到文字' })
    const cli = getClient(apiKey)
    const today = new Date().toISOString().split('T')[0]
    const thisYear = new Date().getFullYear()

    const hasTransactions = transactions?.length > 0
    const summary = hasTransactions
      ? (transactions || []).slice(0, 50).map(t => ({
          id: t.id, date: t.date, amount: t.amount, type: t.type, tag: t.tag, superCat: t.superCat, note: t.note,
        }))
      : []

    const isModifyCmd = /修改|改成|改为|换成|更新|调整|删除|去掉|移除|清除|删掉/.test(text)

    const systemPrompt = isModifyCmd && hasTransactions
      ? `记账助手。分析用户命令。今天 ${today}。\n\n如果是记录新账单，返回：{"action":"create","transactions":[{"date":"${today}","amount":58,"type":"expense","tag":"餐饮","note":"午餐"}]}\n\n如果是修改已有账单（关键词：修改、改成、改为、换成、更新），只改用户指定的字段，没提到的字段不要动！返回：{"action":"modify","modifications":[{"id":"匹配到的账单id","changes":{"tag":"餐饮"}}]}\n\n如果是删除已有账单（关键词：删除、去掉、移除），返回：{"action":"delete","deleteIds":["匹配到的账单id"]}\n\n⚠ 修改时 changes 里只放要改的字段，不要编造金额和备注！用户没说要改金额就别写amount。标签：餐饮、水果零食、买菜、烟酒、购物、穿搭美容、生活日用、家居家电、交通、爱车、酒店旅行、休闲娱乐、网络虚拟、运动、住房、生活服务、养娃、宠物、人情社交、发红包、学习教育、医疗保健、金融保险、转账、公益、其他、工资薪资、奖金、兼职收入、投资收益、其他收入。日期 YYYY-MM-DD。`
      : `记账助手。从自然语言提取交易记录。今天 ${today}。只返回 JSON：{"action":"create","transactions":[{"date":"${today}","amount":238.50,"type":"expense","tag":"餐饮","note":"海底捞"}]}。标签：餐饮、水果零食、买菜、烟酒、购物、穿搭美容、生活日用、家居家电、交通、爱车、酒店旅行、休闲娱乐、网络虚拟、运动、住房、生活服务、养娃、宠物、人情社交、发红包、学习教育、医疗保健、金融保险、转账、公益、其他、工资薪资、奖金、兼职收入、投资收益、其他收入。没有年用 ${thisYear}。`

    const userMsg = hasTransactions
      ? `现有账单：${JSON.stringify(summary)}\n\n用户说：${text}`
      : text

    const response = await cli.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 2048, temperature: 0.1,
    })

    const raw = response.choices?.[0]?.message?.content || ''
    console.log('=== AI ===', raw)
    const parsed = extractJSON(raw)

    // 处理 transactions
    if (parsed.transactions) {
      parsed.transactions = enrichTransactions(parsed.transactions.map(t => ({
        ...t, amount: +t.amount || 0,
        type: t.type === 'income' ? 'income' : 'expense',
        tag: t.tag || '其他', note: (t.note || '').slice(0, 20),
      })))
    }

    res.json({ ok: true, action: parsed.action || 'create', ...parsed })
  } catch (err) {
    console.error('AI error:', err.message)
    res.status(500).json({ ok: false, error: err.status === 401 ? 'API Key 无效' : '服务内部错误' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🧠 后端已启动: http://localhost:${PORT}`)
})
