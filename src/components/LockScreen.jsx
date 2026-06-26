import { useState, useEffect } from 'react'

const PASSWORD = '020124'
const KEY = 'app_unlocked'

export default function LockScreen({ onUnlock }) {
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [dots, setDots] = useState([])

  const nums = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  function press(val) {
    if (val === '⌫') {
      setInput(p => p.slice(0, -1))
      setDots(p => p.slice(0, -1))
      return
    }
    if (input.length >= 6) return
    const next = input + val
    setInput(next)
    setDots(p => [...p, '●'])

    if (next.length === 6) {
      setTimeout(() => {
        if (next === PASSWORD) {
          sessionStorage.setItem(KEY, '1')
          onUnlock()
        } else {
          setShake(true)
          setTimeout(() => { setShake(false); setInput(''); setDots([]) }, 600)
        }
      }, 150)
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'#e8f5ee',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      maxWidth:430, margin:'0 auto'
    }}>
      <div style={{fontSize:40, marginBottom:8}}>🌿</div>
      <h1 style={{fontSize:20, fontWeight:700, color:'#0f3d24', marginBottom:4}}>随手记账</h1>
      <p style={{fontSize:13, color:'#7ab894', marginBottom:48}}>请输入密码</p>

      {/* 密码点 */}
      <div style={{
        display:'flex', gap:16, marginBottom:48,
        animation: shake ? 'shake 0.5s ease' : 'none'
      }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width:14, height:14, borderRadius:'50%',
            background: dots[i] ? '#1a5c38' : 'transparent',
            border: '2px solid ' + (dots[i] ? '#1a5c38' : '#a8c4b0'),
            transition:'all 0.15s'
          }} />
        ))}
      </div>

      {/* 数字键盘 */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, width:240}}>
        {nums.map((n, i) => (
          n === '' ? <div key={i} /> :
          <button key={i} onClick={() => n !== '⌫' ? press(n) : press('⌫')}
            style={{
              height:64, borderRadius:32,
              background: n === '⌫' ? 'transparent' : '#fff',
              border:'none', cursor:'pointer',
              fontSize: n === '⌫' ? 22 : 24,
              fontWeight:500, color:'#1a5c38',
              boxShadow: n === '⌫' ? 'none' : '0 2px 8px rgba(26,92,56,0.1)',
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>
            {n}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-8px)}
          80%{transform:translateX(8px)}
        }
      `}</style>
    </div>
  )
}
