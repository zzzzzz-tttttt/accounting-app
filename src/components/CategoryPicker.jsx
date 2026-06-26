import { CATEGORIES, INCOME_CATEGORIES } from '../utils/categories'
import { X } from 'lucide-react'
import { useState } from 'react'

export default function CategoryPicker({ type, value, onChange, onClose }) {
  const [expanded, setExpanded] = useState(null)
  const cats = type === 'income' ? INCOME_CATEGORIES : CATEGORIES

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{background:'rgba(15,61,36,0.5)'}} onClick={onClose}>
      <div className="w-full rounded-t-2xl max-h-[70vh] overflow-y-auto" style={{background:'#fff'}} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid #e8f5ee'}}>
          <span className="font-semibold" style={{color:'#0f3d24'}}>选择分类</span>
          <button onClick={onClose}><X size={20} style={{color:'#9cbfab'}} /></button>
        </div>
        <div className="p-3 space-y-1">
          {Object.entries(cats).map(([superCat, data]) => (
            <div key={superCat}>
              <button
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors"
                style={{background: expanded === superCat ? '#e8f5ee' : 'transparent'}}
                onClick={() => setExpanded(expanded === superCat ? null : superCat)}
              >
                <span className="text-xl">{data.emoji}</span>
                <span className="font-medium" style={{color:'#1a5c38'}}>{superCat}</span>
                <span className="ml-auto text-sm" style={{color:'#9cbfab'}}>{expanded === superCat ? '▲' : '▼'}</span>
              </button>
              {expanded === superCat && (
                <div className="flex flex-wrap gap-2 px-3 pb-3">
                  {data.tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => { onChange(tag, superCat, data.emoji); onClose() }}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                      style={{
                        background: value === tag ? '#1a5c38' : '#e8f5ee',
                        color: value === tag ? '#fff' : '#2d8a57'
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
