import type { NavigateFunction } from 'react-router-dom'
import { api } from '../api/client'
import type { DailyPlan } from '../types'

export type ModuleType = 'learn' | 'meaning' | 'spelling' | 'pronunciation'
export type AssessmentModuleType = 'meaning' | 'spelling' | 'pronunciation'

export interface ModuleConfig {
  type: ModuleType
  label: string
  subtitle: string
  emoji: string
  bg: string
  border: string
  text: string
  isAssessment?: boolean
}

export const LEARN_MODULE: ModuleConfig = {
  type: 'learn',
  label: '学一学',
  subtitle: '认识新单词，随时复习',
  emoji: '📖',
  bg: 'bg-gradient-to-br from-sky-100 to-blue-50',
  border: 'border-sky-300',
  text: 'text-sky-700',
}

export const ASSESSMENT_MODULES: ModuleConfig[] = [
  {
    type: 'meaning',
    label: '认一认',
    subtitle: '听发音，选意思',
    emoji: '👂',
    bg: 'bg-gradient-to-br from-violet-100 to-purple-50',
    border: 'border-violet-300',
    text: 'text-violet-700',
    isAssessment: true,
  },
  {
    type: 'spelling',
    label: '拼一拼',
    subtitle: '听发音，拼单词',
    emoji: '✏️',
    bg: 'bg-gradient-to-br from-emerald-100 to-teal-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    isAssessment: true,
  },
  {
    type: 'pronunciation',
    label: '读一读',
    subtitle: '大声读出来',
    emoji: '🎤',
    bg: 'bg-gradient-to-br from-amber-100 to-orange-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    isAssessment: true,
  },
]

export const STUDENT_MODULES: ModuleConfig[] = [LEARN_MODULE, ...ASSESSMENT_MODULES]

export function getModuleConfig(type: ModuleType): ModuleConfig {
  return STUDENT_MODULES.find((m) => m.type === type) ?? LEARN_MODULE
}

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
  review = false,
) {
  if (review) {
    return {
      completed: sessionDone,
      total: poolSize,
      label: sessionDone > 0 ? `复习中 · 已练 ${sessionDone} 题` : '复习模式',
    }
  }
  const { total, completed } = moduleProgress(plan, moduleType)
  if (total > 0) {
    return {
      completed,
      total,
      label: completed >= total ? '今日完成 🎉' : `今日进度 · 第 ${completed + 1} 题`,
    }
  }
  if (poolSize > 0) {
    if (moduleType === 'learn') {
      return {
        completed: sessionDone,
        total: poolSize,
        label: sessionDone > 0 ? `自由练习 · 已学 ${sessionDone} 个` : `自由练习 · 共 ${poolSize} 个词`,
      }
    }
    return {
      completed: sessionDone,
      total: poolSize,
      label: sessionDone > 0 ? `自由练习 · 已完成 ${sessionDone} 题` : `自由练习 · 共 ${poolSize} 个词`,
    }
  }
  return { completed: 0, total: 0, label: '暂无单词，请家长添加词表' }
}

export interface PickNextWordOptions {
  /** 复习模式：忽略今日任务，从词表中循环练习 */
  review?: boolean
}

export async function pickNextWord(
  childId: number,
  moduleType: ModuleType,
  excludeItemIds: number[] = [],
  existingPlan?: DailyPlan | null,
  excludeWordIds: number[] = [],
  learnedWordIds: number[] = [],
  options?: PickNextWordOptions,
): Promise<{ wordId: number; planItemId?: number; fromPlan: boolean; review?: boolean } | null> {
  const plan = existingPlan !== undefined ? existingPlan : await api.dailyPlans.today(childId)
  const pool = await api.children.wordPool(childId)
  if (pool.length === 0) return null
  const poolIds = new Set(pool.map((w) => w.id))
  const learnedSet = new Set(learnedWordIds)
  const review = options?.review ?? false

  if (!review) {
    const planLearnItems =
      moduleType === 'learn'
        ? (plan?.items.filter(
            (i) => i.module_type === 'learn' && poolIds.has(i.word_id),
          ) ?? [])
        : []
    const pending =
      plan?.items
        .filter(
          (i) =>
            i.module_type === moduleType &&
            i.status !== 'completed' &&
            poolIds.has(i.word_id) &&
            !excludeItemIds.includes(i.id) &&
            (moduleType !== 'learn' || !excludeWordIds.includes(i.word_id)),
        )
        .sort((a, b) => a.sort_order - b.sort_order) ?? []

    if (pending.length > 0) {
      const item = pending[0]
      return { wordId: item.word_id, planItemId: item.id, fromPlan: true }
    }

    // 今日有学一学任务时，做完任务即结束，不自动继续练词表里的其他新词
    if (moduleType === 'learn' && planLearnItems.length > 0) {
      return null
    }
  }

  const excludeSet = new Set(excludeWordIds)
  let candidates = pool.filter((w) => !excludeSet.has(w.id))

  if (moduleType === 'learn') {
    if (!review) {
      candidates = candidates.filter((w) => !learnedSet.has(w.id))
    }
  } else {
    candidates = candidates.filter((w) => learnedSet.has(w.id))
  }

  if (candidates.length === 0) {
    if (!review) return null
    // 复习模式：本轮词都练过，从头再来
    candidates = moduleType === 'learn'
      ? pool
      : pool.filter((w) => learnedSet.has(w.id))
    if (candidates.length === 0) return null
  }

  return { wordId: candidates[0].id, fromPlan: false }
}

export function goToModuleHome(childId: string | number, navigate: NavigateFunction) {
  navigate(`/learn/${childId}`)
}

export function goToLearnHome(childId: string | number, navigate: NavigateFunction) {
  navigate(`/learn/${childId}/learn`)
}
