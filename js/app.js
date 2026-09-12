/* ============================================================
   Приложение форума: роутер, лента, пост, композер, профиль,
   авторизация, лайки и комментарии.
   ============================================================ */
(function () {
  "use strict";

  const { h, md, timeAgo, fmtNum, I, avatar, userChip, tagChip, postCard, likeCount } = window.UI;

  const state = {
    posts: null,          // загруженные посты (issues с меткой post)
    postsError: null,
    visible: 20,          // сколько карточек показано
    tagFilter: null,      // активный тег
    query: "",            // строка поиска
    sort: "new",          // new | old | top | comments
    myReactions: {},      // url -> { liked, id }
  };

  const SORTS = {
    new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    old: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    top: (a, b) => likeCount(b) - likeCount(a),
    comments: (a, b) => (b.comments || 0) - (a.comments || 0),
  };

  const PER_STEP = 20;

  /* ============================================================
     Инициализация
     ============================================================ */
  function init() {
    document.getElementById("brand-name").textContent = CONFIG.site.name;
    document.getElementById("brand-tag").textContent = CONFIG.site.tagline;
    document.getElementById("footer-brand").textContent = CONFIG.site.name;
    document.title = `${CONFIG.site.name} — ${CONFIG.site.tagline}`;
    renderAuth();
    window.addEventListener("hashchange", route);
    if (!location.hash) location.replace("#/");
    route();
  }

  /* ============================================================
     Роутер
     ============================================================ */
  function route() {
    closeMenus();
    const hash = location.hash || "#/";
    const m = hash.match(/^#\/post\/(\d+)(\/edit)?$/);
    const u = hash.match(/^#\/user\/(.+)$/);

    if (m) {
      if (m[2]) renderEdit(+m[1]);
      else renderPost(+m[1]);
    } else if (u) {
      renderUser(decodeURIComponent(u[1]));
    } else if (hash === "#/new") {
      renderNew();
    } else {
      renderFeed();
    }
    updateNav();
    window.scrollTo({ top: 0 });
  }

  function updateNav() {
    const hash = location.hash || "#/";
    document.querySelectorAll("#topnav a").forEach((a) => {
      const nav = a.dataset.nav;
      const active =
        (nav === "feed" && !/^#\/(post|user|new)/.test(hash)) ||
        (nav === "new" && hash === "#/new");
      a.classList.toggle("active", !!active);
    });
  }

  /* ============================================================
     Загрузка постов
     ============================================================ */
  async function loadPosts() {
    if (state.posts) return state.posts;
    const raw = await API.listIssues();
    state.posts = raw
      .filter((i) => !i.pull_request)
      .filter((i) => (i.labels || []).some((l) => l.name === CONFIG.postLabel))
      .sort(SORTS.new);
    return state.posts;
  }

  function filteredPosts() {
    const posts = (state.posts || []).slice().sort(SORTS[state.sort] || SORTS.new);
    const q = state.query.trim().toLowerCase();
    return posts.filter((p) => {
      if (state.tagFilter) {
        if (!(p.labels || []).some((l) => l.name === state.tagFilter)) return false;
      }
      if (q) {
        const hay = `${p.title}\n${p.body || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ============================================================
     Лента
     ============================================================ */
  function renderFeed() {
    const app = document.getElementById("app");
    app.innerHTML = "";

    // фильтр, переданный из клика по тегу в карточке
    if (window.__tagFilter) {
      state.tagFilter = window.__tagFilter;
      window.__tagFilter = null;
    }

    const toolbar = feedToolbar();
    const head = h("div", { class: "page__head" }, [
      h("h1", { class: "page__title" }, "Лента"),
      toolbar,
    ]);
    const list = h("div", { class: "post-list" });
    const page = h("div", { class: "page" }, [head, list]);
    app.appendChild(page);

    if (state.posts) {
      renderFeedListOnly();
    } else if (state.postsError) {
      list.appendChild(
        UI.emptyState("😕", "Не удалось загрузить посты", state.postsError, [
          h("button", { class: "btn btn--primary", onclick: () => { state.postsError = null; renderFeed(); } }, "Повторить"),
        ])
      );
    } else {
      list.append(...UI.skeletons(5));
      loadPosts()
        .then(() => { state.visible = PER_STEP; renderFeedListOnly(); })
        .catch((e) => {
          state.postsError = friendlyError(e);
          list.innerHTML = "";
          list.appendChild(
            UI.emptyState("😕", "Не удалось загрузить посты", state.postsError, [
              h("button", { class: "btn btn--primary", onclick: () => { state.postsError = null; state.posts = null; renderFeed(); } }, "Повторить"),
            ])
          );
        });
    }
  }

  function feedToolbar() {
    const search = h("div", { class: "search-box" }, [
      h("span", { html: I.search }),
      h("input", {
        type: "search",
        placeholder: "Поиск по постам…",
        value: state.query,
        oninput: debounce((e) => {
          state.query = e.target.value;
          state.visible = PER_STEP;
          const list = document.querySelector(".post-list");
          if (list) renderFeedListOnly();
        }, 200),
      }),
    ]);

    const sort = h("select", { class: "select", onchange: (e) => {
      state.sort = e.target.value;
      state.visible = PER_STEP;
      renderFeedListOnly();
    }}, [
      h("option", { value: "new", selected: state.sort === "new" }, "Сначала новые"),
      h("option", { value: "top", selected: state.sort === "top" }, "По лайкам"),
      h("option", { value: "comments", selected: state.sort === "comments" }, "По обсуждениям"),
      h("option", { value: "old", selected: state.sort === "old" }, "Сначала старые"),
    ]);

    return h("div", { class: "toolbar" }, [search, sort]);
  }

  function feedChips() {
    const tags = new Map();
    (state.posts || []).forEach((p) =>
      (p.labels || []).forEach((l) => {
        if (l.name !== CONFIG.postLabel) tags.set(l.name, l);
      })
    );
    const chips = [h("span", {
      class: "chip chip--click" + (!state.tagFilter ? " active" : ""),
      onclick: () => { state.tagFilter = null; state.visible = PER_STEP; renderFeedListOnly(); },
    }, "Все")];
    tags.forEach((label) => {
      chips.push(h("span", {
        class: "chip chip--click" + (state.tagFilter === label.name ? " active" : ""),
        onclick: () => { state.tagFilter = label.name; state.visible = PER_STEP; renderFeedListOnly(); },
      }, [h("span", { class: "dot", style: { background: `#${label.color}` } }), label.name]));
    });
    return chips;
  }

  function renderFeedListOnly() {
    const list = document.querySelector(".post-list");
    if (!list) return;
    let chipsRow = document.querySelector(".chips-row");
    if (!chipsRow) {
      chipsRow = h("div", { class: "chips chips-row", style: { marginBottom: "14px" } });
      list.parentElement.insertBefore(chipsRow, list);
    }
    chipsRow.innerHTML = "";
    feedChips().forEach((c) => chipsRow.appendChild(c));

    const posts = filteredPosts();
    list.innerHTML = "";
    if (!posts.length) { list.appendChild(feedEmpty()); return; }
    posts.slice(0, state.visible).forEach((p) => list.appendChild(postCard(p)));
    if (posts.length > state.visible) {
      list.appendChild(h("div", { class: "loading-row" }, [
        h("button", { class: "btn", onclick: () => { state.visible += PER_STEP; renderFeedListOnly(); } },
          `Показать ещё (осталось ${posts.length - state.visible})`),
      ]));
    }
  }

  function feedEmpty() {
    const actions = [];
    if (Auth.isAuthed()) {
      actions.push(h("a", { class: "btn btn--primary", href: "#/new" }, "Написать первый пост"));
    } else {
      actions.push(h("button", { class: "btn btn--primary", onclick: openLogin }, "Войти и написать пост"));
    }
    return UI.emptyState("🗨️", "Пока пусто", "Здесь ещё нет ни одного поста. Станьте первым!", actions);
  }

  /* ============================================================
     Пост
     ============================================================ */
  function renderPost(number) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const page = h("div", { class: "page" });
    app.appendChild(page);
    page.appendChild(UI.spinner());

    Promise.all([API.getIssue(number), API.listComments(number)])
      .then(async ([post, comments]) => {
        await loadLikeStates([post, ...comments]);
        page.innerHTML = "";
        page.appendChild(postView(post, comments));
      })
      .catch((e) => {
        page.innerHTML = "";
        page.appendChild(
          UI.emptyState("😕", "Пост не найден", friendlyError(e), [
            h("a", { class: "btn", href: "#/" }, "← В ленту"),
          ])
        );
      });
  }

  function postView(post, comments) {
    const canEdit = Auth.isAuthed() && Auth.user() && post.user && post.user.login === Auth.user().login;

    const tags = (post.labels || [])
      .filter((l) => l.name !== CONFIG.postLabel)
      .map((l) => tagChip(l));

    const byline = h("div", { class: "post__byline" }, [
      userChip(post.user, 30),
      h("span", {}, `· ${timeAgo(post.created_at)}`),
      post.updated_at && post.updated_at !== post.created_at
        ? h("span", {}, `· изменён ${timeAgo(post.updated_at)}`)
        : null,
    ]);

    const likeBtn = likeButton(post, "like-btn");
    const actions = h("div", { class: "post__actions" }, [
      likeBtn,
      h("span", { class: "stat", title: "Комментарии" }, [h("span", { html: I.comment }), fmtNum(comments.length)]),
      h("a", { class: "btn btn--ghost btn--sm", href: post.html_url, target: "_blank", rel: "noopener noreferrer" },
        [h("span", { html: I.github }), "На GitHub"]),
      canEdit
        ? h("a", { class: "btn btn--ghost btn--sm", href: `#/post/${post.number}/edit` },
            [h("span", { html: I.edit }), "Редактировать"])
        : null,
    ]);

    const commentsBox = commentsSection(post, comments);

    return h("article", { class: "post" }, [
      h("div", { class: "post__head" }, [
        h("a", { class: "post__back", href: "#/" }, [h("span", { html: I.back }), "В ленту"]),
        tags.length ? h("div", { class: "card__tags" }, tags) : null,
        h("h1", { class: "post__title" }, post.title),
        byline,
      ]),
      h("div", { class: "post__body md", html: md(post.body || "") }),
      actions,
      commentsBox,
    ]);
  }

  /* ---------- Комментарии ---------- */
  function commentsSection(post, comments) {
    const box = h("section", { class: "comments" });
    const head = h("div", { class: "comments__head" }, [
      "Комментарии",
      h("span", { class: "count" }, fmtNum(comments.length)),
    ]);
    box.appendChild(head);

    const list = h("div", { class: "comments__list" });
    comments.forEach((c) => list.appendChild(commentView(c)));
    box.appendChild(list);

    // композер комментария
    const composer = commentComposer(post.number);
    box.appendChild(composer);
    return box;
  }

  function commentView(c) {
    const likeBtn = likeMiniButton(c);
    return h("div", { class: "comment" }, [
      avatar(c.user, 34),
      h("div", { class: "comment__main" }, [
        h("div", { class: "comment__head" }, [
          userChip(c.user, 20),
          h("span", { class: "comment__time" }, timeAgo(c.created_at)),
        ]),
        h("div", { class: "comment__body md", html: md(c.body || "") }),
        h("div", { class: "comment__actions" }, [likeBtn]),
      ]),
    ]);
  }

  function commentComposer(number) {
    const wrap = h("div", { class: "comment-composer", style: { marginTop: "16px" } });

    if (!Auth.isAuthed()) {
      wrap.appendChild(
        h("div", { class: "state", style: { padding: "26px 12px" } }, [
          h("div", { class: "state__title" }, "Хотите ответить?"),
          h("p", { class: "state__text" }, "Комментарии и лайки доступны после входа через GitHub."),
          h("button", { class: "btn btn--primary", onclick: openLogin }, "Войти"),
        ])
      );
      return wrap;
    }

    const user = Auth.user();
    const ta = h("textarea", {
      class: "textarea",
      rows: 3,
      placeholder: "Написать комментарий… (поддерживается Markdown)",
    });

    const submit = h("button", { class: "btn btn--primary" }, "Отправить");
    const status = h("span", { class: "composer__hint" });

    submit.addEventListener("click", async () => {
      const body = ta.value.trim();
      if (!body) { UI.toast("Комментарий пустой", "err"); return; }
      submit.disabled = true;
      submit.textContent = "Отправка…";
      try {
        await API.createComment(number, body);
        ta.value = "";
        UI.toast("Комментарий добавлен", "ok");
        renderPost(number); // мягко перерисовываем пост с новым комментарием
      } catch (e) {
        UI.toast(friendlyError(e), "err");
        submit.disabled = false;
        submit.textContent = "Отправить";
      }
    });

    wrap.appendChild(
      h("div", { style: { display: "flex", gap: "11px", alignItems: "flex-start" } }, [
        avatar(user, 34),
        h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "10px" } }, [
          ta,
          h("div", { class: "composer__foot" }, [submit, status, h("span", { class: "markdown-help composer__hint" }, "Markdown поддерживается")]),
        ]),
      ])
    );
    return wrap;
  }

  /* ============================================================
     Лайки
     ============================================================ */
  async function loadLikeStates(items) {
    if (!Auth.isAuthed()) return;
    const login = Auth.user().login;
    await Promise.all(items.map(async (item) => {
      const url = item.reactions && item.reactions.url;
      if (!url) return;
      try {
        const rs = await API.listReactions(url);
        const mine = rs.find((r) => r.content === "+1" && r.user && r.user.login === login);
        state.myReactions[url] = mine ? { liked: true, id: mine.id } : { liked: false, id: null };
      } catch (_) {
        state.myReactions[url] = { liked: false, id: null };
      }
    }));
  }

  function likeButton(item, extraClass) {
    const url = item.reactions && item.reactions.url;
    const st = url && state.myReactions[url];
    const btn = h("button", {
      class: `${extraClass}${st && st.liked ? " liked" : ""}`,
      title: st && st.liked ? "Убрать лайк" : "Нравится",
    });
    const icon = h("span", { html: I.like });
    const label = h("span", { class: "like-count" }, fmtNum(likeCount(item)));
    btn.append(icon, label);
    btn.addEventListener("click", () => toggleLike(item, btn, label));
    return btn;
  }

  function likeMiniButton(item) {
    return likeButton(item, "like-mini");
  }

  async function toggleLike(item, btn, label) {
    if (!Auth.isAuthed()) { openLogin(); return; }
    const url = item.reactions && item.reactions.url;
    if (!url) return;
    const st = state.myReactions[url] || { liked: false, id: null };
    const wantLike = !st.liked;
    btn.disabled = true;
    try {
      if (wantLike) {
        const r = await API.addReaction(url, "+1");
        state.myReactions[url] = { liked: true, id: r.id };
        item.reactions = item.reactions || {};
        item.reactions["+1"] = (item.reactions["+1"] || 0) + 1;
      } else {
        if (st.id) await API.deleteReaction(url, st.id);
        state.myReactions[url] = { liked: false, id: null };
        item.reactions["+1"] = Math.max(0, (item.reactions["+1"] || 0) - 1);
      }
      btn.classList.toggle("liked", wantLike);
      if (label) label.textContent = fmtNum(likeCount(item));
      UI.toast(wantLike ? "Лайк поставлен" : "Лайк убран", "ok");
    } catch (e) {
      UI.toast(friendlyError(e), "err");
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================================================
     Композер (новый пост / редактирование)
     ============================================================ */
  function renderNew() {
    const app = document.getElementById("app");
    app.innerHTML = "";
    if (!Auth.isAuthed()) {
      app.appendChild(
        UI.emptyState("🔐", "Нужен вход", "Публиковать посты могут только вошедшие пользователи (вход через GitHub).", [
          h("button", { class: "btn btn--primary", onclick: openLogin }, "Войти"),
        ])
      );
      return;
    }
    app.appendChild(composerPage(null));
  }

  function renderEdit(number) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const page = h("div", { class: "page" });
    app.appendChild(page);
    page.appendChild(UI.spinner());
    API.getIssue(number)
      .then((post) => {
        if (!Auth.isAuthed() || !Auth.user() || !post.user || post.user.login !== Auth.user().login) {
          page.innerHTML = "";
          page.appendChild(UI.emptyState("⛔", "Нет доступа", "Редактировать можно только свои посты."));
          return;
        }
        page.innerHTML = "";
        page.appendChild(composerPage(post));
      })
      .catch((e) => {
        page.innerHTML = "";
        page.appendChild(UI.emptyState("😕", "Не удалось открыть пост", friendlyError(e)));
      });
  }

  function composerPage(existing) {
    const isEdit = !!existing;
    const titleInput = h("input", {
      class: "input",
      maxlength: 200,
      placeholder: "Заголовок поста…",
      value: existing ? existing.title : "",
    });

    // выбранные теги
    const chosen = new Set(
      existing
        ? (existing.labels || []).filter((l) => l.name !== CONFIG.postLabel).map((l) => l.name)
        : []
    );

    const tagBox = h("div", { class: "chips" });
    CONFIG.tags.forEach((t) => {
      tagBox.appendChild(
        h("span", {
          class: "chip chip--click" + (chosen.has(t.name) ? " active" : ""),
          onclick: (e) => {
            const el = e.currentTarget;
            if (chosen.has(t.name)) { chosen.delete(t.name); el.classList.remove("active"); }
            else { chosen.add(t.name); el.classList.add("active"); }
          },
        }, [h("span", { class: "dot", style: { background: `#${t.color}` } }), t.name])
      );
    });

    const editor = editorField(existing ? existing.body || "" : "");

    const submit = h("button", { class: "btn btn--primary" }, isEdit ? "Сохранить" : "Опубликовать");
    const status = h("span", { class: "composer__hint" });

    submit.addEventListener("click", async () => {
      const title = titleInput.value.trim();
      const body = editor.getValue();
      if (!title) { UI.toast("Укажите заголовок", "err"); titleInput.focus(); return; }
      if (!body.trim()) { UI.toast("Пост пустой — напишите что-нибудь", "err"); return; }
      submit.disabled = true;
      submit.textContent = isEdit ? "Сохраняем…" : "Публикуем…";
      status.textContent = "";
      try {
        await API.ensureLabels();
        const labels = [CONFIG.postLabel, ...Array.from(chosen)];
        if (isEdit) {
          await API.updateIssue(existing.number, { title, body });
          location.hash = `#/post/${existing.number}`;
          UI.toast("Пост обновлён", "ok");
        } else {
          const created = await API.createIssue(title, body, labels);
          state.posts = null; // инвалидируем кэш ленты
          location.hash = `#/post/${created.number}`;
          UI.toast("Пост опубликован", "ok");
        }
      } catch (e) {
        UI.toast(friendlyError(e), "err");
        submit.disabled = false;
        submit.textContent = isEdit ? "Сохранить" : "Опубликовать";
      }
    });

    return h("div", { class: "page" }, [
      h("div", { class: "page__head" }, [
        h("h1", { class: "page__title" }, isEdit ? "Редактировать пост" : "Новый пост"),
      ]),
      h("form", { class: "composer", onsubmit: (e) => e.preventDefault() }, [
        h("div", { class: "field" }, [
          h("label", {}, "Заголовок"),
          titleInput,
        ]),
        h("div", { class: "field" }, [
          h("label", {}, "Теги"),
          tagBox,
        ]),
        h("div", { class: "field" }, [
          h("label", {}, "Текст"),
          editor.root,
        ]),
        h("div", { class: "composer__foot" }, [
          submit, status,
          h("span", { class: "composer__hint markdown-help" }, "Markdown: **жирный**, *курсив*, `код`, [ссылка](https://…), ![картинка](url), ```блок кода```"),
        ]),
      ]),
    ]);
  }

  /* ---------- Редактор markdown ---------- */
  function editorField(initialValue) {
    const textarea = h("textarea", { placeholder: "Текст поста… (Markdown)", value: initialValue });
    const preview = h("div", { class: "preview md", hidden: true });

    const wrap = h("div", { class: "editor" }, [
      h("div", { class: "editor__tabs" }, [
        h("button", { class: "editor__tab active", type: "button", onclick: (e) => switchTab(e, "write") }, "Пишу"),
        h("button", { class: "editor__tab", type: "button", onclick: (e) => switchTab(e, "preview") }, "Предпросмотр"),
      ]),
      h("div", { class: "editor__toolbar" }, toolbarButtons(textarea)),
      textarea,
      preview,
    ]);

    function switchTab(e, mode) {
      wrap.querySelectorAll(".editor__tab").forEach((t) => t.classList.remove("active"));
      e.currentTarget.classList.add("active");
      if (mode === "preview") {
        preview.innerHTML = md(textarea.value);
        preview.hidden = false;
        textarea.style.display = "none";
      } else {
        preview.hidden = true;
        textarea.style.display = "";
      }
    }

    return {
      root: wrap,
      getValue: () => textarea.value,
    };
  }

  function toolbarButtons(textarea) {
    const defs = [
      { title: "Жирный", action: () => surround("**", "**", "жирный"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 5h4.5a3.5 3.5 0 0 1 0 7H8zM8 12h5.5a3.5 3.5 0 0 1 0 7H8z"/></svg>' },
      { title: "Курсив", action: () => surround("*", "*", "курсив"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 5h-6M13 19H7M15 5 9 19"/></svg>' },
      { title: "Заголовок", action: () => linePrefix("## "), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 5v14M18 5v14M6 12h12"/></svg>' },
      { title: "Цитата", action: () => linePrefix("> "), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 6h14M5 12h9M5 18h7"/></svg>' },
      { title: "Код", action: () => surround("`", "`", "код"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/></svg>' },
      { title: "Блок кода", action: () => surround("\n```\n", "\n```\n", "код"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>' },
      { title: "Ссылка", action: () => surround("[", "](https://)", "текст"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>' },
      { title: "Картинка", action: () => surround("![", "](url)", "описание"), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>' },
      { title: "Список", action: () => linePrefix("- "), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/></svg>' },
      { title: "Нумерованный список", action: () => linePrefix("1. "), icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 5h2v3M4 13h1.5a1.5 1.5 0 0 1 0 3H4zM4 18.5h2"/></svg>' },
    ];

    function surround(before, after, ph) {
      const el = textarea;
      const s = el.selectionStart, e = el.selectionEnd;
      const sel = el.value.slice(s, e) || ph;
      el.setRangeText(before + sel + after, s, e, "select");
      el.focus();
    }
    function linePrefix(p) {
      const el = textarea;
      const s = el.selectionStart, e = el.selectionEnd;
      const lineStart = el.value.lastIndexOf("\n", s - 1) + 1;
      el.setRangeText(p, lineStart, lineStart, "end");
      el.focus();
    }

    return defs.map((d) =>
      h("button", { type: "button", title: d.title, onclick: d.action, html: d.icon })
    );
  }

  /* ============================================================
     Профиль пользователя
     ============================================================ */
  function renderUser(login) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const page = h("div", { class: "page" });
    app.appendChild(page);
    page.appendChild(UI.spinner());

    Promise.all([API.getUser(login).catch(() => null), loadPosts().catch(() => null)])
      .then(([user, posts]) => {
        if (!user) {
          page.innerHTML = "";
          page.appendChild(UI.emptyState("👤", "Пользователь не найден", "Не удалось загрузить профиль."));
          return;
        }
        const theirs = (posts || []).filter((p) => p.user && p.user.login === login);
        page.innerHTML = "";

        page.appendChild(
          h("div", { class: "card", style: { display: "flex", gap: "18px", alignItems: "center" } }, [
            avatar(user, 72),
            h("div", { style: { flex: 1, minWidth: 0 } }, [
              h("h1", { class: "page__title", style: { margin: 0 } }, user.name || user.login),
              h("div", { class: "user-chip", style: { marginTop: 2 } }, "@" + user.login),
              user.bio ? h("p", { style: { margin: "10px 0 0", color: "var(--text-dim)", fontSize: "14.5px" } }, user.bio) : null,
            ]),
            h("a", { class: "btn btn--ghost btn--sm", href: user.html_url, target: "_blank", rel: "noopener noreferrer" },
              [h("span", { html: I.github }), "Профиль GitHub"]),
          ])
        );

        page.appendChild(h("h2", { class: "page__title", style: { fontSize: "18px", margin: "22px 0 12px" } },
          `Посты (${theirs.length})`));

        const list = h("div", { class: "post-list" });
        if (!theirs.length) {
          list.appendChild(UI.emptyState("📭", "Пока нет постов", "Этот пользователь ещё ничего не публиковал."));
        } else {
          theirs.forEach((p) => list.appendChild(postCard(p)));
        }
        page.appendChild(list);
      });
  }

  /* ============================================================
     Авторизация (UI)
     ============================================================ */
  function renderAuth() {
    const slot = document.getElementById("auth-slot");
    slot.innerHTML = "";
    if (Auth.isAuthed() && Auth.user()) {
      const user = Auth.user();
      const menu = h("div", { class: "menu" }, [
        h("button", {
          class: "auth-user btn btn--ghost btn--sm",
          onclick: (e) => { e.stopPropagation(); menu.classList.toggle("open"); },
        }, [
          avatar(user, 28),
          h("span", { class: "auth-user__info" }, [
            h("span", { class: "auth-user__name" }, user.name),
            h("span", { class: "auth-user__login" }, "@" + user.login),
          ]),
        ]),
        h("div", { class: "menu__panel" }, [
          h("a", { class: "menu__item", href: `#/user/${encodeURIComponent(user.login)}` }, [h("span", { html: I.github }), "Мой профиль"]),
          h("button", { class: "menu__item menu__item--danger", onclick: () => {
            Auth.logout();
            UI.toast("Вы вышли", "ok");
            renderAuth();
            if (/^#\/(new|post)/.test(location.hash)) route();
          } }, "Выйти"),
        ]),
      ]);
      slot.appendChild(menu);
    } else {
      slot.appendChild(
        h("button", { class: "btn btn--primary btn--sm", onclick: openLogin }, [h("span", { html: I.github }), "Войти"])
      );
    }
  }

  function openLogin() {
    const tokenInput = h("input", {
      class: "input",
      type: "password",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "github_pat_…",
    });
    const submit = h("button", { class: "btn btn--primary", style: { width: "100%" } }, "Войти");

    const doLogin = async () => {
      submit.disabled = true;
      submit.textContent = "Проверяем токен…";
      try {
        const user = await Auth.login(tokenInput.value);
        UI.toast(`Привет, ${user.name}!`, "ok");
        closeModal();
        renderAuth();
        route(); // перерисовать текущую страницу (лайки/права)
      } catch (e) {
        UI.toast(friendlyError(e), "err");
        submit.disabled = false;
        submit.textContent = "Войти";
      }
    };
    submit.addEventListener("click", doLogin);
    tokenInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

    const content = h("div", {}, [
      UI.modalHeader("Вход через GitHub", "Вставьте персональный токен — он используется только для этого форума."),
      h("ol", { class: "steps" }, [
        h("li", {}, [h("span", {}, [
          h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener noreferrer" }, "Откройте создание токена"),
          " (Fine-grained token).",
        ])]),
        h("li", {}, [h("span", {}, ["Repository access → ", h("strong", {}, "Only select repositories"), " → ", h("code", {}, CONFIG.repo.name)])]),
        h("li", {}, [h("span", {}, ["Permissions → ", h("strong", {}, "Issues"), " → ", h("code", {}, "Read and write")])]),
        h("li", {}, [h("span", {}, ["Нажмите ", h("strong", {}, "Generate token"), " и скопируйте его."])]),
      ]),
      h("div", { class: "token-row" }, [tokenInput, submit]),
      h("p", { class: "note" }, [
        h("strong", {}, "Как это работает: "),
        "токен хранится только в localStorage вашего браузера и отправляется исключительно на api.github.com. ",
        "Не вставляйте токен на чужих сайтах. Выйти можно в любой момент из меню профиля.",
      ]),
    ]);
    openModal(content);
    setTimeout(() => tokenInput.focus(), 60);
  }

  function closeMenus() {
    document.querySelectorAll(".menu.open").forEach((m) => m.classList.remove("open"));
  }
  document.addEventListener("click", closeMenus);

  /* ============================================================
     Ошибки и утилиты
     ============================================================ */
  function friendlyError(e) {
    const msg = (e && e.message) || "Неизвестная ошибка";
    if (e && e.status === 401) return "Неверный или истёкший токен. Войдите заново.";
    if (e && e.status === 403) {
      if (/rate limit/i.test(msg)) return "Превышен лимит запросов GitHub. Попробуйте позже или войдите.";
      return "Недостаточно прав. Проверьте, что у токена права Issues → Read and write на этот репозиторий.";
    }
    if (e && e.status === 422) return "Не удалось сохранить: проверьте содержимое (возможно, несуществующая метка).";
    if (e && e.status === 404) return "Не найдено.";
    if (/fetch|network|Failed to fetch/i.test(msg)) return "Сетевая ошибка. Проверьте соединение.";
    return msg;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ============================================================ */
  document.addEventListener("DOMContentLoaded", init);
})();
