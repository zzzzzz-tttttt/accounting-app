// IndexedDB 封装
const DB_NAME = 'accounting_db'
const DB_VERSION = 1
const STORE = 'transactions'

let _db = null

async function getDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('date', 'date', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
    }
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror = () => reject(req.error)
  })
}

export async function loadTransactions() {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)))
      req.onerror = () => reject(req.error)
    })
  } catch {
    // 降级到 localStorage
    try { return JSON.parse(localStorage.getItem('transactions') || '[]') } catch { return [] }
  }
}

export async function saveTransaction(tx) {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite')
      const req = t.objectStore(STORE).put(tx)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // 降级到 localStorage
    const list = JSON.parse(localStorage.getItem('transactions') || '[]')
    const idx = list.findIndex(t => t.id === tx.id)
    idx >= 0 ? list.splice(idx, 1, tx) : list.unshift(tx)
    localStorage.setItem('transactions', JSON.stringify(list))
  }
}

export async function deleteTransaction(id) {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readwrite')
      const req = t.objectStore(STORE).delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    const list = JSON.parse(localStorage.getItem('transactions') || '[]')
    localStorage.setItem('transactions', JSON.stringify(list.filter(t => t.id !== id)))
  }
}

// 导出全部数据为 JSON 文件
export async function exportData() {
  const list = await loadTransactions()
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), transactions: list }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `记账备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 从 JSON 文件恢复数据
export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async e => {
      try {
        const data = JSON.parse(e.target.result)
        const list = data.transactions || data // 兼容旧格式
        for (const tx of list) await saveTransaction(tx)
        resolve(list.length)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
