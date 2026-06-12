import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './Button'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const nav = [
    { to: '/admin', label: '首页' },
    { to: '/admin/children', label: '孩子管理' },
    { to: '/admin/plans', label: '学习计划' },
    { to: '/admin/words', label: '词表管理' },
    { to: '/admin/ai', label: 'AI 助手' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎤</span>
          <div>
            <h1 className="font-bold text-lg text-indigo-600">yoyoVoice</h1>
            <p className="text-xs text-slate-500">{user?.display_name} · 管理端</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/learn">
            <Button variant="secondary" size="sm">学生端</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={logout}>退出</Button>
        </div>
      </header>
      <nav className="bg-white border-b border-slate-100 px-2 py-2 flex gap-1 overflow-x-auto">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              location.pathname === item.to
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}

export function StudentLayout() {
  return (
    <div className="min-h-screen flex flex-col student-bg text-slate-800">
      <Outlet />
    </div>
  )
}
