/* ============================================================
 * account.js — 个人中心 · 账号设置（改昵称 / 留言反馈 / 注销 / 星币 / AI Key）
 * 挂在独立页 public/account.html 的 #accountPage；登录态可见。
 * 所有账号（普通 / 内测 / 站长）均可自助使用；
 * 注销由后端强校验（站长不可注销）。
 * 内测账号（isBeta）额外提供自有 AI Key 配置（保存走服务端加密落盘）。
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function hasSession() { return !!(window.API && API.hasSession()); }

  function currencyName() {
    return (window.SITE_CONFIG && window.SITE_CONFIG.currency) || '星币';
  }

  function renderHead() {
    var p = (window.API && API.cachedProfile()) || {};
    var roleTxt = p.role === 'admin' ? '站长' : (p.isBeta ? '内测用户' : '普通用户');
    var el = $('#accountHead');
    if (!el) return;
    el.innerHTML = '<p style="margin:0 0 14px;font-size:13px;color:var(--ink-dim)">当前账号：<b style="color:var(--ink)">' + esc(p.username || '') + '</b>' +
      ' · 角色：' + roleTxt +
      ' · 当前昵称：' + esc(p.nickname || '（未设置）') + '</p>';
  }

  function renderBalance() {
    var el = $('#accountBalance');
    if (!el) return;
    var unlimited = !!(window.Auth && Auth.isUnlimited());
    var text = unlimited ? '\u221e' : String((window.Auth && Auth.getBalance()) || 0);
    var hint = unlimited ? '（内测 / 站长无限余额，免计费）' : '（AI 问答与专业解析按次扣费）';
    el.innerHTML = '<b style="color:var(--ink)">' + text + '</b> ' + esc(currencyName()) +
      '<span style="font-size:12px;font-weight:400;color:var(--ink-dim);margin-left:10px">' + hint + '</span>';
  }

  function renderAiKey() {
    var box = $('#betaKeyBox');
    if (!box) return;
    var p = (window.API && API.cachedProfile()) || {};
    if (!(p.isBeta)) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    var cur = $('#aiKeyCurrent');
    if (cur) cur.value = p.aiKeyMasked ? p.aiKeyMasked : '（未配置）';
  }

  function saveAiKey() {
    var err = $('#err-aiKey');
    if (err) err.textContent = '';
    var key = $('#aiKeyInput').value.trim();
    if (!key) { if (err) err.textContent = '请输入要保存的 API Key，或点击「清除 Key」'; return; }
    var btn = $('#btnSaveKey');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    API.auth.aiKey(key).then(function (d) {
      if (window.API && API.setCachedProfile) API.setCachedProfile(d.user);
      toast('AI Key 已加密存储并优先使用');
      $('#aiKeyInput').value = '';
      renderAiKey();
      if (window.Auth && Auth.renderUserArea) Auth.renderUserArea();
    }).catch(function (e) {
      if (err) err.textContent = (e && e.message) || '保存失败，请重试';
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '保存 AI Key'; }
    });
  }

  function clearAiKey() {
    var err = $('#err-aiKey');
    if (err) err.textContent = '';
    var btn = $('#btnSaveKey');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    API.auth.aiKey('').then(function (d) {
      if (window.API && API.setCachedProfile) API.setCachedProfile(d.user);
      toast('AI Key 已清除');
      renderAiKey();
      if (window.Auth && Auth.renderUserArea) Auth.renderUserArea();
    }).catch(function (e) {
      if (err) err.textContent = (e && e.message) || '清除失败，请重试';
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '保存 AI Key'; }
    });
  }

  function saveNickname() {
    var err = $('#err-accNickname');
    if (err) err.textContent = '';
    var v = $('#accNickname').value.trim();
    if (!v) { if (err) err.textContent = '请输入昵称'; return; }
    if (v.length > 24) { if (err) err.textContent = '昵称不能超过 24 个字符'; return; }
    API.auth.profile({ nickname: v }).then(function (d) {
      if (window.API && API.setCachedProfile) API.setCachedProfile(d.user);
      toast('昵称已更新为：' + v);
      renderHead();
      if (window.Auth && Auth.renderUserArea) Auth.renderUserArea();
    }).catch(function (e) {
      if (err) err.textContent = (e && e.message) || '保存失败，请重试';
    });
  }

  function sendFeedback() {
    var err = $('#err-fbContent');
    if (err) err.textContent = '';
    var content = $('#fbContent').value.trim();
    var contact = $('#fbContact').value.trim();
    if (!content) { if (err) err.textContent = '请输入反馈内容'; return; }
    if (content.length > 2000) { if (err) err.textContent = '反馈内容不能超过 2000 字'; return; }
    var btn = $('#btnSendFeedback');
    if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }
    API.notify.feedback(content, contact).then(function () {
      toast('反馈已提交，感谢你的留言');
      $('#fbContent').value = '';
      $('#fbContact').value = '';
      if (btn) { btn.disabled = false; btn.textContent = '提交反馈'; }
    }).catch(function (e) {
      if (err) err.textContent = (e && e.message) || '提交失败，请重试';
      if (btn) { btn.disabled = false; btn.textContent = '提交反馈'; }
    });
  }

  function deleteAccount() {
    var err = $('#err-accDelete');
    if (err) err.textContent = '';
    var v = $('#accConfirm').value.trim();
    if (v !== '确认注销') { if (err) err.textContent = '请输入「确认注销」以确认'; return; }
    var btn = $('#btnDeleteAccount');
    if (btn) { btn.disabled = true; btn.textContent = '正在注销…'; }
    API.auth.deleteAccount(v).then(function () {
      toast('账号已注销，感谢使用');
      if (window.API && API.clearSession) API.clearSession();
      setTimeout(function () { location.href = 'index.html'; }, 1500);
    }).catch(function (e) {
      if (err) err.textContent = (e && e.message) || '注销失败，请重试';
      if (btn) { btn.disabled = false; btn.textContent = '注销账号'; }
    });
  }

  function bind() {
    var b1 = $('#btnSaveNickname'); if (b1) b1.addEventListener('click', saveNickname);
    var b2 = $('#btnSendFeedback'); if (b2) b2.addEventListener('click', sendFeedback);
    var b3 = $('#btnDeleteAccount'); if (b3) b3.addEventListener('click', deleteAccount);
    var b4 = $('#btnSaveKey'); if (b4) b4.addEventListener('click', saveAiKey);
    var b5 = $('#btnClearKey'); if (b5) b5.addEventListener('click', clearAiKey);
  }

  function showGuest() {
    var guest = $('#accountGuest');
    var main = $('#accountMain');
    if (guest) guest.style.display = 'block';
    if (main) main.style.display = 'none';
  }

  function showMain() {
    var guest = $('#accountGuest');
    var main = $('#accountMain');
    if (guest) guest.style.display = 'none';
    if (main) main.style.display = 'block';
  }

  function boot() {
    if (!$('#accountPage')) return;
    if (!hasSession()) { showGuest(); return; }
    showMain();
    bind();
    var p = (window.API && API.cachedProfile()) || null;
    if (!p) {
      // 缓存未就绪时等待会话引导完成
      if (window.API && API.bootstrap) {
        API.bootstrap().then(function () {
          renderHead();
          renderBalance();
          renderAiKey();
          var pp = (window.API && API.cachedProfile()) || {};
          if (pp.nickname) $('#accNickname').value = pp.nickname;
        });
      }
      return;
    }
    renderHead();
    renderBalance();
    renderAiKey();
    if (p.nickname) $('#accNickname').value = p.nickname;
  }

  function init() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  init();
})();
