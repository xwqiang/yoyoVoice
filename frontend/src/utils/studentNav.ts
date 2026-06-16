import type { NavigateFunction } from 'react-router-dom'
import { api } from '../api/client'

/** 在用户点击时调用，解锁 iOS / Safari 的语音播放 */
export function primeSpeech() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.resume()
}

function whenVoicesReady(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([])
      return
    }
    const synth = window.speechSynthesis
    const existing = synth.getVoices()
    if (existing.length > 0) {
      resolve(existing)
      return
    }
    const timer = window.setTimeout(() => resolve(synth.getVoices()), timeoutMs)
    synth.onvoiceschanged = () => {
      window.clearTimeout(timer)
      resolve(synth.getVoices())
    }
  })
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.startsWith('en'))
  return (
    en.find((v) => v.lang === 'en-US' && !v.localService) ??
    en.find((v) => v.lang === 'en-US') ??
    en[0] ??
    null
  )
}

export function speakText(text: string, lang = 'en-US', rate = 0.85) {
  const trimmed = text.trim()
  if (!trimmed || typeof window === 'undefined' || !window.speechSynthesis) return

  void whenVoicesReady().then((voices) => {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const u = new SpeechSynthesisUtterance(trimmed)
    u.lang = lang
    u.rate = rate
    const voice = pickEnglishVoice(voices)
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
  })
}

export function speakWord(word: string) {
  speakText(word)
}

/** 先读单词，再读例句（若有） */
export function speakWordWithExample(word: string, example: string | null | undefined) {
  const trimmedWord = word.trim()
  if (!trimmedWord || typeof window === 'undefined' || !window.speechSynthesis) return

  void whenVoicesReady().then((voices) => {
    const voice = pickEnglishVoice(voices)
    const trimmedExample = example?.trim()

    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()

    const wordUtter = new SpeechSynthesisUtterance(trimmedWord)
    wordUtter.lang = 'en-US'
    wordUtter.rate = 0.85
    if (voice) wordUtter.voice = voice

    if (trimmedExample) {
      wordUtter.onend = () => {
        const exUtter = new SpeechSynthesisUtterance(trimmedExample)
        exUtter.lang = 'en-US'
        exUtter.rate = 0.8
        if (voice) exUtter.voice = voice
        window.speechSynthesis.speak(exUtter)
      }
    }

    window.speechSynthesis.speak(wordUtter)
  })
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
