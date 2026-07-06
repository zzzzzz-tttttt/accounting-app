import { useState } from 'react'
import { X, Shield, Key } from 'lucide-react'
import { getUserApiKey, setUserApiKey } from '../utils/api'

export default function SettingsModal({ onClose }) {
  const [key, setKey] = useState(getUserApiKey)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setUserApiKey(key)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,61,36,0.4)' }}
      onClick={onClose}>
      <div className="w-full max-w-[380px] rounded-2xl p-5" style={{ background: '#fff' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#0f3d24' }}>API 设置</h2>
          <button onClick={onClose}><X size={20} style={{ color: '#9cbfab' }} /></button>
        </div>

        {/* 安全说明 */}
        <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Shield size={16} style={{ color: '#1a8c50', marginTop: 1 }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#1a8c50' }}>你的 API Key 是安全的</p>
            <p className="text-xs mt-0.5" style={{ color: '#7ab894' }}>
              Key 只保存在你手机的浏览器本地存储中，不会上传到任何服务器。每次调用 AI 时直接发给硅基流动官方，App 开发者看不到你的 Key。
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs mb-2" style={{ color: '#9cbfab' }}>
            去 <a href="https://cloud.siliconflow.cn" target="_blank" rel="noopener noreferrer"
              style={{ color: '#2d8a57', textDecoration: 'underline' }}>siliconflow.cn</a> 注册拿 Key，粘贴到下方：
          </p>
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#f5faf7', border: '1px solid #d4eddf' }}>
            <Key size={16} style={{ color: '#9cbfab', flexShrink: 0 }} />
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="flex-1 outline-none text-sm bg-transparent"
              style={{ color: '#0f3d24' }}
            />
          </div>
        </div>

        <button onClick={handleSave}
          className="w-full py-3 rounded-xl font-semibold text-white text-sm"
          style={{ background: saved ? '#1a8c50' : '#1a5c38' }}>
          {saved ? '✅ 已保存' : '保存'}
        </button>

        <p className="text-xs text-center mt-3" style={{ color: '#c4dece' }}>
          不填则使用 App 默认 Key（如果可用）
        </p>
      </div>
    </div>
  )
}
