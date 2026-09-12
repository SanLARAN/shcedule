/* ============================================================
   Хелперы рендера: элементы, markdown, даты, иконки, карточки,
   тосты, модалки. Никакой логики данных.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Базовые хелперы DOM ---------- */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k === "html") el.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") {
          el.addEventListener(k.slice(2), v);
        } else if (k === "style" && typeof v === "object") {
          Object.assign(el.style, v);
        } else el.setAttribute(k, v === true ? "" : v);
      }
    }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null || c === false) continue;
        el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(c) : c);
      }
    }
    return el;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- Markdown (безопасно) ---------- */
  marked.setOptions({ gfm: true, breaks: true });

  // Все ссылки в рендеренном markdown открываем в новой вкладке.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });

  function md(text) {
    let html;
    try {
      html = marked.parse(text || "");
    } catch (_) {
      html = escapeHtml(text || "");
    }
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ["target"],
      FORBID_TAGS: ["style", "form", "input", "button"],
    });
  }

  function plainExcerpt(markdown, len) {
    const tmp = document.createElement("div");
    tmp.innerHTML = DOMPurify.sanitize(md(markdown), { ALLOWED_TAGS: [] });
    const text = (tmp.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length <= len) return text;
    return text.slice(0, len).trimEnd() + "…";
  }

  /* ---------- Даты и числа ---------- */
  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (!then) return "";
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60000);
    if (min < 1) return "только что";
    if (min < 60) return plural(min, "минуту", "минуты", "минут") + " назад";
    const hr = Math.floor(min / 60);
    if (hr < 24) return plural(hr, "час", "часа", "часов") + " назад";
    const day = Math.floor(hr / 24);
    if (day < 7) return plural(day, "день", "дня", "дней") + " назад";
    return new Date(then).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
    return `${n} ${many}`;
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + "k";
    return String(n);
  }

  /* ---------- Иконки ---------- */
  const I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.78 1.05.78 2.13v3.16c0 .3.2.67.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    write: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 1 10-10c0 2-1.5 3-3 3h-2a2 2 0 0 0-1.5 3.4c.4.4.6 1 .4 1.5-.2.7-.9 1.1-1.9 1.1Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>',
  };

  /* ---------- Чипы и аватары ---------- */
  function avatar(user, size) {
    size = size || 28;
    const el = h("img", {
      class: "avatar",
      width: size,
      height: size,
      loading: "lazy",
      alt: "",
    });
    el.src = (user && (user.avatar || user.avatar_url || user.avatarUrl)) || defaultAvatar();
    el.addEventListener("error", () => { el.src = defaultAvatar(); });
    return el;
  }

  function defaultAvatar() {
    return "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#1f2430"/><circle cx="20" cy="16" r="7" fill="#4a5468"/><path d="M6 34c2-7 7-11 14-11s12 4 14 11" fill="#4a5468"/></svg>`
    );
  }

  function userChip(user, size) {
    if (!user) return h("span", { class: "user-chip" }, "—");
    const chip = h(
      "a",
      { class: "user-chip", href: `#/user/${encodeURIComponent(user.login)}` },
      [avatar(user, size || 22), escapeHtml(user.name || user.login)]
    );
    return chip;
  }

  function tagChip(label, clickable) {
    const color = label.color ? `#${label.color}` : "#6b7386";
    const cls = clickable ? "chip chip--click" : "chip";
    const chip = h("span", { class: cls, dataset: { tag: label.name } }, [
      h("span", { class: "dot", style: { background: color } }),
      escapeHtml(label.name),
    ]);
    return chip;
  }

  /* ---------- Карточка поста ---------- */
  function postCard(post) {
    const tags = (post.labels || [])
      .filter((l) => l.name !== CONFIG.postLabel)
      .map((l) => tagChip(l));

    const title = h("h3", { class: "card__title" }, [
      h("a", { href: `#/post/${post.number}` }, escapeHtml(post.title)),
    ]);

    const card = h(
      "article",
      { class: "card" },
      [
        tags.length ? h("div", { class: "card__tags" }, tags) : null,
        title,
        post.body
          ? h("p", { class: "card__excerpt" }, plainExcerpt(post.body, 190))
          : null,
        h("div", { class: "card__meta" }, [
          userChip(post.user),
          h("span", { class: "stat", title: "Создано" }, [h("span", { html: I.clock }), timeAgo(post.created_at)]),
          h("div", { class: "card__stats" }, [
            h("span", { class: "stat", title: "Комментарии" }, [
              h("span", { html: I.comment }), fmtNum(post.comments),
            ]),
            h("span", { class: "stat", title: "Лайки" }, [
              h("span", { html: I.like }), fmtNum(likeCount(post)),
            ]),
          ]),
        ]),
      ]
    );

    card.addEventListener("click", (e) => {
      // клик по тегу = фильтр, иначе — открыть пост
      const tagEl = e.target.closest("[data-tag]");
      if (tagEl) {
        e.preventDefault();
        location.hash = `#/`;
        window.__tagFilter = tagEl.dataset.tag;
        return;
      }
    });
    return card;
  }

  function likeCount(obj) {
    const r = obj && obj.reactions;
    return r ? (r["+1"] || 0) : 0;
  }

  /* ---------- Тосты ---------- */
  function toast(msg, type) {
    const root = document.getElementById("toast-root");
    const el = h("div", { class: `toast toast--${type || ""}` }, [
      h("span", { class: "toast__dot" }),
      typeof msg === "string" ? document.createTextNode(msg) : msg,
    ]);
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 320);
    }, 3400);
  }

  /* ---------- Модалки ---------- */
  function openModal(content) {
    closeModal();
    const root = document.getElementById("modal-root");
    const backdrop = h("div", { class: "modal-backdrop" }, [
      h("div", { class: "modal", role: "dialog", "aria-modal": "true" }, [content]),
    ]);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    root.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    return backdrop;
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    root.innerHTML = "";
    document.body.style.overflow = "";
  }

  function modalHeader(title, sub) {
    const wrap = h("div", {}, [
      h("button", { class: "modal__close", "aria-label": "Закрыть", onclick: closeModal }, "×"),
      h("h2", { class: "modal__title" }, title),
      sub ? h("p", { class: "modal__sub" }, sub) : null,
    ]);
    return wrap;
  }

  /* ---------- Состояния ---------- */
  function emptyState(icon, title, text, actions) {
    return h("div", { class: "state" }, [
      h("div", { class: "state__icon" }, icon),
      h("div", { class: "state__title" }, title),
      text ? h("p", { class: "state__text" }, text) : null,
      actions ? h("div", {}, actions) : null,
    ]);
  }

  function skeletons(n) {
    n = n || 5;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(
        h("div", { class: "skeleton" }, [
          h("div", { class: "skeleton__line skeleton__line--title" }),
          h("div", { class: "skeleton__line" }),
          h("div", { class: "skeleton__line skeleton__line--short" }),
        ])
      );
    }
    return out;
  }

  function spinner() {
    return h("div", { class: "loading-row" }, [h("div", { class: "spinner" })]);
  }

  /* ---------- Экспорт ---------- */
  window.UI = {
    h, escapeHtml, md, plainExcerpt, timeAgo, plural, fmtNum,
    I, avatar, userChip, tagChip, postCard, likeCount,
    toast, openModal, closeModal, modalHeader,
    emptyState, skeletons, spinner, defaultAvatar,
  };
})();
