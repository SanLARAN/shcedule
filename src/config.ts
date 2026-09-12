/**
 * Конфигурация форума по умолчанию.
 * Всё это можно поменять прямо на сайте: «Настройки» (значок шестерёнки) —
 * изменения сохранятся в localStorage конкретного браузера.
 */

export type ForumConfig = {
  /** Владелец репозитория, где живут посты (issues) */
  owner: string
  /** Имя репозитория */
  repo: string
  /** client_id GitHub OAuth App с включённым Device Flow (опционально, нужен для входа) */
  clientId: string
  /** Заголовок форума */
  title: string
  /** Короткое описание под заголовком */
  tagline: string
  /** Демо-режим: данные хранятся в браузере, GitHub не используется */
  demo: boolean
}

export const DEFAULT_CONFIG: ForumConfig = {
  owner: 'SanLARAN',
  repo: 'shcedule',
  clientId: '',
  title: 'Форум',
  tagline: 'Обсуждаем, спрашиваем, делимся',
  demo: false,
}

export type Category = {
  id: string
  label: string
  emoji: string
  color: string
  description: string
}

// Цвета разделов — плоские пастельные блоки из референса:
// небо, персик, лайм, лаванда, роза, серый.
export const CATEGORIES: Category[] = [
  { id: 'general', label: 'Общее', emoji: '💬', color: '#A9C7E8', description: 'Всё, что не подошло в другие разделы' },
  { id: 'help', label: 'Помощь', emoji: '🆘', color: '#FFC48A', description: 'Задайте вопрос — сообщество поможет' },
  { id: 'ideas', label: 'Идеи', emoji: '💡', color: '#D8FA4F', description: 'Предложения и обсуждение развития' },
  { id: 'show', label: 'Проекты', emoji: '🚀', color: '#B9A9F5', description: 'Покажите, что вы сделали' },
  { id: 'news', label: 'Новости', emoji: '📰', color: '#F7A8CE', description: 'Анонсы и события' },
  { id: 'offtopic', label: 'Оффтоп', emoji: '☕', color: '#C9CFD6', description: 'Свободное общение' },
]

export const DEFAULT_CATEGORY = 'general'

export function getCategory(id: string | undefined | null): Category {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]
}

/** Префикс для ключей в localStorage */
export const LS_PREFIX = 'forum:'
