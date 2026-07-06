import { useState, useRef, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import TabBar from './components/TabBar'
import HomePage from './components/HomePage'
import AddPage from './components/AddPage'
import BillPage from './components/BillPage'
import StatsPage from './components/StatsPage'
import SettingsModal from './components/SettingsModal'
import { useTransactions } from './hooks/useTransactions'
import { exportData, importData } from './utils/storage'
import { supabase } from './supabase'
import { Download, Upload, X, Key, LogOut } from 'lucide-react'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [tab, setTab] = useState('home')
  const [editTx, setEditTx] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState('')
  const { transactions, add, update, remove, loaded } = useTransactions()

  // 检查登录状态
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }
  const backupRef = useRef()

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function handleSave(tx) {
    if (tx.id && transactions.find(t => t.id === tx.id)) {
      update(tx.id, tx)
    } else {
      add(tx)
    }
    setEditTx(null)
    setTab('home')
  }

  function handleEdit(tx) {
    setEditTx(tx)
    setTab('add')
  }

  function handleDelete(id) {
    if (window.confirm('确认删除这条记录？')) remove(id)
  }

  function handleBatchImport(items) {
    items.forEach(item => add(item))
    showToast(`✅ 已导入 ${items.length} 条记录`)
  }

  async function handleExport() {
    await exportData()
    setShowMenu(false)
    showToast('📥 备份文件已下载')
  }

  async function handleImportBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const count = await importData(file)
      const list = await loadTransactions()
      // 强制刷新
      window.location.reload()
      showToast(`✅ 已恢复 ${count} 条记录`)
    } catch {
      showToast('❌ 文件格式有误')
    }
    e.target.value = ''
    setShowMenu(false)
  }

  if (!authChecked) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#e8f5ee' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div><p style={{ color: '#7ab894', fontSize: 14 }}>加载中...</p></div>
    </div>
  }

  if (!user) return <LoginPage onLogin={() => {}} />

  return (
    <div style={{background:'#e8f5ee', minHeight:'100vh', maxWidth:430, margin:'0 auto', position:'relative'}}>

      {/* 顶部菜单按钮（仅首页显示） */}
      {tab === 'home' && (
        <button
          onClick={() => setShowMenu(true)}
          style={{
            position:'fixed', top:20, right:20, zIndex:100,
            width:36, height:36, borderRadius:'50%',
            background:'#fff', boxShadow:'0 2px 8px rgba(26,92,56,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18, color:'#1a5c38'
          }}>⋯</button>
      )}

      {/* 备份菜单弹窗 */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showMenu && (
        <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(15,61,36,0.4)'}}
          onClick={() => setShowMenu(false)}>
          <div style={{
            position:'absolute', top:60, right:16,
            background:'#fff', borderRadius:16, overflow:'hidden',
            boxShadow:'0 8px 32px rgba(26,92,56,0.2)', minWidth:180
          }} onClick={e => e.stopPropagation()}>
            <div style={{padding:'12px 16px', borderBottom:'1px solid #e8f5ee'}}>
              <p style={{fontSize:12, color:'#9cbfab', margin:0}}>{user?.email || '已登录'}</p>
            </div>
            <button onClick={() => { setShowSettings(true); setShowMenu(false) }}
              style={{width:'100%', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer'}}>
              <Key size={18} color="#1a5c38" />
              <span style={{fontSize:14, color:'#1a5c38', fontWeight:500}}>API 设置</span>
            </button>
            <button onClick={handleExport}
              style={{width:'100%', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer'}}>
              <Download size={18} color="#1a5c38" />
              <span style={{fontSize:14, color:'#1a5c38', fontWeight:500}}>导出备份</span>
            </button>
            <button onClick={() => backupRef.current?.click()}
              style={{width:'100%', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer'}}>
              <Upload size={18} color="#1a5c38" />
              <span style={{fontSize:14, color:'#1a5c38', fontWeight:500}}>恢复备份</span>
            </button>
            <input ref={backupRef} type="file" accept=".json" style={{display:'none'}} onChange={handleImportBackup} />
            <div style={{borderTop:'1px solid #e8f5ee'}}>
              <button onClick={handleLogout}
                style={{width:'100%', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer'}}>
                <LogOut size={18} color="#c0392b" />
                <span style={{fontSize:14, color:'#c0392b', fontWeight:500}}>退出登录</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div style={{
          position:'fixed', top:70, left:'50%', transform:'translateX(-50%)',
          background:'#1a5c38', color:'#fff', padding:'8px 20px',
          borderRadius:24, fontSize:13, zIndex:300,
          boxShadow:'0 4px 16px rgba(26,92,56,0.3)', whiteSpace:'nowrap'
        }}>{toast}</div>
      )}

      {!loaded ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🌿</div>
            <p style={{color:'#7ab894',fontSize:14}}>加载中...</p>
          </div>
        </div>
      ) : (
        <>
          {tab === 'home' && <HomePage transactions={transactions} onAdd={() => { setEditTx(null); setTab('add') }} onEdit={handleEdit} onDelete={handleDelete} />}
          {tab === 'add' && <AddPage onSave={handleSave} editTx={editTx} onCancel={() => { setEditTx(null); setTab('home') }} transactions={transactions} onUpdate={update} onDelete={handleDelete} />}
          {tab === 'bill' && <BillPage transactions={transactions} onEdit={handleEdit} onDelete={handleDelete} />}
          {tab === 'stats' && <StatsPage transactions={transactions} />}
          <TabBar active={tab} onChange={(t) => { if (t !== 'add') setEditTx(null); setTab(t) }} />
        </>
      )}
    </div>
  )
}
