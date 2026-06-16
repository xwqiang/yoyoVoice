import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import type { Child, CustomList, DailyPlan } from '../../types'

const MODULE_LABELS: Record<string, string> = {
  learn: '学习',
  meaning: '释义',
  spelling: '拼写',
  pronunciation: '发音',
}
const MODULE_ORDER = ['learn', 'meaning', 'spelling', 'pronunciation'] as const
type PlanGenerateMode = 'quota' | 'full_list'

export function PlansPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newWords, setNewWords] = useState(5)
  const [reviewWords, setReviewWords] = useState(3)
  const [generateMode, setGenerateMode] = useState<PlanGenerateMode>('quota')
  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [selectedCustomListId, setSelectedCustomListId] = useState<number | null>(null)
  const loadSeq = useRef(0)

  useEffect(() => {
    api.children.list()
      .then((list) => {
        setChildren(list)
        if (list[0]) setSelectedChild(list[0].id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载孩子列表失败'))
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    api.customLists.list(selectedChild)
      .then((lists) => {
        setCustomLists(lists)
        const child = children.find((c) => c.id === selectedChild)
        const preferredListId = child?.active_custom_list_id
        const hasPreferred = preferredListId != null && lists.some((list) => list.id === preferredListId)
        setSelectedCustomListId(hasPreferred ? preferredListId : (lists[0]?.id ?? null))
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载自定义词表失败'))
  }, [selectedChild, children])

  useEffect(() => {
    if (!selectedChild) return
    const child = children.find((c) => c.id === selectedChild)
    if (child) {
      setNewWords(child.daily_new_words)
      setReviewWords(child.daily_review_words)
      setGenerateMode('quota')
    }
    setPlan(null)
    setError('')
    const seq = ++loadSeq.current
    loadPlan(selectedChild, seq)
  }, [selectedChild, children])

  const loadPlan = async (childId: number, seq: number) => {
    try {
      const p = await api.dailyPlans.today(childId)
      if (seq !== loadSeq.current) return
      setPlan(p)
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof Error ? err.message : '加载计划失败')
    }
  }

  const useAllCustomWords = generateMode === 'full_list'
  const selectedCustomList = customLists.find((list) => list.id === selectedCustomListId)

  const handleGenerate = async () => {
    if (!selectedChild) return
    if (useAllCustomWords && !selectedCustomListId) {
      setError('请选择要用于今日学习计划的自定义词表')
      return
    }
    const hasProgress = plan && plan.completed > 0
    if (hasProgress) {
      const ok = window.confirm(
        `今日已完成 ${plan.completed}/${plan.total} 项，重新生成会覆盖未完成任务。确定继续吗？`
      )
      if (!ok) return
    }
    setLoading(true)
    setError('')
    try {
      if (!useAllCustomWords) {
        await api.children.update(selectedChild, {
          daily_new_words: newWords,
          daily_review_words: reviewWords,
        })
        setChildren((prev) =>
          prev.map((c) =>
            c.id === selectedChild
              ? { ...c, daily_new_words: newWords, daily_review_words: reviewWords }
              : c
          )
        )
      }
      const p = await api.dailyPlans.generate(selectedChild, {
        ...(useAllCustomWords
          ? {}
          : { new_words: newWords, review_words: reviewWords }),
        use_all_custom_words: useAllCustomWords,
        custom_list_id: useAllCustomWords ? selectedCustomListId ?? undefined : undefined,
        force: !!hasProgress || !!plan,
      })
      setPlan(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成计划失败')
    } finally {
      setLoading(false)
    }
  }

  const progress = plan ? Math.round((plan.completed / Math.max(plan.total, 1)) * 100) : 0
  const groupedTasks = useMemo(() => {
    if (!plan) return []
    const grouped = new Map<number, {
      word: DailyPlan['items'][number]['word']
      isReview: boolean
      sortOrder: number
      modules: Array<{
        id: number
        moduleType: string
        status: string
      }>
    }>()

    for (const item of plan.items) {
      const existing = grouped.get(item.word_id)
      if (existing) {
        existing.modules.push({
          id: item.id,
          moduleType: item.module_type,
          status: item.status,
        })
        existing.sortOrder = Math.min(existing.sortOrder, item.sort_order)
        existing.isReview = existing.isReview || item.is_review === 1
        continue
      }
      grouped.set(item.word_id, {
        word: item.word,
        isReview: item.is_review === 1,
        sortOrder: item.sort_order,
        modules: [
          {
            id: item.id,
            moduleType: item.module_type,
            status: item.status,
          },
        ],
      })
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        modules: group.modules.sort(
          (a, b) => MODULE_ORDER.indexOf(a.moduleType as typeof MODULE_ORDER[number]) - MODULE_ORDER.indexOf(b.moduleType as typeof MODULE_ORDER[number])
        ),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [plan])
  const pendingTasks = useMemo(
    () => groupedTasks.filter((group) => group.modules.some((module) => module.status !== 'completed')),
    [groupedTasks]
  )
  const completedTasks = useMemo(
    () => groupedTasks.filter((group) => group.modules.every((module) => module.status === 'completed')),
    [groupedTasks]
  )

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">每日学习计划</h2>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedChild(c.id)}
            className={`px-4 py-2 rounded-xl font-medium ${
              selectedChild === c.id ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-700'
            }`}
          >
            {c.avatar_emoji} {c.nickname}
          </button>
        ))}
      </div>

      {selectedChild && (
        <>
          <Card>
            <h3 className="font-bold mb-3">生成今日计划</h3>
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap items-end">
                <div className={useAllCustomWords ? 'opacity-50' : undefined}>
                  <label className={`text-sm ${useAllCustomWords ? 'text-slate-400' : 'text-slate-500'}`}>
                    新词数
                  </label>
                  <input
                    type="number"
                    value={newWords}
                    onChange={(e) => setNewWords(Number(e.target.value))}
                    className={`block w-24 px-3 py-2 rounded-lg border mt-1 ${
                      useAllCustomWords ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                    }`}
                    min={1}
                    max={30}
                    disabled={useAllCustomWords}
                  />
                </div>
                <div className={useAllCustomWords ? 'opacity-50' : undefined}>
                  <label className={`text-sm ${useAllCustomWords ? 'text-slate-400' : 'text-slate-500'}`}>
                    复习词数
                  </label>
                  <input
                    type="number"
                    value={reviewWords}
                    onChange={(e) => setReviewWords(Number(e.target.value))}
                    className={`block w-24 px-3 py-2 rounded-lg border mt-1 ${
                      useAllCustomWords ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                    }`}
                    min={0}
                    max={20}
                    disabled={useAllCustomWords}
                  />
                </div>
                {!useAllCustomWords && (
                  <p className="text-xs text-slate-500 pb-2">
                    默认读取孩子档案中的每日配额；生成计划时会保存此处修改
                  </p>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">生成方式</legend>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="plan-generate-mode"
                    checked={generateMode === 'quota'}
                    onChange={() => setGenerateMode('quota')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">按每日配额</span>
                    <span className="block text-slate-500 text-xs mt-0.5">
                      从当前学习词池选取新词与到期复习词
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="plan-generate-mode"
                    checked={generateMode === 'full_list'}
                    onChange={() => setGenerateMode('full_list')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">自定义词表全量生成</span>
                    <span className="block text-slate-500 text-xs mt-0.5">
                      将所选词表中的全部单词纳入今日计划，上方新词数与复习词数不生效
                    </span>
                  </span>
                </label>
              </fieldset>

              {generateMode === 'full_list' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-sm text-slate-500">词表</label>
                    <select
                      value={selectedCustomListId ?? ''}
                      onChange={(e) => setSelectedCustomListId(e.target.value ? Number(e.target.value) : null)}
                      className="block min-w-[220px] px-3 py-2 rounded-lg border mt-1 bg-white"
                    >
                      <option value="">请选择词表</option>
                      {customLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list.word_count} 词)
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedCustomList
                      ? `将生成「${selectedCustomList.name}」中的全部 ${selectedCustomList.word_count} 个单词，共 ${selectedCustomList.word_count * 3} 项模块任务。`
                      : '请选择要全量生成的自定义词表。'}
                  </p>
                </div>
              )}

              {generateMode === 'quota' && (
                <p className="text-xs text-slate-500">
                  今日最多安排 {newWords} 个新词 + {reviewWords} 个复习词（每词 3 个模块）
                </p>
              )}

              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? '生成中...' : plan ? '重新生成' : '生成今日计划'}
              </Button>
            </div>
          </Card>

          {plan ? (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">今日任务</h3>
                  <p className="text-sm text-slate-500">{plan.plan_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">{progress}%</p>
                  <p className="text-sm text-slate-500">{plan.completed}/{plan.total} 完成</p>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mb-3">
                共 {groupedTasks.length} 个单词任务（{plan.total} 个模块任务）
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingTasks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">待完成（{pendingTasks.length}）</p>
                    {pendingTasks.map((group) => {
                      const completedModules = group.modules.filter((m) => m.status === 'completed').length
                      return (
                        <div
                          key={group.word.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>⬜</span>
                            <span className="font-medium">{group.word.word_en}</span>
                            <span className="text-sm text-slate-500">{group.word.meaning_zh}</span>
                            {group.isReview && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">复习</span>
                            )}
                            <span className="text-xs text-slate-500">
                              {completedModules}/{group.modules.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {group.modules.map((module) => (
                              <span
                                key={module.id}
                                className={`text-xs px-2 py-1 rounded-full ${
                                  module.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {MODULE_LABELS[module.moduleType]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-600 font-medium">今日单词任务已全部完成</p>
                )}

                {completedTasks.length > 0 && (
                  <details className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-emerald-700">
                      已完成（{completedTasks.length}）
                    </summary>
                    <div className="mt-2 space-y-2">
                      {completedTasks.map((group) => (
                        <div
                          key={group.word.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-emerald-50"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>✅</span>
                            <span className="font-medium">{group.word.word_en}</span>
                            <span className="text-sm text-slate-500">{group.word.meaning_zh}</span>
                            {group.isReview && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">复习</span>
                            )}
                            <span className="text-xs text-slate-500">
                              {group.modules.length}/{group.modules.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {group.modules.map((module) => (
                              <span
                                key={module.id}
                                className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700"
                              >
                                {MODULE_LABELS[module.moduleType]}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-center text-slate-500 py-8">今日还没有学习计划，点击上方按钮生成</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
