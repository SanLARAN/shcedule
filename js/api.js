/* ============================================================
   Тонкий клиент GitHub REST API (все вызовы — только к api.github.com).
   Чтение доступно анонимно, запись — с токеном пользователя.
   ============================================================ */
(function () {
  "use strict";

  const API_BASE = "https://api.github.com";
  const CONFIG = window.CONFIG;

  function repoPath() {
    return `/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}`;
  }

  function authHeaders(extra) {
    const h = { Accept: "application/vnd.github+json" };
    const token = window.Auth ? window.Auth.token() : null;
    if (token) h.Authorization = "Bearer " + token;
    if (extra) Object.assign(h, extra);
    return h;
  }

  /** Выполнить запрос, разобрать JSON и ошибки. */
  async function apiFetch(path, opts = {}) {
    const res = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: authHeaders(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const rate = {
      limit: res.headers.get("x-ratelimit-limit"),
      remaining: res.headers.get("x-ratelimit-remaining"),
      reset: res.headers.get("x-ratelimit-reset"),
    };

    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) {
      try { data = await res.json(); } catch (_) { /* пустое тело */ }
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const err = new Error((data && data.message) || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.rate = rate;
      throw err;
    }
    return { data, headers: res.headers, rate };
  }

  /** Пройтись по всем страницам (Link-заголовок rel="next"). */
  async function listAllPages(path, maxPages) {
    let page = 1;
    let all = [];
    while (page <= maxPages) {
      const sep = path.includes("?") ? "&" : "?";
      const { data, headers } = await apiFetch(`${path}${sep}per_page=100&page=${page}`);
      const items = Array.isArray(data) ? data : [];
      all = all.concat(items);
      const link = headers.get("link") || "";
      if (!/rel="next"/.test(link)) break;
      if (items.length === 0) break;
      page++;
    }
    return all;
  }

  function absToPath(url) {
    if (!url) return "";
    return String(url).replace(/^https?:\/\/api\.github\.com/i, "");
  }

  const API = {
    /* ---------- Репо / пользователь ---------- */
    getRepo() { return apiFetch(repoPath()).then((r) => r.data); },
    me() { return apiFetch("/user").then((r) => r.data); },
    getUser(login) {
      return apiFetch(`/users/${encodeURIComponent(login)}`).then((r) => r.data);
    },
    rateLimit() { return apiFetch("/rate_limit").then((r) => r.data); },

    /* ---------- Посты (issues) ---------- */
    listIssues() {
      const maxPages = Math.ceil(CONFIG.maxPosts / 100);
      return listAllPages(`${repoPath()}/issues?state=all`, maxPages);
    },
    getIssue(number) {
      return apiFetch(`${repoPath()}/issues/${number}`).then((r) => r.data);
    },
    createIssue(title, body, labels) {
      return apiFetch(`${repoPath()}/issues`, {
        method: "POST",
        body: { title, body, labels },
      }).then((r) => r.data);
    },
    updateIssue(number, patch) {
      return apiFetch(`${repoPath()}/issues/${number}`, {
        method: "PATCH",
        body: patch,
      }).then((r) => r.data);
    },

    /* ---------- Комментарии ---------- */
    listComments(number) {
      const maxPages = Math.ceil(CONFIG.maxCommentsPerPost / 100);
      return listAllPages(`${repoPath()}/issues/${number}/comments`, maxPages);
    },
    createComment(number, body) {
      return apiFetch(`${repoPath()}/issues/${number}/comments`, {
        method: "POST",
        body: { body },
      }).then((r) => r.data);
    },

    /* ---------- Лайки (реакции +1) ---------- */
    listReactions(url) {
      return listAllPages(absToPath(url), 10);
    },
    addReaction(url, content) {
      return apiFetch(absToPath(url) + "/reactions", {
        method: "POST",
        body: { content: content || "+1" },
      }).then((r) => r.data);
    },
    deleteReaction(url, reactionId) {
      return apiFetch(`${absToPath(url)}/reactions/${reactionId}`, {
        method: "DELETE",
      }).then(() => true);
    },

    /* ---------- Метки ---------- */
    async ensureLabels() {
      const wanted = [
        { name: CONFIG.postLabel, color: "7c5cff", description: "Пост форума" },
        ...CONFIG.tags.map((t) => ({
          name: t.name,
          color: t.color,
          description: `Тег «${t.name}»`,
        })),
      ];
      for (const label of wanted) {
        const exists = await apiFetch(
          `${repoPath()}/labels/${encodeURIComponent(label.name)}`
        ).then(() => true).catch((e) => (e.status === 404 ? false : Promise.reject(e)));
        if (!exists) {
          await apiFetch(`${repoPath()}/labels`, {
            method: "POST",
            body: { name: label.name, color: label.color, description: label.description },
          });
        }
      }
    },
  };

  window.API = API;
})();
