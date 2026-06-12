import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../api/client'
import { ModuleShell } from '../../components/student/ModuleShell'
import { KidButton } from '../../components/student/KidButton'
import { TeachingCard } from '../../components/student/TeachingCard'
import { CelebrationOverlay } from '../../components/student/CelebrationOverlay'
import { AchievementToast } from '../../components/student/AchievementToast'
import {
  goToModuleHome,
  moduleProgressLabel,
  pickNextWord,
  STUDENT_MODULES,
} from '../../utils/moduleHelpers'
import { speakWord } from '../../utils/studentNav'
import { playCorrectSound, playWrongSound } from '../../utils/sounds'
import type { AchievementData, DailyPlan, GamificationData } from '../../types'

function scoreToStars(score: number): number {
  if (score >= 85) return 3
  if (score >= 60) return 2
  if (score > 0) return 1
  return 0
}

export function PronunciationModule() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const config = STUDENT_MODULES[2]

  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [sessionDone, setSessionDone] = useState(0)
  const [wordEn, setWordEn] = useState('')
  const [meaningZh, setMeaningZh] = useState('')
  const [wordId, setWordId] = useState(0)
  const [planItemId, setPlanItemId] = useState<number | undefined>()
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stars, setStars] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const [showTeaching, setShowTeaching] = useState(false)
  const [teachingData, setTeachingData] = useState<{
    wordEn: string; meaningZh: string | null; phonetic: string | null; exampleSentence: string | null
  } | null>(null)

  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationXp, setCelebrationXp] = useState(0)
  const [celebrationLevelUp, setCelebrationLevelUp] = useState(false)
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([])
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null)

  const loadNext = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError('')
    setStars(null)
    setSubmitting(false)
    setFinished(false)
    setShowTeaching(false)
    setTeachingData(null)
    setWordEn('')
    try {
      const id = Number(childId)
      const [p, pool] = await Promise.all([
        api.dailyPlans.today(id),
        api.children.wordPool(id),
      ])
      setPlan(p)
      setPoolSize(pool.length)

      const next = await pickNextWord(id, 'pronunciation', [], p)
      if (!next) {
        setFinished(true)
        return
      }
      const quiz = await api.learning.pronunciationQuiz(id, next.wordId, next.planItemId)
      setWordEn(quiz.word_en)
      setMeaningZh(quiz.meaning_zh)
      setWordId(quiz.word_id)
      setPlanItemId(next.planItemId)

      if (quiz.needs_teaching) {
        setTeachingData({
          wordEn: quiz.word_en,
          meaningZh: quiz.meaning_zh,
          phonetic: quiz.phonetic,
          exampleSentence: quiz.example_sentence,
        })
        setShowTeaching(true)
      } else {
        setTimeout(() => speakWord(quiz.word_en), 300)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => { loadNext() }, [loadNext])

  useEffect(() => {
    if (achievementQueue.length > 0 && !currentAchievement) {
      setCurrentAchievement(achievementQueue[0])
      setAchievementQueue((q) => q.slice(1))
    }
  }, [achievementQueue, currentAchievement])

  const handleTeachingDone = () => {
    setShowTeaching(false)
    setTimeout(() => speakWord(wordEn), 200)
  }

  const triggerCelebration = (gamification: GamificationData) => {
    setCelebrationXp(gamification.xp_earned)
    setCelebrationLevelUp(gamification.level_up)
    setShowCelebration(true)
    if (gamification.new_achievements.length > 0) {
      setAchievementQueue((q) => [...q, ...gamification.new_achievements])
    }
  }

  const startRecording = async () => {
    if (recording || submitting || loading) return
    setError('')
    setStars(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunks.current = []
      recorder.ondataavailable = (e) => chunks.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        await submitAudio(blob)
      }
      mediaRecorder.current = recorder
      recorder.start()
      setRecording(true)
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
          setRecording(false)
        }
      }, 4000)
    } catch {
      setError('请允许使用麦克风')
    }
  }

  const submitAudio = async (blob: Blob) => {
    if (!childId) return
    setSubmitting(true)
    const form = new FormData()
    form.append('child_id', String(childId))
    form.append('word_id', String(wordId))
    if (planItemId) form.append('plan_item_id', String(planItemId))
    form.append('audio', blob, 'recording.webm')

    try {
      const data = await api.learning.pronunciationCheck(form)
      const s = scoreToStars(data.pronunciation_score)
      setStars(s)
      if (s >= 2) {
        playCorrectSound()
        triggerCelebration(data.gamification)
        setSessionDone((n) => n + 1)
        setTimeout(() => {
          setShowCelebration(false)
          loadNext()
        }, 2000)
      } else {
        playWrongSound()
        setSubmitting(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '再试一次吧')
      setSubmitting(false)
    }
  }

  const progress = moduleProgressLabel(plan, 'pronunciation', poolSize, sessionDone)

  if (!childId) return null

  return (
    <ModuleShell
      config={config}
      progress={progress}
      onBack={() => goToModuleHome(childId, navigate)}
    >
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

      {showTeaching && teachingData ? (
        <TeachingCard
          wordEn={teachingData.wordEn}
          meaningZh={teachingData.meaningZh}
          phonetic={teachingData.phonetic}
          exampleSentence={teachingData.exampleSentence}
          onDone={handleTeachingDone}
        />
      ) : error && !finished && !loading ? (
        <p className="text-center text-xl text-amber-600 px-6 pt-4">{error}</p>
      ) : null}

      {!showTeaching && (
        <>
          {finished ? (
            <motion.div
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <motion.span
                className="text-9xl mb-6"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                🌟
              </motion.span>
              <h2 className="text-3xl font-bold text-amber-600 mb-4">读一读完成啦！</h2>
              <KidButton color="orange" onClick={() => goToModuleHome(childId, navigate)}>
                返回首页
              </KidButton>
            </motion.div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <motion.span
                className="text-7xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                🎤
              </motion.span>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <motion.p
                className="text-5xl font-extrabold text-violet-600 mb-2"
                key={wordEn}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {wordEn}
              </motion.p>
              {meaningZh && <p className="text-2xl text-slate-500 mb-6">{meaningZh}</p>}

              <motion.button
                onClick={() => speakWord(wordEn)}
                className="mb-6 p-5 bg-white rounded-full shadow-xl"
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-5xl">🔊</span>
              </motion.button>

              <p className="text-xl text-violet-500 font-bold mb-6">大声读出来</p>

              <AnimatePresence mode="wait">
                {stars !== null ? (
                  <motion.div
                    key="stars"
                    className="mb-6"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <div className="flex justify-center gap-3 text-5xl mb-4">
                      {[1, 2, 3].map((i) => (
                        <motion.span
                          key={i}
                          className={i <= stars ? '' : 'opacity-20'}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: i * 0.15 }}
                        >
                          ⭐
                        </motion.span>
                      ))}
                    </div>
                    {stars < 2 && (
                      <KidButton
                        color="orange"
                        onClick={() => { setStars(null); setError(''); setSubmitting(false) }}
                      >
                        再试一次 🎤
                      </KidButton>
                    )}
                  </motion.div>
                ) : (
                  <motion.button
                    key="record"
                    onClick={startRecording}
                    disabled={recording || submitting}
                    className={`w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-transform ${
                      recording ? 'bg-red-400' : 'bg-gradient-to-br from-violet-500 to-indigo-600'
                    } disabled:opacity-60`}
                    animate={recording ? { scale: [1, 1.1, 1] } : {}}
                    transition={recording ? { repeat: Infinity, duration: 0.8 } : {}}
                    whileTap={{ scale: 0.9 }}
                  >
                    <span className="text-6xl">{recording ? '🔴' : '🎤'}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </ModuleShell>
  )
}
