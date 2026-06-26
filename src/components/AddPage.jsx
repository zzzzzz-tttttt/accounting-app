import { useState } from 'react'
import CategoryPicker from './CategoryPicker'
import { ChevronRight } from 'lucide-react'

export default function AddPage({ onSave, editTx, onCancel }) {
  const [type, setType] = useState(editTx?.type || 'expense')
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : '')
  const [date, setDate] = useState(editTx?.date || new Date().toISOString().split('T')[0])
  const [tag, setTag] = useState(editTx?.tag || '')
  const [superCat, setSuperCat] = useState(editTx?.superCat || '')
  const [superEmoji, setSuperEmoji] = useState(editTx?.superEmoji || '')
  const [note, setNote] = useState(editTx?.note || '')
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState('')

  function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('请输入有效金额'); return }
    if (!tag) { setError('请选择分类'); return }
    setError('')
    onSave({ type, amount: Number(amount), date, tag, superCat, superEmoji, note, ...(editTx ? { id: editTx.id } : {}) })
  }

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(26,92,56,0.06)' }

  return (
    <div className="px-4 pt-6 pb-24" style={{background:'#e8f5ee', minHeight:'100vh'}}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{color:'#0f3d24'}}>{editTx ? '编辑账单' : '记一笔'}</h1>
        {editTx && <button onClick={onCancel} className="text-sm" style={{color:'#7ab894'}}>取消</button>}
      </div>

      {/* 收支切换 */}
      <div className="flex rounded-xl p-1 mb-5" style={{background:'#d4eddf'}}>
        <button
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
          style={type === 'expense' ? {background:'#fff', color:'#d97706'} : {color:'#7ab894'}}
          onClick={() => { setType('expense'); setTag(''); setSuperCat(''); setSuperEmoji('') }}
        >支出</button>
        <button
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
          style={type === 'income' ? {background:'#fff', color:'#1a8c50'} : {color:'#7ab894'}}
          onClick={() => { setType('income'); setTag(''); setSuperCat(''); setSuperEmoji('') }}
        >收入</button>
      </div>

      <div className="space-y-3">
        <div className="p-4" style={card}>
          <p className="text-xs mb-2" style={{color:'#9cbfab'}}>金额</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-light" style={{color:'#9cbfab'}}>¥</span>
            <input type="number" inputMode="decimal" placeholder="0.00" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-3xl font-bold w-full outline-none bg-transparent"
              style={{color:'#0f3d24'}} />
          </div>
        </div>

        <div className="p-4" style={card}>
          <p className="text-xs mb-2" style={{color:'#9cbfab'}}>分类</p>
          <button onClick={() => setShowPicker(true)} className="w-full flex items-center justify-between">
            {tag
              ? <span className="font-medium" style={{color:'#1a5c38'}}>{superEmoji} {superCat} · {tag}</span>
              : <span style={{color:'#c4dece'}}>点击选择分类</span>}
            <ChevronRight size={18} style={{color:'#9cbfab'}} />
          </button>
        </div>

        <div className="p-4" style={card}>
          <p className="text-xs mb-2" style={{color:'#9cbfab'}}>备注</p>
          <input type="text" placeholder="如：海底捞" value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full outline-none bg-transparent"
            style={{color:'#0f3d24'}} />
        </div>

        <div className="p-4" style={card}>
          <p className="text-xs mb-2" style={{color:'#9cbfab'}}>日期</p>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full outline-none bg-transparent"
            style={{color:'#0f3d24'}} />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button onClick={handleSave}
          className="w-full py-4 text-white rounded-2xl font-semibold text-base"
          style={{background:'#1a5c38'}}>
          {editTx ? '保存修改' : '记账'}
        </button>
      </div>

      {showPicker && (
        <CategoryPicker type={type} value={tag}
          onChange={(t, sc, se) => { setTag(t); setSuperCat(sc); setSuperEmoji(se) }}
          onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}
