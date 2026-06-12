export function xpForLevel(level: number): number {
  return level * 100
}

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1
  let level = 1
  let cumulative = 0
  while (cumulative + xpForLevel(level) <= xp) {
    cumulative += xpForLevel(level)
    level++
  }
  return level
}

export function xpProgress(xp: number, level: number): number {
  let cumulative = 0
  for (let l = 1; l < level; l++) {
    cumulative += xpForLevel(l)
  }
  const xpInLevel = xp - cumulative
  const needed = xpForLevel(level)
  if (needed <= 0) return 0
  return Math.min(1, Math.max(0, xpInLevel / needed))
}
