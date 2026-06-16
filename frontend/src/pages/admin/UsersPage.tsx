import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { ParentUser } from '../../types'

export function UsersPage() {
  const [users, setUsers] = useState<ParentUser[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('家长')
  const [accountName, setAccountName] = useState('我的家庭')
  const [error, setError] = useState('')

  const load = () => {
    api.users.list().then(setUsers).catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!username.trim() || !password) return
    setError('')
    try {
      await api.users.create({
        username: username.trim(),
        password,
        display_name: displayName.trim() || '家长',
        account_name: accountName.trim() || '我的家庭',
      })
      setUsername('')
      setPassword('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该家长账号？')) return
    try {
      await api.users.delete(id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">家长账号管理</h2>

      <Card>
        <h3 className="font-bold mb-3">创建家长账号</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            className="px-4 py-3 rounded-xl border text-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 6 位）"
            className="px-4 py-3 rounded-xl border text-lg"
            minLength={6}
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="显示名称"
            className="px-4 py-3 rounded-xl border text-lg"
          />
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="家庭名称"
            className="px-4 py-3 rounded-xl border text-lg"
          />
        </div>
        <Button className="mt-3" onClick={handleCreate}>创建账号</Button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </Card>

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-lg">{user.display_name}</p>
              <p className="text-sm text-slate-500">
                用户名：{user.username} · 家庭 ID：{user.account_id}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(user.id)}>删除</Button>
          </Card>
        ))}
        {users.length === 0 && (
          <p className="text-center text-slate-400 py-8">暂无家长账号</p>
        )}
      </div>
    </div>
  )
}
