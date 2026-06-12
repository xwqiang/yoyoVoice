import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Child, Recommendation, WeeklyReport } from '../../types'

export function AIPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [recSource, setRecSource] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.children.list()
      .then((list) => {
        setChildren(list)
        if (list[0]) setSelectedChild(list[0].id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }, [])

  useEffect(() => {
    setRecommendations([])
    setReport(null)
    setRecSource('')
    setError('')
  }, [selectedChild])

  const handleRecommend = async () => {
    if (!selectedChild) return
    setLoading(true)
    setError('')
    try {
      const res = await api.ai.recommend(selectedChild)
      setRecommendations(res.recommendations)
      setRecSource(res.source)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取推荐失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReport = async () => {
    if (!selectedChild) return
    setLoading(true)
    setError('')
    try {
      const res = await api.ai.weeklyReport(selectedChild)
      setReport(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成报告失败')
    } finally {
      setLoading(false)
    }
  }

  const handleApplySuggestions = async () => {
    if (!selectedChild || !report) return
    setError('')
    try {
      await api.children.update(selectedChild, {
        daily_new_words: report.suggested_daily_new_words,
        daily_review_words: report.suggested_daily_review_words,
      })
      setChildren((prev) =>
        prev.map((c) =>
          c.id === selectedChild
            ? {
                ...c,
                daily_new_words: report.suggested_daily_new_words,
                daily_review_words: report.suggested_daily_review_words,
              }
            : c
        )
      )
      alert('已应用 AI 建议的每日词数')
    } catch (err) {
      setError(err instanceof Error ? err.message : '应用建议失败')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">AI 学习助手</h2>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedChild(c.id)}
            className={`px-4 py-2 rounded-xl font-medium ${
              selectedChild === c.id ? 'bg-indigo-600 text-white' : 'bg-white border'
            }`}
          >
            {c.avatar_emoji} {c.nickname}
          </button>
        ))}
      </div>

      {selectedChild && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">智能练习推荐</h3>
              <Button onClick={handleRecommend} disabled={loading}>获取推荐</Button>
            </div>
            {recSource && (
              <p className="text-xs text-slate-400 mb-2">来源：{recSource === 'ai' ? 'Cursor AI' : '规则引擎'}</p>
            )}
            {recommendations.length > 0 ? (
              <div className="space-y-2">
                {recommendations.map((r) => (
                  <div key={`${r.word_id}-${r.module}`} className="p-3 bg-indigo-50 rounded-xl">
                    <div className="flex justify-between">
                      <span className="font-medium">{r.word_en}</span>
                      <span className="text-sm text-indigo-600">{r.module}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{r.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">点击获取基于历史表现的练习推荐</p>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">学习评估报告</h3>
              <Button onClick={handleReport} disabled={loading}>生成周报</Button>
            </div>
            {report && (
              <div className="space-y-4">
                <p className="text-slate-700 leading-relaxed">{report.summary}</p>
                <div>
                  <p className="font-medium text-emerald-600 mb-1">优点</p>
                  <ul className="list-disc list-inside text-sm text-slate-600">
                    {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-amber-600 mb-1">待加强</p>
                  <ul className="list-disc list-inside text-sm text-slate-600">
                    {report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
                <p className="text-sm text-slate-500">
                  建议每日：{report.suggested_daily_new_words} 新词 + {report.suggested_daily_review_words} 复习
                  （{report.source === 'ai' ? 'AI' : '规则'}）
                </p>
                <Button variant="secondary" onClick={handleApplySuggestions}>应用建议到学习计划</Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
