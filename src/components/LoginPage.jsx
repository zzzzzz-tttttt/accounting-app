import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // 检测从重置密码邮件跳回
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setResetMode(true)
      window.location.hash = '' // 清除 URL 里的 token
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('请填写邮箱'); return }
    if (!password || password.length < 6) { setError('密码至少 6 位'); return }
    setLoading(true)
    setError('')

    const { data, error: err } = isSignUp
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (err) {
      if (err.message.includes('Invalid login')) setError('邮箱或密码错误')
      else if (err.message.includes('already registered')) setError('该邮箱已注册，请直接登录')
      else if (err.message.includes('Email not confirmed')) setError('请先去邮箱点击确认链接')
      else setError(err.message)
    } else if (data.user) {
      onLogin(data.user)
    }
    setLoading(false)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!email.trim()) { setError('请填写邮箱'); return }
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    })

    if (err) {
      setError(err.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  async function handleSetNewPassword(e) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) { setError('新密码至少 6 位'); return }
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password: newPassword })

    if (err) {
      setError(err.message)
    } else {
      setResetMode(false)
      setNewPassword('')
      onLogin(supabase.auth.getUser().then(d => d.data.user))
    }
    setLoading(false)
  }

  // ===== 重设密码界面 =====
  if (resetMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#e8f5ee' }}>
        <div className="w-full max-w-[340px]">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🔑</div>
            <h1 className="text-2xl font-bold" style={{ color: '#0f3d24' }}>重设密码</h1>
            <p className="text-sm mt-1" style={{ color: '#7ab894' }}>输入你的新密码</p>
          </div>

          <form onSubmit={handleSetNewPassword} className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #d4eddf' }}>
              <Lock size={18} style={{ color: '#9cbfab', flexShrink: 0 }} />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="新密码（至少6位）" className="flex-1 outline-none text-sm bg-transparent"
                style={{ color: '#0f3d24' }} />
            </div>

            {error && <p className="text-xs text-center px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#e74c3c' }}>{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-white text-sm"
              style={{ background: loading ? '#a8c4b0' : '#1a5c38' }}>
              {loading ? '请稍候…' : '确认修改'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ===== 忘记密码界面 =====
  if (forgotMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#e8f5ee' }}>
        <div className="w-full max-w-[340px]">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📧</div>
            <h1 className="text-2xl font-bold" style={{ color: '#0f3d24' }}>
              {resetSent ? '邮件已发送' : '找回密码'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#7ab894' }}>
              {resetSent ? '请去邮箱点击重置链接，然后回来设置新密码' : '输入注册时的邮箱，我们会发送重置链接'}
            </p>
          </div>

          {!resetSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #d4eddf' }}>
                <Mail size={18} style={{ color: '#9cbfab', flexShrink: 0 }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="注册邮箱" className="flex-1 outline-none text-sm bg-transparent"
                  style={{ color: '#0f3d24' }} />
              </div>

              {error && <p className="text-xs text-center px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#e74c3c' }}>{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-xl font-semibold text-white text-sm"
                style={{ background: loading ? '#a8c4b0' : '#1a5c38' }}>
                {loading ? '发送中…' : '发送重置邮件'}
              </button>
            </form>
          ) : (
            <button onClick={() => { setForgotMode(false); setResetSent(false); setError('') }}
              className="w-full py-4 rounded-xl font-semibold text-sm mt-3"
              style={{ background: '#e8f5ee', color: '#1a5c38' }}>
              返回登录
            </button>
          )}

          <button onClick={() => { setForgotMode(false); setResetSent(false); setError('') }}
            className="w-full text-center mt-4 text-sm flex items-center justify-center gap-1" style={{ color: '#7ab894' }}>
            <ArrowLeft size={14} /> 返回登录
          </button>
        </div>
      </div>
    )
  }

  // ===== 正常登录/注册界面 =====
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#e8f5ee' }}>
      <div className="w-full max-w-[340px]">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌿</div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f3d24' }}>记账</h1>
          <p className="text-sm mt-1" style={{ color: '#7ab894' }}>
            {isSignUp ? '创建账号，数据云端同步' : '登录以同步你的数据'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #d4eddf' }}>
            <Mail size={18} style={{ color: '#9cbfab', flexShrink: 0 }} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="邮箱地址" autoComplete="email"
              className="flex-1 outline-none text-sm bg-transparent" style={{ color: '#0f3d24' }} />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #d4eddf' }}>
            <Lock size={18} style={{ color: '#9cbfab', flexShrink: 0 }} />
            <input type={showPwd ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="密码（至少6位）"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="flex-1 outline-none text-sm bg-transparent" style={{ color: '#0f3d24' }} />
            <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ color: '#9cbfab' }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-center px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#e74c3c' }}>{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl font-semibold text-white text-sm"
            style={{ background: loading ? '#a8c4b0' : '#1a5c38' }}>
            {loading ? '请稍候…' : isSignUp ? '注册' : '登录'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-3">
          <button onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="text-sm" style={{ color: '#2d8a57' }}>
            {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
          {!isSignUp && (
            <button onClick={() => { setForgotMode(true); setError('') }}
              className="text-sm" style={{ color: '#7ab894' }}>
              忘记密码？
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 mt-6 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <Shield size={14} style={{ color: '#1a8c50', marginTop: 1, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#7ab894' }}>
            数据加密存储在 Supabase 云端。密码经过哈希加盐处理，只有你知道，开发者也无法查看。
          </p>
        </div>
      </div>
    </div>
  )
}
