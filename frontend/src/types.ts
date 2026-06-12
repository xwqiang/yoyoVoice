export interface User {
  id: number
  email: string
  display_name: string
  account_id: number
}

export interface Child {
  id: number
  account_id: number
  nickname: string
  avatar_emoji: string
  grade: string | null
  pin_code: string | null
  streak_days: number
  xp: number
  level: number
  learning_mode: string
  active_course_id: number | null
  active_custom_list_id: number | null
  daily_new_words: number
  daily_review_words: number
}

export interface Word {
  id: number
  word_en: string
  meaning_zh: string
  phonetic: string | null
  example_sentence: string | null
  image_url: string | null
}

export interface Course {
  id: number
  title: string
  description: string | null
  level: string
  word_count: number
}

export interface CustomList {
  id: number
  child_id: number
  name: string
  word_count: number
}

export interface DailyPlanItem {
  id: number
  word_id: number
  module_type: 'meaning' | 'spelling' | 'pronunciation'
  sort_order: number
  status: string
  is_review: number
  word: Word
}

export interface DailyPlan {
  id: number
  child_id: number
  plan_date: string
  items: DailyPlanItem[]
  total: number
  completed: number
}

export interface AchievementData {
  type: string
  title: string
  desc: string
  emoji: string
  unlocked_at?: string
}

export interface GamificationData {
  xp_earned: number
  total_xp: number
  level: number
  level_up: boolean
  xp_to_next: number
  new_achievements: AchievementData[]
}

export interface LearningCheckResult {
  is_correct: boolean
  correct_answer: string
  score: number
  message: string
  attempt_id: number
  gamification: GamificationData
}

export interface ChildStats {
  xp: number
  level: number
  xp_to_next: number
  xp_for_current_level: number
  streak_days: number
  today_completed: number
  today_total: number
  achievements: AchievementData[]
}

export interface MeaningQuiz {
  word_id: number
  word_en: string
  meaning_zh: string | null
  phonetic: string | null
  example_sentence: string | null
  options: string[]
  quiz_type: string
  plan_item_id: number | null
  needs_teaching: boolean
}

export interface SpellingQuiz {
  word_id: number
  word_en: string
  letters: string[]
  letter_count: number
  meaning_zh: string | null
  phonetic: string | null
  example_sentence: string | null
  prompt_type: string
  plan_item_id: number | null
  needs_teaching: boolean
}

export interface PronunciationQuiz {
  word_id: number
  word_en: string
  meaning_zh: string
  phonetic: string | null
  example_sentence: string | null
  plan_item_id: number | null
  needs_teaching: boolean
}

export interface PronunciationResult {
  is_correct: boolean
  pronunciation_score: number
  accuracy_score: number
  fluency_score: number
  completeness_score: number
  prosody_score: number | null
  message: string
  attempt_id: number
  word: Word
  gamification: GamificationData
}

export interface Recommendation {
  word_id: number
  word_en: string
  module: string
  reason: string
  priority: number
}

export interface WeeklyReport {
  summary: string
  strengths: string[]
  weaknesses: string[]
  suggested_daily_new_words: number
  suggested_daily_review_words: number
  source: string
}
