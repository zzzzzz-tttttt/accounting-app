import { useState, useRef, useEffect } from 'react'
import { getSuperCategory } from '../utils/categories'
import { formatAmount } from '../utils/formatters'

export default function TransactionItem({ tx, onEdit, onDelete }) {
  const { emoji } = getSuperCategory(tx.tag)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef()

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

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
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button onClick={() => setMenuOpen(!menuOpen)} className="px-2 py-1 rounded-lg text-lg leading-none" style={{color:'#9cbfab'}}>
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 rounded-xl py-1 shadow-lg z-10" style={{background:'#fff', minWidth:'80px', border:'1px solid #e8f5ee'}}>
            <button onClick={() => { onEdit(tx); setMenuOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50" style={{color:'#1a5c38'}}>
              ✏️ 编辑
            </button>
            <button onClick={() => { onDelete(tx.id); setMenuOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50" style={{color:'#e74c3c'}}>
              🗑️ 删除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
