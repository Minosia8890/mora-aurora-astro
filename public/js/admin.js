/* ============================================================
 * admin.js — 主平台（站长后台）
 * 模块：数据看板 / 客户档案总库 / 用户与账号 / 星币与订单 /
 *       充值套餐 / AI 配置与调试
 * 权限：仅 role=admin 可进；所有数据来自服务端接口。
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) { return Number(n || 0).toLocaleString('zh-CN'); }
  function dt(s) { return String(s || '').replace('T', ' ').slice(0, 16); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  /* ---------------- 二次点击确认（避免误删） ---------------- */
  function arm(btn, label, fn) {
    if (btn.getAttribute('data-armed') === '1') {
      btn.removeAttribute('data-armed');
      btn.textContent = btn.getAttribute('data-label') || label;
      fn();
      return true;
    }
    btn.setAttribute('data-armed', '1');
    btn.textContent = '确认' + label + '？';
    setTimeout(function () {
      if (btn.getAttribute('data-armed') === '1') {
        btn.removeAttribute('data-armed');
        btn.textContent = btn.getAttribute('data-label') || label;
      }
    }, 3000);
    return false;
  }

  /* ---------------- 通用弹窗 ---------------- */
  var modalHost = null;
  function openModal(opts) {
    modalHost = $('#modalHost');
    var fields = opts.fields || '';
    modalHost.innerHTML =
      '<div class="modal-mask show"><div class="modal">' +
      '<h3>' + esc(opts.title) + '</h3>' +
      (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') +
      '<div id="admModalBody">' + fields + '</div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn-ghost" data-m="cancel">取消</button>' +
      (opts.okLabel === false ? '' : '<button type="button" class="btn-gold" data-m="ok">' + esc(opts.okLabel || '确定') + '</button>') +
      '</div></div></div>';

    var mask = $('.modal-mask', modalHost);
    function close() { modalHost.innerHTML = ''; document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) { close(); return; }
      var btn = e.target.closest ? e.target.closest('[data-m]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-m');
      if (act === 'cancel') { close(); return; }
      if (act === 'ok') {
        var okBtn = btn;
        okBtn.disabled = true;
        Promise.resolve(opts.onOk ? opts.onOk($('#admModalBody'), close) : null)
          .then(function (keep) { if (!keep) close(); })
          .catch(function () { okBtn.disabled = false; });
      }
    });
    if (opts.onMount) opts.onMount($('#admModalBody'));
    return { close: close };
  }

  function field(label, inner, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + inner +
      (hint ? '<div class="err" style="color:var(--ink-faint)">' + esc(hint) + '</div>' : '') + '</div>';
  }
  function input(id, value, placeholder, type) {
    return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value === undefined ? '' : value) + '" placeholder="' + esc(placeholder || '') + '">';
  }
  function select(id, options, value) {
    return '<select id="' + id + '">' + options.map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('') + '</select>';
  }

  /* ---------------- 视图路由 ---------------- */
  var VIEWS = {};
  var currentView = 'overview';

  function show(view) {
    if (!VIEWS[view]) view = 'overview';
    currentView = view;
    $$('.admin-nav-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === view);
    });
    $$('.admin-view').forEach(function (s) {
      s.classList.toggle('active', s.id === 'view-' + view);
    });
    if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
    VIEWS[view]();
  }

  /* ============================================================
   * 一、数据看板
   * ============================================================ */
  VIEWS.overview = function () {
    var host = $('#view-overview');
    host.innerHTML =
      '<div class="admin-h2">数据看板</div>' +
      '<div class="admin-sub">全站经营概览 · 数据实时来自服务端</div>' +
      '<div id="ovStats"></div>' +
      '<div class="admin-section-title">近 14 天充值趋势</div>' +
      '<div id="ovTrend"></div>' +
      '<div class="admin-section-title">最近流水</div>' +
      '<div id="ovTxns"></div>';

    API.admin.overview().then(function (d) {
      var u = d.users, w = d.wallet, ai = d.ai;
      $('#ovStats').innerHTML =
        '<div class="stat-grid">' +
        statCard('注册用户', fmt(u.total), '今日 +' + fmt(u.today) + ' · 近 7 天 +' + fmt(u.week)) +
        statCard('有效账号', fmt(u.active), (u.disabled ? u.disabled + ' 个已禁用' : '无禁用账号')) +
        statCard('客户档案', fmt(d.customers), '全站客户总数') +
        statCard('星盘档案', fmt(d.charts), '用户保存的盘') +
        statCard('充值总额', fmt(w.recharge), '今日 +' + fmt(w.todayRecharge)) +
        statCard('消费总额', fmt(w.spend), '今日 ' + fmt(w.todaySpend)) +
        statCard('AI 调用', fmt(ai.total), '今日 ' + fmt(ai.today) + ' · 平均 ' + fmt(ai.avgLatencyMs) + 'ms') +
        statCard('AI 失败', fmt(ai.failed), ai.total ? ('成功率 ' + Math.round(ai.ok / ai.total * 100) + '%') : '暂无调用') +
        '</div>';

      var max = Math.max.apply(null, d.trend.map(function (t) { return t.amount; }).concat([1]));
      $('#ovTrend').innerHTML = '<div class="trend">' + d.trend.map(function (t) {
        var h = Math.max(3, Math.round(t.amount / max * 92));
        return '<div class="bar-wrap" title="' + t.date + '：' + fmt(t.amount) + ' 星币">' +
          '<div class="bar" style="height:' + h + '%"></div>' +
          '<div class="bar-lbl">' + t.date.slice(5) + '</div></div>';
      }).join('') + '</div>';

      return API.admin.transactions({ pageSize: 8 });
    }).then(function (d) {
      $('#ovTxns').innerHTML = txnTable(d.items);
    }).catch(function (err) {
      $('#ovStats').innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
    });
  };

  function statCard(k, v, s) {
    return '<div class="stat-card"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div><div class="s">' + esc(s) + '</div></div>';
  }

  var TXN_LABEL = { recharge: '充值', spend: '消费', refund: '退回', admin_adjust: '调账' };

  function txnTable(items) {
    if (!items || !items.length) return '<div class="empty-line">暂无流水记录</div>';
    return '<table class="astro-table admin-table"><thead><tr>' +
      '<th>时间</th><th>用户</th><th>类型</th><th>金额</th><th>余额后</th><th>备注</th>' +
      '</tr></thead><tbody>' +
      items.map(function (t) {
        var cls = t.amount < 0 ? 'retro-yes' : '';
        return '<tr><td>' + dt(t.createdAt) + '</td>' +
          '<td>' + esc(t.username || ('#' + t.userId)) + '</td>' +
          '<td>' + esc(TXN_LABEL[t.type] || t.type) + '</td>' +
          '<td class="' + cls + '">' + (t.amount >= 0 ? '+' : '') + fmt(t.amount) + '</td>' +
          '<td>' + fmt(t.balanceAfter) + '</td>' +
          '<td>' + esc(t.note || '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* 星币显示：内测账号 / 站长账号为无限（∞），其余显示数字 */
  function coinText(u) {
    if (u && (u.unlimited || u.isBeta || u.role === 'admin')) return '\u221e';
    return fmt(u ? u.balance : 0);
  }

  /* ============================================================
   * 二、客户档案总库
   * ============================================================ */
  var custState = { page: 1, q: '', userId: '', brief: [] };

  VIEWS.customers = function () {
    var host = $('#view-customers');
    host.innerHTML =
      '<div class="admin-h2">客户档案总库</div>' +
      '<div class="admin-sub">全站所有客户出生资料，跨账号可查可维护</div>' +
      '<div class="admin-toolbar">' +
      '<input id="admCustQ" placeholder="搜索姓名 / 备注 / 出生地" value="' + esc(custState.q) + '">' +
      '<select id="admCustUser"><option value="">全部用户</option></select>' +
      '<button class="btn-gold" id="admCustSearch">搜索</button>' +
      '<button class="btn-si" id="admCustNew">+ 新建客户</button>' +
      '</div><div id="admCustList"></div><div id="admCustPager" class="admin-pager"></div>';

    loadUsersBrief().then(function (brief) {
      custState.brief = brief;
      var sel = $('#admCustUser');
      brief.forEach(function (u) {
        var o = document.createElement('option');
        o.value = u.id;
        o.textContent = u.username + (u.nickname ? '（' + u.nickname + '）' : '') + ' · ' + coinText(u) + ' 星币';
        sel.appendChild(o);
      });
      sel.value = custState.userId;
      renderCustomers();
    });

    $('#admCustSearch').addEventListener('click', function () {
      custState.q = $('#admCustQ').value.trim();
      custState.userId = $('#admCustUser').value;
      custState.page = 1;
      renderCustomers();
    });
    $('#admCustQ').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('#admCustSearch').click();
    });
    $('#admCustNew').addEventListener('click', function () { customerForm(null); });
  };

  function renderCustomers() {
    var box = $('#admCustList');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.customers({ q: custState.q, userId: custState.userId, page: custState.page, pageSize: 20 })
      .then(function (d) {
        if (!d.items.length) {
          box.innerHTML = '<div class="empty-line">没有匹配的客户档案</div>';
        } else {
          box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
            '<th>姓名</th><th>性别</th><th>出生</th><th>出生地</th><th>归属用户</th><th>备注</th><th>操作</th>' +
            '</tr></thead><tbody>' + d.items.map(function (c) {
              return '<tr data-id="' + c.id + '">' +
                '<td class="pl-name">' + esc(c.name) + '</td>' +
                '<td>' + esc(c.gender || '—') + '</td>' +
                '<td>' + esc(c.date) + ' ' + (c.timeUnknown ? '时间不详' : esc(c.time || '')) + '</td>' +
                '<td>' + esc(c.place ? c.place.name : '') + '</td>' +
                '<td>' + esc(c.ownerName || ('#' + c.userId)) + '</td>' +
                '<td>' + esc((c.note || '').slice(0, 24)) + '</td>' +
                '<td class="ops">' +
                '<button class="btn-si" data-act="edit">编辑</button>' +
                '<button class="btn-si danger" data-act="del" data-label="删除">删除</button>' +
                '</td></tr>';
            }).join('') + '</tbody></table>';
        }
        $('#admCustPager').innerHTML = pagerHtml(d.page, d.pageSize, d.total, 'admCustPage');
      }).catch(function (err) {
        box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
      });
  }

  function pagerHtml(page, pageSize, total, idPrefix) {
    var pages = Math.max(1, Math.ceil(total / pageSize));
    return '<span>共 ' + fmt(total) + ' 条 · 第 ' + page + '/' + pages + ' 页</span>' +
      '<button class="btn-si" data-pg="' + idPrefix + ':' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>上一页</button>' +
      '<button class="btn-si" data-pg="' + idPrefix + ':' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>下一页</button>';
  }

  // 全局分页点击
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-pg]') : null;
    if (!btn) return;
    var parts = btn.getAttribute('data-pg').split(':');
    var target = parts[0];
    var page = parseInt(parts[1], 10);
    if (target === 'admCustPage') { custState.page = page; renderCustomers(); }
    if (target === 'admUserPage') { userState.page = page; renderUsers(); }
    if (target === 'admTxnPage') { txnState.page = page; renderTxns(); }
    if (target === 'admLogPage') { aiState.logPage = page; renderLogs(); }
    if (target === 'admFbPage') { fbState.page = page; renderFeedbacks(); }
  });

  // 客户表操作
  document.addEventListener('click', function (e) {
    if (currentView !== 'customers') return;
    var btn = e.target.closest ? e.target.closest('#admCustList [data-act]') : null;
    if (!btn) return;
    var tr = btn.closest('tr');
    var id = tr && tr.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    if (act === 'edit') customerForm(id);
    if (act === 'del') {
      if (!arm(btn, '删除', function () {})) return;
      API.admin.removeCustomer(id).then(function () {
        toast('客户已删除');
        renderCustomers();
      }).catch(function (err) { toast('删除失败：' + err.message); });
    }
  });

  var adminCustPlace = null;
  function customerForm(id) {
    var isEdit = !!id;
    var options = custState.brief.map(function (u) {
      return { value: u.id, label: u.username + (u.nickname ? '（' + u.nickname + '）' : '') };
    });
    if (!options.length) { toast('请先创建至少一个客户账号'); return; }

    // 编辑：先取该条档案；新建：空表单
    var preload = isEdit
      ? API.admin.customer(id).then(function (d) { return d.customer; })
      : Promise.resolve(null);

    preload.then(function (c) {
      adminCustPlace = c ? c.place : null;
      openModal({
        title: isEdit ? '编辑客户档案' : '新建客户档案',
        hint: '归属用户决定这份档案出现在谁的副平台里。',
        okLabel: isEdit ? '保存修改' : '创建档案',
        fields:
          field('归属用户', select('admCustOwner', options, c ? c.userId : options[0].value)) +
          field('客户姓名', input('admCustName', c ? c.name : '', '例如：张小雨')) +
          field('性别', select('admCustGender', [{ value: '', label: '未填写' }, { value: '男', label: '男' }, { value: '女', label: '女' }, { value: '其他', label: '其他' }], c ? c.gender : '')) +
          field('出生日期', input('admCustDate', c ? c.date : '', '', 'date')) +
          field('出生时间', input('admCustTime', c && !c.timeUnknown ? c.time : '12:00', '', 'time')) +
          field('出生地', '<div class="geo-wrap">' + input('admCustPlace', c && c.place ? (c.place.name + (c.place.admin ? '，' + c.place.admin : '')) : '', '输入城市名并从联想中选择') + '</div>', '必须从联想结果中选择，才能取得经纬度与时区') +
          field('备注', '<textarea id="admCustNote">' + esc(c ? c.note : '') + '</textarea>'),
        onMount: function () {
          ClientLib.attachGeoSearch('admCustPlace', function (p) { adminCustPlace = p; });
        },
        onOk: function () {
          var payload = {
            userId: $('#admCustOwner').value,
            name: $('#admCustName').value.trim(),
            gender: $('#admCustGender').value,
            date: $('#admCustDate').value,
            time: $('#admCustTime').value || '12:00',
            timeUnknown: false,
            place: adminCustPlace || {},
            note: $('#admCustNote').value.trim()
          };
          if (!payload.name) { toast('请填写客户姓名'); return false; }
          if (!payload.date) { toast('请选择出生日期'); return false; }
          if (!payload.place || !payload.place.name) { toast('请从联想中选择出生地'); return false; }
          var req = isEdit ? API.admin.updateCustomer(id, payload) : API.admin.createCustomer(payload);
          return req.then(function () {
            toast(isEdit ? '客户档案已更新' : '客户档案已创建');
            renderCustomers();
          }).catch(function (err) {
            toast('保存失败：' + err.message);
            return true;
          });
        }
      });
    });
  }

  /* ============================================================
   * 三、用户与账号
   * ============================================================ */
  var userState = { page: 1, q: '', role: '', status: '' };

  VIEWS.users = function () {
    var host = $('#view-users');
    host.innerHTML =
      '<div class="admin-h2">用户与账号</div>' +
      '<div class="admin-sub">注册用户管理 · 建号、停用、重置密码、调账</div>' +
      '<div class="admin-toolbar">' +
      '<input id="admUserQ" placeholder="搜索用户名 / 昵称 / 备注" value="' + esc(userState.q) + '">' +
      '<select id="admUserRole"><option value="">全部角色</option><option value="customer">客户</option><option value="admin">管理员</option></select>' +
      '<select id="admUserStatus"><option value="">全部状态</option><option value="active">正常</option><option value="disabled">已禁用</option></select>' +
      '<button class="btn-gold" id="admUserSearch">搜索</button>' +
      '<button class="btn-si" id="admUserNew">+ 新建账号</button>' +
      '</div><div id="admUserList"></div><div id="admUserPager" class="admin-pager"></div>';

    $('#admUserRole').value = userState.role;
    $('#admUserStatus').value = userState.status;

    $('#admUserSearch').addEventListener('click', function () {
      userState.q = $('#admUserQ').value.trim();
      userState.role = $('#admUserRole').value;
      userState.status = $('#admUserStatus').value;
      userState.page = 1;
      renderUsers();
    });
    $('#admUserQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#admUserSearch').click(); });
    $('#admUserNew').addEventListener('click', newUserForm);

    renderUsers();
  };

  function renderUsers() {
    var box = $('#admUserList');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.users({
      q: userState.q, role: userState.role, status: userState.status,
      page: userState.page, pageSize: 20
    }).then(function (d) {
      if (!d.items.length) {
        box.innerHTML = '<div class="empty-line">没有匹配的用户</div>';
      } else {
        box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
          '<th>ID</th><th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>星币</th>' +
          '<th>客户</th><th>星盘</th><th>注册时间</th><th>最后登录</th><th>操作</th>' +
          '</tr></thead><tbody>' + d.items.map(function (u) {
            return '<tr data-id="' + u.id + '">' +
              '<td class="mono">' + u.id + '</td>' +
              '<td class="pl-name">' + esc(u.username) + '</td>' +
              '<td>' + esc(u.nickname || '—') + '</td>' +
              '<td>' + (u.role === 'admin' ? '<span class="pill">管理员</span>' : '客户') + '</td>' +
              '<td>' + (u.status === 'active' ? '正常' : '<span class="pill warn">已禁用</span>') + '</td>' +
              '<td>' + coinText(u) + '</td>' +
              '<td>' + fmt(u.customerCount) + '</td>' +
              '<td>' + fmt(u.chartCount) + '</td>' +
              '<td>' + dt(u.createdAt) + '</td>' +
              '<td>' + dt(u.lastLoginAt) + '</td>' +
              '<td class="ops">' +
              '<button class="btn-si" data-uact="adjust">调账</button>' +
              '<button class="btn-si" data-uact="passwd">改密</button>' +
              '<button class="btn-si" data-uact="toggleRole">' + (u.role === 'admin' ? '取消管理员' : '设为管理员') + '</button>' +
              '<button class="btn-si ' + (u.status === 'active' ? 'danger' : '') + '" data-uact="toggleStatus">' + (u.status === 'active' ? '禁用' : '启用') + '</button>' +
              '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      $('#admUserPager').innerHTML = pagerHtml(d.page, d.pageSize, d.total, 'admUserPage');
    }).catch(function (err) {
      box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
    });
  }

  document.addEventListener('click', function (e) {
    if (currentView !== 'users') return;
    var btn = e.target.closest ? e.target.closest('#admUserList [data-uact]') : null;
    if (!btn) return;
    var tr = btn.closest('tr');
    var id = tr && tr.getAttribute('data-id');
    var name = tr ? tr.children[1].textContent : '';
    var act = btn.getAttribute('data-uact');

    if (act === 'adjust') {
      openModal({
        title: '手动调账 · ' + name,
        hint: '正数加币，负数扣币；调整后余额不能为负。',
        okLabel: '确认调账',
        fields: field('调整数量（星币）', input('admAdjAmount', '', '例如 100 或 -50')) +
          field('调账原因', input('admAdjNote', '', '例如：活动奖励 / 退款抵扣')),
        onOk: function () {
          var amount = parseInt($('#admAdjAmount').value, 10);
          if (!amount) { toast('请输入非 0 的整数'); return false; }
          return API.admin.adjustBalance(id, amount, $('#admAdjNote').value.trim()).then(function (r) {
            toast('调账完成，当前余额 ' + (r.balance === -1 ? '\u221e' : fmt(r.balance)));
            renderUsers();
          }).catch(function (err) { toast('调账失败：' + err.message); return true; });
        }
      });
    }

    if (act === 'passwd') {
      openModal({
        title: '重置密码 · ' + name,
        hint: '重置后该用户所有登录状态将失效。',
        okLabel: '确认重置',
        fields: field('新密码（至少 6 位）', input('admNewPw', '', '')),
        onOk: function () {
          var pw = $('#admNewPw').value;
          if (pw.length < 6) { toast('密码至少 6 位'); return false; }
          return API.admin.resetPassword(id, pw).then(function () {
            toast('密码已重置');
          }).catch(function (err) { toast('重置失败：' + err.message); return true; });
        }
      });
    }

    if (act === 'toggleRole') {
      var toAdmin = btn.textContent.indexOf('取消') < 0;
      API.admin.updateUser(id, { role: toAdmin ? 'admin' : 'customer' }).then(function () {
        toast(toAdmin ? '已设为管理员' : '已取消管理员');
        renderUsers();
      }).catch(function (err) { toast('操作失败：' + err.message); });
    }

    if (act === 'toggleStatus') {
      var disable = btn.textContent.indexOf('禁用') === 0;
      if (!arm(btn, disable ? '禁用' : '启用', function () {})) return;
      API.admin.updateUser(id, { status: disable ? 'disabled' : 'active' }).then(function () {
        toast(disable ? '账号已禁用' : '账号已启用');
        renderUsers();
      }).catch(function (err) { toast('操作失败：' + err.message); });
    }
  });

  function newUserForm() {
    openModal({
      title: '新建账号',
      hint: '为客户开号；初始星币会写入流水，便于对账。',
      okLabel: '创建账号',
      fields:
        field('用户名（2-20 位，不可重复）', input('admNewUser', '', '例如：xiaoyu2026')) +
        field('初始密码（至少 6 位）', input('admNewPw2', '', '')) +
        field('角色', select('admNewRole', [{ value: 'customer', label: '客户' }, { value: 'admin', label: '管理员' }], 'customer')) +
        field('初始星币', input('admNewBalance', '0', '0')) +
        field('昵称', input('admNewNick', '', '选填')) +
        field('备注', input('admNewNote', '', '例如：小红书客户 / 线下咨询')),
      onOk: function () {
        var payload = {
          username: $('#admNewUser').value.trim(),
          password: $('#admNewPw2').value,
          role: $('#admNewRole').value,
          balance: parseInt($('#admNewBalance').value, 10) || 0,
          nickname: $('#admNewNick').value.trim(),
          note: $('#admNewNote').value.trim()
        };
        if (!payload.username) { toast('请填写用户名'); return false; }
        return API.admin.createUser(payload).then(function () {
          toast('账号已创建：' + payload.username);
          renderUsers();
        }).catch(function (err) { toast('创建失败：' + err.message); return true; });
      }
    });
  }

  /* ============================================================
   * 三·五、内测账号（is_beta）
   * ============================================================ */
  var betaState = { page: 1, q: '', status: '' };

  VIEWS.beta = function () {
    var host = $('#view-beta');
    host.innerHTML =
      '<div class="admin-h2">内测账号</div>' +
      '<div class="admin-sub">内测账号：界面与普通用户一致，但可解锁全部盘型 / 推运与 AI 专业解析，并可自配 AI Key</div>' +
      '<div class="admin-toolbar">' +
      '<input id="admBetaQ" placeholder="搜索用户名 / 昵称" value="' + esc(betaState.q) + '">' +
      '<select id="admBetaStatus"><option value="">全部状态</option><option value="active">正常</option><option value="disabled">已禁用</option></select>' +
      '<button class="btn-gold" id="admBetaSearch">搜索</button>' +
      '<button class="btn-si" id="admBetaCreate">+ 单个创建内测账号</button>' +
      '<button class="btn-si" id="admBetaSeed">+ 批量创建内测账号</button>' +
      '</div><div id="admBetaList"></div><div id="admBetaPager" class="admin-pager"></div>';

    $('#admBetaStatus').value = betaState.status;

    $('#admBetaSearch').addEventListener('click', function () {
      betaState.q = $('#admBetaQ').value.trim();
      betaState.status = $('#admBetaStatus').value;
      betaState.page = 1;
      renderBeta();
    });
    $('#admBetaQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#admBetaSearch').click(); });
    $('#admBetaCreate').addEventListener('click', createBetaOneForm);
    $('#admBetaSeed').addEventListener('click', seedBetaForm);

    renderBeta();
  };

  function renderBeta() {
    var box = $('#admBetaList');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.betaUsers({
      q: betaState.q, status: betaState.status,
      page: betaState.page, pageSize: 20
    }).then(function (d) {
      if (!d.items.length) {
        box.innerHTML = '<div class="empty-line">暂无内测账号，点击右上角「批量创建」生成</div>';
      } else {
        box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
          '<th>ID</th><th>用户名</th><th>昵称</th><th>状态</th><th>星币</th>' +
          '<th>客户</th><th>星盘</th><th>已配 AI Key</th><th>创建时间</th><th>操作</th>' +
          '</tr></thead><tbody>' + d.items.map(function (u) {
            return '<tr data-id="' + u.id + '">' +
              '<td class="mono">' + u.id + '</td>' +
              '<td class="pl-name">' + esc(u.username) + '</td>' +
              '<td>' + esc(u.nickname || '—') + '</td>' +
              '<td>' + (u.status === 'active' ? '正常' : '<span class="pill warn">已禁用</span>') + '</td>' +
              '<td>' + coinText(u) + '</td>' +
              '<td>' + fmt(u.customerCount) + '</td>' +
              '<td>' + fmt(u.chartCount) + '</td>' +
              '<td>' + (u.hasAiKey ? '<span class="pill">' + esc(u.aiKeyMasked) + '</span>' : '<span class="pill warn">未配置</span>') + '</td>' +
              '<td>' + dt(u.createdAt) + '</td>' +
              '<td class="ops">' +
              '<button class="btn-si" data-bact="backup">备份</button>' +
              '<button class="btn-si" data-bact="passwd">重置密码</button>' +
              '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      $('#admBetaPager').innerHTML = pagerHtml(d.page, d.pageSize, d.total, 'admBetaPage');
    }).catch(function (err) {
      box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
    });
  }

  document.addEventListener('click', function (e) {
    if (currentView !== 'beta') return;
    var btn = e.target.closest ? e.target.closest('#admBetaList [data-bact]') : null;
    if (!btn) return;
    var tr = btn.closest('tr');
    var id = tr && tr.getAttribute('data-id');
    var name = tr ? tr.children[1].textContent : '';
    var act = btn.getAttribute('data-bact');

    if (act === 'backup') {
      API.admin.betaBackup(id).then(function (r) {
        openModal({
          title: '备份完成 · ' + name,
          hint: '账号数据已写入服务端 data/backups/ 目录（含明文 AI Key 供站长存档）。',
          okLabel: '知道了',
          fields:
            field('备份文件', '<div class="mono">' + esc(r.file) + '</div>') +
            field('导出时间', r.exportedAt) +
            field('包含内容', '客户 ' + r.included.customers + ' 条 · 星盘 ' + r.included.charts + ' 份 · 钱包流水 ' + r.included.transactions + ' 条') +
            field('文件大小', fmt(r.size) + ' 字节'),
          onOk: function () { return true; }
        });
      }).catch(function (err) { toast('备份失败：' + err.message); });
    }

    if (act === 'passwd') {
      openModal({
        title: '重置密码 · ' + name,
        hint: '重置后该内测账号所有登录状态将失效，可回收账号。',
        okLabel: '确认重置',
        fields: field('新密码（至少 6 位）', input('admBetaNewPw', '', '')),
        onOk: function () {
          var pw = $('#admBetaNewPw').value;
          if (pw.length < 6) { toast('密码至少 6 位'); return false; }
          return API.admin.betaResetPassword(id, pw).then(function () {
            toast('密码已重置：' + pw + '（请妥善保管）');
          }).catch(function (err) { toast('重置失败：' + err.message); return true; });
        }
      });
    }
  });

  function seedBetaForm() {
    openModal({
      title: '批量创建内测账号',
      hint: '用户名自动生成（前缀+时间戳+序号），密码随机；创建后请立即记录密码。',
      okLabel: '创建',
      fields:
        field('数量（1-20）', input('admBetaCount', '5', '默认 5')) +
        field('用户名前缀', input('admBetaPrefix', 'beta', '字母数字下划线')) +
        field('昵称', input('admBetaNick', '内测用户', '')) +
        field('备注', input('admBetaNote', '内测账号（站长创建）', '')) +
        field('初始星币', input('admBetaBalance', '500', '0 表示不赠送')),
      onOk: function () {
        var count = parseInt($('#admBetaCount').value, 10) || 0;
        if (count < 1) { toast('数量至少为 1'); return false; }
        var payload = {
          count: count,
          prefix: $('#admBetaPrefix').value.trim(),
          nickname: $('#admBetaNick').value.trim(),
          note: $('#admBetaNote').value.trim(),
          balance: parseInt($('#admBetaBalance').value, 10) || 0
        };
        return API.admin.betaSeed(payload).then(function (d) {
          renderBeta();
          openModal({
            title: '已创建 ' + d.total + ' 个内测账号',
            hint: '以下为初始密码，仅此一次明文展示，请立即复制分发给内测用户。',
            okLabel: '我已保存',
            fields: '<div class="beta-pw-list">' + d.created.map(function (c) {
              return '<div><b>' + esc(c.username) + '</b>　密码：<span class="mono">' + esc(c.password) + '</span></div>';
            }).join('') + '</div>',
            onOk: function () { return true; }
          });
        }).catch(function (err) { toast('创建失败：' + err.message); return true; });
      }
    });
  }

  function createBetaOneForm() {
    openModal({
      title: '单个创建内测账号',
      hint: '用户名可指定或留空自动生成；密码随机生成，仅此一次明文展示。内测账号星币无限（∞），无需充值。',
      okLabel: '创建',
      fields:
        field('用户名（2-20 位，选填）', input('admBetaOneUser', '', '留空则自动生成，如 beta2601021234')) +
        field('昵称', input('admBetaOneNick', '内测用户', '')) +
        field('备注', input('admBetaOneNote', '内测账号（站长创建）', '')),
      onOk: function () {
        var payload = {
          username: $('#admBetaOneUser').value.trim(),
          nickname: $('#admBetaOneNick').value.trim(),
          note: $('#admBetaOneNote').value.trim()
        };
        return API.admin.betaCreate(payload).then(function (d) {
          renderBeta();
          var c = d.created;
          openModal({
            title: '内测账号已创建',
            hint: '以下为初始密码，仅此一次明文展示，请立即复制分发给内测用户。',
            okLabel: '我已保存',
            fields:
              field('用户名', '<b>' + esc(c.username) + '</b>') +
              field('初始密码', '<span class="mono">' + esc(c.password) + '</span>') +
              field('星币', '∞（无限，无需充值）'),
            onOk: function () { return true; }
          });
        }).catch(function (err) { toast('创建失败：' + err.message); return true; });
      }
    });
  }

  /* ============================================================
   * 四、星币与订单
   * ============================================================ */
  var txnState = { page: 1, type: '', q: '' };

  VIEWS.wallet = function () {
    var host = $('#view-wallet');
    host.innerHTML =
      '<div class="admin-h2">星币与订单</div>' +
      '<div class="admin-sub">全站收支流水 · 手动调账</div>' +
      '<div id="admTxnStats"></div>' +
      '<div class="admin-toolbar">' +
      '<input id="admTxnQ" placeholder="搜索用户名 / 备注" value="' + esc(txnState.q) + '">' +
      '<select id="admTxnType"><option value="">全部类型</option><option value="recharge">充值</option><option value="spend">消费</option><option value="refund">退回</option><option value="admin_adjust">调账</option></select>' +
      '<button class="btn-gold" id="admTxnSearch">搜索</button>' +
      '</div><div id="admTxnList"></div><div id="admTxnPager" class="admin-pager"></div>';

    $('#admTxnType').value = txnState.type;
    $('#admTxnSearch').addEventListener('click', function () {
      txnState.q = $('#admTxnQ').value.trim();
      txnState.type = $('#admTxnType').value;
      txnState.page = 1;
      renderTxns();
    });
    $('#admTxnQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#admTxnSearch').click(); });

    API.admin.overview().then(function (d) {
      $('#admTxnStats').innerHTML = '<div class="stat-grid">' +
        statCard('充值总额', fmt(d.wallet.recharge), '含管理员调账入账') +
        statCard('消费总额', fmt(d.wallet.spend), 'AI 与导出扣费') +
        statCard('今日充值', fmt(d.wallet.todayRecharge), '') +
        statCard('今日消费', fmt(d.wallet.todaySpend), '') +
        '</div>';
    }).catch(function () { /* 忽略看板错误，流水仍可查 */ });

    renderTxns();
  };

  function renderTxns() {
    var box = $('#admTxnList');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.transactions({ q: txnState.q, type: txnState.type, page: txnState.page, pageSize: 30 })
      .then(function (d) {
        box.innerHTML = txnTable(d.items);
        $('#admTxnPager').innerHTML = pagerHtml(d.page, d.pageSize, d.total, 'admTxnPage');
      }).catch(function (err) {
        box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
      });
  }

  /* ============================================================
   * 五、充值套餐
   * ============================================================ */
  VIEWS.plans = function () {
    var host = $('#view-plans');
    host.innerHTML =
      '<div class="admin-h2">充值套餐</div>' +
      '<div class="admin-sub">副平台充值页展示的套餐与价格，改这里即刻生效</div>' +
      '<div class="admin-toolbar"><button class="btn-gold" id="admPlanNew">+ 新建套餐</button></div>' +
      '<div id="admPlanList"></div>';
    $('#admPlanNew').addEventListener('click', function () { planForm(null); });
    renderPlans();
  };

  function renderPlans() {
    var box = $('#admPlanList');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.plans().then(function (d) {
      if (!d.items.length) { box.innerHTML = '<div class="empty-line">暂无套餐</div>'; return; }
      box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
        '<th>ID</th><th>名称</th><th>星币</th><th>赠送</th><th>价格</th><th>到账合计</th><th>排序</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>' + d.items.map(function (p) {
          return '<tr data-id="' + p.id + '">' +
            '<td class="mono">' + p.id + '</td>' +
            '<td class="pl-name">' + esc(p.label || '—') + '</td>' +
            '<td>' + fmt(p.coins) + '</td>' +
            '<td>' + fmt(p.bonus) + '</td>' +
            '<td>¥' + p.price + '</td>' +
            '<td>' + fmt(p.coins + p.bonus) + '</td>' +
            '<td>' + p.sort + '</td>' +
            '<td>' + (p.active ? '上架中' : '<span class="pill warn">已下架</span>') + '</td>' +
            '<td class="ops">' +
            '<button class="btn-si" data-pact="edit">编辑</button>' +
            '<button class="btn-si" data-pact="toggle">' + (p.active ? '下架' : '上架') + '</button>' +
            '<button class="btn-si danger" data-pact="del" data-label="删除">删除</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function (err) {
      box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
    });
  }

  document.addEventListener('click', function (e) {
    if (currentView !== 'plans') return;
    var btn = e.target.closest ? e.target.closest('#admPlanList [data-pact]') : null;
    if (!btn) return;
    var tr = btn.closest('tr');
    var id = tr.getAttribute('data-id');
    var act = btn.getAttribute('data-pact');
    if (act === 'edit') planForm(id);
    if (act === 'toggle') {
      var off = btn.textContent.indexOf('下架') === 0;
      API.admin.updatePlan(id, { active: !off }).then(function () {
        toast(off ? '套餐已下架' : '套餐已上架');
        renderPlans();
      }).catch(function (err) { toast('操作失败：' + err.message); });
    }
    if (act === 'del') {
      if (!arm(btn, '删除', function () {})) return;
      API.admin.removePlan(id).then(function () {
        toast('套餐已删除');
        renderPlans();
      }).catch(function (err) { toast('删除失败：' + err.message); });
    }
  });

  function planForm(id) {
    var p = null;
    var pre = id ? API.admin.plans().then(function (d) {
      return d.items.filter(function (x) { return String(x.id) === String(id); })[0] || null;
    }) : Promise.resolve(null);

    pre.then(function (plan) {
      p = plan;
      openModal({
        title: id ? '编辑套餐' : '新建套餐',
        hint: '副平台用户看到的价格即为这里的设置。',
        okLabel: id ? '保存修改' : '创建套餐',
        fields:
          field('套餐名称', input('admPlanLabel', p ? p.label : '', '例如：常用包')) +
          field('星币数量', input('admPlanCoins', p ? p.coins : 500, '')) +
          field('额外赠送', input('admPlanBonus', p ? p.bonus : 0, '0')) +
          field('价格（元）', input('admPlanPrice', p ? p.price : 45, '')) +
          field('排序（越小越靠前）', input('admPlanSort', p ? p.sort : 0, '0')) +
          field('状态', select('admPlanActive', [{ value: '1', label: '上架' }, { value: '0', label: '下架' }], p && !p.active ? '0' : '1')),
        onOk: function () {
          var payload = {
            label: $('#admPlanLabel').value.trim(),
            coins: parseInt($('#admPlanCoins').value, 10),
            bonus: parseInt($('#admPlanBonus').value, 10) || 0,
            price: parseFloat($('#admPlanPrice').value),
            sort: parseInt($('#admPlanSort').value, 10) || 0,
            active: $('#admPlanActive').value === '1'
          };
          if (!payload.coins || payload.coins < 1) { toast('星币数量至少为 1'); return false; }
          if (!(payload.price >= 0)) { toast('请填写有效价格'); return false; }
          var req = id ? API.admin.updatePlan(id, payload) : API.admin.createPlan(payload);
          return req.then(function () {
            toast(id ? '套餐已更新' : '套餐已创建');
            renderPlans();
          }).catch(function (err) { toast('保存失败：' + err.message); return true; });
        }
      });
    });
  }

  /* ============================================================
   * 六、AI 配置与调试
   * ============================================================ */
  var aiState = { logPage: 1 };

  VIEWS.ai = function () {
    var host = $('#view-ai');
    host.innerHTML =
      '<div class="admin-h2">AI 配置与调试</div>' +
      '<div class="admin-sub">全站 AI 能力（星盘解析 / 合盘问答 / 个人运势）统一在这里配置，客户端无需填写任何密钥</div>' +
      '<div id="admAiStatus" style="margin-bottom:14px"></div>' +
      '<div class="admin-form">' +
      '<div class="row">' +
      '<div>' + field('接口地址（OpenAI 兼容）', input('admAiUrl', '', 'https://api.deepseek.com/v1')) + '</div>' +
      '<div>' + field('API Key', input('admAiKey', '', '留空或不改则保持原值')) + '</div>' +
      '</div>' +
      '<div class="row">' +
      '<div>' + field('模型名称', input('admAiModel', '', 'deepseek-chat')) + '</div>' +
      '<div>' + field('温度（0-2）', input('admAiTemp', '', '0.7', 'number')) + '</div>' +
      '</div>' +
      '<div class="row"><div>' + field('启停', select('admAiEnabled', [{ value: '1', label: '启用' }, { value: '0', label: '停用' }], '0')) + '</div></div>' +
      field('系统提示词（全局规则，与各页面专属提示词叠加生效）',
        '<textarea id="admAiPrompt" rows="14" style="min-height:220px"></textarea>',
        '此处内容会拼在各页面自带提示词之前一起发送；留空则不注入。上限 20000 字符。') +
      '<div class="admin-actions">' +
      '<button class="btn-gold" id="admAiSave">保存配置</button>' +
      '<button class="btn-si" id="admAiTest">测试连通性</button>' +
      '</div>' +
      '<div id="admAiTestResult" class="table-note"></div>' +
      '</div>' +
      '<div class="admin-section-title">调用统计</div><div id="admAiStats"></div>' +
      '<div class="admin-section-title">调用日志</div><div id="admAiLogs"></div><div id="admLogPager" class="admin-pager"></div>';

    $('#admAiSave').addEventListener('click', saveAI);
    $('#admAiTest').addEventListener('click', testAI);
    loadAI();
    renderLogs();
  };

  function loadAI() {
    API.admin.aiSettings().then(function (d) {
      var s = d.settings;
      $('#admAiUrl').value = s.baseUrl || '';
      $('#admAiKey').value = s.apiKeyMasked || '';
      $('#admAiModel').value = s.model || '';
      $('#admAiTemp').value = s.temperature;
      $('#admAiPrompt').value = s.systemPrompt || '';
      $('#admAiEnabled').value = s.enabled ? '1' : '0';
      renderAiStatus(d.status, s);
    }).catch(function (err) {
      $('#admAiStatus').innerHTML = '<div class="empty-line">读取配置失败：' + esc(err.message) + '</div>';
    });
  }

  function renderAiStatus(status, s) {
    $('#admAiStatus').innerHTML =
      '<span class="admin-status ' + (status.configured ? 'on' : '') + '">' +
      (status.configured ? 'AI 已就绪' : 'AI 未就绪') + '</span> ' +
      '<span class="admin-status">模型：' + esc(status.model || '未设置') + '</span> ' +
      '<span class="admin-status">密钥：' + (status.hasKey ? '已配置' : '未配置') + '</span>' +
      (s && s.updatedAt ? ' <span class="admin-status">更新于 ' + dt(s.updatedAt) + '</span>' : '');
  }

  function saveAI() {
    var payload = {
      baseUrl: $('#admAiUrl').value.trim(),
      apiKey: $('#admAiKey').value.trim(),
      model: $('#admAiModel').value.trim(),
      temperature: parseFloat($('#admAiTemp').value),
      systemPrompt: $('#admAiPrompt').value,
      enabled: $('#admAiEnabled').value === '1'
    };
    if (Number.isNaN(payload.temperature)) delete payload.temperature;
    API.admin.saveAiSettings(payload).then(function (d) {
      toast('AI 配置已保存');
      renderAiStatus(d.status, d.settings);
      loadAI();
    }).catch(function (err) {
      toast('保存失败：' + err.message);
    });
  }

  function testAI() {
    var box = $('#admAiTestResult');
    box.textContent = '正在测试连通性…';
    API.admin.aiTest({
      baseUrl: $('#admAiUrl').value.trim() || undefined,
      apiKey: $('#admAiKey').value.indexOf('\u2022') >= 0 ? undefined : ($('#admAiKey').value.trim() || undefined),
      model: $('#admAiModel').value.trim() || undefined
    }).then(function (r) {
      box.innerHTML = '<span style="color:var(--ok)">连通成功</span>：模型 ' + esc(r.model) + ' · 往返 ' + fmt(r.latencyMs) + 'ms · 回复「' + esc(r.reply) + '」';
      renderLogs();
    }).catch(function (err) {
      box.innerHTML = '<span style="color:var(--danger)">连通失败</span>：' + esc(err.message);
      renderLogs();
    });
  }

  function renderLogs() {
    var box = $('#admAiLogs');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.aiLogs({ page: aiState.logPage, pageSize: 20 }).then(function (d) {
      var s = d.stats;
      $('#admAiStats').innerHTML = '<div class="stat-grid">' +
        statCard('总调用', fmt(s.total), '') +
        statCard('成功', fmt(s.ok), s.total ? ('成功率 ' + Math.round(s.ok / s.total * 100) + '%') : '') +
        statCard('失败', fmt(s.failed), '') +
        statCard('今日调用', fmt(s.today), '') +
        statCard('平均耗时', fmt(s.avgLatencyMs) + 'ms', '仅统计成功请求') +
        '</div>';
      if (!d.items.length) {
        box.innerHTML = '<div class="empty-line">暂无调用记录</div>';
      } else {
        box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
          '<th>时间</th><th>用户</th><th>场景</th><th>结果</th><th>HTTP</th><th>耗时</th><th>提示词长度</th><th>错误信息</th>' +
          '</tr></thead><tbody>' + d.items.map(function (l) {
            return '<tr>' +
              '<td>' + dt(l.createdAt) + '</td>' +
              '<td>' + esc(l.username) + '</td>' +
              '<td>' + esc(l.scene || '—') + '</td>' +
              '<td>' + (l.ok ? '成功' : '<span class="log-fail">失败</span>') + '</td>' +
              '<td class="mono">' + (l.statusCode === null ? '—' : l.statusCode) + '</td>' +
              '<td>' + (l.latencyMs === null ? '—' : fmt(l.latencyMs) + 'ms') + '</td>' +
              '<td>' + fmt(l.promptChars) + '</td>' +
              '<td>' + esc((l.error || '').slice(0, 60)) + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      $('#admLogPager').innerHTML = pagerHtml(d.page, d.pageSize, d.total, 'admLogPage');
    }).catch(function (err) {
      box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
    });
  }

  function loadUsersBrief() {
    return API.admin.usersBrief().then(function (d) { return d.items || []; })
      .catch(function () { return []; });
  }

  /* ============================================================
   * 七、留言反馈（站长查看）
   * ============================================================ */
  var fbState = { page: 1, status: '' };

  VIEWS.feedback = function () {
    var host = $('#view-feedback');
    host.innerHTML =
      '<div class="admin-h2">留言反馈</div>' +
      '<div class="admin-sub">用户从个人中心提交的留言与反馈；新留言会同步推送系统通知到站长铃铛</div>' +
      '<div class="admin-toolbar">' +
      '<select id="admFbStatus"><option value="">全部状态</option><option value="new">待处理</option><option value="done">已处理</option></select>' +
      '</div>' +
      '<div id="admFbList"></div>' +
      '<div id="admFbPager" class="admin-pager"></div>';
    $('#admFbStatus').value = fbState.status;
    $('#admFbStatus').addEventListener('change', function () {
      fbState.status = this.value;
      fbState.page = 1;
      renderFeedbacks();
    });
    renderFeedbacks();
  };

  function renderFeedbacks() {
    var box = $('#admFbList');
    box.innerHTML = '<div class="empty-line">加载中…</div>';
    API.admin.feedbacks({ status: fbState.status || undefined, limit: 20, offset: (fbState.page - 1) * 20 }).then(function (d) {
      if (!d.items.length) {
        box.innerHTML = '<div class="empty-line">暂无留言反馈</div>';
      } else {
        box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
          '<th>时间</th><th>用户名</th><th>昵称</th><th>内容</th><th>联系方式</th><th>状态</th>' +
          '</tr></thead><tbody>' + d.items.map(function (f) {
            return '<tr><td>' + dt(f.createdAt) + '</td>' +
              '<td>' + esc(f.username || ('#' + f.userId)) + '</td>' +
              '<td>' + esc(f.nickname || '—') + '</td>' +
              '<td style="white-space:normal;max-width:420px">' + esc(f.content) + '</td>' +
              '<td>' + esc(f.contact || '—') + '</td>' +
              '<td>' + (f.status === 'done' ? '已处理' : '<span class="log-fail">待处理</span>') + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      $('#admFbPager').innerHTML = pagerHtml(fbState.page, 20, d.total, 'admFbPage');
    }).catch(function (err) {
      box.innerHTML = '<div class="empty-line">加载失败：' + esc(err.message) + '</div>';
    });
  }

  /* ============================================================
   * 八、消息通知群发（站长）
   * ============================================================ */
  var TARGET_LABEL = { all: '全部用户', customer: '普通用户', beta: '内测账号' };
  var notifyState = { recent: [] };

  VIEWS.notify = function () {
    var host = $('#view-notify');
    host.innerHTML =
      '<div class="admin-h2">消息通知群发</div>' +
      '<div class="admin-sub">向全部用户 / 普通用户 / 内测账号群发通知；群发内容会进入对方右上角铃铛，未读红点即时提示</div>' +
      '<div class="admin-form">' +
      '<div class="row">' +
      '<div>' + field('目标用户', select('admNtTarget', [
        { value: 'all', label: '全部用户（除站长外所有账号）' },
        { value: 'customer', label: '普通用户' },
        { value: 'beta', label: '内测账号' }
      ], 'all')) + '</div>' +
      '</div>' +
      '<div class="row"><div>' + field('通知标题', input('admNtTitle', '', '例如：平台维护通知（最多 100 字）')) + '</div></div>' +
      field('通知内容', '<textarea id="admNtContent" rows="5" style="min-height:120px"></textarea>', '上限 2000 字。') +
      '<div class="admin-actions"><button class="btn-gold" id="admNtSend">群发通知</button></div>' +
      '<div id="admNtResult" class="table-note"></div>' +
      '</div>' +
      '<div class="admin-section-title">本次会话发送记录</div><div id="admNtRecent" class="empty-line">暂无发送记录</div>';
    $('#admNtSend').addEventListener('click', sendBroadcast);
    renderNtRecent();
  };

  function sendBroadcast() {
    var title = $('#admNtTitle').value.trim();
    var content = $('#admNtContent').value.trim();
    var target = $('#admNtTarget').value;
    var box = $('#admNtResult');
    var btn = $('#admNtSend');
    box.innerHTML = '<span style="color:var(--ink-dim)">发送中…</span>';
    btn.disabled = true;
    API.notify.broadcast({ title: title, content: content, target: target }).then(function (d) {
      box.innerHTML = '<span style="color:var(--ok)">已送达 ' + fmt(d.sent) + ' 个账号</span>（目标：' + esc(TARGET_LABEL[d.target] || d.target) + '）';
      notifyState.recent.unshift({ time: new Date().toISOString(), target: d.target, sent: d.sent, title: title });
      notifyState.recent = notifyState.recent.slice(0, 20);
      renderNtRecent();
      $('#admNtTitle').value = '';
      $('#admNtContent').value = '';
      btn.disabled = false;
    }).catch(function (err) {
      box.innerHTML = '<span style="color:var(--danger)">发送失败：' + esc(err.message) + '</span>';
      btn.disabled = false;
    });
  }

  function renderNtRecent() {
    var box = $('#admNtRecent');
    if (!box) return;
    if (!notifyState.recent.length) { box.innerHTML = '<div class="empty-line">暂无发送记录</div>'; return; }
    box.innerHTML = '<table class="astro-table admin-table"><thead><tr>' +
      '<th>时间</th><th>目标</th><th>送达</th><th>标题</th>' +
      '</tr></thead><tbody>' + notifyState.recent.map(function (r) {
        return '<tr><td>' + dt(r.time) + '</td>' +
          '<td>' + esc(TARGET_LABEL[r.target] || r.target) + '</td>' +
          '<td>' + fmt(r.sent) + '</td>' +
          '<td>' + esc(r.title) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------------- 启动 ---------------- */
  (async function boot() {
    if (!Auth.hasSession()) {
      location.href = 'login.html?next=' + encodeURIComponent('admin.html');
      return;
    }
    try {
      var me = await API.auth.me();
      API.setCachedProfile(me.user);
      Auth.renderUserArea();
      if (me.user.role !== 'admin') {
        toast('该页面仅限站长访问');
        setTimeout(function () { location.href = 'index.html'; }, 1200);
        return;
      }
    } catch (e) {
      location.href = 'login.html?next=' + encodeURIComponent('admin.html');
      return;
    }

    $$('.admin-nav-item').forEach(function (a) {
      a.addEventListener('click', function () { show(a.getAttribute('data-view')); });
    });
    window.addEventListener('hashchange', function () { show(location.hash.slice(1) || 'overview'); });

    show(location.hash.slice(1) || 'overview');
  })();
})();
