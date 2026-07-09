import { useState, useRef, useEffect } from 'react'
import CategoryPicker from './CategoryPicker'
import { ChevronRight, Mic, MicOff, Image, Send, Loader, MoreVertical, X, FileText, Upload, MessageCircle, Clock, Trash2 } from 'lucide-react'
import { CATEGORIES, INCOME_CATEGORIES } from '../utils/categories'
import { getUserApiKey } from '../utils/api'

const ALL_TAGS = [
  ...Object.entries(CATEGORIES).flatMap(([superCat, d]) => d.tags.map(tag => ({ tag, superCat, emoji: d.emoji }))),
  ...Object.entries(INCOME_CATEGORIES).flatMap(([superCat, d]) => d.tags.map(tag => ({ tag, superCat, emoji: d.emoji })))
]

function parseText(text) {
  const today = new Date().toISOString().split('T')[0]
  const results = []
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^(日期|时间|金额|分类|备注|交易|收支|明细|账单|序号|No\.)/i.test(line)) continue
    const amountMatch = line.match(/[¥￥]?\s*([\d,]+\.?\d*)/)
    if (!amountMatch) continue
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
    if (!amount || amount <= 0 || amount > 1000000) continue
    const date = extractDate(line) || today
    const type = guessType(line)
    const tag = guessTag(line)
    const note = extractNote(line)
    results.push({ date, amount, type, tag: tag.tag, superCat: tag.superCat, superEmoji: tag.emoji, note })
  }
  return results
}

function extractDate(text) {
  let m = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
  m = text.match(/(\d{1,2})[/-](\d{1,2})/)
  if (m) { const y = new Date().getFullYear(); return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` }
  m = text.match(/(\d{1,2})月(\d{1,2})[日号]/)
  if (m) { const y = new Date().getFullYear(); return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` }
  return null
}

function guessType(text) {
  return /工资|薪资|奖金|收入|收款|红包收|转账收|退款|报销|兼职/.test(text) ? 'income' : 'expense'
}

function guessTag(text) {
  const kwMap = [
    { kw: /餐饮|吃饭|午餐|晚餐|早餐|外卖|堂食|饭店|食/, tag: '餐饮' },
    { kw: /咖啡|奶茶|饮料|星巴克|瑞幸|喜茶|茶饮/, tag: '餐饮' },
    { kw: /超市|买菜|蔬菜|水果|生鲜|菜市场|盒马|叮咚/, tag: '买菜' },
    { kw: /零食|薯片|糖果|饼干|巧克力|坚果/, tag: '水果零食' },
    { kw: /烟|酒|茅台|啤酒|白酒|红酒/, tag: '烟酒' },
    { kw: /打车|滴滴|出租|地铁|公交|高铁|火车|机票|飞机|交通/, tag: '交通' },
    { kw: /加油|油费|停车|洗车|修车|保养|汽车/, tag: '爱车' },
    { kw: /酒店|民宿|旅行|旅游|景区|门票|出行/, tag: '酒店旅行' },
    { kw: /购物|网购|淘宝|京东|拼多多|天猫/, tag: '购物' },
    { kw: /衣服|鞋子|包包|服装|穿搭|美容|化妆|口红|护肤|美发/, tag: '穿搭美容' },
    { kw: /日用|洗发|沐浴|卫生纸|洗衣|洁厕/, tag: '生活日用' },
    { kw: /家电|冰箱|洗衣机|空调|家居|家具|装修/, tag: '家居家电' },
    { kw: /房租|租房|水电|物业|燃气|住房|按揭/, tag: '住房' },
    { kw: /宽带|话费|流量|电话|手机费|快递/, tag: '生活服务' },
    { kw: /娱乐|电影|KTV|游戏|演出|音乐会|演唱会/, tag: '休闲娱乐' },
    { kw: /视频|爱奇艺|优酷|腾讯视频|Netflix|会员|订阅/, tag: '网络虚拟' },
    { kw: /健身|运动|游泳|跑步|体育|球/, tag: '运动' },
    { kw: /医疗|看病|医院|药|诊所|体检|牙科/, tag: '医疗保健' },
    { kw: /学习|课程|培训|书|教育|学费|辅导/, tag: '学习教育' },
    { kw: /保险|理财|基金|股票|金融|投资/, tag: '金融保险' },
    { kw: /转账|还款|借款|还钱/, tag: '转账' },
    { kw: /红包|礼金|人情|随礼|送礼/, tag: '人情社交' },
    { kw: /发红包/, tag: '发红包' },
    { kw: /孩子|奶粉|玩具|养娃|育儿|幼儿园/, tag: '养娃' },
    { kw: /宠物|猫粮|狗粮|猫|狗|宠/, tag: '宠物' },
    { kw: /工资|薪资/, tag: '工资薪资' },
    { kw: /奖金|绩效/, tag: '奖金' },
    { kw: /兼职|副业/, tag: '兼职收入' },
  ]
  for (const { kw, tag: tagName } of kwMap) {
    if (kw.test(text)) {
      const found = ALL_TAGS.find(t => t.tag === tagName)
      if (found) return found
    }
  }
  return ALL_TAGS.find(t => t.tag === '其他') || { tag: '其他', superCat: '公益其他', emoji: '❤️' }
}

function extractNote(text) {
  return text
    .replace(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g, '')
    .replace(/\d{1,2}[/-]\d{1,2}/g, '')
    .replace(/\d{1,2}月\d{1,2}[日号]/g, '')
    .replace(/[¥￥]\s*[\d,]+\.?\d*/g, '')
    .replace(/[\d,]+\.?\d*\s*元/g, '')
    .replace(/收入|支出|消费|转账/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 20)
}

function parseCSV(text) {
  const lines = text.split(/[\n\r]+/).filter(Boolean)
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''))
  const today = new Date().toISOString().split('T')[0]
  const results = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/^["']|["']$/g, '').trim())
    if (cols.length < 2) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = cols[idx] || '' })
    const amountCol = headers.find(h => /金额|amount|price|钱/.test(h))
    const amount = parseFloat((row[amountCol] || '').replace(/[¥￥,]/g, ''))
    if (!amount || amount <= 0) continue
    const dateCol = headers.find(h => /日期|date|时间|time/.test(h))
    const date = extractDate(row[dateCol] || '') || today
    const noteCol = headers.find(h => /备注|note|描述|说明|商家|merchant|remark/.test(h))
    const note = row[noteCol] || ''
    const tag = guessTag(cols.join(' ') + ' ' + note)
    results.push({ date, amount, type: guessType(note), tag: tag.tag, superCat: tag.superCat, superEmoji: tag.emoji, note })
  }
  return results
}

// 调用后端 AI 文字解析
async function aiParseText(text, apiKey) {
  const res = await fetch('http://localhost:3001/api/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, apiKey }),
    signal: AbortSignal.timeout(30000),
  })
  return await res.json()
}

// 调用后端 OCR
async function ocrImage(file, apiKey) {
  const fd = new FormData()
  fd.append('image', file)
  fd.append('apiKey', apiKey)
  const res = await fetch('http://localhost:3001/api/ocr', {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(60000),
  })
  return await res.json()
}

export default function AddPage({ onSave, editTx, onCancel, onBatchImport, transactions, onUpdate, onDelete }) {
  const [mode, setMode] = useState('manual') // 'manual' | 'ai'
  // 手动模式
  const [type, setType] = useState(editTx?.type || 'expense')
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : '')
  const [date, setDate] = useState(editTx?.date || new Date().toISOString().split('T')[0])
  const [tag, setTag] = useState(editTx?.tag || '')
  const [superCat, setSuperCat] = useState(editTx?.superCat || '')
  const [superEmoji, setSuperEmoji] = useState(editTx?.superEmoji || '')
  const [note, setNote] = useState(editTx?.note || '')
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState('')
  // AI 模式
  const [chatMessages, setChatMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [showAiHistory, setShowAiHistory] = useState(false)
  const [currentHistoryId, setCurrentHistoryId] = useState(null)  // 追踪当前加载的是哪条历史
  // 批量导入
  const [batchText, setBatchText] = useState('')
  const [batchParsed, setBatchParsed] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchSelected, setBatchSelected] = useState(new Set())

  const chatEndRef = useRef()
  const imgRef = useRef()
  const batchFileRef = useRef()

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }

  function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('请输入有效金额'); return }
    if (!tag) { setError('请选择分类'); return }
    setError('')
    onSave({ type, amount: Number(amount), date, tag, superCat, superEmoji, note, ...(editTx ? { id: editTx.id } : {}) })
  }

  // ===== AI 对话 =====
  async function sendAiMessage() {
    const text = aiInput.trim()
    if (!text || aiLoading) return
    setAiInput('')
    setChatMessages(prev => [...prev, { role: 'user', text }])
    setAiLoading(true)

    // 先用本地简单解析试试
    // 全部走 AI（Dify），本地正则太弱，多笔/复杂输入会出错
    const result = await fetch('http://localhost:3001/api/parse-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, transactions: transactions || [], apiKey: getUserApiKey() }),
      signal: AbortSignal.timeout(30000),
    }).then(r => r.json()).catch(() => null)

    if (!result?.ok) {
      setChatMessages(prev => [...prev, {
        role: 'assistant', action: 'none',
        text: '没理解你的意思。可以试试：\n• "午餐58元" — 记录新账单\n• "把昨天的账单改成餐饮分类" — 修改已有账单\n• "删除6月15号的记录" — 删除账单'
      }])
      setAiLoading(false)
      return
    }

    // 兼容 AI 可能返回的不同格式
    const action = result.action || (result.modifications?.length > 0 ? 'modify' : result.deleteIds?.length > 0 ? 'delete' : 'create')

    if ((action === 'modify' || action === 'update') && (result.modifications?.length > 0 || result.transactions?.some(t => t.id))) {
      // 统一成 modifications 格式
      const mods = result.modifications || result.transactions.filter(t => t.id).map(t => {
        const { id, ...changes } = t
        return { id, changes }
      })
      result.modifications = mods
      result.action = 'modify'
    }

    if (result.action === 'modify' && result.modifications?.length > 0) {
      setChatMessages(prev => [...prev, {
        role: 'assistant', action: 'modify',
        modifications: result.modifications,
        text: `找到 ${result.modifications.length} 条需要修改的账单`
      }])
    } else if (result.action === 'delete' && result.deleteIds?.length > 0) {
      const matched = (transactions || []).filter(t => result.deleteIds.includes(t.id))
      setChatMessages(prev => [...prev, {
        role: 'assistant', action: 'delete',
        deleteIds: result.deleteIds,
        matched,
        text: `找到 ${matched.length} 条要删除的账单`
      }])
    } else if (result.action === 'create' && result.transactions?.length > 0) {
      setChatMessages(prev => [...prev, {
        role: 'assistant', action: 'create', transactions: result.transactions,
        text: `找到了 ${result.transactions.length} 笔记录`
      }])
    } else {
      setChatMessages(prev => [...prev, {
        role: 'assistant', action: 'none',
        text: '没找到匹配的账单或记录。请检查日期和描述是否准确。'
      }])
    }
    setAiLoading(false)
  }

  async function sendAiImage(file) {
    setAiLoading(true)
    const userMsg = { role: 'user', text: '📷 上传了截图', image: URL.createObjectURL(file) }
    setChatMessages(prev => [...prev, userMsg])

    const result = await ocrImage(file, getUserApiKey())
    if (result.ok && result.transactions?.length > 0) {
      setChatMessages(prev => [...prev, { role: 'assistant', action: 'create', transactions: result.transactions, source: 'ocr', text: `识别到 ${result.transactions.length} 笔记录` }])
    } else {
      setChatMessages(prev => [...prev, { role: 'assistant', transactions: [], source: 'ocr', text: '未识别到记录：' + (result.error || '请换张更清晰的截图') }])
    }
    setAiLoading(false)
  }

  function importAiTransactions(transactions) {
    if (onBatchImport) {
      onBatchImport(transactions)
    } else {
      transactions.forEach(t => onSave(t))
    }
  }

  // 保存 AI 对话到历史（同一条对话始终覆盖同一条记录）
  function saveAiHistory(msgs) {
    if (msgs.length === 0) return
    const history = JSON.parse(localStorage.getItem('ai_chat_history') || '[]')
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recent = history.filter(h => new Date(h.time).getTime() > sevenDaysAgo)
    const preview = msgs.find(m => m.role === 'user')?.text?.slice(0, 40) || 'AI对话'
    const now = Date.now()
    // 如果是继续已有对话 → 更新那条记录；否则新建
    const existingIdx = currentHistoryId ? recent.findIndex(h => h.id === currentHistoryId) : -1
    if (existingIdx >= 0) {
      recent[existingIdx].messages = msgs
      recent[existingIdx].preview = preview
      recent[existingIdx].time = new Date().toLocaleString('zh-CN')
      // 挪到最前面
      const [item] = recent.splice(existingIdx, 1)
      recent.unshift(item)
    } else {
      const id = 'h' + now
      setCurrentHistoryId(id)
      recent.unshift({ id, time: new Date().toLocaleString('zh-CN'), preview, messages: msgs })
    }
    if (recent.length > 50) recent.length = 50
    localStorage.setItem('ai_chat_history', JSON.stringify(recent))
  }

  function getAiHistory() {
    return JSON.parse(localStorage.getItem('ai_chat_history') || '[]')
  }

  function deleteAiHistory(id) {
    const history = getAiHistory().filter(h => h.id !== id)
    localStorage.setItem('ai_chat_history', JSON.stringify(history))
    // 触发刷新
    setShowAiHistory(false)
    setTimeout(() => setShowAiHistory(true), 0)
  }

  function loadAiHistory(h) {
    setChatMessages(h.messages)
    setCurrentHistoryId(h.id)
    setShowAiHistory(false)
    // 强制切到 AI 模式
    if (editTx) return
    setMode('ai')
  }

  // ===== 语音 =====
  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('当前浏览器不支持语音，请用 Chrome'); return }
    const r = new SR()
    r.lang = 'zh-CN'
    r.interimResults = false
    setListening(true)
    r.onresult = e => setAiInput(prev => prev + e.results[0][0].transcript)
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    r.start()
  }

  // ===== 批量导入 =====
  function handleBatchParse() {
    if (!batchText.trim()) return
    setBatchLoading(true)
    try {
      const isTabular = (batchText.includes(',') || batchText.includes('\t')) && batchText.split('\n')[0].split(/[,\t]/).length >= 3
      const results = isTabular ? parseCSV(batchText) : parseText(batchText)
      setBatchParsed(results)
      setBatchSelected(new Set(results.map((_, i) => i)))
    } finally { setBatchLoading(false) }
  }

  function handleBatchFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setBatchText(ev.target.result); setBatchParsed(null) }
    reader.readAsText(file, 'utf-8')
  }

  function doBatchImport() {
    const items = batchParsed.filter((_, i) => batchSelected.has(i))
    items.forEach(item => onSave({ ...item }))
    setShowBatchImport(false)
    setBatchText('')
    setBatchParsed(null)
  }

  // 自动保存 AI 对话历史
  useEffect(() => {
    if (chatMessages.length >= 2) saveAiHistory(chatMessages)
  }, [chatMessages])

  // 如果正在编辑已有记录，强制手动模式
  useEffect(() => { if (editTx) setMode('manual') }, [editTx])

  return (
    <div className="px-4 pt-6 pb-24" style={{ background: '#e8f5ee', minHeight: '100vh' }}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: '#0f3d24' }}>
          {editTx ? '编辑账单' : '记账'}
        </h1>
        <div className="flex items-center gap-2">
          {editTx && <button onClick={onCancel} className="text-sm" style={{ color: '#7ab894' }}>取消</button>}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-lg" style={{ color: '#9cbfab' }}>
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-xl py-1 shadow-lg z-20" style={{ background: '#fff', minWidth: '138px', border: '1px solid #e8f5ee' }}>
                <button onClick={() => { setShowBatchImport(true); setShowMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap" style={{ color: '#1a5c38' }}>
                  <FileText size={14} /> 粘贴文本导入
                </button>
                <button onClick={() => { batchFileRef.current?.click(); setShowMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap" style={{ color: '#1a5c38' }}>
                  <Upload size={14} /> 文件导入
                </button>
                <input ref={batchFileRef} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={handleBatchFile} />
                <button onClick={() => { setShowAiHistory(true); setShowMenu(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap" style={{ color: '#1a5c38' }}>
                  <MessageCircle size={14} /> AI记录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 模式切换 */}
      {!editTx && (
        <div className="flex rounded-xl p-1 mb-5" style={{ background: '#d4eddf' }}>
          <button className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={mode === 'manual' ? { background: '#fff', color: '#1a5c38' } : { color: '#7ab894' }}
            onClick={() => { setMode('manual'); setCurrentHistoryId(null) }}>手动记录</button>
          <button className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={mode === 'ai' ? { background: '#fff', color: '#1a5c38' } : { color: '#7ab894' }}
            onClick={() => { setMode('ai'); setCurrentHistoryId(null) }}>AI记录</button>
        </div>
      )}

      {/* ========== 手动记录 ========== */}
      {mode === 'manual' && (
        <>
          <div className="flex rounded-xl p-1 mb-5" style={{ background: '#d4eddf' }}>
            <button className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={type === 'expense' ? { background: '#fff', color: '#d97706' } : { color: '#7ab894' }}
              onClick={() => { setType('expense'); setTag(''); setSuperCat(''); setSuperEmoji('') }}>支出</button>
            <button className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={type === 'income' ? { background: '#fff', color: '#1a8c50' } : { color: '#7ab894' }}
              onClick={() => { setType('income'); setTag(''); setSuperCat(''); setSuperEmoji('') }}>收入</button>
          </div>

          <div className="space-y-3">
            <div className="p-4" style={card}>
              <p className="text-xs mb-2" style={{ color: '#9cbfab' }}>金额</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-light" style={{ color: '#9cbfab' }}>¥</span>
                <input type="text" inputMode="decimal" placeholder="0.00" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="text-3xl font-bold w-full outline-none bg-transparent"
                  style={{ color: '#0f3d24' }} />
              </div>
            </div>

            <div className="p-4" style={card}>
              <p className="text-xs mb-2" style={{ color: '#9cbfab' }}>分类</p>
              <button onClick={() => setShowPicker(true)} className="w-full flex items-center justify-between">
                {tag
                  ? <span className="font-medium" style={{ color: '#1a5c38' }}>{superEmoji} {superCat} · {tag}</span>
                  : <span style={{ color: '#c4dece' }}>点击选择分类</span>}
                <ChevronRight size={18} style={{ color: '#9cbfab' }} />
              </button>
            </div>

            <div className="p-4" style={card}>
              <p className="text-xs mb-2" style={{ color: '#9cbfab' }}>备注</p>
              <input type="text" placeholder="如：海底捞" value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full outline-none bg-transparent"
                style={{ color: '#0f3d24' }} />
            </div>

            <div className="p-4" style={card}>
              <p className="text-xs mb-2" style={{ color: '#9cbfab' }}>日期</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full outline-none bg-transparent"
                style={{ color: '#0f3d24' }} />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button onClick={handleSave}
              className="w-full py-4 text-white rounded-2xl font-semibold text-base"
              style={{ background: '#1a5c38' }}>
              {editTx ? '保存修改' : '记账'}
            </button>
          </div>

          {showPicker && (
            <CategoryPicker type={type} value={tag}
              onChange={(t, sc, se) => { setTag(t); setSuperCat(sc); setSuperEmoji(se) }}
              onClose={() => setShowPicker(false)} />
          )}
        </>
      )}

      {/* ========== AI 记录 ========== */}
      {mode === 'ai' && (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
          {/* 聊天区域 */}
          <div className="flex-1 overflow-y-auto mb-3 space-y-3" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            {chatMessages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm" style={{ color: '#9cbfab' }}>跟我说你的花销</p>
                <p className="text-xs mt-1" style={{ color: '#c4dece' }}>比如"午餐58元 打车30元"</p>
                <p className="text-xs mt-1" style={{ color: '#c4dece' }}>也可以上传账单截图</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? '' : ''}`}
                  style={msg.role === 'user'
                    ? { background: '#1a5c38', color: '#fff', borderBottomRightRadius: 4 }
                    : { background: '#fff', borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }}>
                  {msg.image && <img src={msg.image} alt="截图" className="max-h-40 max-w-full rounded-lg mb-2" />}
                  <p className="text-sm">{msg.text}</p>
                  {/* create — 新交易 */}
                  {msg.role === 'assistant' && msg.action === 'create' && msg.transactions?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.transactions.map((tx, j) => (
                        <div key={j} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#f5faf7' }}>
                          <span>{tx.superEmoji}</span>
                          <span className="text-xs font-medium" style={{ color: '#1a5c38' }}>{tx.tag}</span>
                          <span className="text-xs" style={{ color: '#9cbfab' }}>{tx.date}</span>
                          <span className="text-xs font-semibold ml-auto" style={{ color: tx.type === 'income' ? '#1a8c50' : '#d97706' }}>
                            {tx.type === 'income' ? '+' : '-'}¥{Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <button onClick={() => { importAiTransactions(msg.transactions); setChatMessages(prev => [...prev, { role: 'assistant', action: 'done', text: '✅ 已导入！' }]) }}
                        className="w-full mt-2 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#1a5c38' }}>
                        导入这 {msg.transactions.length} 条记录
                      </button>
                    </div>
                  )}

                  {/* modify — 修改账单 */}
                  {msg.role === 'assistant' && msg.action === 'modify' && msg.modifications?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.modifications.map((mod, j) => {
                        const original = (transactions || []).find(t => t.id === mod.id)
                        return (
                          <div key={j} className="p-2 rounded-lg text-xs" style={{ background: '#fff9ed', border: '1px solid #f0d78c' }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span>{original?.superEmoji}</span>
                              <span style={{ color: '#7ab894' }}>{original?.date} {original?.tag} ¥{original?.amount?.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1" style={{ color: '#d97706' }}>
                              <span>→</span>
                              {mod.changes.date && <span>日期:{mod.changes.date}</span>}
                              {mod.changes.tag && <span>分类:{mod.changes.tag}</span>}
                              {mod.changes.note && <span>备注:{mod.changes.note}</span>}
                              {mod.changes.amount && <span>金额:{mod.changes.amount}</span>}
                            </div>
                          </div>
                        )
                      })}
                      <button onClick={() => {
                        msg.modifications.forEach(mod => {
                          const tx = (transactions || []).find(t => t.id === mod.id)
                          if (tx) onUpdate(mod.id, { ...tx, ...mod.changes })
                        })
                        setChatMessages(prev => [...prev, { role: 'assistant', action: 'done', text: '✅ 已修改！' }])
                      }}
                        className="w-full mt-2 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#d97706' }}>
                        确认修改 {msg.modifications.length} 条记录
                      </button>
                    </div>
                  )}

                  {/* delete — 删除账单 */}
                  {msg.role === 'assistant' && msg.action === 'delete' && msg.matched?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.matched.map((tx, j) => (
                        <div key={j} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#fef2f2' }}>
                          <span>{tx.superEmoji}</span>
                          <span className="text-xs font-medium" style={{ color: '#c0392b' }}>{tx.tag}</span>
                          <span className="text-xs" style={{ color: '#9cbfab' }}>{tx.date}</span>
                          <span className="text-xs font-semibold ml-auto" style={{ color: '#c0392b' }}>
                            {tx.type === 'income' ? '+' : '-'}¥{Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <button onClick={() => {
                        msg.deleteIds.forEach(id => onDelete(id))
                        setChatMessages(prev => [...prev, { role: 'assistant', action: 'done', text: '✅ 已删除！' }])
                      }}
                        className="w-full mt-2 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#e74c3c' }}>
                        确认删除 {msg.matched.length} 条记录
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3" style={{ background: '#fff', borderBottomLeftRadius: 4 }}>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9cbfab', animationDelay: '0s' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9cbfab', animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#9cbfab', animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 输入栏 */}
          <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }}>
            <button onClick={() => imgRef.current?.click()} className="p-2 rounded-lg" style={{ color: '#9cbfab' }}>
              <Image size={20} />
            </button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) sendAiImage(e.target.files[0]); e.target.value = '' }} />
            <button onClick={startVoice} disabled={listening} className="p-2 rounded-lg" style={{ color: listening ? '#e74c3c' : '#9cbfab' }}>
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendAiMessage() }}
              placeholder="说说你的花销…" className="flex-1 outline-none text-sm bg-transparent" style={{ color: '#0f3d24' }} />
            <button onClick={sendAiMessage} disabled={!aiInput.trim() || aiLoading}
              className="p-2 rounded-lg" style={{ color: aiInput.trim() ? '#1a5c38' : '#c4dece' }}>
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      {/* ===== 批量导入弹窗 ===== */}
      {showBatchImport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(15,61,36,0.4)' }} onClick={() => setShowBatchImport(false)}>
          <div className="w-full max-w-[430px] rounded-t-3xl p-5 animate-slideUp" style={{ background: '#fff', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: '#0f3d24' }}>批量导入</h2>
              <button onClick={() => setShowBatchImport(false)}><X size={20} style={{ color: '#9cbfab' }} /></button>
            </div>
            <textarea value={batchText} onChange={e => { setBatchText(e.target.value); setBatchParsed(null) }}
              placeholder={`粘贴账单内容，或点右上角上传文件

2024-06-15 海底捞 238元 餐饮
打车 45.5 交通

也支持 CSV 或支付宝/微信账单导出文本`}
              rows={6} className="w-full outline-none resize-none text-sm rounded-xl p-3 mb-3"
              style={{ background: '#f5faf7', color: '#0f3d24', border: '1px solid #d4eddf' }} />
            <button onClick={handleBatchParse} disabled={!batchText.trim() || batchLoading}
              className="w-full py-3 rounded-xl font-semibold text-white mb-3 flex items-center justify-center gap-2"
              style={{ background: batchText.trim() ? '#1a5c38' : '#a8c4b0' }}>
              {batchLoading ? <><Loader size={16} className="animate-spin" /> 解析中…</> : '🔍 解析'}
            </button>

            {batchParsed !== null && batchParsed.length === 0 && (
              <p className="text-sm text-center" style={{ color: '#a8c4b0' }}>未识别到账单</p>
            )}
            {batchParsed?.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: '#0f3d24' }}>{batchParsed.length} 条记录</span>
                  <div className="flex gap-2">
                    <button onClick={() => setBatchSelected(new Set(batchParsed.map((_,i)=>i)))} className="text-xs px-2 py-1 rounded-lg" style={{background:'#e8f5ee', color:'#2d8a57'}}>全选</button>
                    <button onClick={() => setBatchSelected(new Set())} className="text-xs px-2 py-1 rounded-lg" style={{background:'#e8f5ee', color:'#2d8a57'}}>全不选</button>
                  </div>
                </div>
                <div className="space-y-1.5 mb-3 max-h-60 overflow-auto">
                  {batchParsed.map((item, i) => (
                    <div key={i} onClick={() => { const s = new Set(batchSelected); s.has(i) ? s.delete(i) : s.add(i); setBatchSelected(s) }}
                      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                      style={{ background: batchSelected.has(i) ? '#d4eddf' : '#f5faf7' }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: batchSelected.has(i) ? '#1a5c38' : '#d4eddf' }}>
                        {batchSelected.has(i) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <span>{item.superEmoji}</span>
                      <span className="text-xs font-medium" style={{ color: '#1a5c38' }}>{item.tag}</span>
                      <span className="text-xs ml-auto font-semibold" style={{ color: item.type === 'income' ? '#1a8c50' : '#d97706' }}>
                        {item.type === 'income' ? '+' : '-'}¥{Math.abs(item.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <button onClick={doBatchImport} disabled={batchSelected.size === 0}
                  className="w-full py-3 rounded-xl font-semibold text-white"
                  style={{ background: batchSelected.size > 0 ? '#1a5c38' : '#a8c4b0' }}>
                  导入选中的 {batchSelected.size} 条记录
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== AI 记录弹窗 ===== */}
      {showAiHistory && (() => {
        const history = getAiHistory()
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(15,61,36,0.4)' }} onClick={() => setShowAiHistory(false)}>
            <div className="w-full max-w-[430px] rounded-t-3xl p-5 animate-slideUp" style={{ background: '#fff', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: '#0f3d24' }}>AI 对话记录</h2>
                <button onClick={() => setShowAiHistory(false)}><X size={20} style={{ color: '#9cbfab' }} /></button>
              </div>
              {history.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm" style={{ color: '#9cbfab' }}>还没有 AI 对话记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50"
                      style={{ background: '#f5faf7', border: '1px solid #e8f5ee' }}>
                      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#e8f5ee' }}>
                        <MessageCircle size={18} style={{ color: '#1a5c38' }} />
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => loadAiHistory(h)}>
                        <p className="text-sm truncate" style={{ color: '#0f3d24' }}>{h.preview}</p>
                        <p className="text-xs" style={{ color: '#9cbfab' }}>
                          <Clock size={10} className="inline mr-1" />{h.time} · {h.messages.length} 条消息
                        </p>
                      </div>
                      <button onClick={() => deleteAiHistory(h.id)} className="p-1" style={{ color: '#9cbfab' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
