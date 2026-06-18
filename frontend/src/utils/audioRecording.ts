export type RecordingFormat = { mimeType: string; ext: string }

export function pickRecordingFormat(): RecordingFormat {
  const candidates: RecordingFormat[] = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/mp4', ext: 'm4a' },
    { mimeType: 'audio/aac', ext: 'aac' },
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c
    }
  }
  return { mimeType: '', ext: 'webm' }
}

export function micErrorMessage(err: unknown): string {
  if (!window.isSecureContext) {
    return '请用 HTTPS 打开（手机通过局域网 IP 访问时无法使用麦克风）'
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return '当前浏览器不支持录音，请用 Safari 或 Chrome 打开'
  }
  if (typeof MediaRecorder === 'undefined') {
    return '当前浏览器不支持录音，请升级系统或换 Safari/Chrome'
  }
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '请允许使用麦克风：点地址栏旁的锁/设置图标，开启麦克风权限后刷新'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '未检测到麦克风'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '麦克风被其他应用占用，请关闭后重试'
  }
  return '无法使用麦克风，请确认已授权并用 Safari/Chrome 打开'
}

export async function recordAudio(durationMs: number): Promise<{ blob: Blob; ext: string }> {
  const format = pickRecordingFormat()
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  try {
    const recorder = new MediaRecorder(stream, format.mimeType ? { mimeType: format.mimeType } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('recording failed'))
      recorder.onstop = () => {
        const type = format.mimeType || recorder.mimeType || 'audio/webm'
        resolve(new Blob(chunks, { type }))
      }
      recorder.start(250)
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, durationMs)
    })
    return { blob, ext: format.ext }
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}

export class HoldToRecordSession {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private format: RecordingFormat = pickRecordingFormat()
  private startedAt = 0
  private stopped = false
  private maxTimer: ReturnType<typeof setTimeout> | null = null

  async begin(maxMs = 8000, onMaxReached?: () => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.recorder = new MediaRecorder(
      this.stream,
      this.format.mimeType ? { mimeType: this.format.mimeType } : undefined,
    )
    this.chunks = []
    this.stopped = false
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.start(250)
    this.startedAt = Date.now()
    if (onMaxReached) {
      this.maxTimer = setTimeout(onMaxReached, maxMs)
    }
  }

  async end(minMs = 400): Promise<{ blob: Blob; ext: string; durationMs: number }> {
    if (!this.recorder || this.stopped) throw new Error('录音未开始')
    this.stopped = true
    if (this.maxTimer) clearTimeout(this.maxTimer)

    const durationMs = Date.now() - this.startedAt
    const blob = await new Promise<Blob>((resolve, reject) => {
      const rec = this.recorder!
      rec.onerror = () => reject(new Error('recording failed'))
      rec.onstop = () => {
        const type = this.format.mimeType || rec.mimeType || 'audio/webm'
        resolve(new Blob(this.chunks, { type }))
      }
      if (rec.state === 'recording') rec.stop()
      else reject(new Error('录音未开始'))
    })

    this.cleanup()

    if (durationMs < minMs) {
      throw new Error('录音太短，按住多说一会儿')
    }
    if (blob.size < 100) {
      throw new Error('没录到声音，请检查麦克风权限')
    }

    return { blob, ext: this.format.ext, durationMs }
  }

  cancel(): void {
    if (this.stopped) return
    this.stopped = true
    if (this.maxTimer) clearTimeout(this.maxTimer)
    if (this.recorder?.state === 'recording') this.recorder.stop()
    this.cleanup()
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.recorder = null
  }
}
