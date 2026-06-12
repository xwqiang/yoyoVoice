import type { NavigateFunction } from 'react-router-dom'
import { api } from '../api/client'
import type { DailyPlan } from '../types'

export type ModuleType = 'meaning' | 'spelling' | 'pronunciation'

export interface ModuleConfig {
  type: ModuleType
  label: string
  subtitle: string
  emoji: string
  bg: string
  border: string
  text: string
}

export const STUDENT_MODULES: ModuleConfig[] = [
  {
    type: 'meaning',
    label: '认一认',
    subtitle: '听发音，选意思',
    emoji: '👂',
    bg: 'bg-gradient-to-br from-violet-100 to-purple-50',
    border: 'border-violet-300',
    text: 'text-violet-700',
  },
  {
    type: 'spelling',
    label: '拼一拼',
    subtitle: '听发音，拼单词',
    emoji: '✏️',
    bg: 'bg-gradient-to-br from-emerald-100 to-teal-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
  },
  {
    type: 'pronunciation',
    label: '读一读',
    subtitle: '大声读出来',
    emoji: '🎤',
    bg: 'bg-gradient-to-br from-amber-100 to-orange-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
  },
]

export function moduleProgress(plan: DailyPlan | null, moduleType: ModuleType) {
  const items = plan?.items.filter((i) => i.module_type === moduleType) ?? []
  const total = items.length
  const completed = items.filter((i) => i.status === 'completed').length
  return { total, completed, items }
}

export function moduleProgressLabel(
  plan: DailyPlan | null,
  moduleType: ModuleType,
  poolSize: number,
  sessionDone: number,
) {
  const { total, completed } = moduleProgress(plan, moduleType)
  if (total > 0) {
    return {
      completed,
      total,
      label: completed >= total ? '今日完成 🎉' : `今日进度 · 第 ${completed + 1} 题`,
    }
  }
  if (poolSize > 0) {
    return {
      completed: sessionDone,
      total: poolSize,
      label: sessionDone > 0 ? `自由练习 · 已完成 ${sessionDone} 题` : `自由练习 · 共 ${poolSize} 个词`,
    }
  }
  return { completed: 0, total: 0, label: '暂无单词，请家长添加词表' }
}

export async function pickNextWord(
  childId: number,
  moduleType: ModuleType,
  excludeItemIds: number[] = [],
  existingPlan?: DailyPlan | null,
): Promise<{ wordId: number; planItemId?: number; fromPlan: boolean } | null> {
  const plan = existingPlan !== undefined ? existingPlan : await api.dailyPlans.today(childId)
  const pending =
    plan?.items.filter(
      (i) =>
        i.module_type === moduleType &&
        i.status !== 'completed' &&
        !excludeItemIds.includes(i.id),
    ) ?? []

  if (pending.length > 0) {
    const item = pending[0]
    return { wordId: item.word_id, planItemId: item.id, fromPlan: true }
  }

  const pool = await api.children.wordPool(childId)
  if (pool.length === 0) return null

  const word = pool[Math.floor(Math.random() * pool.length)]
  return { wordId: word.id, fromPlan: false }
}

export function goToModuleHome(childId: string | number, navigate: NavigateFunction) {
  navigate(`/learn/${childId}`)
}
