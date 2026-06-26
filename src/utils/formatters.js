export function formatAmount(amount) {
  return `¥${Math.abs(amount).toFixed(2)}`
}

export function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now - 86400000).toDateString()
  if (d.toDateString() === today) return "今天"
  if (d.toDateString() === yesterday) return "昨天"
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatFullDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getDateRange(period) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch(period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86400000 - 1) }
    case 'week': {
      const day = today.getDay() || 7
      const start = new Date(today.getTime() - (day - 1) * 86400000)
      return { start, end: new Date(today.getTime() + 86400000 - 1) }
    }
    case 'month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getTime() + 86400000 - 1) }
    case 'year':
      return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getTime() + 86400000 - 1) }
    default:
      return { start: new Date(0), end: new Date() }
  }
}
