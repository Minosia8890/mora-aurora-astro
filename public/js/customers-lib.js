/* ============================================================
 * customers-lib.js — 客户资料库共享模块（服务端存储版）
 * 数据模型（服务端返回）：
 *   { id, name, gender, date:'YYYY-MM-DD', time:'HH:mm', timeUnknown,
 *     place:{name,admin,lat,lon,tz}, note, tags, createdAt, updatedAt }
 *
 * 设计：内存缓存 + 服务端权威
 *   - list()/byId() 同步读缓存，页面渲染不等待网络
 *   - ready / reload() 负责从 /api/customers 拉取
 *   - upsert()/remove() 乐观更新缓存并异步落库，失败回滚并提示
 *   - openPicker() 内部先确保数据就绪，调用方无需改异步
 * ============================================================ */
(function () {
  'use strict';

  var cache = [];
  var loaded = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    var prev = t.textContent;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); if (prev) t.textContent = prev; }, 2800);
  }

  function loggedIn() {
    return !!(window.API && API.hasSession());
  }

  /* ---------------- 读取：缓存 + 拉取 ---------------- */
  var readyPromise = null;

  function reload() {
    if (!loggedIn()) {
      cache = [];
      loaded = true;
      readyPromise = Promise.resolve(cache);
      return readyPromise;
    }
    readyPromise = API.customers.list().then(function (d) {
      cache = Array.isArray(d.items) ? d.items : [];
      loaded = true;
      return cache;
    }).catch(function (err) {
      loaded = true;
      if (err && err.status === 401) cache = [];
      return cache;
    });
    return readyPromise;
  }

  function ensureLoaded() {
    if (loaded) return readyPromise || Promise.resolve(cache);
    return reload();
  }

  function list() { return cache.slice(); }

  function byId(id) {
    if (id === undefined || id === null) return null;
    for (var i = 0; i < cache.length; i++) {
      if (String(cache[i].id) === String(id)) return cache[i];
    }
    return null;
  }

  // 供需要等待数据的调用方（如 URL 深链载入客户）
  function whenReady(fn) {
    return ensureLoaded().then(function () { return fn(); });
  }

  /* ---------------- 写入：乐观更新 + 异步落库 ---------------- */
  function payloadOf(cust) {
    return {
      name: cust.name,
      gender: cust.gender || '',
      date: cust.date,
      time: cust.time,
      timeUnknown: !!cust.timeUnknown,
      place: cust.place || {},
      note: cust.note || '',
      tags: cust.tags || ''
    };
  }

  function upsert(cust) {
    if (!cust) return Promise.resolve(null);
    if (!loggedIn()) {
      toast('请先登录后再保存客户资料');
      setTimeout(function () { location.href = 'login.html'; }, 900);
      return Promise.resolve(null);
    }

    var isEdit = cust.id !== undefined && cust.id !== null && cust.id !== '';
    var snapshot = cache.slice();

    if (isEdit) {
      // 乐观更新
      for (var i = 0; i < cache.length; i++) {
        if (String(cache[i].id) === String(cust.id)) {
          cache[i] = Object.assign({}, cache[i], payloadOf(cust));
          break;
        }
      }
      return API.customers.update(cust.id, payloadOf(cust)).then(function (d) {
        for (var j = 0; j < cache.length; j++) {
          if (String(cache[j].id) === String(cust.id)) { cache[j] = d.customer; break; }
        }
        return d.customer;
      }).catch(function (err) {
        cache = snapshot;
        toast('保存失败：' + err.message);
        return null;
      });
    }

    // 新建：先本地占位（id=null），成功后替换为服务端记录
    var temp = Object.assign({ id: 'tmp' + Date.now(), createdAt: '', updatedAt: '' }, payloadOf(cust));
    cache.unshift(temp);
    return API.customers.create(payloadOf(cust)).then(function (d) {
      cache = cache.filter(function (c) { return c.id !== temp.id; });
      if (d.customer) cache.unshift(d.customer);
      return d.customer;
    }).catch(function (err) {
      cache = snapshot;
      toast('建档失败：' + err.message);
      return null;
    });
  }

  function remove(id) {
    if (!loggedIn()) return Promise.resolve(false);
    var snapshot = cache.slice();
    cache = cache.filter(function (c) { return String(c.id) !== String(id); });
    return API.customers.remove(id).then(function () {
      return true;
    }).catch(function (err) {
      cache = snapshot;
      toast('删除失败：' + err.message);
      return false;
    });
  }

  /* ---------------- 展示辅助（纯函数，保持同步） ---------------- */
  function placeText(place) {
    if (!place) return '';
    return place.name + (place.admin ? '，' + place.admin : '');
  }

  function birthSummary(c) {
    return (c.date || '') + ' ' + (c.timeUnknown ? '时间不详' : (c.time || '12:00'));
  }

  /* ---------------- 出生地联想（Open-Meteo Geocoding，免费无需 Key） ---------------- */
  var geoTimers = {};
  function attachGeoSearch(inputId, onPick) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var box = null;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(geoTimers[inputId]);
      if (!q) { closeDrop(); return; }
      geoTimers[inputId] = setTimeout(function () { searchGeo(q, input, onPick); }, 350);
    });
    input.addEventListener('blur', function () { setTimeout(closeDrop, 220); });
    function closeDrop() { if (box) { box.remove(); box = null; } }
    function searchGeo(q, inputEl, pick) {
      var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=8&language=zh&format=json';
      fetch(url).then(function (r) { return r.json(); }).then(function (data) {
        showDrop(mergeGeoResults(localGeoResults(q), data.results || []), inputEl, pick);
      }).catch(function () { showDrop([], inputEl, pick); });
    }
    function showDrop(results, inputEl, pick) {
      closeDrop();
      box = document.createElement('div');
      box.className = 'geo-drop';
      if (!results.length) {
        box.innerHTML = '<div class="geo-empty">没有找到匹配的地点，试试输入城市名（如：上海）</div>';
      } else {
        results.forEach(function (r) {
          var item = document.createElement('div');
          item.className = 'geo-item';
          var sub = [r.admin1, r.country].filter(Boolean).join(' · ');
          item.innerHTML = esc(r.name) + '<span class="geo-sub">' + esc(sub) + '</span>';
          item.addEventListener('mousedown', function (e) {
            e.preventDefault();
            inputEl.value = r.name + (sub ? '，' + sub : '');
            pick({ name: r.name, admin: sub, lat: r.latitude, lon: r.longitude, tz: r.timezone });
            closeDrop();
          });
          box.appendChild(item);
        });
      }
      inputEl.parentNode.appendChild(box);
    }
  }

  /* ---------------- 客户选择弹窗（本命盘 / 合盘 / 个人运势共用） ---------------- */
  function pickerItemHtml(c) {
    return '<div class="picker-item" data-id="' + esc(c.id) + '">' +
      '<div class="pi-main"><span class="pi-name">' + esc(c.name) + '</span>' +
      '<span class="pi-sub">' + esc(birthSummary(c)) + ' · ' + esc(c.place ? c.place.name : '') + '</span>' +
      (c.note ? '<div class="pi-note">' + esc(c.note) + '</div>' : '') + '</div>' +
      '<span class="pi-go">载入 →</span></div>';
  }

  function renderPicker(opts, arr) {
    var mask = document.createElement('div');
    mask.className = 'modal-mask show';
    mask.innerHTML =
      '<div class="modal cust-picker-modal"><h3>' + esc(opts.title || '从客户库选择') + '</h3>' +
      '<p class="hint">点击客户即可一键载入其出生信息（云端档案）。</p>' +
      '<div class="picker-list">' +
      (arr.length ? arr.map(pickerItemHtml).join('') :
        '<div class="saved-empty">客户库还是空的。先到「客户库」页面录入客户，即可在这里一键选择。</div>') +
      '</div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn-ghost" data-act="new">去新建客户</button>' +
      '<button type="button" class="btn-gold" data-act="close">关 闭</button>' +
      '</div></div>';
    document.body.appendChild(mask);

    function close() {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) { close(); return; }
      var item = e.target.closest ? e.target.closest('.picker-item') : null;
      if (item) {
        var c = byId(item.getAttribute('data-id'));
        close();
        if (c && typeof opts.onPick === 'function') opts.onPick(c);
        return;
      }
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (btn) {
        if (btn.getAttribute('data-act') === 'new') location.href = 'customers.html';
        else close();
      }
    });
    return { close: close };
  }

  // 内部先确保云端数据已就绪，调用方无需改异步写法
  function openPicker(opts) {
    opts = opts || {};
    if (!loggedIn()) {
      toast('请先登录后再使用客户库');
      setTimeout(function () { location.href = 'login.html'; }, 900);
      return { close: function () {} };
    }
    var handle = { close: function () {} };
    ensureLoaded().then(function () {
      handle = renderPicker(opts, list());
    });
    return handle;
  }

  window.ClientLib = {
    list: list,
    byId: byId,
    upsert: upsert,
    remove: remove,
    placeText: placeText,
    birthSummary: birthSummary,
    attachGeoSearch: attachGeoSearch,
    openPicker: openPicker,
    reload: reload,
    whenReady: whenReady,
    isLoaded: function () { return loaded; },
    escapeHtml: esc
  };

  // 脚本加载即预热缓存（登录态下）
  if (window.API && API.hasSession()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { reload(); });
    else reload();
  }
})();
