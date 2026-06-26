import { useState, useEffect, useCallback } from 'react'
import { loadTransactions, saveTransaction, deleteTransaction as dbDelete } from '../utils/storage'

export function useTransactions() {
  const [transactions, setTransactions] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadTransactions().then(list => {
      setTransactions(list)
      setLoaded(true)
    })
  }, [])

  const add = useCallback(async (txData) => {
    const tx = {
      ...txData,
      id: txData.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      createdAt: txData.createdAt || new Date().toISOString()
    }
    await saveTransaction(tx)
    setTransactions(prev => [tx, ...prev].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)))
    return tx
  }, [])

  const update = useCallback(async (id, updates) => {
    setTransactions(prev => {
      const list = prev.map(t => t.id === id ? { ...t, ...updates } : t)
      const updated = list.find(t => t.id === id)
      if (updated) saveTransaction(updated)
      return list
    })
  }, [])

  const remove = useCallback(async (id) => {
    await dbDelete(id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }, [])

  return { transactions, add, update, remove, loaded }
}
