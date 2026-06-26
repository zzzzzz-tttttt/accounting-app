import { Home, PlusCircle, List, BarChart2, Upload } from 'lucide-react'

const tabs = [
  { id: 'home', label: '首页', Icon: Home },
  { id: 'add', label: '记账', Icon: PlusCircle },
  { id: 'bill', label: '账单', Icon: List },
  { id: 'stats', label: '统计', Icon: BarChart2 },
  { id: 'import', label: '导入', Icon: Upload },
]

export default function TabBar({ active, onChange }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto flex" style={{background:'#fff', borderTop:'1px solid #d4eddf'}}>
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors"
          style={{color: active === id ? '#1a5c38' : '#9cbfab'}}
        >
          <Icon size={20} strokeWidth={active === id ? 2.5 : 1.8} />
          <span className="text-[10px]">{label}</span>
        </button>
      ))}
    </div>
  )
}
