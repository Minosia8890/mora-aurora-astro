/* ============================================================
 * notify.js — 全站右上角信息通知铃铛（公共组件）
 *  - 登录态显示：所有页面自动注入（userArea 前插入）
 *  - 未读红点：进入时拉取 + 60s 轮询
 *  - 点击展开通知列表；单条标记已读 / 全部已读
 *  - 站长同样可见（可收系统级通知：新留言反馈提醒等）
 * ============================================================ */
(function () {
  'use strict';

  var POLL_MS = 60000;

  function hasSession() { return !!(window.API && API.hasSession()); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtTime(s) {
    var t = String(s || '').replace('T', ' ').slice(0, 16);
    return t;
  }

  var hostEl = null;
  var badgeEl = null;
  var listEl = null;
  var panelEl = null;
  var opened = false;
  var timer = null;

  var CSS = [
    '#notifyWrap{position:relative;display:inline-flex;align-items:center;margin-right:10px;vertical-align:middle;}',
    '#notifyWrap .notify-bell{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;cursor:pointer;color:var(--ink,#333);background:transparent;border:none;transition:background .2s;}',
    '#notifyWrap .notify-bell:hover{background:rgba(0,0,0,.06);}',
    '#notifyWrap .bell-svg{width:20px;height:20px;fill:currentColor;}',
    '#notifyWrap .bell-badge{position:absolute;top:1px;right:0;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#e23c3c;color:#fff;font-size:10px;line-height:15px;text-align:center;font-style:normal;font-family:inherit;box-shadow:0 0 0 2px #fff;}',
    '.notify-panel{position:fixed;z-index:9999;top:56px;right:12px;width:340px;max-width:calc(100vw - 24px);max-height:70vh;display:flex;flex-direction:column;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:12px;box-shadow:0 6px 30px rgba(0,0,0,.18);overflow:hidden;}',
    '.notify-panel .notify-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,.08);font-size:14px;color:#222;}',
    '.notify-panel .notify-readall{color:#6b4eff;font-size:12px;text-decoration:none;}',
    '.notify-list{overflow:auto;padding:4px 0;}',
    '.notify-empty{padding:24px 12px;text-align:center;color:#999;font-size:13px;}',
    '.notify-item{padding:10px 14px;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;transition:background .15s;}',
    '.notify-item:last-child{border-bottom:none;}',
    '.notify-item:hover{background:#f6f6fb;}',
    '.notify-item .ni-title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#222;}',
    '.notify-item.unread .ni-title{color:#1a1a2e;}',
    '.notify-item.unread .ni-title::before{content:"";width:7px;height:7px;border-radius:50%;background:#e23c3c;flex:none;}',
    '.notify-item .ni-title .ni-tag{margin-left:auto;font-size:10px;font-weight:400;color:#888;flex:none;}',
    '.notify-item .ni-content{font-size:12px;color:#555;margin-top:4px;line-height:1.55;word-break:break-all;}',
    '.notify-item .ni-time{font-size:11px;color:#aaa;margin-top:6px;}',
    '.notify-item .ni-read{display:inline-block;margin-top:6px;font-size:11px;color:#6b4eff;text-decoration:none;}',
    '.notify-item.read .ni-title{font-weight:400;color:#666;}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('notifyStyle')) return;
    var s = document.createElement('style');
    s.id = 'notifyStyle';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureHost() {
    if (hostEl) return hostEl;
    var userArea = document.getElementById('userArea');
    if (!userArea) return null;
    injectStyle();
    hostEl = document.createElement('div');
    hostEl.id = 'notifyWrap';
    hostEl.innerHTML =
      '<button type="button" class="notify-bell" id="notifyBell" title="信息通知" aria-label="信息通知">' +
      '<svg class="bell-svg" viewBox="0 0 24 24"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4.5a1.5 1.5 0 0 0-3 0v.7A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>' +
      '<span class="bell-badge" id="notifyBadge" style="display:none">0</span>' +
      '</button>';
    userArea.parentNode.insertBefore(hostEl, userArea);

    badgeEl = hostEl.querySelector('#notifyBadge');
    panelEl = document.createElement('div');
    panelEl.className = 'notify-panel';
    panelEl.style.display = 'none';
    panelEl.innerHTML =
      '<div class="notify-head"><b>信息通知</b><a href="#" class="notify-readall">全部已读</a></div>' +
      '<div class="notify-list"></div>';
    document.body.appendChild(panelEl);
    listEl = panelEl.querySelector('.notify-list');

    hostEl.querySelector('#notifyBell').addEventListener('click', toggle);
    panelEl.querySelector('.notify-readall').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      API.notify.readAll().then(function () {
        loadList(true);
      }).catch(function () { /* 忽略 */ });
    });
    document.addEventListener('click', function (e) {
      if (opened && !hostEl.contains(e.target) && !panelEl.contains(e.target)) {
        close();
      }
    });
    window.addEventListener('scroll', closeOnMove, true);
    window.addEventListener('resize', closeOnMove);
    return hostEl;
  }

  function closeOnMove() {
    if (opened) close();
  }

  function setBadge(n) {
    if (!badgeEl) return;
    if (n > 0) {
      badgeEl.textContent = n > 99 ? '99+' : String(n);
      badgeEl.style.display = '';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  function refreshBadge() {
    if (!hasSession()) return;
    API.notify.unreadCount().then(function (d) {
      setBadge(d.unread || 0);
    }).catch(function () { /* 忽略 */ });
  }

  function toggle() {
    if (!hasSession()) return;
    if (opened) { close(); return; }
    opened = true;
    panelEl.style.display = 'flex';
    loadList(false);
  }

  function close() {
    opened = false;
    panelEl.style.display = 'none';
  }

  function loadList(forceBadge) {
    API.notify.list({ limit: 50 }).then(function (d) {
      setBadge(d.unread || 0);
      var items = d.items || [];
      if (!items.length) {
        listEl.innerHTML = '<div class="notify-empty">暂无通知</div>';
        return;
      }
      listEl.innerHTML = items.map(function (n) {
        var read = !!n.read;
        return '<div class="notify-item' + (read ? ' read' : ' unread') + '" data-id="' + n.id + '">' +
          '<div class="ni-title">' + esc(n.title) +
          (read ? '<span class="ni-tag">已读</span>' : '<span class="ni-tag">' + esc(n.type === 'system' ? '系统' : '公告') + '</span>') +
          '</div>' +
          '<div class="ni-content">' + esc(n.content) + '</div>' +
          '<div class="ni-time">' + fmtTime(n.createdAt) + '</div>' +
          (read ? '' : '<a href="#" class="ni-read" data-read="' + n.id + '">标记已读</a>') +
          '</div>';
      }).join('');

      listEl.querySelectorAll('.notify-item').forEach(function (item) {
        item.addEventListener('click', function (e) {
          var btn = e.target.closest ? e.target.closest('[data-read]') : null;
          if (btn) {
            e.preventDefault();
            e.stopPropagation();
            markRead(Number(btn.getAttribute('data-read')));
            return;
          }
          var id = Number(item.getAttribute('data-id'));
          if (!item.classList.contains('read')) markRead(id);
        });
      });
    }).catch(function () { /* 忽略 */ });
  }

  function markRead(id) {
    API.notify.read(id).then(function (d) {
      setBadge(d.unread || 0);
      loadList(true);
    }).catch(function () { /* 忽略 */ });
  }

  function startPolling() {
    if (timer) clearInterval(timer);
    timer = setInterval(refreshBadge, POLL_MS);
  }

  function boot() {
    injectStyle();
    if (!hasSession()) return;
    if (!ensureHost()) return;
    refreshBadge();
    startPolling();
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  init();

  window.Notify = {
    refresh: refreshBadge,
    open: toggle,
    close: close
  };
})();
