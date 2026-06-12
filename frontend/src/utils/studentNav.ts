import type { NavigateFunction } from 'react-router-dom'
import { api } from '../api/client'

export function speakWord(word: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.85
  speechSynthesis.speak(u)
}

export async function navigateToNext(childId: number, navigate: NavigateFunction) {
  try {
    const plan = await api.dailyPlans.today(childId)
    const next = plan?.items.find((i) => i.status !== 'completed')
    if (next) {
      navigate(`/learn/${childId}/${next.module_type}/${next.id}`)
    } else {
      navigate(`/learn/${childId}`)
    }
  } catch {
    navigate(`/learn/${childId}`)
  }
}

export function starsFromProgress(completed: number, total: number): number {
  if (total <= 0) return 0
  const ratio = completed / total
  if (ratio >= 1) return 5
  if (ratio >= 0.75) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  if (ratio > 0) return 1
  return 0
}
