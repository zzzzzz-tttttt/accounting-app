import { useState, useMemo } from 'react'
import { formatAmount, formatDate } from '../utils/formatters'
import { CATEGORIES } from '../utils/categories'
import TransactionItem from './TransactionItem'
import { Filter } from 'lucide-react'

const PERIODS = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
]

function getRange(period, customStart, customEnd) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch(period) {
    case 'today': return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
    case 'week': { const day = today.getDay()||7; return { start: new Date(today.getTime()-(day-1)*86400000), end: new Date(today.getTime()+86400000-1) } }
    case 'month': return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getTime()+86400000-1) }
    case 'year': return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getTime()+86400000-1) }
    case 'custom': return { start: customStart ? new Date(customStart) : new Date(0), end: customEnd ? new Date(new Date(customEnd).getTime()+86400000-1) : new Date() }
    default: return { start: new Date(0), end: new Date() }
  }
}

export default function BillPage({ transactions, onEdit, onDelete }) {
  const [period, setPeriod] = useState('month')
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const { start, end } = getRange(period, customStart, customEnd)
    return transactions.filter(tx => {
      const d = new Date(tx.date)
      if (d < start || d > end) return false
      if (filterCat && tx.superCat !== filterCat) return false
      if (filterType !== 'all' && tx.type !== filterType) return false
      if (keyword && !tx.note?.includes(keyword) && !tx.tag?.includes(keyword)) return false
      return true
    })
  }, [transactions, period, filterCat, filterType, customStart, customEnd, keyword])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(tx => { if (!map[tx.date]) map[tx.date] = []; map[tx.date].push(tx) })
    return Object.entries(map).sort(([a],[b]) => b.localeCompare(a))
  }, [filtered])

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0)

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }
  const activeBtn = { background: '#1a5c38', color: '#fff' }
  const inactiveBtn = { background: '#fff', color: '#7ab894' }

  return (
    <div className="px-4 pt-6 pb-24" style={{background:'#e8f5ee', minHeight:'100vh'}}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{color:'#0f3d24'}}>账单</h1>
        <button onClick={() => setShowFilter(!showFilter)} className="p-2 rounded-xl" style={{background:'#fff'}}>
          <Filter size={18} style={{color: showFilter ? '#1a5c38' : '#9cbfab'}} />
        </button>
      </div>

      {/* 时间筛选 */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={period === p.key ? activeBtn : inactiveBtn}>
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex gap-2 mb-3">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{background:'#fff', color:'#0f3d24'}} />
          <span className="self-center" style={{color:'#9cbfab'}}>至</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{background:'#fff', color:'#0f3d24'}} />
        </div>
      )}

      {/* 筛选面板 */}
      {showFilter && (
        <div className="rounded-2xl p-4 mb-3 space-y-3" style={card}>
          <div>
            <p className="text-xs mb-2" style={{color:'#9cbfab'}}>收支类型</p>
            <div className="flex gap-2">
              {[['all','全部'],['expense','支出'],['income','收入']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterType(v)}
                  className="px-3 py-1 rounded-full text-sm"
                  style={filterType === v ? activeBtn : {background:'#e8f5ee', color:'#2d8a57'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs mb-2" style={{color:'#9cbfab'}}>大类筛选</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterCat('')}
                className="px-3 py-1 rounded-full text-sm"
                style={!filterCat ? activeBtn : {background:'#e8f5ee', color:'#2d8a57'}}>全部</button>
              {Object.entries(CATEGORIES).map(([name, d]) => (
                <button key={name} onClick={() => setFilterCat(name)}
                  className="px-3 py-1 rounded-full text-sm"
                  style={filterCat === name ? activeBtn : {background:'#e8f5ee', color:'#2d8a57'}}>
                  {d.emoji} {name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs mb-2" style={{color:'#9cbfab'}}>搜索</p>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="备注/标签关键词..."
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{background:'#e8f5ee', color:'#0f3d24'}} />
          </div>
        </div>
      )}

      {/* 汇总 */}
      <div className="flex gap-2 mb-4">
        {[
          { label:'支出', value: totalExpense, color:'#d97706' },
          { label:'收入', value: totalIncome, color:'#1a8c50' },
          { label:'结余', value: totalIncome - totalExpense, color:'#1a5c38' },
        ].map(({label, value, color}) => (
          <div key={label} className="flex-1 p-3 text-center rounded-2xl" style={card}>
            <p className="text-xs mb-1" style={{color:'#9cbfab'}}>{label}</p>
            <p className="font-bold text-sm" style={{color}}>{formatAmount(value)}</p>
          </div>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="py-16 text-center" style={{color:'#a8c4b0'}}>
          <p className="text-4xl mb-2">📭</p>
          <p className="text-sm">暂无账单记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([date, txs]) => {
            const dayExpense = txs.filter(t => t.type==='expense').reduce((s,t)=>s+t.amount,0)
            const dayIncome = txs.filter(t => t.type==='income').reduce((s,t)=>s+t.amount,0)
            return (
              <div key={date} className="rounded-2xl px-4" style={card}>
                <div className="flex items-center justify-between py-2" style={{borderBottom:'1px solid #e8f5ee'}}>
                  <span className="text-sm font-medium" style={{color:'#7ab894'}}>{formatDate(date)}</span>
                  <div className="flex gap-3 text-xs">
                    {dayIncome > 0 && <span style={{color:'#1a8c50'}}>+{formatAmount(dayIncome)}</span>}
                    {dayExpense > 0 && <span style={{color:'#d97706'}}>-{formatAmount(dayExpense)}</span>}
                  </div>
                </div>
                <div>
                  {txs.map((tx, i) => (
                    <div key={tx.id} style={i > 0 ? {borderTop:'1px solid #e8f5ee'} : {}}>
                      <TransactionItem tx={tx} onEdit={onEdit} onDelete={onDelete} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
