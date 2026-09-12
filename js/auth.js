/* ============================================================
   Авторизация: вход по персональному токену GitHub (fine-grained PAT).
   Токен хранится только в localStorage этого браузера и отправляется
   исключительно на api.github.com.
   ============================================================ */
(function () {
  "use strict";

  const LS_TOKEN = "shcedule.token";
  const LS_USER = "shcedule.user";

  const Auth = {
    token() {
      try { return localStorage.getItem(LS_TOKEN) || null; } catch (_) { return null; }
    },

    user() {
      try {
        const raw = localStorage.getItem(LS_USER);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    },

    isAuthed() {
      return !!this.token();
    },

    /** Проверить токен и получить личность пользователя. */
    async login(token) {
      token = (token || "").trim();
      if (!token) throw new Error("Вставьте токен");

      // Проверяем токен и достаём логин.
      let me = null;
      try {
        me = await API.me();
      } catch (e) {
        // /user может не ответить у очень урезанных токенов — пробуем rate_limit.
        if (e.status === 401) {
          const err = new Error("Токен не принят GitHub. Проверьте, что вы вставили его целиком и он не истёк.");
          err.status = e.status;
          throw err;
        }
        try { await API.rateLimit(); } catch (_) {
          throw new Error("Не удалось проверить токен. Проверьте соединение и сам токен.");
        }
      }

      const user = me
        ? {
            login: me.login,
            name: me.name || me.login,
            avatar: me.avatar_url || "",
            html_url: me.html_url || "",
          }
        : { login: "user", name: "Вы", avatar: "" };

      try {
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_USER, JSON.stringify(user));
      } catch (_) { /* приватный режим — сессия до перезагрузки */ }

      return user;
    },

    logout() {
      try {
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
      } catch (_) {}
    },
  };

  window.Auth = Auth;
})();
