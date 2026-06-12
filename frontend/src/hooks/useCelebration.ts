import { useCallback, useState } from 'react'
import type { AchievementData } from '../types'

interface CelebrationState {
  show: boolean
  xpEarned: number
  levelUp: boolean
}

interface CelebrationProps {
  show: boolean
  xpEarned: number
  levelUp: boolean
  onDone: () => void
}

export function useCelebration() {
  const [state, setState] = useState<CelebrationState>({
    show: false,
    xpEarned: 0,
    levelUp: false,
  })
  const [achievementQueue, setAchievementQueue] = useState<AchievementData[]>([])

  const celebrate = useCallback(
    (xpEarned: number, levelUp: boolean, achievements: AchievementData[]) => {
      setState({ show: true, xpEarned, levelUp })
      if (achievements.length > 0) {
        setAchievementQueue((prev) => [...prev, ...achievements])
      }
    },
    [],
  )

  const onDone = useCallback(() => {
    setState((prev) => ({ ...prev, show: false }))
  }, [])

  const dismissAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1))
  }, [])

  const celebrationProps: CelebrationProps = {
    show: state.show,
    xpEarned: state.xpEarned,
    levelUp: state.levelUp,
    onDone,
  }

  return {
    celebrate,
    celebrationProps,
    achievementQueue,
    dismissAchievement,
  }
}
