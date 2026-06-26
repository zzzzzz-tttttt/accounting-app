import { useMemo } from 'react'
import { formatAmount, formatDate } from '../utils/formatters'
import TransactionItem from './TransactionItem'

export default function HomePage({ transactions, onAdd, onEdit, onDelete }) {
  const today = new Date().toDateString()

  const todayTxs = useMemo(() =>
    transactions.filter(tx => new Date(tx.date).toDateString() === today),
    [transactions, today]
  )

  const todayIncome = todayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const todayExpense = todayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const recent = transactions.slice(0, 5)

  return (
    <div className="px-4 pt-6 pb-24" style={{background:'#e8f5ee', minHeight:'100vh'}}>
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm mb-0.5" style={{color:'#4a8a65'}}>今日概览</p>
          <p className="font-bold text-xl" style={{color:'#0f3d24'}}>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={onAdd}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl shadow-lg"
          style={{background:'#1a5c38'}}
        >
          +
        </button>
      </div>

      {/* 今日净额卡片 */}
      <div className="rounded-2xl p-5 text-white mb-5 shadow-sm" style={{background:'linear-gradient(135deg, #1a5c38, #2d8a57)'}}>
        <p className="text-sm mb-2" style={{color:'#a8dbbe'}}>今日净额</p>
        <p className="text-3xl font-bold mb-4">
          {todayIncome - todayExpense >= 0 ? '+' : ''}{formatAmount(todayIncome - todayExpense)}
        </p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs mb-0.5" style={{color:'#a8dbbe'}}>收入</p>
            <p className="text-lg font-semibold" style={{color:'#a8f0c6'}}>+{formatAmount(todayIncome)}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{color:'#a8dbbe'}}>支出</p>
            <p className="text-lg font-semibold" style={{color:'#fde68a'}}>-{formatAmount(todayExpense)}</p>
          </div>
        </div>
      </div>

      {/* 最近记录 */}
      <div className="rounded-2xl p-4 shadow-sm" style={{background:'#fff'}}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold" style={{color:'#0f3d24'}}>最近记录</span>
        </div>
        {recent.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-4xl mb-2">📝</p>
            <p className="text-sm" style={{color:'#a8c4b0'}}>点击右上角「+」开始记账</p>
          </div>
        ) : (
          <div>
            {recent.map((tx, i) => (
              <div key={tx.id} style={i > 0 ? {borderTop:'1px solid #e8f5ee'} : {}}>
                <TransactionItem tx={tx} onEdit={onEdit} onDelete={onDelete} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
