import type {
  Child,
  ChildStats,
  Course,
  CustomList,
  DailyPlan,
  LearningCheckResult,
  MeaningQuiz,
  PronunciationQuiz,
  PronunciationResult,
  Recommendation,
  SpellingQuiz,
  User,
  WeeklyReport,
  Word,
} from '../types'

const TOKEN_KEY = 'yoyovoice_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const res = await fetch(path, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?from=${returnTo}`
    }
    throw new Error('登录已过期，请重新登录')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('；')
          : data.message || '请求失败'
    throw new Error(message)
  }
  return data as T
}

export const api = {
  register: (body: { email: string; password: string; display_name?: string }) =>
    request<{ access_token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ access_token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  me: () => request<User>('/api/auth/me'),

  children: {
    list: () => request<Child[]>('/api/children'),
    get: (id: number) => request<Child>(`/api/children/${id}`),
    wordPool: (id: number) => request<Word[]>(`/api/children/${id}/word-pool`),
    stats: (id: number) => request<ChildStats>(`/api/children/${id}/stats`),
    create: (body: Partial<Child> & { nickname: string }) =>
      request<Child>('/api/children', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      request<Child>(`/api/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/api/children/${id}`, { method: 'DELETE' }),
    switchSource: (id: number, body: { learning_mode: string; course_id?: number; custom_list_id?: number }) =>
      request<Child>(`/api/children/${id}/switch-source`, { method: 'POST', body: JSON.stringify(body) }),
  },

  courses: {
    list: () => request<Course[]>('/api/courses'),
    words: (id: number) => request<Word[]>(`/api/courses/${id}/words`),
  },

  customLists: {
    list: (childId?: number) =>
      request<CustomList[]>(`/api/custom-lists${childId ? `?child_id=${childId}` : ''}`),
    create: (body: { child_id: number; name: string }) =>
      request<CustomList>('/api/custom-lists', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/api/custom-lists/${id}`, { method: 'DELETE' }),
    words: (id: number) => request<Word[]>(`/api/custom-lists/${id}/words`),
    addWord: (listId: number, wordId: number) =>
      request<Word>(`/api/custom-lists/${listId}/words`, {
        method: 'POST',
        body: JSON.stringify({ word_id: wordId }),
      }),
    removeWord: (listId: number, wordId: number) =>
      request<void>(`/api/custom-lists/${listId}/words/${wordId}`, { method: 'DELETE' }),
  },

  words: {
    create: (body: { word_en: string; meaning_zh?: string; phonetic?: string }) =>
      request<Word>('/api/words', { method: 'POST', body: JSON.stringify(body) }),
    bulk: (words: { word_en: string; meaning_zh?: string; phonetic?: string }[]) =>
      request<Word[]>('/api/words/bulk', { method: 'POST', body: JSON.stringify(words) }),
  },

  dailyPlans: {
    today: (childId: number) =>
      request<DailyPlan | null>(`/api/children/${childId}/daily-plans/today`),
    generate: (
      childId: number,
      body?: {
        new_words?: number
        review_words?: number
        use_all_custom_words?: boolean
        custom_list_id?: number
        force?: boolean
      }
    ) =>
      request<DailyPlan>(`/api/children/${childId}/daily-plans/generate`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
  },

  learning: {
    meaningQuiz: (childId: number, wordId: number, planItemId?: number) =>
      request<MeaningQuiz>(
        `/api/learning/meaning/quiz?child_id=${childId}&word_id=${wordId}${planItemId ? `&plan_item_id=${planItemId}` : ''}`
      ),
    meaningCheck: (body: { child_id: number; word_id: number; selected_meaning: string; plan_item_id?: number; duration_ms?: number }) =>
      request<LearningCheckResult>('/api/learning/meaning/check', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    spellingQuiz: (childId: number, wordId: number, planItemId?: number) =>
      request<SpellingQuiz>(
        `/api/learning/spelling/quiz?child_id=${childId}&word_id=${wordId}${planItemId ? `&plan_item_id=${planItemId}` : ''}`
      ),
    spellingCheck: (body: { child_id: number; word_id: number; spelling: string; plan_item_id?: number; duration_ms?: number }) =>
      request<LearningCheckResult>('/api/learning/spelling/check', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    pronunciationQuiz: (childId: number, wordId: number, planItemId?: number) =>
      request<PronunciationQuiz>(
        `/api/learning/pronunciation/quiz?child_id=${childId}&word_id=${wordId}${planItemId ? `&plan_item_id=${planItemId}` : ''}`
      ),
    pronunciationCheck: (formData: FormData) =>
      request<PronunciationResult>('/api/learning/pronunciation', { method: 'POST', body: formData }),
  },

  ai: {
    recommend: (childId: number, limit = 5) =>
      request<{ recommendations: Recommendation[]; source: string }>('/api/ai/recommend', {
        method: 'POST',
        body: JSON.stringify({ child_id: childId, limit }),
      }),
    importWords: (text: string) =>
      request<{ words: { word_en: string; meaning_zh: string; phonetic?: string }[]; source: string }>(
        '/api/ai/import-words',
        { method: 'POST', body: JSON.stringify({ text }) }
      ),
    importAndSave: (text: string) =>
      request<{ id: number; word_en: string; meaning_zh: string }[]>('/api/ai/import-words/save', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    weeklyReport: (childId: number, days = 7) =>
      request<WeeklyReport>('/api/ai/weekly-report', {
        method: 'POST',
        body: JSON.stringify({ child_id: childId, days }),
      }),
  },
}
