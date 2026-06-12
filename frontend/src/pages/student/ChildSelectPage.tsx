import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getToken } from '../../api/client'
import { useChild } from '../../context/ChildContext'
import type { Child } from '../../types'

export function ChildSelectPage() {
  const [children, setChildren] = useState<Child[]>([])
  const { setActiveChild } = useChild()
  const navigate = useNavigate()
  const hasAuth = !!getToken()

  useEffect(() => {
    if (!hasAuth) return
    api.children.list().then(setChildren).catch(() => setChildren([]))
  }, [hasAuth])

  const startLearn = (child: Child) => {
    setActiveChild(child)
    navigate(`/learn/${child.id}`)
  }

  if (!hasAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <span className="text-8xl mb-6">🎤</span>
        <p className="text-2xl text-violet-600 font-bold mb-8">叫爸爸妈妈来帮你吧</p>
        <Link
          to="/login"
          className="min-h-16 px-10 py-4 bg-violet-500 text-white rounded-3xl text-xl font-bold shadow-lg"
        >
          家长入口
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-violet-600 mb-10">我是谁？</h1>
      <div className="grid grid-cols-1 gap-6 w-full max-w-md">
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => startLearn(child)}
            className="p-10 bg-white rounded-[2rem] shadow-lg border-4 border-violet-100 active:scale-95 transition-transform"
          >
            <span className="text-8xl block mb-4">{child.avatar_emoji}</span>
            <span className="text-3xl font-bold text-slate-800">{child.nickname}</span>
          </button>
        ))}
      </div>
      {children.length === 0 && (
        <p className="text-xl text-slate-400 mt-8">还没有小朋友哦</p>
      )}
    </div>
  )
}
