/* ============================================================
 * theme.js — 黑白双主题切换
 * 在 <head> 中尽早加载，读取 localStorage 立即应用，避免闪烁。
 * 导航栏 #themeToggle 按钮由本文件自动绑定。
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'cyber_astro_theme';

  function current() {
    try {
      var v = window.localStorage.getItem(KEY);
      if (v === 'dark' || v === 'light') return v;
    } catch (e) { }
    return 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function updateBtn() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = dark ? '\u2600\uFE0F' : '\u263D';
    btn.title = dark ? '切换到亮色模式' : '切换到暗色模式';
    btn.setAttribute('aria-label', btn.title);
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem(KEY, next); } catch (e) { }
    apply(next);
    updateBtn();
  }

  // 立即应用（脚本在 head 中同步执行）
  apply(current());

  window.ThemeSwitch = { toggle: toggle, current: current, apply: apply };

  function init() {
    var btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggle);
    updateBtn();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
