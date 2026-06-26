import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { CATEGORIES } from '../utils/categories'
import { formatAmount } from '../utils/formatters'

const PERIODS = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' },
]

function getRange(period) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch(period) {
    case 'week': { const day = today.getDay()||7; return { start: new Date(today.getTime()-(day-1)*86400000), end: new Date(today.getTime()+86400000-1) } }
    case 'month': return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getTime()+86400000-1) }
    case 'year': return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getTime()+86400000-1) }
    default: return { start: new Date(0), end: new Date() }
  }
}

const CHART_COLORS = ['#1a5c38','#2d8a57','#3da66b','#5fd68a','#a8dbbe','#7ab894','#226b43','#c6e8d4','#0f3d24']

export default function StatsPage({ transactions }) {
  const [period, setPeriod] = useState('month')
  const [drillCat, setDrillCat] = useState(null)

  const { start, end } = getRange(period)
  const filtered = useMemo(() =>
    transactions.filter(tx => { const d = new Date(tx.date); return d >= start && d <= end }),
    [transactions, start, end]
  )

  const expenses = filtered.filter(t => t.type === 'expense')
  const totalExpense = expenses.reduce((s,t) => s+t.amount, 0)
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0)

  const barData = useMemo(() => {
    const map = {}
    expenses.forEach(tx => { map[tx.date] = (map[tx.date]||0) + tx.amount })
    const sorted = Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
    return { dates: sorted.map(([d]) => d.slice(5)), amounts: sorted.map(([,v]) => +v.toFixed(2)) }
  }, [expenses])

  const pieData = useMemo(() => {
    if (drillCat) {
      const map = {}
      expenses.filter(t => t.superCat === drillCat).forEach(tx => { map[tx.tag] = (map[tx.tag]||0) + tx.amount })
      return Object.entries(map).map(([name, value]) => ({ name, value: +value.toFixed(2) }))
    }
    const map = {}
    expenses.forEach(tx => { const sc = tx.superCat||'其他'; map[sc] = (map[sc]||0)+tx.amount })
    return Object.entries(map).map(([name, value]) => ({ name, value: +value.toFixed(2) }))
  }, [expenses, drillCat])

  const top5 = useMemo(() => {
    const map = {}
    expenses.forEach(tx => { const k = tx.superCat||'其他'; map[k] = (map[k]||0)+tx.amount })
    return Object.entries(map).sort(([,a],[,b]) => b-a).slice(0,5)
  }, [expenses])

  const barOption = {
    backgroundColor: 'transparent',
    grid: { left:10, right:10, top:20, bottom:20, containLabel:true },
    xAxis: { type:'category', data:barData.dates, axisLabel:{fontSize:10, color:'#9cbfab'}, axisTick:{show:false}, axisLine:{lineStyle:{color:'#d4eddf'}} },
    yAxis: { type:'value', axisLabel:{fontSize:10, color:'#9cbfab', formatter:v=>`¥${v}`}, splitLine:{lineStyle:{color:'#e8f5ee'}} },
    series: [{ type:'bar', data:barData.amounts, itemStyle:{color:'#1a5c38', borderRadius:[4,4,0,0]}, barMaxWidth:30 }],
    tooltip: { backgroundColor:'#fff', borderColor:'#d4eddf', textStyle:{color:'#1a5c38'}, formatter:p=>`${p.name}<br/>¥${Number(p.value).toFixed(2)}` }
  }

  const pieOption = {
    backgroundColor: 'transparent',
    color: CHART_COLORS,
    tooltip: { backgroundColor:'#fff', borderColor:'#d4eddf', textStyle:{color:'#1a5c38'}, formatter:p=>`${p.name}: ¥${p.value} (${p.percent}%)` },
    legend: { orient:'vertical', right:0, top:'middle', textStyle:{fontSize:10, color:'#2d8a57'}, itemWidth:10, itemHeight:10 },
    series: [{ type:'pie', radius:['40%','70%'], center:['35%','50%'], data:pieData, label:{show:false}, emphasis:{label:{show:true, fontSize:12, color:'#0f3d24'}} }]
  }

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }
  const activeBtn = { background: '#1a5c38', color: '#fff' }
  const inactiveBtn = { background: '#fff', color: '#7ab894' }

  return (
    <div className="px-4 pt-6 pb-24" style={{background:'#e8f5ee', minHeight:'100vh'}}>
      <h1 className="text-xl font-bold mb-4" style={{color:'#0f3d24'}}>统计分析</h1>

      <div className="flex gap-2 mb-4">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => { setPeriod(p.key); setDrillCat(null) }}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={period === p.key ? activeBtn : inactiveBtn}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label:'支出', value: totalExpense, color:'#d97706' },
          { label:'收入', value: totalIncome, color:'#1a8c50' },
          { label:'结余', value: totalIncome-totalExpense, color:'#1a5c38' },
        ].map(({label, value, color}) => (
          <div key={label} className="p-3 text-center" style={card}>
            <p className="text-xs mb-1" style={{color:'#9cbfab'}}>{label}</p>
            <p className="font-bold text-sm" style={{color}}>{formatAmount(value)}</p>
          </div>
        ))}
      </div>

      {barData.dates.length > 0 && (
        <div className="p-4 mb-4" style={card}>
          <p className="text-sm font-semibold mb-2" style={{color:'#0f3d24'}}>支出趋势</p>
          <ReactECharts option={barOption} style={{height:160}} />
        </div>
      )}

      {pieData.length > 0 && (
        <div className="p-4 mb-4" style={card}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold" style={{color:'#0f3d24'}}>{drillCat ? `${drillCat} 明细` : '支出分类占比'}</p>
            {drillCat && <button onClick={() => setDrillCat(null)} className="text-xs" style={{color:'#2d8a57'}}>← 返回</button>}
          </div>
          {!drillCat && <p className="text-xs mb-1" style={{color:'#9cbfab'}}>点击饼图下钻分类明细</p>}
          <ReactECharts option={pieOption} style={{height:180}}
            onEvents={{'click': params => { if (!drillCat && CATEGORIES[params.name]) setDrillCat(params.name) }}} />
        </div>
      )}

      {top5.length > 0 && (
        <div className="p-4" style={card}>
          <p className="text-sm font-semibold mb-3" style={{color:'#0f3d24'}}>支出排行 TOP5</p>
          <div className="space-y-3">
            {top5.map(([name, amount], i) => {
              const pct = totalExpense ? (amount/totalExpense*100).toFixed(0) : 0
              const catEmoji = Object.entries(CATEGORIES).find(([k]) => k === name)?.[1]?.emoji || '📌'
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-sm w-4" style={{color:'#9cbfab'}}>{i+1}</span>
                  <span className="text-base">{catEmoji}</span>
                  <span className="text-sm flex-1" style={{color:'#1a5c38'}}>{name}</span>
                  <div className="w-20 rounded-full h-1.5 overflow-hidden" style={{background:'#e8f5ee'}}>
                    <div className="h-full rounded-full" style={{width:`${pct}%`, background:'#1a5c38'}} />
                  </div>
                  <span className="text-sm font-medium w-16 text-right" style={{color:'#0f3d24'}}>{formatAmount(amount)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-16 text-center" style={{color:'#a8c4b0'}}>
          <p className="text-4xl mb-2">📊</p>
          <p className="text-sm">暂无数据</p>
        </div>
      )}
    </div>
  )
}
