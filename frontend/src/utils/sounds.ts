let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', startTime = 0) {
  const ctx = getAudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(ctx.currentTime + startTime)
  osc.stop(ctx.currentTime + startTime + duration)
}

export function playCorrectSound(): void {
  playTone(523, 0.15)
  playTone(659, 0.2, 'sine', 0.12)
}

export function playWrongSound(): void {
  playTone(200, 0.3, 'square')
}

export function playLevelUpSound(): void {
  playTone(523, 0.15)
  playTone(659, 0.15, 'sine', 0.15)
  playTone(784, 0.25, 'sine', 0.3)
}
