/* ============================================================
 * app.js — 本命星盘页逻辑
 * 地点搜索 / 表单 / 渲染 / 六大主星 / 折叠解析 / 盘面数据格表
 * 星盘档案保存 / AI 问答与深度解析（扣星币）/ 导出 Word（扣星币）
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  // ---------- 安全存储 (localStorage 不可用时降级为内存) ----------
  var store = (function () {
    try {
      var t = '__astro_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (e) {
      var mem = {};
      return {
        getItem: function (k) { return mem[k] || null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  // ---------- 全局状态 ----------
  var state = {
    chart: null,
    name: '',
    birthPlace: null,
    livePlace: null,
    birth: null // 表单出生信息（日期/时间/是否不详），供存入客户库使用
  };

  var GLYPH = { asc: 'AC', sun: '\u2609', moon: '\u263D', mercury: '\u263F', venus: '\u2640', mars: '\u2642', jupiter: '\u2643', saturn: '\u2644', uranus: '\u2645', neptune: '\u2646', pluto: '\u2647' };

  // ---------- Toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---------- 地点搜索 (Open-Meteo Geocoding, 免费/无需Key) ----------
  var geoTimers = {};
  function attachGeoSearch(inputId, onPick) {
    var input = $('#' + inputId);
    var box = null;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(geoTimers[inputId]);
      if (!q || q.length < 1) { closeDrop(); return; }
      geoTimers[inputId] = setTimeout(function () { searchGeo(q, input, onPick, function () { closeDrop(); }); }, 350);
    });
    input.addEventListener('blur', function () { setTimeout(closeDrop, 220); });
    function closeDrop() { if (box) { box.remove(); box = null; } }
  }

  function searchGeo(q, input, onPick, done) {
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=8&language=zh&format=json';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      var results = mergeGeoResults(localGeoResults(q), data.results || []);
      showDrop(results, input, onPick);
      done();
    }).catch(function () {
      showDrop([], input, onPick);
      done();
    });
  }

  function showDrop(results, input, onPick) {
    var old = input.parentNode.querySelector('.geo-drop');
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'geo-drop';
    if (!results.length) {
      box.innerHTML = '<div class="geo-empty">没有找到匹配的地点，试试输入城市名（如：上海）</div>';
    } else {
      results.forEach(function (r) {
        var item = document.createElement('div');
        item.className = 'geo-item';
        var sub = [r.admin1, r.country].filter(Boolean).join(' · ');
        item.innerHTML = r.name + '<span class="geo-sub">' + sub + '</span>';
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          input.value = r.name + (sub ? '，' + sub : '');
          onPick({ name: r.name, admin: sub, lat: r.latitude, lon: r.longitude, tz: r.timezone });
          box.remove();
        });
        box.appendChild(item);
      });
    }
    input.parentNode.appendChild(box);
  }

  attachGeoSearch('birthPlace', function (p) { state.birthPlace = p; });
  attachGeoSearch('livePlace', function (p) { state.livePlace = p; });

  // 出生时间不详
  $('#timeUnknown').addEventListener('change', function () {
    var disabled = this.checked;
    $('#birthTime').disabled = disabled;
    if (disabled) $('#birthTime').value = '12:00';
  });

  // ---------- 生成星盘 ----------
  $('#btnGenerate').addEventListener('click', function () {
    var btn = this;
    var errs = [];
    var dv = $('#birthDate').value;
    var tv = $('#birthTime').value || '12:00';
    if (!dv) { errs.push(['birthDate', '请选择出生日期']); }
    if (!state.birthPlace) { errs.push(['birthPlace', '请从下拉中选择出生地（输入后选择联想项）']); }
    showFieldErrors(errs);
    if (errs.length) return;

    var y = +dv.slice(0, 4), mo = +dv.slice(5, 7), d = +dv.slice(8, 10);
    var h = +tv.slice(0, 2), mi = +tv.slice(3, 5);
    if (y < 1800 || y > 2400) { showFieldErrors([['birthDate', '请输入 1800-2400 年之间的日期']]); return; }

    state.name = $('#nickName').value.trim();
    var houseSystem = $('#houseSystem').value;
    state.birth = { date: dv, time: tv, timeUnknown: $('#timeUnknown').checked };

    btn.disabled = true;
    btn.textContent = '推 算 星 盘 中 …';

    setTimeout(function () {
      try {
        var chart = AstroCalc.computeChart({
          year: y, month: mo, day: d, hour: h, minute: mi,
          timeUnknown: $('#timeUnknown').checked,
          birthPlace: state.birthPlace,
          livePlace: state.livePlace,
          houseSystem: houseSystem
        });
        state.chart = chart;
        renderResult();
        $('#hero').style.display = 'none';
        $('#result').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error(e);
        toast('生成失败：' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '生 成 我 的 星 盘';
      }
    }, 60);
  });

  function showFieldErrors(errs) {
    ['birthDate', 'birthPlace', 'birthTime'].forEach(function (id) {
      var el = $('#err-' + id); if (el) el.textContent = '';
    });
    errs.forEach(function (e) {
      var el = $('#err-' + e[0]); if (el) el.textContent = e[1];
    });
  }

  // ---------- 九大行星速览 ----------
  function planetListHtml(chart) {
    var order = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    return order.map(function (key) {
      var p = null;
      for (var i = 0; i < chart.planets.length; i++) if (chart.planets[i].key === key) { p = chart.planets[i]; break; }
      if (!p) return '';
      return '<div class="pl-row">' +
        '<span class="pl-glyph">' + (GLYPH[key] || p.glyph || '') + '</span>' +
        '<span class="pl-name">' + p.name + '</span>' +
        '<span class="pl-sign">' + p.sign.name + '</span>' +
        '<span class="pl-deg">' + p.sign.deg + '\u00B0' + String(p.sign.min).padStart(2, '0') + '\u2032' + (p.retro ? ' \u211E' : '') + '</span>' +
        '<span class="pl-house">第' + p.house + '宫</span>' +
        '</div>';
    }).join('');
  }

  // ---------- 折叠解析报告 ----------
  function reportHtml() {
    var chart = state.chart;
    var sections = Interpret.buildFullReport(chart, state.name);
    var html = '';
    sections.forEach(function (s, i) {
      html += '<details class="acc"' + (i === 0 ? ' open' : '') + '><summary>' + s.title + '</summary>' +
        '<div class="acc-body">' + s.html + '</div></details>';
    });
    return '<div class="report">' + html + '</div>';
  }

  // ---------- 盘面数据（专业格子） ----------
  function degCell(sign) {
    return sign.deg + '\u00B0' + String(sign.min).padStart(2, '0') + '\u2032';
  }

  function houseSystemName(sys) {
    var hs = (window.AstroCalc && AstroCalc.HOUSE_SYSTEMS) || [];
    for (var i = 0; i < hs.length; i++) if (hs[i].key === sys) return hs[i].name;
    return sys;
  }

  function dataGridHtml(chart) {
    var nature = { conj: ['融合', 'nature-c'], trine: ['和谐', 'nature-h'], sextile: ['和谐', 'nature-h'], square: ['紧张', 'nature-t'], opp: ['紧张', 'nature-t'] };
    // 表一：行星落座
    var rows = '';
    chart.planets.forEach(function (p) {
      rows += '<tr><td class="pl-name"><span class="gly">' + (p.glyph || '') + '</span>' + p.name + '</td>' +
        '<td>' + p.sign.name + '</td><td>' + degCell(p.sign) + '</td>' +
        '<td>第' + p.house + '宫</td>' +
        '<td class="' + (p.retro ? 'retro-yes' : 'retro-no') + '">' + (p.retro ? '\u211E 逆行' : '\u2014') + '</td></tr>';
    });
    rows += '<tr><td class="pl-name"><span class="gly">AC</span>上升点</td><td>' + chart.asc.sign.name + '</td><td>' + degCell(chart.asc.sign) + '</td><td>第1宫</td><td class="retro-no">\u2014</td></tr>';
    rows += '<tr><td class="pl-name"><span class="gly">MC</span>中天点</td><td>' + chart.mc.sign.name + '</td><td>' + degCell(chart.mc.sign) + '</td><td>第10宫</td><td class="retro-no">\u2014</td></tr>';
    var t1 = '<div class="astro-block"><h4>行星落座表</h4>' +
      '<table class="astro-table"><thead><tr><th>星体</th><th>星座</th><th>度数</th><th>宫位</th><th>逆行</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (chart.timeUnknown ? '<p class="table-note">出生时间按 12:00 估算，上升 / 宫位 / 月亮可能有偏差。</p>' : '') +
      '</div>';

    // 表二：宫头
    var hRows = '';
    for (var h = 1; h <= 12; h++) {
      var cusp = AstroCalc.signOf(chart.houses[h]);
      hRows += '<tr><td>第' + h + '宫</td><td>' + cusp.name + '</td><td>' + degCell(cusp) + '</td></tr>';
    }
    var t2 = '<div class="astro-block"><h4>宫头位置表（' + houseSystemName(chart.houseSystem) + (chart.houseFallback ? '，高纬度已兜底为等宫制' : '') + '）</h4>' +
      '<table class="astro-table"><thead><tr><th>宫位</th><th>宫头星座</th><th>宫头度数</th></tr></thead><tbody>' + hRows + '</tbody></table></div>';

    // 表三：相位
    var aRows = '';
    chart.aspects.forEach(function (a) {
      var nt = nature[a.type] || ['\u2014', 'nature-c'];
      aRows += '<tr><td>' + a.aName + '</td><td>' + a.name + '</td><td>' + a.bName + '</td><td>' + a.orb + '\u00B0</td><td class="' + nt[1] + '">' + nt[0] + '</td></tr>';
    });
    var t3 = '<div class="astro-block"><h4>相位表（共 ' + chart.aspects.length + ' 组，按紧密排序）</h4>' +
      '<table class="astro-table"><thead><tr><th>行星 A</th><th>相位</th><th>行星 B</th><th>容许度</th><th>性质</th></tr></thead><tbody>' + aRows + '</tbody></table>' +
      '<p class="table-note">和谐 = 三分 / 六分；紧张 = 四分 / 对分；融合 = 合相。</p></div>';

    return t1 + t2 + t3;
  }

  // ---------- 渲染结果 ----------
  function renderResult() {
    var chart = state.chart;
    // 盘面
    ChartRender.renderChart(ChartRender.prepareChart(chart), $('#wheel'));

    $('#placeLine').textContent = chart.localTimeStr + ' · ' + chart.place.name +
      (chart.livePlace ? ' · 现居' + chart.livePlace.name : '') +
      (chart.houseFallback ? '（高纬度自动改用等宫制）' : '');

    // 九大行星速览
    $('#planetList').innerHTML = planetListHtml(chart);

    // 解析报告（折叠）
    $('#tab-report').innerHTML = reportHtml();

    // 盘面数据格子
    $('#dataGrid').innerHTML = dataGridHtml(chart);

    // AI 上下文预览
    $('#aiContext').textContent = JSON.stringify(Interpret.chartContext(chart, state.name), null, 1);

    if (window.Billing) Billing.refreshChips();
  }

  // Tab 切换
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      $('#' + t.dataset.tab).classList.add('active');
    });
  });

  // AI 子页签（AI 回答 / AI 深度解析）
  document.querySelectorAll('.ai-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.ai-tab').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('.ai-sub-panel').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      $('#' + t.dataset.aiTab).classList.add('active');
    });
  });

  // AI 由主平台统一配置：客户端不读取本地密钥，统一走服务端代理
  var aiReadyCache = null;
  function checkAI() {
    if (aiReadyCache !== null) return Promise.resolve(aiReadyCache);
    return API.ai.status().then(function (s) { aiReadyCache = !!s.configured; return aiReadyCache; })
      .catch(function () { return true; });
  }
  async function requireAI() {
    var ready = await checkAI();
    if (!ready) toast('AI 功能尚未配置，请联系站长在主平台完成设置');
    return ready;
  }

  // ---------- 从客户库选择（依赖 customers-lib.js） ----------
  function fillFromCustomer(c) {
    if (!c) return;
    $('#nickName').value = c.name || '';
    $('#birthDate').value = c.date || '';
    $('#timeUnknown').checked = !!c.timeUnknown;
    $('#birthTime').disabled = !!c.timeUnknown;
    $('#birthTime').value = c.time || '12:00';
    state.birthPlace = c.place || null;
    $('#birthPlace').value = window.ClientLib ? ClientLib.placeText(c.place) : '';
    showFieldErrors([]);
    toast('已载入客户「' + (c.name || '') + '」的出生信息');
  }
  if ($('#btnPickCustomer') && window.ClientLib) {
    $('#btnPickCustomer').addEventListener('click', function () {
      ClientLib.openPicker({ title: '选择客户 · 本命盘', onPick: fillFromCustomer });
    });
    // 支持客户库页「本命盘」直达：natal.html?customer=xxx
    var mCust = /[?&]customer=([^&]+)/.exec(location.search);
    if (mCust) ClientLib.whenReady(function () { fillFromCustomer(ClientLib.byId(decodeURIComponent(mCust[1]))); });
  }

  // ---------- 保存到客户库（复用 customers-lib.js 存储逻辑） ----------
  $('#btnSave').addEventListener('click', function () {
    if (!state.chart) return;
    if (!window.ClientLib) { toast('客户库模块未加载'); return; }
    var chart = state.chart;
    var name = ($('#nickName') ? $('#nickName').value.trim() : '') || state.name || '';
    if (!name) { toast('请先填写昵称，再存入客户库'); $('#nickName').focus(); return; }
    var cust = {
      name: name,
      note: '来自本命盘 · 太阳' + chart.planets[0].sign.name + ' · 月亮' + chart.planets[1].sign.name + ' · 上升' + chart.asc.sign.name,
      date: ($('#birthDate') ? $('#birthDate').value : '') || '',
      time: ($('#birthTime') ? $('#birthTime').value : '') || '12:00',
      timeUnknown: !!($('#timeUnknown') && $('#timeUnknown').checked),
      place: state.birthPlace || null
    };
    ClientLib.upsert(cust).then(function (saved) { if (saved) toast('已存入客户库：' + name); });
  });

  // ---------- AI 问答 ----------
  var chatHistory = [];
  $('#btnSend').addEventListener('click', sendChat);
  $('#chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $('#chatInput').value = c.textContent;
      sendChat();
    });
  });

  function addMsg(role, html) {
    var div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
    div.innerHTML = '<div class="avatar">' + (role === 'user' ? '我' : 'AI') + '</div><div class="bubble">' + html + '</div>';
    $('#chatWindow').appendChild(div);
    $('#chatWindow').scrollTop = $('#chatWindow').scrollHeight;
    return div;
  }

  async function sendChat() {
    if (!state.chart) return;
    if (!(await requireAI())) return;
    var input = $('#chatInput');
    var q = input.value.trim();
    if (!q) return;
    if (!(await Billing.spend('本命 · AI 问答'))) return;
    input.value = '';
    addMsg('user', escapeHtml(q));

    var sys = AI_SYSTEM_PROMPT + '\n\n用户星盘数据：\n' + JSON.stringify(Interpret.chartContext(state.chart, state.name)) +
      '\n\n当前天象（行运）：\n' + JSON.stringify(AstroCalc.currentTransits()) +
      '\n\n回答要求：紧扣盘面数据说话，说人话，给建议；回答控制在 300 字内直讲核心，主要课题只保留最重要的 1-2 项，除非用户要求更详细。';
    var msgs = [{ role: 'system', content: sys }].concat(chatHistory.slice(-10)).concat([{ role: 'user', content: q }]);
    var typing = addMsg('ai', '<span class="typing">正在结合你的星盘推算…</span>');

    callAI(msgs).then(function (text) {
      typing.querySelector('.bubble').innerHTML = mdLite(text);
      $('#chatWindow').scrollTop = $('#chatWindow').scrollHeight;
      chatHistory.push({ role: 'user', content: q });
      chatHistory.push({ role: 'assistant', content: text });
    }).catch(function (e) {
      Billing.refund('AI 问答失败退回');
      typing.querySelector('.bubble').innerHTML = '<span style="color:var(--danger)">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }

  var AI_SYSTEM_PROMPT =
    '你是一位功底扎实的资深占星师，说话风格：像懂心理学的老朋友，大白话、接地气、有温度，会打比方，偶尔幽默。' +
    '规则：1) 所有解读必须紧扣提供的星盘数据（星座/宫位/相位/行运），不允许编造盘面上不存在的信息；' +
    '2) 不做绝对化断言，不说"注定""一定"，星盘是倾向不是判决；3) 不制造焦虑，不给改运承诺；' +
    '4) 结论后给可操作的小建议；5) 输出使用简体中文，可用简单的 Markdown（小标题、加粗、列表）。';

  // 统一走服务端 AI 代理（密钥保存在服务端，客户端不接触）
  function callAI(messages) {
    return API.ai.chat('本命 · AI 问答', messages, 0.8).then(function (d) { return d.content; });
  }
  function callAIDeep(messages) {
    return API.ai.chat('本命 · AI 深度解析', messages, 0.8).then(function (d) { return d.content; });
  }

  // 轻量 Markdown
  function mdLite(s) {
    var lines = escapeHtml(s).split('\n');
    var html = '', inList = false;
    lines.forEach(function (line) {
      var t = line.trim();
      if (/^#{1,4}\s/.test(t)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p><b>' + t.replace(/^#{1,4}\s*/, '') + '</b></p>';
      } else if (/^[-*]\s/.test(t)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inline(t.replace(/^[-*]\s*/, '')) + '</li>';
      } else if (t === '') {
        if (inList) { html += '</ul>'; inList = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p>' + inline(t) + '</p>';
      }
    });
    if (inList) html += '</ul>';
    return html;
    function inline(x) {
      return x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- AI 深度解析（综合解析 + 主要课题 + 个人的优势/劣势 + 人生建议） ----------
  var deepReportText = '';
  var DEEP_SYSTEM_PROMPT =
    '你是一位功底扎实的资深占星师，请基于用户整张星盘（行星落座/宫位/相位/元素/上升/中天），生成一份「综合解析 + 主要课题 + 个人的优势/劣势 + 人生建议」报告。' +
    '要求：1) 只做星盘整体综合解读，不做单星象逐项罗列；2) 先给出整体画像与人生主线（性格基调、天赋能量、发展节奏），并优先以四轴 ASC/IC/MC/DSC 搭建全局框架；' +
    '3) 再提炼当下最重要的主要课题（只保留最重要的 1-2 项，成长方向、卡点与转化建议）；4) 接着给出个人的优势与劣势（各 2-3 项，紧扣盘面数据，落到现实生活）；5) 最后给出人生建议（最优活法 + 可操作的落地建议）；6) 必须紧扣盘面数据，不编造盘面上不存在的信息；' +
    '7) 不说"注定""一定"，星盘是倾向不是判决；8) 输出简体中文 Markdown，全篇控制在 900 字内，格式固定为：\n' +
    '一、综合解析\n（内容）\n二、主要课题\n（内容）\n三、个人的优势/劣势\n（内容）\n四、人生建议\n（内容）';

  async function aiDeepReport() {
    if (!state.chart) return;
    if (!(await requireAI())) return;
    if (!(await Billing.spend('本命 · AI 深度解析'))) return;
    var box = $('#deepReport');
    box.innerHTML = '<span class="typing">正在为你生成星盘整体解析…</span>';
    var sys = DEEP_SYSTEM_PROMPT + '\n\n用户星盘数据：\n' + JSON.stringify(Interpret.chartContext(state.chart, state.name));
    callAIDeep([{ role: 'system', content: sys }, { role: 'user', content: '请为这份星盘生成「综合解析 + 主要课题 + 个人的优势/劣势 + 人生建议」报告。' }]).then(function (text) {
      deepReportText = text;
      box.innerHTML = mdLite(text);
      toast('AI 深度解析已生成');
    }).catch(function (e) {
      Billing.refund('AI 深度解析失败退回');
      box.innerHTML = '<span class="deep-empty">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }
  $('#btnDeepReport').addEventListener('click', aiDeepReport);

  // ---------- AI 专业解析（2500 字长报告，仅站主/管理员） ----------
  var proReportText = '';
  var PRO_SYSTEM_PROMPT =
    '你是一位功底扎实、从业 20 年+ 的资深占星师，请基于用户整张星盘（行星落座/宫位/相位/元素/上升/中天），生成一份约 2500 字的「AI 专业解析」完整报告。' +
    '要求：1) 以四轴 ASC/IC/MC/DSC 为全局骨架，先做综合解析（性格基调、天赋能量、原生惯性、发展节奏、人生主线）；' +
    '2) 再展开主要课题（伴随一生的成长主线、最需要突破的卡点与转化路径）；3) 深入拆解：真实人格与外在呈现、感情模式与亲密关系、事业定位与赚钱逻辑、致命短板与后天误区、最优活法与落地建议，每项都要落到现实生活并给出可执行建议；' +
    '4) 汇总个人的优势与劣势（各 2-3 项，落在现实生活、紧扣盘面数据）；5) 最后给出人生建议（最优活法 + 可执行落地建议）；' +
    '6) 结构清晰分章节，固定为：一、综合解析；二、主要课题；三、个人的优势/劣势；四、人生建议，总字数约 2500 字；' +
    '7) 必须紧扣盘面数据，不编造盘面上不存在的信息；8) 不说"注定""一定"，星盘是倾向不是判决；9) 不制造焦虑，不给改运承诺；' +
    '10) 全程隐藏原始盘面数据（不罗列行星落座/相位/度数），只输出推导后的结论；11) 输出使用简体中文 Markdown，格式固定为：\n' +
    '一、综合解析\n（内容）\n二、主要课题\n（内容）\n三、个人的优势/劣势\n（内容）\n四、人生建议\n（内容）';

  function callAIPro(messages) {
    return API.ai.proReport(messages, 0.8).then(function (d) { return d.content; });
  }

  async function aiProReport() {
    if (!state.chart) return;
    if (!(await requireAI())) return;
    if (!(await Billing.spend('AI 专业解析'))) return;
    var box = $('#proReport');
    box.innerHTML = '<span class="typing">正在为你生成约 2500 字的专业级报告…</span>';
    var sys = PRO_SYSTEM_PROMPT + '\n\n用户星盘数据：\n' + JSON.stringify(Interpret.chartContext(state.chart, state.name));
    callAIPro([{ role: 'system', content: sys }, { role: 'user', content: '请为这份星盘生成约 2500 字的「AI 专业解析」完整报告。' }]).then(function (text) {
      proReportText = text;
      box.innerHTML = mdLite(text);
      toast('AI 专业解析已生成（已扣 1 星币）');
    }).catch(function (e) {
      Billing.refund('AI 专业解析失败退回');
      box.innerHTML = '<span class="deep-empty">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }
  $('#btnProReport').addEventListener('click', aiProReport);

  // 专业解析入口仅站主/管理员可见
  function applyProVisible() {
    var show = !!(window.Auth && typeof window.Auth.isAdmin === 'function' && (window.Auth.isAdmin() || window.Auth.isBeta()));
    var tabs = document.querySelectorAll('.ai-pro-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].style.display = show ? '' : 'none';
  }
  applyProVisible();
  if (window.API && window.API.bootstrap && !(window.Auth && window.Auth.currentProfile && window.Auth.currentProfile())) {
    window.API.bootstrap().then(applyProVisible, applyProVisible);
  }

  // ---------- 导出报告（txt，Word 可直接打开；内容：AI 深度解析全文（综合解析 + 主要课题 + 个人的优势/劣势 + 人生建议）+ AI 回答记录） ----------
  $('#btnExport').addEventListener('click', async function () {
    if (!state.chart) return;
    if (!(await Billing.spend('本命 · 导出报告'))) return;
    var chart = state.chart;
    var btn = $('#btnExport');
    var oldText = btn.textContent;
    btn.textContent = '正在生成报告…';
    btn.disabled = true;
    function finish() { btn.textContent = oldText; btn.disabled = false; }

    function doExport(deepText) {
      var lines = [];
      lines.push('个人星盘解读报告');
      lines.push('========================================');
      lines.push((state.name || '') + ' · ' + chart.localTimeStr + ' · ' + chart.place.name + ' · 由' + (window.SITE_CONFIG ? window.SITE_CONFIG.name : 'Mora Aurora Astro') + '生成');
      lines.push('');
      lines.push(deepText.trim());
      lines.push('');
      lines.push('三、AI 回答记录');
      lines.push('');
      if (!chatHistory.length) {
        lines.push('（暂无 AI 问答记录）');
      } else {
        for (var i = 0; i < chatHistory.length; i += 2) {
          lines.push('问：' + chatHistory[i].content);
          if (chatHistory[i + 1]) lines.push('答：' + chatHistory[i + 1].content);
          lines.push('');
        }
      }
      lines.push('');
      lines.push('免责声明：本报告由 AI 生成，仅供娱乐与参考，不构成任何医疗、法律、投资、职业或其他重大决策依据。');
      var blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '星盘报告_' + (state.name || '我的') + '_' + chart.utcISO.slice(0, 10) + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast('报告已导出（txt，Word 可直接打开，已扣 1 星币）');
    }

    if (deepReportText) { doExport(deepReportText); finish(); return; }

    // 尚无深度解析：先自动生成（再扣 1 星币），成功后再导出
    if (!(await requireAI())) { Billing.refund('导出失败退回'); finish(); return; }
    if (!(await Billing.spend('本命 · AI 深度解析'))) { finish(); return; }
    var sys = DEEP_SYSTEM_PROMPT + '\n\n用户星盘数据：\n' + JSON.stringify(Interpret.chartContext(chart, state.name));
    callAIDeep([{ role: 'system', content: sys }, { role: 'user', content: '请为这份星盘生成「综合解析 + 主要课题 + 个人的优势/劣势 + 人生建议」报告。' }]).then(function (text) {
      deepReportText = text;
      $('#deepReport').innerHTML = mdLite(text);
      doExport(text);
      finish();
    }).catch(function (e) {
      Billing.refund('AI 深度解析失败退回');
      toast('导出失败：' + e.message + '（星币已退回）');
      finish();
    });
  });

  // 重新输入
  $('#btnReset').addEventListener('click', function () {
    $('#result').style.display = 'none';
    $('#hero').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- 启动 ----------
  window.addEventListener('DOMContentLoaded', function () {
    if (typeof AstroCalc === 'undefined') {
      document.body.innerHTML = '<p style="padding:40px;text-align:center">星象计算库加载失败，请检查网络后刷新页面。</p>';
      return;
    }
  });
})();
