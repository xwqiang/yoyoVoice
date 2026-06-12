import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Child, Course, CustomList } from '../../types'

export function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [nickname, setNickname] = useState('')
  const [emoji, setEmoji] = useState('🧒')
  const [error, setError] = useState('')

  const load = () => {
    api.children.list().then(setChildren).catch(console.error)
    api.courses.list().then(setCourses).catch(console.error)
    api.customLists.list().then(setCustomLists).catch(console.error)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!nickname.trim()) return
    try {
      const child = await api.children.create({ nickname, avatar_emoji: emoji })
      if (courses[0]) {
        await api.children.switchSource(child.id, { learning_mode: 'course', course_id: courses[0].id })
      }
      setNickname('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleSwitch = async (child: Child, mode: 'course' | 'custom', id: number) => {
    try {
      await api.children.switchSource(child.id, {
        learning_mode: mode,
        course_id: mode === 'course' ? id : undefined,
        custom_list_id: mode === 'custom' ? id : undefined,
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这个孩子？')) return
    await api.children.delete(id)
    load()
  }

  const listsForChild = (childId: number) => customLists.filter((l) => l.child_id === childId)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">孩子管理</h2>

      <Card>
        <h3 className="font-bold mb-3">添加孩子</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-16 px-2 py-3 rounded-xl border text-center text-2xl"
            maxLength={2}
          />
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="孩子昵称"
            className="flex-1 min-w-[200px] px-4 py-3 rounded-xl border text-lg"
          />
          <Button onClick={handleCreate}>添加</Button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </Card>

      <div className="space-y-4">
        {children.map((child) => (
          <Card key={child.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{child.avatar_emoji}</span>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{child.nickname}</h3>
                <p className="text-sm text-slate-500">
                  连续学习 {child.streak_days} 天 · 每日 {child.daily_new_words} 新词 + {child.daily_review_words} 复习
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(child.id)}>删除</Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600">学习源（当前：{child.learning_mode === 'course' ? '预设课程' : '自定义词表'}）</p>
              <div className="flex flex-wrap gap-2">
                {courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSwitch(child, 'course', c.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      child.learning_mode === 'course' && child.active_course_id === c.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    📚 {c.title}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {listsForChild(child.id).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleSwitch(child, 'custom', l.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      child.learning_mode === 'custom' && child.active_custom_list_id === l.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    📝 {l.name} ({l.word_count})
                  </button>
                ))}
                {listsForChild(child.id).length === 0 && (
                  <span className="text-sm text-slate-400">暂无自定义词表，请到词表管理创建</span>
                )}
              </div>
            </div>
          </Card>
        ))}
        {children.length === 0 && (
          <p className="text-center text-slate-400 py-8">还没有孩子，请先添加</p>
        )}
      </div>
    </div>
  )
}
