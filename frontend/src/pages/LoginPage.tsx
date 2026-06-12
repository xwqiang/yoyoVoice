import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/Button'
import { Card } from '../components/Card'

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from')
  const redirectTo = from && from.startsWith('/learn') ? '/learn' : '/admin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await register(email, password)
      } else {
        await login(email, password)
      }
      navigate(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-100 via-white to-purple-50">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-5xl">🎤</span>
          <h1 className="text-2xl font-bold text-indigo-600 mt-2">yoyoVoice</h1>
          <p className="text-slate-500 mt-1">儿童英语学习平台</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-lg"
              minLength={6}
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
          </Button>
        </form>
        <p className="text-center mt-4 text-sm text-slate-500">
          {isRegister ? '已有账号？' : '没有账号？'}
          <button
            type="button"
            className="text-indigo-600 font-medium ml-1"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
        <div className="mt-6 text-center">
          <Link to="/learn" className="text-indigo-600 text-sm font-medium">
            进入学生端 →
          </Link>
        </div>
      </Card>
    </div>
  )
}
