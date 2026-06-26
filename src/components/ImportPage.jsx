import { useState, useRef } from 'react'
import { Upload, Loader, CheckCircle, XCircle, Image, FileText } from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { CATEGORIES, INCOME_CATEGORIES } from '../utils/categories'

const ALL_TAGS = [
  ...Object.entries(CATEGORIES).flatMap(([superCat, d]) => d.tags.map(tag => ({ tag, superCat, emoji: d.emoji }))),
  ...Object.entries(INCOME_CATEGORIES).flatMap(([superCat, d]) => d.tags.map(tag => ({ tag, superCat, emoji: d.emoji })))
]

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
    const typeCol = headers.find(h => /类型|type|收支/.test(h))
    const type = guessType(row[typeCol] || note)
    const tag = guessTag(cols.join(' ') + ' ' + note)
    results.push({ date, amount, type, tag: tag.tag, superCat: tag.superCat, superEmoji: tag.emoji, note })
  }
  return results
}

// 图片转 base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 服务端 AI 识别（走 pod 上的代理服务）
async function ocrWithServer(base64, mimeType) {
  try {
    const res = await fetch(`http://10.40.123.165:8099/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType }),
      signal: AbortSignal.timeout(20000)
    })
    return await res.json()
  } catch {
    return { ok: false, fallback: true }
  }
}

// Tesseract.js 本地 OCR
async function ocrWithTesseract(imageFile, onProgress) {
  const worker = await createWorker('chi_sim+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100))
      }
    }
  })
  const { data: { text } } = await worker.recognize(imageFile)
  await worker.terminate()
  return text
}

export default function ImportPage({ onImport }) {
  const [mode, setMode] = useState('text') // 'text' | 'image'
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [selected, setSelected] = useState(new Set())
  const [done, setDone] = useState(false)
  const fileRef = useRef()
  const imgRef = useRef()

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }
  const activeBtn = { background: '#1a5c38', color: '#fff' }
  const inactiveBtn = { background: '#e8f5ee', color: '#7ab894' }

  function handleTextFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setText(ev.target.result); setParsed(null); setDone(false) }
    reader.readAsText(file, 'utf-8')
  }

  function handleImageFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setParsed(null)
    setDone(false)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  async function handleParseText() {
    if (!text.trim()) return
    setLoading(true); setDone(false)
    try {
      const isTabular = (text.includes(',') || text.includes('\t')) && text.split('\n')[0].split(/[,\t]/).length >= 3
      const results = isTabular ? parseCSV(text) : parseText(text)
      setParsed(results)
      setSelected(new Set(results.map((_, i) => i)))
    } finally {
      setLoading(false)
    }
  }

  async function handleParseImage() {
    if (!imageFile) return
    setLoading(true); setDone(false); setOcrProgress(0)
    try {
      // 先尝试服务端 AI 识别
      setLoadingMsg('正在用 AI 识别图片...')
      const base64 = await fileToBase64(imageFile)
      const serverResult = await ocrWithServer(base64, imageFile.type)

      let ocrText = ''
      if (serverResult.ok && serverResult.text) {
        ocrText = serverResult.text
        setLoadingMsg('AI 识别完成，解析中...')
      } else {
        // 降级到 Tesseract
        setLoadingMsg('正在本地 OCR 识别...')
        ocrText = await ocrWithTesseract(imageFile, p => {
          setOcrProgress(p)
          setLoadingMsg(`本地 OCR 识别中 ${p}%...`)
        })
      }

      const results = parseText(ocrText)
      setParsed(results)
      setSelected(new Set(results.map((_, i) => i)))
    } finally {
      setLoading(false); setLoadingMsg(''); setOcrProgress(0)
    }
  }

  function toggleSelect(i) {
    const s = new Set(selected)
    s.has(i) ? s.delete(i) : s.add(i)
    setSelected(s)
  }

  function handleImport() {
    onImport(parsed.filter((_, i) => selected.has(i)))
    setDone(true); setParsed(null); setText(''); setImageFile(null); setImagePreview(null); setSelected(new Set())
  }

  return (
    <div className="px-4 pt-6 pb-24" style={{background:'#e8f5ee', minHeight:'100vh'}}>
      <h1 className="text-xl font-bold mb-1" style={{color:'#0f3d24'}}>批量导入</h1>
      <p className="text-sm mb-4" style={{color:'#7ab894'}}>支持文本、CSV 文件、账单截图</p>

      {done && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{background:'#d4eddf'}}>
          <CheckCircle size={18} style={{color:'#1a8c50'}} />
          <span className="text-sm font-medium" style={{color:'#1a5c38'}}>导入成功！</span>
        </div>
      )}

      {/* 模式切换 */}
      <div className="flex rounded-xl p-1 mb-4" style={{background:'#d4eddf'}}>
        <button className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition-all"
          style={mode === 'text' ? {background:'#fff', color:'#1a5c38'} : {color:'#7ab894'}}
          onClick={() => { setMode('text'); setParsed(null) }}>
          <FileText size={14} /> 粘贴文本
        </button>
        <button className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition-all"
          style={mode === 'image' ? {background:'#fff', color:'#1a5c38'} : {color:'#7ab894'}}
          onClick={() => { setMode('image'); setParsed(null) }}>
          <Image size={14} /> 截图识别
        </button>
      </div>

      {/* 文本模式 */}
      {mode === 'text' && (
        <div className="rounded-2xl p-4 mb-3" style={card}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{color:'#9cbfab'}}>粘贴账单内容</p>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{background:'#e8f5ee', color:'#2d8a57'}}>
              <Upload size={12} /> 上传文件
            </button>
            <input ref={fileRef} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={handleTextFile} />
          </div>
          <textarea value={text} onChange={e => { setText(e.target.value); setParsed(null); setDone(false) }}
            placeholder={`粘贴任意格式账单，例如：\n\n2024-06-15 海底捞 238元 餐饮\n打车 45.5 交通\n工资 8000 收入\n\n也支持 CSV 或支付宝/微信账单导出文本`}
            rows={7} className="w-full outline-none resize-none text-sm rounded-xl p-3"
            style={{background:'#f5faf7', color:'#0f3d24', border:'1px solid #d4eddf'}} />
        </div>
      )}

      {/* 图片模式 */}
      {mode === 'image' && (
        <div className="rounded-2xl p-4 mb-3" style={card}>
          <p className="text-xs mb-3" style={{color:'#9cbfab'}}>上传账单截图（支付宝、微信、银行账单）</p>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="预览" className="w-full rounded-xl object-contain max-h-64" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); setParsed(null); imgRef.current.value='' }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                style={{background:'rgba(0,0,0,0.5)'}}>✕</button>
            </div>
          ) : (
            <button onClick={() => imgRef.current?.click()}
              className="w-full h-36 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
              style={{background:'#f5faf7', border:'2px dashed #d4eddf'}}>
              <Image size={32} style={{color:'#a8c4b0'}} />
              <span className="text-sm" style={{color:'#a8c4b0'}}>点击上传截图</span>
              <span className="text-xs" style={{color:'#c4dece'}}>支持 JPG、PNG、WEBP</span>
            </button>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

          {loading && ocrProgress > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{color:'#7ab894'}}>
                <span>{loadingMsg}</span><span>{ocrProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{background:'#e8f5ee'}}>
                <div className="h-full rounded-full transition-all" style={{width:`${ocrProgress}%`, background:'#1a5c38'}} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 识别按钮 */}
      <button
        onClick={mode === 'text' ? handleParseText : handleParseImage}
        disabled={mode === 'text' ? (!text.trim() || loading) : (!imageFile || loading)}
        className="w-full py-3 rounded-2xl font-semibold text-white mb-4 flex items-center justify-center gap-2"
        style={{background: (mode==='text' ? text.trim() : imageFile) ? '#1a5c38' : '#a8c4b0'}}>
        {loading
          ? <><Loader size={16} className="animate-spin" /> {loadingMsg || '识别中...'}</>
          : mode === 'text' ? '🔍 智能识别' : '📸 识别截图'}
      </button>

      {/* 解析结果 */}
      {parsed !== null && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{color:'#0f3d24'}}>识别到 {parsed.length} 条记录</p>
            {parsed.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set(parsed.map((_,i)=>i)))}
                  className="text-xs px-2 py-1 rounded-lg" style={{background:'#e8f5ee', color:'#2d8a57'}}>全选</button>
                <button onClick={() => setSelected(new Set())}
                  className="text-xs px-2 py-1 rounded-lg" style={{background:'#e8f5ee', color:'#2d8a57'}}>全不选</button>
              </div>
            )}
          </div>

          {parsed.length === 0 ? (
            <div className="py-8 text-center rounded-2xl" style={card}>
              <XCircle size={32} className="mx-auto mb-2" style={{color:'#a8c4b0'}} />
              <p className="text-sm" style={{color:'#a8c4b0'}}>未识别到账单，请尝试图片更清晰或手动粘贴文本</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {parsed.map((item, i) => (
                  <div key={i} onClick={() => toggleSelect(i)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                    style={{ background: selected.has(i) ? '#d4eddf' : '#fff', border:`1px solid ${selected.has(i) ? '#2d8a57' : '#e8f5ee'}` }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{background: selected.has(i) ? '#1a5c38' : '#d4eddf'}}>
                      {selected.has(i) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className="text-lg">{item.superEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{color:'#1a5c38'}}>{item.tag}</span>
                        <span className="text-xs" style={{color:'#9cbfab'}}>{item.date}</span>
                      </div>
                      {item.note && <p className="text-xs truncate" style={{color:'#7ab894'}}>{item.note}</p>}
                    </div>
                    <span className="font-semibold text-sm" style={{color: item.type==='income'?'#1a8c50':'#0f3d24'}}>
                      {item.type==='income'?'+':'-'}¥{item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              {selected.size > 0 && (
                <button onClick={handleImport} className="w-full py-4 rounded-2xl font-semibold text-white"
                  style={{background:'#1a5c38'}}>
                  导入选中的 {selected.size} 条记录
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
