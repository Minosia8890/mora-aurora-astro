/* ============================================================
 * config.js — 全站集中配置
 * 站名等需要后续修改的内容，只改这里即可全站生效。
 * 用法：任意页面元素加 data-site-name 属性，加载后自动替换为站名；
 *       <title> 加 data-site-title 属性（可选 data-site-title-prefix="登录"）。
 * ============================================================ */
(function () {
  'use strict';

  window.SITE_CONFIG = {
    name: 'Mora Aurora Astro',                 // ★ 站点名称：改这里即可全站生效
    currency: '星币',                 // 充值货币名称
    currencyUnit: 1,                  // 1 元 = N 星币
    footerText: '星座包括黄道十二宫的描述为传统占星文化的通俗解读，仅供娱乐与自我探索参考。'
  };

  function applyBrand() {
    var t = document.querySelector('title');
    if (t && t.hasAttribute('data-site-title')) {
      var prefix = t.getAttribute('data-site-title-prefix') || '';
      t.textContent = (prefix ? prefix + ' · ' : '') + window.SITE_CONFIG.name;
    }
    var nodes = document.querySelectorAll('[data-site-name]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = window.SITE_CONFIG.name;
    var f = document.querySelector('[data-site-footer]');
    if (f && window.SITE_CONFIG.footerText) f.textContent = window.SITE_CONFIG.footerText;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand);
  } else {
    applyBrand();
  }
})();
