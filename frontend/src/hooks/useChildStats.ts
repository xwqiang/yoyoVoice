import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ChildStats } from '../types'

export function useChildStats(childId: number | undefined) {
  const [stats, setStats] = useState<ChildStats | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const data = await api.children.stats(childId)
      setStats(data)
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, loading, refresh }
}
