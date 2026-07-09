import { CATEGORIES, INCOME_CATEGORIES } from '../utils/categories'
import { X } from 'lucide-react'

// 每个标签的专属 emoji
const TAG_EMOJI = {
  '餐饮':'🍚','水果零食':'🍎','买菜':'🥬','烟酒':'🍺',
  '购物':'🛒','穿搭':'👗','美容':'💄','生活日用':'🧴','家居家电':'🛋️',
  '交通':'🚇','爱车':'🚗','酒店旅行':'🏨',
  '休闲娱乐':'🎮','网络虚拟':'📱','运动':'⚽',
  '住房':'🏡','生活服务':'📦',
  '养娃':'👶','宠物':'🐱','人情社交':'🎁','发红包':'🧧',
  '学习教育':'📚','医疗保健':'💊',
  '金融保险':'💰','转账':'💳','互助保障':'🤝',
  '公益':'❤️','其他':'📝',
  '工资薪资':'💼','奖金':'🎉','兼职收入':'💻','投资收益':'📈','其他收入':'💵',
}

export default function CategoryPicker({ type, value, onChange, onClose }) {
  const cats = type === 'income' ? INCOME_CATEGORIES : CATEGORIES

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{background:'rgba(15,61,36,0.5)'}} onClick={onClose}>
      <div className="w-full rounded-t-2xl max-h-[70vh] overflow-y-auto" style={{background:'#fff'}} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid #e8f5ee'}}>
          <span className="font-semibold" style={{color:'#0f3d24'}}>选择分类</span>
          <button onClick={onClose}><X size={20} style={{color:'#9cbfab'}} /></button>
        </div>
        <div className="p-4 space-y-4">
          {Object.entries(cats).map(([superCat, data]) => (
            <div key={superCat}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">{data.emoji}</span>
                <span className="text-xs font-medium" style={{color:'#a8c4b0'}}>{superCat}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-3">
                {data.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { onChange(tag, superCat, data.emoji); onClose() }}
                    className="flex flex-col items-center gap-1 transition-transform active:scale-90"
                    style={{ width: 56 }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors"
                      style={{
                        background: value === tag ? '#1a5c38' : '#e8f5ee',
                      }}
                    >
                      {TAG_EMOJI[tag] || '📌'}
                    </div>
                    <span className="text-xs text-center leading-tight" style={{
                      color: value === tag ? '#1a5c38' : '#5d7a6a',
                      fontWeight: value === tag ? 600 : 400,
                    }}>
                      {tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
