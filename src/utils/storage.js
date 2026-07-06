import { supabase } from '../supabase'

const TABLE = 'transactions'

// 获取当前登录用户的 ID
async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id || null
}

// ===== 从 Supabase 加载 =====
export async function loadTransactions() {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('date', { ascending: false })

    if (error) throw error

    // 检查本地降级数据，尝试重新上传
    const fallback = loadFallback()
    if (fallback.length > 0) {
      const userId = await getUserId()
      const toUpload = fallback.map(tx => ({ ...tx, user_id: userId }))
      try { await supabase.from(TABLE).upsert(toUpload) } catch {}
      clearFallback()
    }

    // 首次加载，尝试从旧 IndexedDB 迁移
    if (data.length === 0) {
      const old = await loadFromIndexedDB()
      if (old.length > 0) {
        const userId = await getUserId()
        const migrated = old.map(tx => ({ ...tx, user_id: userId }))
        await supabase.from(TABLE).upsert(migrated)
        return old
      }
    }

    // 合并 fallback 数据（去重）
    const merged = [...data]
    for (const fb of fallback) {
      if (!merged.find(t => t.id === fb.id)) merged.unshift(fb)
    }
    return merged
  } catch (err) {
    console.error('Supabase 加载失败，尝试本地降级:', err.message)
    const fb = loadFallback()
    return fb.length > 0 ? fb : await loadFromIndexedDB()
  }
}

// 从旧 IndexedDB 加载（降级 / 迁移用）
async function loadFromIndexedDB() {
  try {
    return new Promise((resolve) => {
      const req = indexedDB.open('accounting_db', 1)
      req.onsuccess = e => {
        const db = e.target.result
        if (db.objectStoreNames.contains('transactions')) {
          const tx = db.transaction('transactions', 'readonly')
          const r = tx.objectStore('transactions').getAll()
          r.onsuccess = () => resolve(r.result.sort((a, b) => b.date.localeCompare(a.date)))
          r.onerror = () => resolve([])
        } else resolve([])
      }
      req.onerror = () => {
        try { resolve(JSON.parse(localStorage.getItem('transactions') || '[]')) } catch { resolve([]) }
      }
      req.onupgradeneeded = () => {} // 不创建，只是读
    })
  } catch {
    try { return JSON.parse(localStorage.getItem('transactions') || '[]') } catch { return [] }
  }
}

// 本地降级存储
function loadFallback() {
  try { return JSON.parse(localStorage.getItem('transactions_fallback') || '[]') } catch { return [] }
}
function clearFallback() {
  localStorage.removeItem('transactions_fallback')
}

// ===== 保存 =====
export async function saveTransaction(tx) {
  const userId = await getUserId()
  const record = { ...tx, user_id: userId }
  try {
    const { error } = await supabase.from(TABLE).upsert(record)
    if (error) throw error
  } catch (err) {
    console.error('Supabase 保存失败:', err.message)
    // 降级到 localStorage
    const list = JSON.parse(localStorage.getItem('transactions_fallback') || '[]')
    const idx = list.findIndex(t => t.id === tx.id)
    idx >= 0 ? list.splice(idx, 1, tx) : list.unshift(tx)
    localStorage.setItem('transactions_fallback', JSON.stringify(list))
  }
}

// ===== 删除 =====
export async function deleteTransaction(id) {
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  } catch (err) {
    console.error('Supabase 删除失败:', err.message)
    const list = JSON.parse(localStorage.getItem('transactions_fallback') || '[]')
    localStorage.setItem('transactions_fallback', JSON.stringify(list.filter(t => t.id !== id)))
  }
}

// ===== 导出备份 =====
export async function exportData() {
  const list = await loadTransactions()
  const json = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), transactions: list }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `记账备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ===== 从文件恢复 =====
export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async e => {
      try {
        const data = JSON.parse(e.target.result)
        const list = data.transactions || data
        for (const tx of list) {
          await saveTransaction({ ...tx })
        }
        resolve(list.length)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
