import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { Card } from '../../components/Card'
import type { Child, Course } from '../../types'

export function AdminDashboard() {
  const [children, setChildren] = useState<Child[]>([])
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    api.children.list().then(setChildren).catch(console.error)
    api.courses.list().then(setCourses).catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">欢迎回来 👋</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-slate-500 text-sm">孩子数量</p>
          <p className="text-3xl font-bold text-indigo-600">{children.length}</p>
        </Card>
        <Card>
          <p className="text-slate-500 text-sm">预设课程</p>
          <p className="text-3xl font-bold text-indigo-600">{courses.length}</p>
        </Card>
        <Card>
          <p className="text-slate-500 text-sm">连续学习</p>
          <p className="text-3xl font-bold text-emerald-600">
            {children.reduce((max, c) => Math.max(max, c.streak_days), 0)} 天
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-lg mb-4">快捷操作</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/admin/children" className="p-4 bg-indigo-50 rounded-xl text-center hover:bg-indigo-100">
            <span className="text-2xl">👶</span>
            <p className="font-medium mt-1">管理孩子</p>
          </Link>
          <Link to="/admin/plans" className="p-4 bg-emerald-50 rounded-xl text-center hover:bg-emerald-100">
            <span className="text-2xl">📅</span>
            <p className="font-medium mt-1">今日计划</p>
          </Link>
          <Link to="/admin/words" className="p-4 bg-amber-50 rounded-xl text-center hover:bg-amber-100">
            <span className="text-2xl">📝</span>
            <p className="font-medium mt-1">自定义词表</p>
          </Link>
          <Link to="/admin/ai" className="p-4 bg-purple-50 rounded-xl text-center hover:bg-purple-100">
            <span className="text-2xl">🤖</span>
            <p className="font-medium mt-1">AI 助手</p>
          </Link>
        </div>
      </Card>

      {courses.length > 0 && (
        <Card>
          <h3 className="font-bold text-lg mb-3">预设课程</h3>
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-slate-500">{c.description}</p>
                </div>
                <span className="text-sm text-indigo-600 font-medium">{c.word_count} 词</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
