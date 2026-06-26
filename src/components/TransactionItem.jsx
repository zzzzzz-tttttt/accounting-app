import { getSuperCategory } from '../utils/categories'
import { formatAmount } from '../utils/formatters'

export default function TransactionItem({ tx, onEdit, onDelete }) {
  const { emoji } = getSuperCategory(tx.tag)

  return (
    <div className="flex items-center gap-3 py-3 px-1">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{background:'#e8f5ee'}}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm" style={{color:'#1a5c38'}}>{tx.tag}</span>
        {tx.note && <p className="text-xs truncate" style={{color:'#7ab894'}}>{tx.note}</p>}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className={`font-semibold text-sm`} style={{color: tx.type === 'income' ? '#1a8c50' : '#0f3d24'}}>
          {tx.type === 'income' ? '+' : '-'}{formatAmount(tx.amount)}
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
        <button onClick={() => onEdit(tx)} className="text-xs" style={{color:'#2d8a57'}}>编辑</button>
        <button onClick={() => onDelete(tx.id)} className="text-xs text-red-400">删除</button>
      </div>
    </div>
  )
}
