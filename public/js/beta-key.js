/* ============================================================
 * public/js/beta-key.js — 内测账号自有 AI Key 配置页
 * 仅内测账号（isBeta）可访问；保存走服务端 AES-GCM 加密落盘。
 * ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('keyForm');
  var msg = document.getElementById('keyMsg');
  var cur = document.getElementById('aiKeyCurrent');

  function showMsg(text, ok) {
    msg.textContent = text || '';
    msg.style.color = ok ? '' : '';
  }

  function refreshCurrent(p) {
    if (cur) {
      cur.value = (p && p.aiKeyMasked) ? p.aiKeyMasked : '（未配置）';
    }
  }

  // 仅内测账号可访问本页；普通用户/游客引导回首页
  if (!Auth.requireLogin()) { return; }
  if (!Auth.isBeta()) {
    showMsg('本页面仅对内测账号开放');
    setTimeout(function () { location.href = 'index.html'; }, 1200);
    return;
  }
  refreshCurrent(Auth.currentProfile());

  function save(key) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    showMsg('');
    API.auth.aiKey(key).then(function (d) {
      showMsg('保存成功，AI Key 已加密存储并优先使用');
      refreshCurrent(d.user || Auth.currentProfile());
      API.bootstrap && API.bootstrap().then(function () {
        if (window.Auth && window.Auth.renderUserArea) window.Auth.renderUserArea();
      });
    }).catch(function (err) {
      showMsg(err && err.message ? err.message : '保存失败，请重试');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '保 存'; }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var key = document.getElementById('aiKeyInput').value.trim();
    if (!key) { showMsg('请输入要保存的 API Key，或点击“清除 Key”'); return; }
    save(key);
  });

  document.getElementById('btnClear').addEventListener('click', function () {
    showMsg('');
    save('');
  });
})();
