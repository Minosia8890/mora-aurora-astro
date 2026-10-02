/* ============================================================
 * auth.js — 账号 / 登录注册 / 星币余额（服务端 API 版）
 * 数据权威源在服务端 SQLite；本模块只缓存会话快照，
 * 以便页面首屏同步渲染（不闪、不阻塞）。
 *
 * 同步方法（读缓存）：currentUser / currentProfile / isAdmin / getBalance
 * 异步方法（走接口）：register / login / logout / refreshProfile / getTxns
 * ============================================================ */
(function () {
  'use strict';

  var MIGRATED_PREFIX = 'cyber_astro_migrated_';
  var OLD_CUSTOMERS_PREFIX = 'cyber_astro_customers_';

  function currencyName() {
    return (window.SITE_CONFIG && window.SITE_CONFIG.currency) || '星币';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------------- 同步读取（缓存） ---------------- */
  function currentProfile() {
    return (window.API && API.cachedProfile()) || null;
  }
  function currentUser() {
    var p = currentProfile();
    return p ? p.username : null;
  }
  function isAdmin() {
    var p = currentProfile();
    return !!(p && p.role === 'admin');
  }
  function isBeta() {
    var p = currentProfile();
    return !!(p && p.isBeta);
  }
  // 星币无限：内测账号（isBeta）与站长账号（admin）余额恒为 ∞，免扣费、无需充值
  function isUnlimited() {
    var p = currentProfile();
    return !!(p && (p.unlimited || p.isBeta || p.role === 'admin'));
  }
  function getBalance() {
    var p = currentProfile();
    return p ? p.balance : 0;
  }
  function balanceText() {
    return isUnlimited() ? '\u221e' : String(getBalance());
  }
  function hasSession() {
    return !!(window.API && API.hasSession());
  }

  /* ---------------- 跳转与保护 ---------------- */
  function requireLogin() {
    if (currentUser() || hasSession()) return true;
    var here = location.pathname.split('/').pop() || 'natal.html';
    location.href = 'login.html?next=' + encodeURIComponent(here);
    return false;
  }

  function requireAdmin() {
    if (!requireLogin()) return false;
    if (isAdmin()) return true;
    // 已登录但不是管理员：交由引导流程确认后再跳转
    API.auth.me().then(function (d) {
      if (d.user.role === 'admin') { location.reload(); return; }
      toast('该页面仅限站长访问');
      setTimeout(function () { location.href = 'index.html'; }, 1200);
    }).catch(function () {
      location.href = 'login.html?next=' + encodeURIComponent('admin.html');
    });
    return false;
  }

  /* ---------------- 异步动作 ---------------- */
  function register(username, password, confirm) {
    return API.auth.register(username, password, confirm).then(function () {
      renderUserArea();
      refreshChips();
      return migrateLocalData().then(function () { return { ok: true }; });
    }).catch(function (err) {
      return { ok: false, msg: err.message };
    });
  }

  function login(username, password) {
    return API.auth.login(username, password).then(function () {
      renderUserArea();
      refreshChips();
      return migrateLocalData().then(function () { return { ok: true }; });
    }).catch(function (err) {
      return { ok: false, msg: err.message };
    });
  }

  function logout() {
    return API.auth.logout().then(function () {
      renderUserArea();
      refreshChips();
    });
  }

  // 重新拉取服务端资料（余额 / 状态变化后同步缓存）
  function refreshProfile() {
    if (!hasSession()) return Promise.resolve(null);
    return API.auth.me().then(function (d) {
      API.setCachedProfile(d.user);
      renderUserArea();
      refreshChips();
      return d.user;
    }).catch(function () { return null; });
  }

  function getTxns(limit, page) {
    return API.wallet.summary({ limit: limit || 50, page: page || 1 }).then(function (d) {
      API.setCachedProfile(Object.assign({}, currentProfile() || {}, { balance: d.balance }));
      refreshChips();
      return d.transactions || [];
    });
  }

  function refreshChips() {
    if (window.Billing && window.Billing.refreshChips) window.Billing.refreshChips();
  }

  /* ---------------- 本地旧数据一次性迁移到云端 ---------------- */
  function migrateLocalData() {
    var user = currentUser();
    if (!user) return Promise.resolve({ skipped: true });
    var flag = MIGRATED_PREFIX + user;
    var pending;
    try {
      if (window.localStorage.getItem(flag) === '1') return Promise.resolve({ skipped: true });
      var raw = window.localStorage.getItem(OLD_CUSTOMERS_PREFIX + user);
      if (!raw) { window.localStorage.setItem(flag, '1'); return Promise.resolve({ skipped: true }); }
      pending = JSON.parse(raw);
    } catch (e) {
      return Promise.resolve({ skipped: true });
    }
    if (!Array.isArray(pending) || !pending.length) {
      try { window.localStorage.setItem(flag, '1'); } catch (e) { /* 忽略 */ }
      return Promise.resolve({ skipped: true });
    }

    return API.customers.importLocal(pending).then(function (r) {
      try { window.localStorage.setItem(flag, '1'); } catch (e) { /* 忽略 */ }
      if (r.inserted > 0) toast('已把本机 ' + r.inserted + ' 位客户资料同步到云端');
      if (window.ClientLib && window.ClientLib.reload) window.ClientLib.reload();
      return r;
    }).catch(function () {
      return { skipped: true, error: true };
    });
  }

  /* ---------------- 页头用户区 ---------------- */
  function renderUserArea() {
    var el = document.getElementById('userArea');
    if (!el) return;
    var p = currentProfile();

    if (!p && hasSession()) {
      el.innerHTML = '<span class="nav-link">加载中…</span>';
      return;
    }
    if (!p) {
      el.innerHTML =
        '<a class="nav-link" href="login.html">登录</a>' +
        '<a class="btn-mini" href="register.html">注册</a>';
      return;
    }

    var name = p.nickname || p.username;
    var unlimited = isUnlimited();
    el.innerHTML =
      '<div class="nav-drop user-menu">' +
      '<a class="nav-link user-chip" href="#" title="账号菜单">' +
      '<b>' + escapeHtml(name) + '</b><span class="dot">·</span>' + balanceText() + ' ' + escapeHtml(currencyName()) +
      ' <span class="caret">&#9662;</span></a>' +
      '<div class="drop-menu">' +
      (p.role === 'admin' ? '<a href="admin.html">主平台后台</a>' : '') +
      (p.isBeta ? '<a href="beta-key.html">AI Key 设置</a>' : '') +
      '<a href="customers.html">客户库</a>' +
      '<a href="account.html">个人中心</a>' +
      (unlimited ? '<span class="nav-link disabled">星币无限 · 无需充值</span>' : '<a href="recharge.html">充值</a>') +
      '<a href="#" id="btnChangePwd">修改密码</a>' +
      '<a href="#" id="btnLogout">退出</a>' +
      '</div></div>';

    var lo = el.querySelector('#btnLogout');
    if (lo) lo.addEventListener('click', function (e) {
      e.preventDefault();
      logout().then(function () { location.href = 'index.html'; });
    });

    var cp = el.querySelector('#btnChangePwd');
    if (cp) cp.addEventListener('click', function (e) {
      e.preventDefault();
      openChangePasswordModal();
    });
  }

  /* ---------------- 修改密码（弹窗） ---------------- */
  function showCpErr(msg) {
    var e = document.getElementById('cpErr');
    if (!e) return;
    e.textContent = msg || '';
    e.style.display = msg ? 'block' : 'none';
  }

  function closeChangePasswordModal() {
    var mask = document.getElementById('changePwdModal');
    if (mask) mask.classList.remove('show');
  }

  function openChangePasswordModal() {
    var mask = document.getElementById('changePwdModal');
    if (mask) { mask.classList.add('show'); return; }
    mask = document.createElement('div');
    mask.id = 'changePwdModal';
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal">' +
      '<h3>修改密码</h3>' +
      '<div class="hint">修改成功后需重新登录，其他设备将自动下线。</div>' +
      '<div class="field"><label for="cpOld">原密码</label>' +
      '<input type="password" id="cpOld" autocomplete="current-password" placeholder="请输入当前密码"></div>' +
      '<div class="field"><label for="cpNew">新密码</label>' +
      '<input type="password" id="cpNew" autocomplete="new-password" placeholder="至少 6 位"></div>' +
      '<div class="field"><label for="cpNew2">确认新密码</label>' +
      '<input type="password" id="cpNew2" autocomplete="new-password" placeholder="再次输入新密码"></div>' +
      '<div class="err" id="cpErr" style="display:none"></div>' +
      '<div class="modal-actions">' +
      '<button class="btn-ghost" id="cpCancel" type="button">取消</button>' +
      '<button class="btn-primary" id="cpSubmit" type="button">确认修改</button>' +
      '</div></div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) closeChangePasswordModal();
    });
    mask.querySelector('#cpCancel').addEventListener('click', closeChangePasswordModal);
    mask.querySelector('#cpSubmit').addEventListener('click', submitChangePassword);
    mask.classList.add('show');
    setTimeout(function () {
      var i = mask.querySelector('#cpOld');
      if (i) i.focus();
    }, 60);
  }

  function submitChangePassword() {
    var oldPw = (document.getElementById('cpOld') || {}).value || '';
    var newPw = (document.getElementById('cpNew') || {}).value || '';
    var newPw2 = (document.getElementById('cpNew2') || {}).value || '';
    showCpErr('');
    if (!oldPw) { showCpErr('请输入原密码'); return; }
    if (newPw.length < 6) { showCpErr('新密码至少 6 位'); return; }
    if (newPw !== newPw2) { showCpErr('两次输入的新密码不一致'); return; }
    var btn = document.getElementById('cpSubmit');
    if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }
    API.auth.password(oldPw, newPw).then(function () {
      closeChangePasswordModal();
      toast('密码修改成功，请重新登录');
      API.clearSession();
      var next = location.pathname.split('/').pop() || 'natal.html';
      setTimeout(function () { location.href = 'login.html?next=' + encodeURIComponent(next); }, 1200);
    }).catch(function (err) {
      showCpErr(err && err.message ? err.message : '修改失败，请重试');
      if (btn) { btn.disabled = false; btn.textContent = '确认修改'; }
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    renderUserArea();
    if (window.API && API.bootstrap) {
      API.bootstrap().then(function () { renderUserArea(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.Auth = {
    // 同步
    currentUser: currentUser,
    currentProfile: currentProfile,
    isAdmin: isAdmin,
    isBeta: isBeta,
    isUnlimited: isUnlimited,
    getBalance: getBalance,
    balanceText: balanceText,
    hasSession: hasSession,
    requireLogin: requireLogin,
    requireAdmin: requireAdmin,
    renderUserArea: renderUserArea,
    // 异步
    register: register,
    login: login,
    logout: logout,
    refreshProfile: refreshProfile,
    getTxns: getTxns,
    migrateLocalData: migrateLocalData
  };
})();
