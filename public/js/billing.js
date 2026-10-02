/* ============================================================
 * billing.js — 星币计费（服务端扣费版）
 * 计费点：AI 问答 / AI 深度解析 / 导出报告，每次 1 星币。
 * spend 先向服务端申请扣费，成功才继续；余额不足或未登录直接引导。
 * refund 用于 AI 调用失败时退回（服务端记账，留流水）。
 * 页面中所有 .coin-chip 元素自动显示当前余额。
 * ============================================================ */
(function () {
  'use strict';

  var COST = 1;

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function loggedIn() {
    return !!(window.API && API.hasSession());
  }

  function balance() {
    // 内测/站长账号星币无限，统一显示 ∞
    if (window.Auth && Auth.isUnlimited && Auth.isUnlimited()) return '∞';
    var p = window.API ? API.cachedProfile() : null;
    return p ? p.balance : 0;
  }

  function currencyName() {
    return (window.SITE_CONFIG && window.SITE_CONFIG.currency) || '星币';
  }

  function isUnlimited() {
    return !!(window.Auth && Auth.isUnlimited && Auth.isUnlimited());
  }

  function refreshChips() {
    var nodes = document.querySelectorAll('.coin-chip');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = loggedIn() ? ('\u2605 ' + currencyName() + ' ' + balance()) : '未登录';
    }
  }

  /* 扣费：返回 Promise<boolean>（服务端权威扣减）；无限账号本地豁免，无需调用扣费接口 */
  function spend(scene, note) {
    if (!loggedIn()) {
      toast('请先登录后再使用该功能');
      setTimeout(function () { location.href = 'login.html'; }, 900);
      return Promise.resolve(false);
    }
    if (isUnlimited()) {
      refreshChips();
      return Promise.resolve(true);
    }
    return API.wallet.spend(scene, note).then(function (r) {
      var p = API.cachedProfile();
      if (p) { p.balance = r.balance; API.setCachedProfile(p); }
      refreshChips();
      return true;
    }).catch(function (err) {
      if (err.status === 402) {
        toast(err.message + '，正在前往充值…');
        setTimeout(function () { location.href = 'recharge.html'; }, 1100);
        return false;
      }
      if (err.status === 401) {
        toast('登录状态已失效，请重新登录');
        setTimeout(function () { location.href = 'login.html'; }, 900);
        return false;
      }
      toast('扣费失败：' + err.message);
      return false;
    });
  }

  /* 退回（AI 调用失败）：不阻塞主流程；无限账号无需退回 */
  function refund(scene, note) {
    if (!loggedIn()) return Promise.resolve(false);
    if (isUnlimited()) {
      refreshChips();
      return Promise.resolve(true);
    }
    return API.wallet.refund(scene, note).then(function (r) {
      var p = API.cachedProfile();
      if (p) { p.balance = r.balance; API.setCachedProfile(p); }
      refreshChips();
      return true;
    }).catch(function () { return false; });
  }

  window.Billing = {
    COST: COST,
    spend: spend,
    refund: refund,
    refreshChips: refreshChips,
    balance: balance,
    loggedIn: loggedIn
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshChips);
  else refreshChips();
})();
