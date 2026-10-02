/* ============================================================
 * api.js — 前端统一 API 客户端（全站唯一的数据出入口）
 * 职责：
 *   1) 令牌管理（访问令牌 + 刷新令牌，401 自动刷新并重试一次）
 *   2) 统一错误映射（后端 error.message → 可读中文提示）
 *   3) 离线/网络异常提示
 *   4) 会话缓存（供 Auth 同步读取，页面首屏不闪）
 * 所有请求都走同源 /api/*，不硬编码任何后端地址。
 * ============================================================ */
(function () {
  'use strict';

  var T_KEY = 'cyber_astro_access';
  var R_KEY = 'cyber_astro_refresh';
  var P_KEY = 'cyber_astro_profile';

  /* ---------------- 存储（localStorage 不可用时降级内存） ---------------- */
  var mem = {};
  var store = (function () {
    try {
      var t = '__astro_api_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (e) {
      return {
        getItem: function (k) { return mem[k] === undefined ? null : mem[k]; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  function readJson(key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function getAccess() { return store.getItem(T_KEY) || ''; }
  function getRefresh() { return store.getItem(R_KEY) || ''; }
  function hasSession() { return !!(getAccess() || getRefresh()); }

  function setSession(data) {
    if (!data) return;
    if (data.accessToken) store.setItem(T_KEY, data.accessToken);
    if (data.refreshToken) store.setItem(R_KEY, data.refreshToken);
    if (data.user) store.setItem(P_KEY, JSON.stringify(data.user));
  }

  function setCachedProfile(user) {
    if (user) store.setItem(P_KEY, JSON.stringify(user));
    else store.removeItem(P_KEY);
  }

  function cachedProfile() { return readJson(P_KEY); }

  function clearSession() {
    store.removeItem(T_KEY);
    store.removeItem(R_KEY);
    store.removeItem(P_KEY);
  }

  /* ---------------- 错误类型 ---------------- */
  function ApiError(message, code, status, details) {
    var e = new Error(message || '请求失败');
    e.name = 'ApiError';
    e.code = code || 'UNKNOWN';
    e.status = status || 0;
    e.details = details || null;
    return e;
  }

  /* ---------------- 基础请求 ---------------- */
  function raw(method, path, body, token) {
    // GET / HEAD 不允许携带 body（fetch 会直接抛错），此处统一兜底忽略
    if (method === 'GET' || method === 'HEAD') body = undefined;
    var headers = {};
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;

    return fetch(path, {
      method: method,
      headers: headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) ? data.error.message : ('请求失败（HTTP ' + res.status + '）');
          var code = (data && data.error && data.error.code) ? data.error.code : 'HTTP_' + res.status;
          var details = (data && data.error && data.error.details) ? data.error.details : null;
          throw ApiError(msg, code, res.status, details);
        }
        return data;
      });
    }).catch(function (err) {
      if (err && err.name === 'ApiError') throw err;
      // 以本地文件方式打开（file://）时接口必然失败，给出可执行的指引
      if (typeof location !== 'undefined' && location.protocol === 'file:') {
        throw ApiError('当前页面是以本地文件方式打开的，接口无法访问。请先启动后端服务，再通过本地服务地址（如 http://<localhost>:<port>）访问', 'FILE_PROTOCOL', 0);
      }
      // 网络层失败（断网 / 服务未启动）
      throw ApiError('网络连接失败，请检查服务是否已启动', 'NETWORK_ERROR', 0);
    });
  }

  /* ---------------- 401 自动刷新（并发去重） ---------------- */
  var refreshing = null;

  function refreshSession() {
    if (refreshing) return refreshing;
    var rt = getRefresh();
    if (!rt) return Promise.reject(ApiError('登录状态已失效，请重新登录', 'UNAUTHORIZED', 401));
    refreshing = raw('POST', '/api/auth/refresh', { refreshToken: rt }, null)
      .then(function (data) {
        setSession(data);
        return data.accessToken;
      })
      .catch(function (err) {
        clearSession();
        throw err;
      })
      .then(function (v) { refreshing = null; return v; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    return raw(method, path, body, opts.auth === false ? '' : getAccess()).catch(function (err) {
      if (err && err.status === 401 && opts.auth !== false && opts.retry !== false) {
        return refreshSession().then(function (token) {
          return raw(method, path, body, token);
        });
      }
      throw err;
    });
  }

  function qs(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  /* ---------------- 对外 API ---------------- */
  var API = {
    ApiError: ApiError,
    hasSession: hasSession,
    getAccess: getAccess,
    getRefresh: getRefresh,
    setSession: setSession,
    setCachedProfile: setCachedProfile,
    cachedProfile: cachedProfile,
    clearSession: clearSession,

    get: function (path, opts) { return request('GET', path, undefined, opts); },
    post: function (path, body, opts) { return request('POST', path, body, opts); },
    put: function (path, body, opts) { return request('PUT', path, body, opts); },
    patch: function (path, body, opts) { return request('PATCH', path, body, opts); },
    del: function (path, opts) { return request('DELETE', path, undefined, opts); },

    /* 认证 */
    auth: {
      register: function (username, password, confirm) {
        return request('POST', '/api/auth/register', { username: username, password: password, confirm: confirm }, { auth: false, retry: false })
          .then(function (d) { setSession(d); return d; });
      },
      login: function (username, password) {
        return request('POST', '/api/auth/login', { username: username, password: password }, { auth: false, retry: false })
          .then(function (d) { setSession(d); return d; });
      },
      me: function () { return request('GET', '/api/auth/me'); },
      profile: function (patch) { return request('PATCH', '/api/auth/profile', patch); },
      password: function (oldPassword, newPassword) { return request('POST', '/api/auth/password', { oldPassword: oldPassword, newPassword: newPassword }); },
      aiKey: function (apiKey) { return request('POST', '/api/auth/ai-key', { apiKey: apiKey }); },
      deleteAccount: function (confirm) { return request('POST', '/api/auth/delete-account', { confirm: confirm }); },
      logout: function () {
        var rt = getRefresh();
        clearSession();
        return request('POST', '/api/auth/logout', { refreshToken: rt }, { auth: false, retry: false })
          .catch(function () { return { ok: true }; });
      }
    },

    /* 客户档案 */
    customers: {
      list: function () { return request('GET', '/api/customers'); },
      create: function (payload) { return request('POST', '/api/customers', payload); },
      update: function (id, payload) { return request('PUT', '/api/customers/' + encodeURIComponent(id), payload); },
      remove: function (id) { return request('DELETE', '/api/customers/' + encodeURIComponent(id)); },
      importLocal: function (items) { return request('POST', '/api/customers/import', { items: items }); }
    },

    /* 星盘档案 */
    charts: {
      list: function () { return request('GET', '/api/charts'); },
      get: function (id) { return request('GET', '/api/charts/' + encodeURIComponent(id)); },
      create: function (payload) { return request('POST', '/api/charts', payload); },
      remove: function (id) { return request('DELETE', '/api/charts/' + encodeURIComponent(id)); }
    },

    /* 钱包 */
    wallet: {
      summary: function (params) { return request('GET', '/api/wallet' + qs(params)); },
      spend: function (scene, note, amount) { return request('POST', '/api/wallet/spend', { scene: scene, note: note, amount: amount }); },
      refund: function (scene, note, amount) { return request('POST', '/api/wallet/refund', { scene: scene, note: note, amount: amount }); },
      recharge: function (planId) { return request('POST', '/api/wallet/recharge', { planId: planId }); },
      plans: function () { return request('GET', '/api/plans', null, { auth: false }); }
    },

    /* AI（服务端代理，客户端不持有任何密钥） */
    ai: {
      status: function () { return request('GET', '/api/ai/status'); },
      chat: function (scene, messages, temperature, variant) {
        return request('POST', '/api/ai/chat', { scene: scene, messages: messages, temperature: temperature, variant: variant });
      },
      proReport: function (messages, temperature, variant) {
        return request('POST', '/api/ai/pro-report', { messages: messages, temperature: temperature, variant: variant });
      }
    },

    /* 主平台 */
    admin: {
      overview: function () { return request('GET', '/api/admin/overview'); },
      users: function (params) { return request('GET', '/api/admin/users' + qs(params)); },
      usersBrief: function () { return request('GET', '/api/admin/users-brief'); },
      createUser: function (payload) { return request('POST', '/api/admin/users', payload); },
      updateUser: function (id, patch) { return request('PATCH', '/api/admin/users/' + encodeURIComponent(id), patch); },
      resetPassword: function (id, password) { return request('POST', '/api/admin/users/' + encodeURIComponent(id) + '/password', { password: password }); },
      adjustBalance: function (id, amount, note) { return request('POST', '/api/admin/users/' + encodeURIComponent(id) + '/balance', { amount: amount, note: note }); },
      customers: function (params) { return request('GET', '/api/admin/customers' + qs(params)); },
      customer: function (id) { return request('GET', '/api/admin/customers/' + encodeURIComponent(id)); },
      createCustomer: function (payload) { return request('POST', '/api/admin/customers', payload); },
      updateCustomer: function (id, payload) { return request('PUT', '/api/admin/customers/' + encodeURIComponent(id), payload); },
      removeCustomer: function (id) { return request('DELETE', '/api/admin/customers/' + encodeURIComponent(id)); },
      transactions: function (params) { return request('GET', '/api/admin/transactions' + qs(params)); },
      plans: function () { return request('GET', '/api/admin/plans'); },
      createPlan: function (payload) { return request('POST', '/api/admin/plans', payload); },
      updatePlan: function (id, patch) { return request('PUT', '/api/admin/plans/' + encodeURIComponent(id), patch); },
      removePlan: function (id) { return request('DELETE', '/api/admin/plans/' + encodeURIComponent(id)); },
      aiSettings: function () { return request('GET', '/api/admin/ai-settings'); },
      saveAiSettings: function (patch) { return request('PUT', '/api/admin/ai-settings', patch); },
      aiTest: function (payload) { return request('POST', '/api/admin/ai-test', payload); },
      aiLogs: function (params) { return request('GET', '/api/admin/ai-logs' + qs(params)); },
      betaUsers: function (params) { return request('GET', '/api/admin/beta/users' + qs(params)); },
      betaCreate: function (payload) { return request('POST', '/api/admin/beta/users', payload); },
      betaSeed: function (payload) { return request('POST', '/api/admin/beta/seed', payload); },
      betaBackup: function (id) { return request('GET', '/api/admin/beta/users/' + encodeURIComponent(id) + '/backup'); },
      betaResetPassword: function (id, password) { return request('POST', '/api/admin/beta/users/' + encodeURIComponent(id) + '/password', { password: password }); },
      feedbacks: function (params) { return request('GET', '/api/admin/feedbacks' + qs(params)); }
    },

    /* 信息通知 + 留言反馈 */
    notify: {
      list: function (params) { return request('GET', '/api/notify/list' + qs(params)); },
      unreadCount: function () { return request('GET', '/api/notify/unread-count'); },
      read: function (id) { return request('POST', '/api/notify/read', { id: id }); },
      readAll: function () { return request('POST', '/api/notify/read-all'); },
      feedback: function (content, contact) { return request('POST', '/api/notify/feedback', { content: content, contact: contact }); },
      broadcast: function (payload) { return request('POST', '/api/notify/broadcast', payload); }
    }
  };

  /* ---------------- 页面启动引导：校验会话 ---------------- */
  API.bootstrap = function () {
    if (!hasSession()) return Promise.resolve(null);
    return API.auth.me().then(function (d) {
      setCachedProfile(d.user);
      if (window.Auth && window.Auth.renderUserArea) window.Auth.renderUserArea();
      if (window.Billing && window.Billing.refreshChips) window.Billing.refreshChips();
      return d.user;
    }).catch(function () {
      clearSession();
      if (window.Auth && window.Auth.renderUserArea) window.Auth.renderUserArea();
      return null;
    });
  };

  window.API = API;
})();
