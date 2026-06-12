import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Child } from '../types'

interface ChildContextType {
  activeChild: Child | null
  setActiveChild: (child: Child | null) => void
}

const ChildContext = createContext<ChildContextType | null>(null)

export function ChildProvider({ children }: { children: ReactNode }) {
  const [activeChild, setActiveChild] = useState<Child | null>(null)
  return (
    <ChildContext.Provider value={{ activeChild, setActiveChild }}>
      {children}
    </ChildContext.Provider>
  )
}

export function useChild() {
  const ctx = useContext(ChildContext)
  if (!ctx) throw new Error('useChild must be used within ChildProvider')
  return ctx
}
