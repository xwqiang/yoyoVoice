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
      recorder.start()
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, durationMs)
    })
    return { blob, ext: format.ext }
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}
