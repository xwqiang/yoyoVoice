import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface KidButtonProps {
  children: ReactNode
  color?: 'purple' | 'green' | 'orange' | 'blue' | 'pink'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  className?: string
}

const gradients: Record<string, string> = {
  purple: 'from-violet-500 to-purple-600 shadow-violet-300/50',
  green: 'from-emerald-400 to-teal-600 shadow-emerald-300/50',
  orange: 'from-amber-400 to-orange-500 shadow-orange-300/50',
  blue: 'from-blue-400 to-indigo-600 shadow-blue-300/50',
  pink: 'from-pink-400 to-rose-500 shadow-pink-300/50',
}

const sizes: Record<string, string> = {
  sm: 'min-h-12 text-lg px-6 py-2',
  md: 'min-h-16 text-xl px-8 py-3',
  lg: 'min-h-20 text-2xl px-10 py-4',
}

export function KidButton({
  children,
  color = 'purple',
  size = 'lg',
  disabled = false,
  onClick,
  className = '',
}: KidButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.92 }}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full rounded-full font-bold text-white
        bg-gradient-to-br ${gradients[color]} ${sizes[size]}
        shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {children}
    </motion.button>
  )
}
