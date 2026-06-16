import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ModuleShell } from '../../components/student/ModuleShell'
import { KidButton } from '../../components/student/KidButton'
import { TeachingCard } from '../../components/student/TeachingCard'
import { CelebrationOverlay } from '../../components/student/CelebrationOverlay'
import { AchievementToast } from '../../components/student/AchievementToast'
import {
  getModuleConfig,
  goToLearnHome,
  moduleProgressLabel,
  pickNextWord,
} from '../../utils/moduleHelpers'
import type { AchievementData, DailyPlan, GamificationData } from '../../types'

function resolveLearnPlanItemId(
  plan: DailyPlan | null,
  wordId: number,
  planItemId?: number,
): number | undefined {
  if (planItemId) return planItemId
  return plan?.items.find(
    (i) => i.module_type === 'learn' && i.word_id === wordId && i.status !== 'completed',
  )?.id
}

export function LearnModule() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reviewMode = searchParams.get('review') === '1'
  const config = getModuleConfig('learn')

  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [sessionDone, setSessionDone] = useState(0)
  const [wordId, setWordId] = useState(0)
  const [planItemId, setPlanItemId] = useState<number | undefined>()
  const [wordEn, setWordEn] = useState('')
  const [meaningZh, setMeaningZh] = useState<string | null>(null)
  const [phonetic, setPhonetic] = useState<string | null>(null)
  const [exampleSentence, setExampleSentence] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [startTime, setStartTime] = useState(Date.now())

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationXp, setCelebrationXp] = useState(0)
  const [celebrationLevelUp, setCelebrationLevelUp] = useState(false)
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null)

  const practicedWordIds = useRef<number[]>([])
  const completedPlanItemIds = useRef<number[]>([])

  const exitToLearnHome = useCallback(() => {
    if (childId) goToLearnHome(childId, navigate)
  }, [childId, navigate])

  const showWord = useCallback(async (
    next: { wordId: number; planItemId?: number },
    id: number,
  ) => {
    const card = await api.learning.learnCard(id, next.wordId, reviewMode ? undefined : next.planItemId)
    setWordId(card.word_id)
    setPlanItemId(reviewMode ? undefined : next.planItemId)
    setWordEn(card.word_en)
    setMeaningZh(card.meaning_zh)
    setPhonetic(card.phonetic)
    setExampleSentence(card.example_sentence)
    setStartTime(Date.now())
  }, [reviewMode])

  const loadNext = useCallback(async (): Promise<boolean> => {
    if (!childId) return false
    setLoading(true)
    setError('')
    setWordEn('')
    try {
      const id = Number(childId)
      const [p, pool, learned] = await Promise.all([
        api.dailyPlans.today(id),
        api.children.wordPool(id),
        api.children.learnedWords(id),
      ])
      setPlan(p)
      setPoolSize(pool.length)

      const next = await pickNextWord(
        id,
        'learn',
        completedPlanItemIds.current,
        p,
        practicedWordIds.current,
        learned.word_ids,
        { review: reviewMode },
      )
      if (!next) {
        setSubmitting(false)
        return false
      }

      await showWord(next, id)
      setSubmitting(false)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      setSubmitting(false)
      return false
    } finally {
      setLoading(false)
    }
  }, [childId, reviewMode, showWord])

  useEffect(() => {
    completedPlanItemIds.current = []
    practicedWordIds.current = []
    loadNext().then((ok) => {
      if (!ok && !reviewMode) exitToLearnHome()
    })
  }, [childId, reviewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (achievementQueue.length > 0 && !currentAchievement) {
      setCurrentAchievement(achievementQueue[0])
      setAchievementQueue((q) => q.slice(1))
    }
  }, [achievementQueue, currentAchievement])

  const triggerCelebration = (gamification: GamificationData) => {
    setCelebrationXp(gamification.xp_earned)
    setCelebrationLevelUp(gamification.level_up)
    setShowCelebration(true)
    if (gamification.new_achievements.length > 0) {
      setAchievementQueue((q) => [...q, ...gamification.new_achievements])
    }
  }

  const handleDone = async () => {
    if (submitting || loading || !childId) return
    setSubmitting(true)
    const currentWordId = wordId
    const itemIdToComplete = reviewMode
      ? undefined
      : resolveLearnPlanItemId(plan, currentWordId, planItemId)

    try {
      const res = await api.learning.learnComplete({
        child_id: Number(childId),
        word_id: currentWordId,
        plan_item_id: itemIdToComplete,
        duration_ms: Date.now() - startTime,
      })

      if (itemIdToComplete && !completedPlanItemIds.current.includes(itemIdToComplete)) {
        completedPlanItemIds.current.push(itemIdToComplete)
      }
      if (!practicedWordIds.current.includes(currentWordId)) {
        practicedWordIds.current.push(currentWordId)
      }
      setSessionDone((n) => n + 1)

      if (!reviewMode) {
        triggerCelebration(res.gamification)
      }

      const updatedPlan = await api.dailyPlans.today(Number(childId))
      const pool = await api.children.wordPool(Number(childId))
      const learned = await api.children.learnedWords(Number(childId))
      setPlan(updatedPlan)
      setPoolSize(pool.length)

      let shouldGoHome = false
      if (reviewMode) {
        shouldGoHome = practicedWordIds.current.length >= pool.length
      } else {
        const next = await pickNextWord(
          Number(childId),
          'learn',
          completedPlanItemIds.current,
          updatedPlan,
          practicedWordIds.current,
          learned.word_ids,
          { review: false },
        )
        shouldGoHome = next === null
      }

      const delay = reviewMode ? 400 : 1500
      setTimeout(async () => {
        setShowCelebration(false)
        if (shouldGoHome) {
          exitToLearnHome()
          return
        }
        await loadNext()
      }, delay)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
      setSubmitting(false)
    }
  }

  const progress = moduleProgressLabel(plan, 'learn', poolSize, sessionDone, reviewMode)

  if (!childId) return null

  return (
    <ModuleShell config={config} progress={progress} onBack={exitToLearnHome}>
      <CelebrationOverlay
        xpEarned={celebrationXp}
        levelUp={celebrationLevelUp}
        show={showCelebration}
        onDone={() => setShowCelebration(false)}
      />
      <AchievementToast
        achievement={currentAchievement}
        onDone={() => setCurrentAchievement(null)}
      />

      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-xl text-red-500 mb-6">{error}</p>
          <KidButton color="blue" onClick={() => loadNext()}>重试</KidButton>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-7xl animate-pulse">📖</span>
        </div>
      ) : (
        <TeachingCard
          embedded
          wordEn={wordEn}
          meaningZh={meaningZh}
          phonetic={phonetic}
          exampleSentence={exampleSentence}
          onDone={handleDone}
          doneLabel={reviewMode ? '下一个' : '我记住了!'}
          disabled={submitting}
        />
      )}
    </ModuleShell>
  )
}
