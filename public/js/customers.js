/* ============================================================
 * customers.js — 客户资料库页面逻辑
 * 列表 / 搜索 / 新建 / 编辑 / 删除（二次点击确认，防误删）/ 一键去生成星盘
 * 出生地经纬度经 Open-Meteo Geocoding 换算，数据存 localStorage（按账号隔离）
 * ============================================================ */
(function () {
  'use strict';
  if (!window.ClientLib) return;

  var $ = function (s) { return document.querySelector(s); };
  var editingId = null;
  var pickedPlace = null;

  // ---------- Toast ----------
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---------- 列表渲染 ----------
  function cardHtml(c) {
    return '<div class="cust-card" data-id="' + ClientLib.escapeHtml(c.id) + '">' +
      '<div class="cc-main">' +
      '<div class="cc-name">' + ClientLib.escapeHtml(c.name) + '</div>' +
      '<div class="cc-birth">' + ClientLib.escapeHtml(ClientLib.birthSummary(c)) +
      ' · 出生' + ClientLib.escapeHtml(c.place ? c.place.name : '—') + '</div>' +
      (c.note ? '<div class="cc-note">' + ClientLib.escapeHtml(c.note) + '</div>' : '') +
      '<div class="cc-time">建档 ' + ClientLib.escapeHtml(c.createdAt || '') + '</div>' +
      '</div>' +
      '<div class="cc-ops">' +
      '<a class="btn-si" href="natal.html?customer=' + encodeURIComponent(c.id) + '">本命盘</a>' +
      '<a class="btn-si" href="synastry.html?side=a&customer=' + encodeURIComponent(c.id) + '">合盘·A方</a>' +
      '<a class="btn-si" href="synastry.html?side=b&customer=' + encodeURIComponent(c.id) + '">合盘·B方</a>' +
      '<button type="button" class="btn-si" data-act="edit">编辑</button>' +
      '<button type="button" class="btn-si danger" data-act="del">删除</button>' +
      '</div></div>';
  }

  function render() {
    var kw = ($('#custSearch').value || '').trim().toLowerCase();
    var arr = ClientLib.list();
    if (kw) {
      arr = arr.filter(function (c) {
        return ((c.name || '') + ' ' + (c.note || '')).toLowerCase().indexOf(kw) >= 0;
      });
    }
    $('#custCount').textContent = '共 ' + arr.length + ' 位客户';
    $('#custList').innerHTML = arr.length ? arr.map(cardHtml).join('') :
      '<div class="saved-empty">' + (kw ?
        '没有匹配的客户，换个关键词试试。' :
        '还没有客户。点击右上角「+ 新建客户」录入第一位客户的出生资料。') + '</div>';
  }

  // ---------- 新建 / 编辑弹窗 ----------
  function openModal(cust) {
    editingId = cust ? cust.id : null;
    pickedPlace = cust ? (cust.place || null) : null;
    $('#custModalTitle').textContent = cust ? '编辑客户' : '新建客户';
    $('#custName').value = cust ? cust.name : '';
    $('#custNote').value = cust ? (cust.note || '') : '';
    $('#custDate').value = cust ? cust.date : '';
    $('#custTime').value = cust && !cust.timeUnknown ? (cust.time || '12:00') : '12:00';
    $('#custUnk').checked = !!(cust && cust.timeUnknown);
    $('#custTime').disabled = !!(cust && cust.timeUnknown);
    $('#custPlace').value = cust ? ClientLib.placeText(cust.place) : '';
    $('#err-custName').textContent = '';
    $('#err-custDate').textContent = '';
    $('#err-custPlace').textContent = '';
    $('#custModal').classList.add('show');
  }
  function closeModal() { $('#custModal').classList.remove('show'); }

  function save() {
    var name = $('#custName').value.trim();
    var date = $('#custDate').value;
    var timeUnknown = $('#custUnk').checked;
    var time = $('#custTime').value || '12:00';
    var note = $('#custNote').value.trim();
    $('#err-custName').textContent = name ? '' : '请填写客户姓名';
    $('#err-custDate').textContent = date ? '' : '请选择出生日期';
    $('#err-custPlace').textContent = pickedPlace ? '' : '请输入出生地并从联想中选择';
    if (!name || !date || !pickedPlace) return;

    var c = editingId ? ClientLib.byId(editingId) : null;
    if (!c) c = {};
    c.name = name;
    c.note = note;
    c.date = date;
    c.time = timeUnknown ? '12:00' : time;
    c.timeUnknown = timeUnknown;
    c.place = pickedPlace;
    var isEdit = !!editingId;
    closeModal();
    render();
    ClientLib.upsert(c).then(function (saved) {
      if (saved) toast(isEdit ? '客户「' + name + '」已更新' : '客户「' + name + '」已建档');
    });
  }

  // ---------- 启动 ----------
  function init() {
    ClientLib.attachGeoSearch('custPlace', function (p) { pickedPlace = p; });

    $('#custUnk').addEventListener('change', function () {
      $('#custTime').disabled = this.checked;
      if (this.checked) $('#custTime').value = '12:00';
    });
    $('#btnNew').addEventListener('click', function () { openModal(null); });
    $('#btnCloseCust').addEventListener('click', closeModal);
    $('#btnSaveCustomer').addEventListener('click', save);
    $('#custModal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('#custSearch').addEventListener('input', render);

    // 列表操作（事件委托）：编辑 / 删除（两次点击确认）
    $('#custList').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var card = btn.closest('.cust-card');
      var id = card && card.getAttribute('data-id');
      if (!id) return;
      if (btn.getAttribute('data-act') === 'edit') {
        openModal(ClientLib.byId(id));
        return;
      }
      if (btn.getAttribute('data-act') === 'del') {
        if (btn.getAttribute('data-armed') !== '1') {
          btn.setAttribute('data-armed', '1');
          btn.textContent = '确认删除？';
          setTimeout(function () {
            btn.removeAttribute('data-armed');
            btn.textContent = '删除';
          }, 3000);
          return;
        }
        var c = ClientLib.byId(id);
        ClientLib.remove(id).then(function (ok) {
          if (ok) toast('已删除客户「' + (c ? c.name : '') + '」');
        });
        render();
      }
    });

    render();
    // 云端数据到达后重绘（首屏先渲染缓存）
    ClientLib.reload().then(render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
