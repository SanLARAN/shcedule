/**
 * Демо-режим: форум работает без GitHub — посты и комментарии лежат
 * в localStorage браузера. Удобно, чтобы посмотреть интерфейс и потыкать
 * всё руками до/без настройки репозитория.
 */
import { DEFAULT_CATEGORY } from '../config'
import type { Author, NewThreadInput, Thread, ThreadComment } from './model'
import { toPlainText } from './markdown'

const KEY = 'forum:demo:db'

type DemoDB = {
  threads: Thread[]
  comments: Record<number, ThreadComment[]>
  seq: number
}

const HOUR = 3600 * 1000
const DAY = 24 * HOUR

function avatar(login: string, seed: string): string {
  return `https://avatars.githubusercontent.com/${login}?s=120&v=${seed}`
}

function makeThread(
  number: number,
  title: string,
  body: string,
  author: string,
  category: string,
  tags: string[],
  ageMs: number,
  comments: number,
  likes: number,
): Thread {
  const created = new Date(Date.now() - ageMs).toISOString()
  return {
    number,
    title,
    body,
    excerpt: toPlainText(body, 220),
    author: { login: author, avatar: avatar(author, 'demo'), url: `https://github.com/${author}` },
    createdAt: created,
    updatedAt: created,
    comments,
    likes,
    likedByMe: false,
    category,
    tags,
    state: 'open',
    htmlUrl: '#',
    hasImages: false,
    pinned: false,
  }
}

function seed(): DemoDB {
  const threads: Thread[] = [
    makeThread(
      1,
      'Добро пожаловать на форум — начните отсюда 👋',
      [
        'Это пространство для спокойных и полезных обсуждений. Здесь можно задавать вопросы, делиться находками и предлагать идеи.',
        '',
        '**Три простых правила:**',
        '',
        '1. Уважайте собеседников — без перехода на личности.',
        '2. Пишите в подходящий раздел, чтобы тему было легко найти.',
        '3. Делитесь деталями: чем больше контекста, тем полезнее ответ.',
        '',
        'Если что-то не работает — загляните в раздел **Помощь** или создайте тему с описанием проблемы.',
      ].join('\n'),
      'community',
      'news',
      ['правила', 'старт'],
      6 * DAY,
      3,
      12,
    ),
    makeThread(
      2,
      'Как вы храните заметки и задачи?',
      [
        'Долго искал систему, которая не разваливается через месяц. Пробовал всё: от бумажного блокнота до связки Obsidian + Todoist.',
        '',
        'Что в итоге работает у меня:',
        '',
        '- одна папка с markdown-файлами, имена вида `2026-09-12-тема.md`;',
        '- каждую неделю — 15 минут на разбор входящих заметок;',
        '- в задачи переходит только то, что имеет конкретный следующий шаг.',
        '',
        'А как устроено у вас? Интересуют именно живые процессы, а не идеальные схемы.',
      ].join('\n'),
      'ivan-dev',
      'general',
      ['заметки', 'продуктивность'],
      2 * DAY + 3 * HOUR,
      7,
      18,
    ),
    makeThread(
      3,
      'Вход через GitHub не срабатывает — что проверить?',
      [
        'Нажимаю «Войти через GitHub», ввожу код, но сайт остаётся гостем.',
        '',
        '```text',
        'authorization_pending ... и тишина',
        '```',
        '',
        'Что я проверил: режим инкогнито, другой браузер, отключил блокировщики. Не помогло.',
      ].join('\n'),
      'marina_k',
      'help',
      ['вход', 'github'],
      22 * HOUR,
      4,
      3,
    ),
    makeThread(
      4,
      'Идея: уведомления об ответах и черновики постов',
      [
        'Было бы удобно получать уведомления о новых ответах в теме и сохранять черновик, если случайно закрыл вкладку.',
        '',
        'Черновик можно складывать в localStorage — сервер для этого не нужен, а потерянные посты исчезнут.',
      ].join('\n'),
      'dev_sasha',
      'ideas',
      ['фичи', 'ux'],
      5 * HOUR,
      2,
      9,
    ),
    makeThread(
      5,
      'Показываю пет-проект: трекер привычек на 200 строк',
      [
        'Сделал минималистичный трекер: одна страница, данные в localStorage, экспорт в JSON.',
        '',
        '![скриншот](https://placehold.co/720x260/3b6cf6/ffffff?text=Habit+Tracker)',
        '',
        'Главная находка: если убрать «мотивационные» экраны, люди просто отмечают дни и не бросают.',
      ].join('\n'),
      'pixel_anton',
      'show',
      ['проект', 'javascript'],
      9 * HOUR,
      5,
      14,
    ),
    makeThread(
      6,
      'Кофе или чай во время дедлайнов?',
      [
        'Классический спор оффтопа. Я за чай: от кофе на третьей чашке начинаю рефакторить то, что работало.',
        '',
        'А вы чем себя поддерживаете в длинные дни?',
      ].join('\n'),
      'lena',
      'offtopic',
      ['оффтоп'],
      3 * HOUR,
      6,
      21,
    ),
  ]

  const comments: Record<number, ThreadComment[]> = {
    1: [
      {
        id: 101,
        body: 'Спасибо за форум! Отдельно радует, что нет бесконечных уровней вложенности — читать легко.',
        author: { login: 'marina_k', avatar: avatar('marina_k', 'demo'), url: 'https://github.com/marina_k' },
        createdAt: new Date(Date.now() - 5 * DAY).toISOString(),
        htmlUrl: '#',
        likes: 4,
      },
      {
        id: 102,
        body: 'Предложение: закрепить тему с FAQ по входу через GitHub — вопросы повторяются.',
        author: { login: 'ivan-dev', avatar: avatar('ivan-dev', 'demo'), url: 'https://github.com/ivan-dev' },
        createdAt: new Date(Date.now() - 3 * DAY).toISOString(),
        htmlUrl: '#',
        likes: 2,
      },
    ],
    2: [
      {
        id: 103,
        body: 'У меня всё в одном файле `today.md`. Утром переписываю список заново — лишнее отваливается само.',
        author: { login: 'pixel_anton', avatar: avatar('pixel_anton', 'demo'), url: 'https://github.com/pixel_anton' },
        createdAt: new Date(Date.now() - 30 * HOUR).toISOString(),
        htmlUrl: '#',
        likes: 6,
      },
      {
        id: 104,
        body: 'Пробовал weekly review — держится ровно две недели, потом забываю. Как вы не бросаете ритуал?',
        author: { login: 'lena', avatar: avatar('lena', 'demo'), url: 'https://github.com/lena' },
        createdAt: new Date(Date.now() - 12 * HOUR).toISOString(),
        htmlUrl: '#',
        likes: 3,
      },
    ],
    3: [
      {
        id: 105,
        body: 'Похоже на `device_flow_disabled` в настройках OAuth App. Владельцу нужно включить галочку Device Flow.',
        author: { login: 'dev_sasha', avatar: avatar('dev_sasha', 'demo'), url: 'https://github.com/dev_sasha' },
        createdAt: new Date(Date.now() - 5 * HOUR).toISOString(),
        htmlUrl: '#',
        likes: 5,
      },
    ],
  }

  threads[0].pinned = true
  return { threads, comments, seq: 1000 }
}

function read(): DemoDB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDB
      if (parsed && Array.isArray(parsed.threads)) return parsed
    }
  } catch {
    /* повреждённые данные — просто пересоздаём */
  }
  const fresh = seed()
  write(fresh)
  return fresh
}

function write(db: DemoDB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* переполнение хранилища — игнорируем */
  }
}

export function demoListThreads(): Thread[] {
  return read().threads.slice()
}

export function demoGetThread(number: number): { thread: Thread | null; comments: ThreadComment[] } {
  const db = read()
  const thread = db.threads.find((t) => t.number === number) || null
  return { thread, comments: db.comments[number] || [] }
}

export function demoCreateThread(input: NewThreadInput, author: Author): Thread {
  const db = read()
  const number = Math.max(0, ...db.threads.map((t) => t.number)) + 1
  const now = new Date().toISOString()
  const thread: Thread = {
    number,
    title: input.title.trim(),
    body: input.body.trim(),
    excerpt: toPlainText(input.body, 220),
    author,
    createdAt: now,
    updatedAt: now,
    comments: 0,
    likes: 0,
    likedByMe: false,
    category: input.category || DEFAULT_CATEGORY,
    tags: input.tags.slice(0, 6),
    state: 'open',
    htmlUrl: '#',
    hasImages: /!\[[^\]]*\]\([^)]+\)/.test(input.body),
  }
  db.threads.unshift(thread)
  write(db)
  return thread
}

export function demoAddComment(number: number, body: string, author: Author): ThreadComment {
  const db = read()
  const now = new Date().toISOString()
  const comment: ThreadComment = {
    id: ++db.seq,
    body: body.trim(),
    author,
    createdAt: now,
    htmlUrl: '#',
    likes: 0,
  }
  db.comments[number] = [...(db.comments[number] || []), comment]
  const thread = db.threads.find((t) => t.number === number)
  if (thread) {
    thread.comments = db.comments[number].length
    thread.updatedAt = now
  }
  write(db)
  return comment
}

export function demoToggleLike(number: number): number {
  const db = read()
  const thread = db.threads.find((t) => t.number === number)
  if (!thread) return 0
  thread.likedByMe = !thread.likedByMe
  thread.likes = Math.max(0, thread.likes + (thread.likedByMe ? 1 : -1))
  write(db)
  return thread.likes
}

export function demoReset() {
  write(seed())
}
