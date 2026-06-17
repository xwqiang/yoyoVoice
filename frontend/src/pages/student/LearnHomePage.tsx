import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../api/client'
import { KidButton } from '../../components/student/KidButton'
import { ModuleProgressBar } from '../../components/student/ModuleProgressBar'
import {
  LEARN_MODULE,
  goToModuleHome,
  moduleProgress,
  pickNextWord,
} from '../../utils/moduleHelpers'
import { primeSpeech } from '../../utils/studentNav'
import type { DailyPlan } from '../../types'

export function LearnHomePage() {
  const { childId } = useParams<{ childId: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [poolSize, setPoolSize] = useState(0)
  const [hasMoreToLearn, setHasMoreToLearn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError('')
    try {
      const id = Number(childId)
      const [p, pool, learned] = await Promise.all([
        api.dailyPlans.today(id),
        api.children.wordPool(id),
        api.children.learnedWords(id),
      ])
      setPlan(p)
      setPoolSize(pool.length)
      const next = await pickNextWord(id, 'learn', [], p, [], learned.word_ids, { review: false })
      setHasMoreToLearn(next !== null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  if (!childId) return null

  const { total, completed } = moduleProgress(plan, 'learn')
  const hasLearnPlan = total > 0
  const planInProgress = hasLearnPlan && completed < total

  return (
    <div className="min-h-screen flex flex-col p-6 pb-10">
      <header className="mb-8">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => goToModuleHome(childId, navigate)}
          className="min-h-12 px-5 bg-white/90 rounded-2xl text-lg font-bold text-sky-500 shadow-md mb-6"
        >
          ← 返回
        </motion.button>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-7xl">{LEARN_MODULE.emoji}</span>
          <h1 className="text-4xl font-extrabold text-sky-700 mt-3">{LEARN_MODULE.label}</h1>
          <p className="text-lg text-slate-500 mt-2">{LEARN_MODULE.subtitle}</p>
        </motion.div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.span
            className="text-7xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            📖
          </motion.span>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xl text-red-500 mb-6">{error}</p>
          <KidButton color="blue" onClick={load}>重试</KidButton>
        </div>
      ) : poolSize === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <span className="text-8xl mb-6">📭</span>
          <p className="text-xl text-amber-600 font-medium">还没有单词，叫爸爸妈妈帮你添加吧</p>
        </div>
      ) : (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full gap-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {hasLearnPlan && (
            <div className="w-full px-2">
              <ModuleProgressBar
                completed={completed}
                total={total}
                label={
                  completed >= total
                    ? '今日学习完成 🎉'
                    : `今日进度 · ${completed}/${total}`
                }
                color="bg-sky-500"
              />
            </div>
          )}

          {(hasMoreToLearn || planInProgress) ? (
            <>
              <motion.span className="text-8xl">📚</motion.span>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-700 mb-2">
                  {planInProgress ? '按顺序认识新单词' : '认识词表里的新单词'}
                </h2>
                <p className="text-lg text-slate-500">
                  {planInProgress
                    ? `还有 ${total - completed} 个单词待学习`
                    : '按顺序逐个学习'}
                </p>
              </div>
              <KidButton
                color="blue"
                onClick={() => {
                  primeSpeech()
                  navigate(`/learn/${childId}/learn/play`)
                }}
              >
                {planInProgress && completed > 0 ? '继续学习 ▶️' : '开始学习 ▶️'}
              </KidButton>
            </>
          ) : (
            <>
              <motion.span
                className="text-9xl"
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                🌟
              </motion.span>
              <div className="text-center">
                <h2 className="text-3xl font-bold text-sky-600 mb-2">今天的单词都学完啦！</h2>
                <p className="text-lg text-slate-500">去挑战认一认、拼一拼、读一读吧</p>
              </div>
              <div className="w-full flex flex-col gap-3">
                <KidButton
                  color="blue"
                  onClick={() => {
                    primeSpeech()
                    navigate(`/learn/${childId}/learn/play?review=1`)
                  }}
                >
                  再复习一遍 🔄
                </KidButton>
                <KidButton
                  color="purple"
                  size="md"
                  onClick={() => goToModuleHome(childId, navigate)}
                >
                  去挑战考核
                </KidButton>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
