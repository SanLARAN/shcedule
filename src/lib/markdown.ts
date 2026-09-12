import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

let hooksInstalled = false
function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy')
      node.setAttribute('alt', node.getAttribute('alt') || 'изображение')
    }
  })
}

/** Превращает @nickname в ссылку на профиль GitHub (не трогая код и ссылки). */
function linkifyMentions(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)

  for (const node of nodes) {
    const parent = node.parentElement
    if (!parent || parent.closest('a, code, pre')) continue
    const text = node.nodeValue || ''
    if (!/@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})/.test(text)) continue

    const frag = document.createDocumentFragment()
    let last = 0
    for (const m of text.matchAll(/@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}))/g)) {
      const idx = m.index ?? 0
      frag.append(document.createTextNode(text.slice(last, idx)))
      const a = document.createElement('a')
      a.className = 'mention'
      a.href = `https://github.com/${m[1]}`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = `@${m[1]}`
      frag.append(a)
      last = idx + m[0].length
    }
    frag.append(document.createTextNode(text.slice(last)))
    node.parentNode?.replaceChild(frag, node)
  }
}

/** Markdown → безопасный HTML */
export function renderMarkdown(source: string): string {
  installHooks()
  const raw = marked.parse(source || '', { async: false }) as string
  const clean = DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel', 'loading'],
    FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'script'],
    FORBID_ATTR: ['style', 'onerror', 'onload'],
  })
  const holder = document.createElement('div')
  holder.innerHTML = clean
  linkifyMentions(holder)
  return holder.innerHTML
}

/** Короткий текстовый превью-текст без разметки */
export function toPlainText(md: string, max = 240): string {
  const withoutHtml = (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (withoutHtml.length <= max) return withoutHtml
  return withoutHtml.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

export function countImages(md: string): number {
  return (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
}
