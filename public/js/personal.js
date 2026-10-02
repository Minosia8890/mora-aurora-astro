/* ============================================================
 * personal.js — 个人运势页逻辑
 * 复用本命盘表单/客户库；生成太阳弧/日返/次限/三限/行运/月返/小限/法达推运
 * 布局对齐本命盘/合盘：左盘（BiWheel 本命+推运）右行星速览，
 * AI 双页签（AI 问答 + AI 深度解析两段式）/ 导出 TXT
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  // ---------- 安全存储 ----------
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
    natal: null,
    transit: null,
    cross: [],
    name: '',
    birthPlace: null,
    livePlace: null,
    birth: null,
    gran: 'day',
    aiPeriodDeep: null,
    aiPeriodPro: null
  };

  // AI 解析时间周期配置：行运/月返统一按月计——深度面板 一个月/三个月/六个月，专业面板 一个月/三个月/六个月/十二个月；
  // 太阳弧默认未来三年（不展示按键，固定注入）；其余推运无按键
  var AI_PERIODS = {
    'transit': {
      deep: [
        { key: '1m', label: '一个月' },
        { key: '3m', label: '三个月' },
        { key: '6m', label: '六个月' }
      ],
      pro: [
        { key: '1m', label: '一个月' },
        { key: '3m', label: '三个月' },
        { key: '6m', label: '六个月' },
        { key: '12m', label: '十二个月' }
      ]
    },
    'lunar-return': {
      deep: [
        { key: '1m', label: '一个月' },
        { key: '3m', label: '三个月' },
        { key: '6m', label: '六个月' }
      ],
      pro: [
        { key: '1m', label: '一个月' },
        { key: '3m', label: '三个月' },
        { key: '6m', label: '六个月' },
        { key: '12m', label: '十二个月' }
      ]
    },
    'solar-arc': [
      { key: '3y', label: '三年' }
    ]
  };

  // 推运方式元信息（解读视角侧重）
  var TRANSIT_MAP = {
    'solar-arc': { key: 'solar-arc', label: '太阳弧推运 (Solar Arc)', short: '太阳弧', angle: '太阳弧把本命所有行星与四轴同步推进出生后太阳走过的度数，揭示人生各阶段的主线剧情与成熟课题，适合看年度级的大趋势与关键转折。' },
    'solar-return': { key: 'solar-return', label: '日返盘 (Solar Return)', short: '日返', angle: '日返盘是每年太阳回归本命太阳位置的时刻所起的盘，揭示新一岁这一年的整体气象：年度主题、重点领域与成长节奏。' },
    'secondary': { key: 'secondary', label: '次限推进 (Secondary)', short: '次限', angle: '次限盘以"出生后一天 = 一年"推进，反映内心成长与外部环境同步演化的长期曲线，适合观察数月至一年的心境与际遇演变。' },
    'tertiary': { key: 'tertiary', label: '三限推进 (Tertiary)', short: '三限', angle: '三限盘以"出生后一天 = 一个朔望月"推进，捕捉最近数日至数周的即时波动与临时课题，适合关注当下的状态切换。' },
    'transit': { key: 'transit', label: '行运 (Transit)', short: '行运', angle: '行运盘是当下真实天象盘与本命盘的对照，反映外界的"天气"正在如何激活你的本命配置，适合把握当下正在发生的机会与压力。' },
    'lunar-return': { key: 'lunar-return', label: '月返盘 (Lunar Return)', short: '月返', angle: '月返盘是月亮每月回归本命月亮位置的时刻所起的盘，浓缩最近一个月的心绪节奏、情绪课题与日常生活的起伏，适合观察短周期内的状态切换。' },
    'profection': { key: 'profection', label: '小限年运 (Profection)', short: '小限', angle: '小限以每年上升推进一宫（一个星座）标记当年的主题宫位，行星保持本命位置、宫位逐年轮转，适合看一年的领域重心与生日前后的转折。' },
    'firdaria': { key: 'firdaria', label: '法达大运 (Firdaria)', short: '法达', angle: '法达以波斯古法按年龄分配行星大运（每星 2-13 年），揭示人生长周期的主运底色与阶段课题，适合拉长时间轴看 5 年以上的大运势走向。' }
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

  // ---------- 地点搜索 ----------
  var geoTimers = {};
  function attachGeoSearch(inputId, onPick) {
    var input = $('#' + inputId);
    var box = null;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(geoTimers[inputId]);
      if (!q || q.length < 1) { if (box) { box.remove(); box = null; } return; }
      geoTimers[inputId] = setTimeout(function () { searchGeo(q, input, onPick); }, 350);
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (box) { box.remove(); box = null; } }, 220); });
  }

  function searchGeo(q, input, onPick) {
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=8&language=zh&format=json';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      var old = input.parentNode.querySelector('.geo-drop');
      if (old) old.remove();
      var box = document.createElement('div');
      box.className = 'geo-drop';
      var results = mergeGeoResults(localGeoResults(q), data.results || []);
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
    }).catch(function () { });
  }

  attachGeoSearch('birthPlace', function (p) { state.birthPlace = p; });
  attachGeoSearch('livePlace', function (p) { state.livePlace = p; });

  $('#timeUnknown').addEventListener('change', function () {
    var disabled = this.checked;
    $('#birthTime').disabled = disabled;
    if (disabled) $('#birthTime').value = '12:00';
  });

  // ---------- 生成推运盘 ----------
  function showFieldErrors(errs) {
    ['birthDate', 'birthPlace', 'birthTime', 'transitDate'].forEach(function (id) {
      var el = $('#err-' + id); if (el) el.textContent = '';
    });
    errs.forEach(function (e) {
      var el = $('#err-' + e[0]); if (el) el.textContent = e[1];
    });
  }

  $('#btnGenerate').addEventListener('click', function () {
    var btn = this;
    var errs = [];
    var dv = $('#birthDate').value;
    var tv = $('#birthTime').value || '12:00';
    var td = $('#transitDate').value;
    if (!dv) { errs.push(['birthDate', '请选择出生日期']); }
    if (!state.birthPlace) { errs.push(['birthPlace', '请从下拉中选择出生地（输入后选择联想项）']); }
    if (!td) { errs.push(['transitDate', '请选择推运目标日期']); }
    showFieldErrors(errs);
    if (errs.length) return;

    var y = +dv.slice(0, 4), mo = +dv.slice(5, 7), d = +dv.slice(8, 10);
    var h = +tv.slice(0, 2), mi = +tv.slice(3, 5);
    if (y < 1800 || y > 2400) { showFieldErrors([['birthDate', '请输入 1800-2400 年之间的日期']]); return; }
    if (td < dv) { showFieldErrors([['transitDate', '推运目标日期不能早于出生日期']]); return; }

    state.name = $('#nickName').value.trim();
    var houseSystem = $('#houseSystem').value;
    state.birth = { date: dv, time: tv, timeUnknown: $('#timeUnknown').checked };

    btn.disabled = true;
    btn.textContent = '推 算 推 运 盘 中 …';

    setTimeout(function () {
      try {
        var natal = AstroCalc.computeChart({
          year: y, month: mo, day: d, hour: h, minute: mi,
          timeUnknown: $('#timeUnknown').checked,
          birthPlace: state.birthPlace,
          livePlace: null,
          houseSystem: houseSystem
        });
        state.natal = natal;
        buildTransit($('#transitType').value, td, $('#livePlace').value ? state.livePlace : null);
        renderResult();
        $('#hero').style.display = 'none';
        $('#result').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error(e);
        toast('生成失败：' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '生 成 我 的 推 运 盘';
      }
    }, 60);
  });

  function buildTransit(type, dateStr, livePlace) {
    var natal = state.natal;
    // 目标日期在推运地/出生地时区下的当地 0 点，转成 UTC 时刻（此前直接把本地 0 点当 UTC，导致目标时刻偏差 8 小时）
    var parts = dateStr.split('-');
    var place = livePlace || natal.place;
    var date = AstroCalc.localToUTC(+parts[0], +parts[1], +parts[2], 0, 0, place.tz);
    // 行运盘：所选日期为今天时按当前实时时刻排盘（与主流软件口径一致）；其他日期仍取当地 0 点
    if (type === 'transit') {
      var now = new Date();
      var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      if (dateStr === todayStr) date = now;
    }
    var meta = TRANSIT_MAP[type] || TRANSIT_MAP['solar-arc'];
    var chart = null;
    if (type === 'solar-arc') {
      chart = AstroCalc.solarArcChart(natal, date, { place: livePlace || natal.place });
    } else if (type === 'solar-return') {
      chart = AstroCalc.solarReturnChart(natal, date, { place: livePlace || natal.place });
    } else if (type === 'secondary') {
      chart = AstroCalc.secondaryProgressedChart(natal, date, {});
    } else if (type === 'tertiary') {
      chart = AstroCalc.tertiaryProgressedChart(natal, date, {});
    } else if (type === 'lunar-return') {
      chart = AstroCalc.lunarReturnChart(natal, date, { place: livePlace || natal.place });
    } else if (type === 'profection') {
      chart = AstroCalc.profectionChart(natal, date, {});
    } else if (type === 'firdaria') {
      chart = AstroCalc.firdaria(natal, date, {});
    } else {
      chart = AstroCalc.transitChart(natal, date, { place: livePlace || natal.place });
    }
    chart.meta = meta;
    state.transit = chart;
    // 法达是时间大运结构（非行星盘），不产生跨盘相位
    state.cross = type === 'firdaria' ? [] : AstroCalc.crossAspects(chart, natal);
  }

  // ---------- 结果区时间切换（日/月/年粒度 + 上一步/下一步步进） ----------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  // 按粒度对 YYYY-MM-DD 步进 ±1，月末/闰年自动钳制到当月最后一天
  function addDateStep(dateStr, gran, dir) {
    var p = dateStr.split('-');
    var y = +p[0], m = +p[1], d = +p[2];
    if (gran === 'day') {
      var dt = new Date(y, m - 1, d + dir);
      return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
    }
    if (gran === 'month') {
      var total = y * 12 + (m - 1) + dir;
      var ny = Math.floor(total / 12);
      var nm = ((total % 12) + 12) % 12 + 1;
      d = Math.min(d, daysInMonth(ny, nm));
      return ny + '-' + pad2(nm) + '-' + pad2(d);
    }
    d = Math.min(d, daysInMonth(y + dir, m));
    return (y + dir) + '-' + pad2(m) + '-' + pad2(d);
  }

  // 以最新目标日期重算当前盘型并重渲染（盘面/行星速览/报告/AI 上下文）
  function rebuildTransit(dateStr) {
    if (!state.natal) return;
    $('#transitDate').value = dateStr;
    buildTransit($('#transitType').value, dateStr, $('#livePlace').value ? state.livePlace : null);
    renderResult();
  }

  // 当前排盘时间标签（含盘型特定信息：日返第 N 年 / 行运排盘时刻 / 月返回归 / 小限年龄 / 法达大运）
  function transitNavTimeText() {
    var t = state.transit;
    if (!t) return '';
    var parts = [localDateStr(t)];
    if (t.type === 'solar-return') parts.push('日返第 ' + t.solarReturnYear + ' 年');
    else if (t.type === 'lunar-return') parts.push('月返 · 月亮回归 ' + t.lunarReturnLon.toFixed(2) + '\u00B0');
    else if (t.type === 'transit') parts.push('行运 · 排盘时刻 ' + (t.localTimeStr || ''));
    else if (t.type === 'solar-arc') parts.push('太阳弧 ' + (typeof t.solarArcDeg === 'number' ? t.solarArcDeg.toFixed(2) + '\u00B0' : ''));
    else if (t.type === 'profection') parts.push('小限 ' + t.profectionAge + ' 岁');
    else if (t.type === 'firdaria') parts.push('法达 ' + t.current.name + '大运（' + t.current.startAge + '-' + t.current.endAge + ' 岁）');
    return parts.join(' · ');
  }
  function updateTransitNavTime() {
    var el = $('#transitNavTime');
    if (el) el.textContent = transitNavTimeText() ? '\u2713 ' + transitNavTimeText() : '';
  }

  function stepTransit(dir) {
    if (!state.natal) return;
    if (!$('#result') || $('#result').style.display === 'none') return;
    var cur = $('#transitDate').value;
    if (!cur) return;
    var next = addDateStep(cur, state.gran, dir);
    var birth = $('#birthDate').value;
    if (birth && next < birth) { toast('目标日期不能早于出生日期'); return; }
    if (next > '2400-12-31') { toast('目标日期不能晚于 2400-12-31'); return; }
    rebuildTransit(next);
  }

  function bindTransitNav() {
    var btns = document.querySelectorAll('.gran-btn');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.gran = b.dataset.gran;
      });
    });
    $('#btnPrev').addEventListener('click', function () { stepTransit(-1); });
    $('#btnNext').addEventListener('click', function () { stepTransit(1); });
  }

  // ---------- 呈现口径：行运/太阳弧/三限/次限/小限/法达 按本命盘宫头判断；日返/月返 按推运盘自身宫位（仅改呈现，推运计算不变） ----------
  var NATAL_HOUSE_TYPES = ['transit', 'solar-arc', 'tertiary', 'secondary', 'profection', 'firdaria'];
  function useNatalHouse() {
    return NATAL_HOUSE_TYPES.indexOf(state.transit.type) >= 0;
  }
  function houseOf(lon, cusps) {
    for (var h = 1; h <= 12; h++) {
      var a = cusps[h], b = cusps[h % 12 + 1];
      var span = AstroCalc.norm360(b - a), off = AstroCalc.norm360(lon - a);
      if (off < span) return h;
    }
    return 1;
  }
  // 推运呈现视图：行星/北交保留推运黄经与星座；useNatal=true 时落宫改为「推运黄经对照本命宫头」，false 时保留推运盘自身宫位
  function transitView(useNatal) {
    var natal = state.natal;
    function map(p) {
      var v = {};
      Object.keys(p).forEach(function (k) { v[k] = p[k]; });
      if (useNatal) v.house = houseOf(p.lon, natal.houses);
      return v;
    }
    return { planets: state.transit.planets.map(map), node: map(state.transit.node) };
  }

  // ---------- 行星速览（本命 + 推运两组） ----------
  function planetListHtml() {
    var order = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    function rowsFor(chart, name, extra) {
      var rows = '';
      order.forEach(function (key) {
        var p = null;
        for (var i = 0; i < chart.planets.length; i++) if (chart.planets[i].key === key) { p = chart.planets[i]; break; }
        if (!p) return;
        rows += '<div class="pl-row">' +
          '<span class="pl-glyph">' + (GLYPH[key] || p.glyph || '') + '</span>' +
          '<span class="pl-name">' + p.name + '</span>' +
          '<span class="pl-sign">' + p.sign.name + '</span>' +
          '<span class="pl-deg">' + p.sign.deg + '\u00B0' + String(p.sign.min).padStart(2, '0') + '\u2032' + (p.retro ? ' \u211E' : '') + '</span>' +
          '<span class="pl-house">第' + p.house + '宫</span>' +
          '</div>';
      });
      return '<div class="pl-group">' + esc(name) + '</div>' + rows + (extra || '');
    }
    var extra = '<div class="pl-node">北交 ' + state.transit.node.sign.name + ' ' + state.transit.node.sign.deg + '\u00B0' + String(state.transit.node.sign.min).padStart(2, '0') + '\u2032</div>';
    // 法达：非行星盘，右侧展示大运周期列表
    if (state.transit.type === 'firdaria') {
      var f = state.transit;
      var fRows = '<div class="pl-group">法达大运（' + (f.dayChart ? '日生' : '夜生') + '）</div>';
      f.periods.forEach(function (pd) {
        var active = f.current && pd.key === f.current.key ? ' style="background:var(--accent-weak);border-radius:4px"' : '';
        var marker = f.current && pd.key === f.current.key ? ' · 当前' : '';
        fRows += '<div class="pl-row"' + active + '>' +
          '<span class="pl-glyph">' + (GLYPH[pd.key] || '\u25C7') + '</span>' +
          '<span class="pl-name">' + pd.name + '大运</span>' +
          '<span class="pl-sign">' + pd.years + '年</span>' +
          '<span class="pl-deg">' + pd.startAge + '-' + pd.endAge + '岁</span>' +
          '<span class="pl-house">' + marker + '</span>' +
          '</div>';
      });
      return rowsFor(state.natal, '本命盘 · ' + (state.name || '我的')) + fRows;
    }
    var useNatal = useNatalHouse();
    return rowsFor(state.natal, '本命盘 · ' + (state.name || '我的')) +
      rowsFor(transitView(useNatal), state.transit.meta.short + '盘 · ' + (useNatal ? '落宫按本命宫位' : '落宫按推运自身宫位'), extra);
  }

  // ---------- 解析报告 ----------
  function degCell(sign) {
    return sign.deg + '\u00B0' + String(sign.min).padStart(2, '0') + '\u2032';
  }

  function houseSystemName(sys) {
    var hs = (window.AstroCalc && AstroCalc.HOUSE_SYSTEMS) || [];
    for (var i = 0; i < hs.length; i++) if (hs[i].key === sys) return hs[i].name;
    return sys;
  }

  function transitDesc() {
    var t = state.transit, m = t.meta;
    var extra = '';
    if (t.type === 'solar-arc') extra = '太阳弧推进角度：' + t.solarArcDeg + '\u00B0（出生太阳→目标日太阳）。';
    else if (t.type === 'solar-return') extra = '太阳回归时刻：' + t.localTimeStr + '（第 ' + t.solarReturnYear + ' 年日返）。';
    else if (t.type === 'lunar-return') extra = '月亮回归时刻：' + t.localTimeStr + '（月亮回到出生黄经 ' + t.lunarReturnLon.toFixed(2) + '\u00B0）。';
    else if (t.type === 'transit') extra = '排盘时刻：' + t.localTimeStr + '。';
    else if (t.type === 'profection') extra = '小限年龄：' + t.profectionAge + ' 岁，上升推进 ' + (t.profectionArc % 360) + '\u00B0（每年一宫，行星保持本命位置）。';
    else if (t.type === 'firdaria') extra = '当前年龄 ' + t.age + ' 岁，处于' + t.current.name + '大运（' + t.current.startAge + '-' + t.current.endAge + ' 岁），小运 ' + t.sub.name + '。';
    return m.label + ' · ' + (m.angle || '') + extra;
  }

  function reportHtml() {
    var natal = state.natal, transit = state.transit;
    var isFirdaria = transit.type === 'firdaria';
    var sections = [];
    sections.push({
      title: '一、推运总览',
      html: '<p><b>' + transit.meta.short + '推运</b> · 目标日期 ' + localDateStr(transit) + ' · ' + houseSystemName(transit.houseSystem) + (transit.houseFallback ? '（高纬度已兜底为等宫制）' : '') + '</p>' +
        '<p>' + transitDesc() + '</p>' +
        (isFirdaria
          ? '<p>解读方式：法达是波斯古法的时间大运结构（非行星盘），以本命盘为底、按年龄轮转行星大运，用于拉长周期看人生阶段主线。</p>'
          : '<p>解读方式：内圈为本命盘（' + (state.name || '我的') + '，' + natal.localTimeStr + ' · ' + natal.place.name + '），外圈为推运盘。推运行星与本命行星之间的相位，标记这段时间能量互动最明显的领域。</p>')
    });
    sections.push({
      title: '二、本命盘概要',
      html: Interpret.buildOverview(natal, state.name)
    });
    if (isFirdaria) {
      // 法达大运表
      var fd = '';
      fd += '<p><b>当前主运：' + transit.current.name + '大运</b>（' + transit.current.startAge + '-' + transit.current.endAge + ' 岁，共 ' + transit.current.years + ' 年）' +
        '，当前小运：' + transit.sub.name + '。' + (transit.dayChart ? '日生盘' : '夜生盘') + '顺序。</p>';
      fd += '<p>完整大运周期（合计 75 年）：</p>';
      transit.periods.forEach(function (pd) {
        var active = transit.current && pd.key === transit.current.key ? '<b>' : '';
        var close = active ? '</b>' : '';
        fd += '<p>' + active + pd.name + '大运 ' + pd.startAge + '-' + pd.endAge + ' 岁（' + pd.years + ' 年）' + close + (active ? ' ← 当前' : '') + '</p>';
      });
      fd += '<p>法达主运定基调、小运写细节：主运行星代表这段人生阶段的核心课题，小运行星代表当下正在推进的具体事务。</p>';
      sections.push({ title: '三、法达大运（主运 + 小运）', html: fd });
      sections.push({ title: '四、法达解读要点', html: '<p>法达不与本命产生跨盘相位。解读时把当前主运行星与本命盘中同行星/同宫位的状态叠加理解：主运行星落座与落宫决定这段大运的主场，小运行星决定近期细节。</p>' });
    } else {
      // 推运行星落座（口径按类型区分：本命宫位 或 推运自身宫位）
      var pl = '';
      var useNatal = useNatalHouse();
      var tv = transitView(useNatal);
      tv.planets.forEach(function (p) { pl += '<p>' + Interpret.planetText(p, transit) + '</p>'; });
      pl += '<p>' + Interpret.planetText(tv.node, transit) + '</p>';
      sections.push({ title: '三、推运行星落座（' + transit.meta.short + '盘 · ' + (useNatal ? '落宫按本命宫位' : '落宫按推运自身宫位') + '）', html: pl });
      // 跨盘相位
      var crossHtml = '';
      if (!state.cross.length) {
        crossHtml = '<p>本推运盘与本命盘之间暂无容许度内的重要相位。</p>';
      } else {
        var items = state.cross.slice(0, 16).map(function (a) {
          var nature = { conj: '融合', trine: '和谐', sextile: '和谐', square: '紧张', opp: '紧张' }[a.type] || '\u2014';
          return '<p><b>' + a.aName + ' ' + a.name + ' ' + a.bName + '</b>（偏差 ' + a.orb + '\u00B0，' + nature + '）<br>' +
            '本命' + a.bName + ' × 推运' + a.aName + '：这段时间 ' + a.bName + ' 所代表的领域被 ' + a.aName + ' 的能量激活，是观察运势变化的重要入口。</p>';
        }).join('');
        crossHtml = '<p>共 ' + state.cross.length + ' 组推运×本命相位（按紧密排序，展示前 ' + Math.min(state.cross.length, 16) + ' 组）：</p>' + items;
      }
      sections.push({ title: '四、推运与本命关键相位', html: crossHtml });
    }
    // 综合建议
    sections.push({
      title: '五、综合建议',
      html: '<p>把本命与推运合起来看：推运盘揭示的是这段时间的\u201c天气\u201d，本命盘决定你\u201c带什么伞\u201d。顺应和谐相位的顺风处主动推进，在紧张相位出现时放慢节奏、先处理卡点。运势是趋势不是判决，方向盘永远在你手里。</p>'
    });
    var html = '';
    sections.forEach(function (s, i) {
      html += '<details class="acc"' + (i === 0 ? ' open' : '') + '><summary>' + s.title + '</summary>' +
        '<div class="acc-body">' + s.html + '</div></details>';
    });
    return '<div class="report">' + html + '</div>';
  }

  // ---------- 盘面数据 ----------
  function dataGridHtml() {
    var natal = state.natal, transit = state.transit;
    function planetTable(chart, title, note, houseRef) {
      var rows = '';
      chart.planets.forEach(function (p) {
        rows += '<tr><td class="pl-name"><span class="gly">' + (p.glyph || '') + '</span>' + p.name + '</td>' +
          '<td>' + p.sign.name + '</td><td>' + degCell(p.sign) + '</td>' +
          '<td>第' + p.house + '宫</td>' +
          '<td class="' + (p.retro ? 'retro-yes' : 'retro-no') + '">' + (p.retro ? '\u211E 逆行' : '\u2014') + '</td></tr>';
      });
      var ascHouse = houseRef ? houseOf(chart.asc.lon, houseRef) : 1;
      var mcHouse = houseRef ? houseOf(chart.mc.lon, houseRef) : 10;
      rows += '<tr><td class="pl-name"><span class="gly">AC</span>上升点</td><td>' + chart.asc.sign.name + '</td><td>' + degCell(chart.asc.sign) + '</td><td>第' + ascHouse + '宫</td><td class="retro-no">\u2014</td></tr>';
      rows += '<tr><td class="pl-name"><span class="gly">MC</span>中天点</td><td>' + chart.mc.sign.name + '</td><td>' + degCell(chart.mc.sign) + '</td><td>第' + mcHouse + '宫</td><td class="retro-no">\u2014</td></tr>';
      return '<div class="astro-block"><h4>' + title + '</h4>' +
        '<table class="astro-table"><thead><tr><th>星体</th><th>星座</th><th>度数</th><th>宫位</th><th>逆行</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        (note ? '<p class="table-note">' + note + '</p>' : '') + '</div>';
    }
    var t1 = planetTable(natal, '本命行星落座表', natal.timeUnknown ? '出生时间按 12:00 估算，上升 / 宫位 / 月亮可能有偏差。' : '');
    var t2;
    if (transit.type === 'firdaria') {
      // 法达大运表
      var fr = '';
      transit.periods.forEach(function (pd) {
        var active = transit.current && pd.key === transit.current.key;
        fr += '<tr' + (active ? ' style="background:var(--accent-weak)"' : '') + '><td class="pl-name"><span class="gly">' + (GLYPH[pd.key] || '\u25C7') + '</span>' + pd.name + '</td>' +
          '<td>' + pd.years + ' 年</td><td>' + pd.startAge + ' 岁</td><td>' + pd.endAge + ' 岁</td>' +
          '<td>' + (active ? '当前' : '\u2014') + '</td></tr>';
      });
      t2 = '<div class="astro-block"><h4>法达大运周期表（' + (transit.dayChart ? '日生' : '夜生') + '）</h4>' +
        '<table class="astro-table"><thead><tr><th>大运</th><th>年限</th><th>起始年龄</th><th>结束年龄</th><th>状态</th></tr></thead><tbody>' + fr + '</tbody></table>' +
        '<p class="table-note">当前主运：' + transit.current.name + '（' + transit.current.startAge + '-' + transit.current.endAge + ' 岁）· 当前小运：' + transit.sub.name + '。</p></div>';
    } else {
      var useNatal = useNatalHouse();
      if (useNatal) {
        var tv2 = transitView(true);
        tv2.asc = transit.asc;
        tv2.mc = transit.mc;
        t2 = planetTable(tv2, transit.meta.short + '推运行星落座表', '落宫按本命盘宫头判断（' + houseSystemName(natal.houseSystem) + '）：推运行星黄经对照本命宫头，呈现为本命第几宫。', natal.houses);
      } else {
        t2 = planetTable(transit, transit.meta.short + '推运行星落座表', '落宫按推运盘自身宫位（' + houseSystemName(transit.houseSystem) + '）呈现，推运计算不变。', transit.houses);
      }
    }

    var hRows = '';
    for (var h = 1; h <= 12; h++) {
      var cusp = AstroCalc.signOf(natal.houses[h]);
      hRows += '<tr><td>第' + h + '宫</td><td>' + cusp.name + '</td><td>' + degCell(cusp) + '</td></tr>';
    }
    var t3 = '<div class="astro-block"><h4>本命宫头位置表（' + houseSystemName(natal.houseSystem) + (natal.houseFallback ? '，高纬度已兜底为等宫制' : '') + '）</h4>' +
      '<table class="astro-table"><thead><tr><th>宫位</th><th>宫头星座</th><th>宫头度数</th></tr></thead><tbody>' + hRows + '</tbody></table></div>';

    var aRows = '';
    state.cross.forEach(function (a) {
      var nature = { conj: ['融合', 'nature-c'], trine: ['和谐', 'nature-h'], sextile: ['和谐', 'nature-h'], square: ['紧张', 'nature-t'], opp: ['紧张', 'nature-t'] }[a.type] || ['\u2014', 'nature-c'];
      aRows += '<tr><td>' + a.aName + '</td><td>' + a.name + '</td><td>' + a.bName + '</td><td>' + a.orb + '\u00B0</td><td class="' + nature[1] + '">' + nature[0] + '</td></tr>';
    });
    var t4;
    if (transit.type === 'firdaria') {
      t4 = '<div class="astro-block"><h4>推运×本命跨盘相位表</h4>' +
        '<p class="table-note">法达是时间大运结构（非行星盘），不产生跨盘相位；解读以当前主运/小运 × 本命落座落宫为主线。</p></div>';
    } else {
      t4 = '<div class="astro-block"><h4>推运×本命跨盘相位表（共 ' + state.cross.length + ' 组，按紧密排序）</h4>' +
        '<table class="astro-table"><thead><tr><th>推运行星</th><th>相位</th><th>本命行星</th><th>容许度</th><th>性质</th></tr></thead><tbody>' + (aRows || '<tr><td colspan="5">暂无重要相位</td></tr>') + '</tbody></table>' +
        '<p class="table-note">和谐 = 三分 / 六分；紧张 = 四分 / 对分；融合 = 合相。</p></div>';
    }

    return t1 + t2 + t3 + t4;
  }

  // ---------- 渲染结果 ----------
  function localDateStr(chart) {
    var s = (chart.localTimeStr || chart.utcISO || '').slice(0, 10);
    return s.replace(/\//g, '-');
  }

  function prep(chart) {
    var pts = chart.planets.map(function (p) { return { key: p.key, lon: p.lon, glyph: p.glyph, retro: p.retro, sign: p.sign }; });
    pts.push({ key: 'node', lon: chart.node.lon, glyph: chart.node.glyph || '\u260A', retro: true, sign: chart.node.sign });
    return { points: pts, houses: chart.houses, asc: chart.asc, mc: chart.mc };
  }

  function renderResult() {
    var natal = state.natal, transit = state.transit;
    var isFirdaria = transit.type === 'firdaria';

    // BiWheel：内圈本命（含宫位），外圈推运，连线为跨盘相位；法达非行星盘，外圈留空
    var cross = isFirdaria ? [] : state.cross.map(function (a) { return { lonA: a.bLon, lonB: a.aLon, type: a.type, name: a.name, orb: a.orb }; });
    ChartRender.renderBiWheel(prep(natal), isFirdaria ? { points: [], houses: [], asc: null, mc: null } : prep(transit), cross, $('#wheel'));

    $('#placeLine').textContent = (isFirdaria ? '法达大运 · 目标 ' + localDateStr(transit) + ' · 当前' + transit.current.name + '大运（' + transit.current.startAge + '-' + transit.current.endAge + ' 岁）' : transit.meta.short + '推运 · 目标 ' + localDateStr(transit)) +
      ' · 本命 ' + natal.localTimeStr + ' · ' + natal.place.name +
      (!isFirdaria && transit.place && transit.place.name !== natal.place.name ? ' · 推运地 ' + transit.place.name : '') +
      (natal.houseFallback ? '（高纬度自动改用等宫制）' : '');

    $('#planetList').innerHTML = planetListHtml();
    $('#tab-report').innerHTML = reportHtml();
    $('#dataGrid').innerHTML = dataGridHtml();
    $('#aiContext').textContent = JSON.stringify(aiContext(), null, 1);

    updateTransitNavTime();
    updatePeriodUI();

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

  // ---------- 从客户库选择 ----------
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
      ClientLib.openPicker({ title: '选择客户 · 个人运势', onPick: fillFromCustomer });
    });
    var mCust = /[?&]customer=([^&]+)/.exec(location.search);
    if (mCust) ClientLib.whenReady(function () { fillFromCustomer(ClientLib.byId(decodeURIComponent(mCust[1]))); });
  }

  // ---------- 保存到客户库 ----------
  $('#btnSave').addEventListener('click', function () {
    if (!state.natal) return;
    if (!window.ClientLib) { toast('客户库模块未加载'); return; }
    var chart = state.natal;
    var name = ($('#nickName') ? $('#nickName').value.trim() : '') || state.name || '';
    if (!name) { toast('请先填写昵称，再存入客户库'); $('#nickName').focus(); return; }
    var cust = {
      name: name,
      note: '来自个人运势 · 太阳' + chart.planets[0].sign.name + ' · 月亮' + chart.planets[1].sign.name + ' · 上升' + chart.asc.sign.name,
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

  function aiContext() {
    var natal = state.natal, transit = state.transit;
    // 法达：注入大运上下文结构（非行星盘，无跨盘相位）
    if (transit.type === 'firdaria') {
      return {
        推运方式: transit.meta.label,
        目标日期: localDateStr(transit),
        推运说明: transitDesc(),
        本命盘: Interpret.chartContext(natal, state.name),
        法达大运: {
          当前年龄: transit.age,
          日生或夜生: transit.dayChart ? '日生（太阳在地平线上）' : '夜生（太阳在地平线下）',
          当前主运: transit.current.name + '大运（' + transit.current.startAge + '-' + transit.current.endAge + ' 岁，共 ' + transit.current.years + ' 年）',
          当前小运: transit.sub.name + (typeof transit.sub.offset === 'number' ? '（当前主运内第 ' + transit.sub.offset.toFixed(2) + ' 年处）' : ''),
          大运周期: transit.periods.map(function (p) { return p.name + '大运 ' + p.startAge + '-' + p.endAge + ' 岁（' + p.years + ' 年）'; }),
          解读提示: '法达主运定长周期基调、小运写近期细节；请结合当前主运/小运行星在本命盘中的落座与落宫解读。'
        }
      };
    }
    var cross = state.cross.slice(0, 30).map(function (a) {
      return a.aName + '-' + a.name + '-' + a.bName + '(' + a.orb + '\u00B0)';
    });
    var useNatal = useNatalHouse();
    var tvP = transitView(useNatal);
    return {
      推运方式: transit.meta.label,
      目标日期: localDateStr(transit),
      推运说明: transitDesc(),
      本命盘: Interpret.chartContext(natal, state.name),
      推运盘: {
        行星: tvP.planets.map(function (p) { return p.name + ': ' + p.sign.name + ' ' + p.sign.deg + '\u00B0' + String(p.sign.min).padStart(2, '0') + (p.retro ? ' 逆行' : '') + ' 第' + p.house + '宫(' + (useNatal ? '本命宫位' : '推运自身宫位') + ')'; }),
        上升: transit.asc.sign.name + ' ' + degCell(transit.asc.sign),
        中天: transit.mc.sign.name + ' ' + degCell(transit.mc.sign),
        落宫口径: useNatal ? '推运行星落宫按本命盘宫头判断（黄经对照本命宫头线），非推运盘自身宫位' : '推运行星落宫按推运盘自身宫位呈现，非本命宫位'
      },
      推运与本命跨盘相位: cross
    };
  }

  function addMsg(role, html) {
    var div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
    div.innerHTML = '<div class="avatar">' + (role === 'user' ? '我' : 'AI') + '</div><div class="bubble">' + html + '</div>';
    $('#chatWindow').appendChild(div);
    $('#chatWindow').scrollTop = $('#chatWindow').scrollHeight;
    return div;
  }

  var AI_SYSTEM_PROMPT =
    '你是一位功底扎实的资深占星师，擅长本命与推运解读，说话风格：像懂心理学的老朋友，大白话、接地气、有温度，会打比方，偶尔幽默。' +
    '规则：1) 所有解读必须紧扣提供的本命盘与推运盘数据（星座/宫位/相位/推运方式），不允许编造盘面上不存在的信息；' +
    '2) 推运解读要区分"趋势"与"必然"，不说"注定""一定"，运势是倾向不是判决；3) 不制造焦虑，不给改运承诺；' +
    '4) 结论后给可操作的小建议；5) 输出使用简体中文，可用简单的 Markdown（小标题、加粗、列表）。';

  async function sendChat() {
    if (!state.natal) return;
    if (!(await requireAI())) return;
    var input = $('#chatInput');
    var q = input.value.trim();
    if (!q) return;
    if (!(await Billing.spend('个人运势 · AI 问答'))) return;
    input.value = '';
    addMsg('user', escapeHtml(q));

    var sys = AI_SYSTEM_PROMPT + '\n\n用户推运数据：\n' + JSON.stringify(aiContext()) +
      '\n\n回答要求：紧扣本命与推运数据说话，说人话，给建议；回答控制在 300 字内直讲核心，主要课题只保留最重要的 1-2 项。';
    var msgs = [{ role: 'system', content: sys }].concat(chatHistory.slice(-10)).concat([{ role: 'user', content: q }]);
    var typing = addMsg('ai', '<span class="typing">正在结合你的本命与推运盘推算…</span>');

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

  // 统一走服务端 AI 代理（密钥保存在服务端，客户端不接触）；variant 为当前推运 key，供服务端做推运权限校验
  function transitVariant() {
    return (state.transit && state.transit.meta && state.transit.meta.key) || 'transit';
  }
  function callAI(messages) {
    return API.ai.chat('个人运势 · AI 问答', messages, 0.8, transitVariant()).then(function (d) { return d.content; });
  }
  function callAIDeep(messages) {
    return API.ai.chat('个人运势 · AI 深度解析', messages, 0.8, transitVariant()).then(function (d) { return d.content; });
  }

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

  function esc(s) { return escapeHtml(s); }

  // ---------- AI 解析时间周期选择（行运/月返按键组，太阳弧固定未来三年） ----------
  function currentTransitKey() {
    return (state.transit && state.transit.meta && state.transit.meta.key) || 'transit';
  }
  // 渲染周期按键组（deepPeriodGroup / proPeriodGroup），并返回所选周期文案；
  // 行运/月返按月计：深度面板 一个月/三个月/六个月，专业面板 一个月/三个月/六个月/十二个月；
  // solar-arc 固定未来三年不展示按键，其余推运不展示
  function renderPeriodGroup(containerId) {
    var key = currentTransitKey();
    var kind = containerId.indexOf('deep') >= 0 ? 'deep' : 'pro';
    var cfg = AI_PERIODS[key] || null;
    var opts = cfg ? (Array.isArray(cfg) ? cfg : (cfg[kind] || null)) : null;
    var box = $(containerId);
    if (!box) return;
    var stateKey = kind === 'deep' ? 'aiPeriodDeep' : 'aiPeriodPro';
    if (!opts) { box.style.display = 'none'; box.innerHTML = ''; state[stateKey] = null; return; }
    // 太阳弧：固定未来三年，不展示按键（请求时注入上下文即可）
    if (key === 'solar-arc') { box.style.display = 'none'; box.innerHTML = ''; state.aiPeriodDeep = AI_PERIODS['solar-arc'][0]; state.aiPeriodPro = AI_PERIODS['solar-arc'][0]; return; }
    var cur = state[stateKey];
    if (!cur || !opts.some(function (o) { return o.key === cur.key; })) {
      state[stateKey] = opts[0];
      cur = state[stateKey];
    }
    box.style.display = '';
    box.innerHTML = '<span class="period-label">时间周期</span>' + opts.map(function (o) {
      return '<button type="button" class="period-chip' + (o.key === cur.key ? ' active' : '') + '" data-period="' + o.key + '">' + o.label + '</button>';
    }).join('');
    Array.prototype.slice.call(box.querySelectorAll('.period-chip')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var o = null;
        for (var i = 0; i < opts.length; i++) if (opts[i].key === btn.dataset.period) { o = opts[i]; break; }
        if (!o) return;
        state[stateKey] = { key: o.key, label: o.label };
        Array.prototype.slice.call(box.querySelectorAll('.period-chip')).forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }
  function updatePeriodUI() {
    renderPeriodGroup('#deepPeriodGroup');
    renderPeriodGroup('#proPeriodGroup');
  }
  function monthsOf(key) {
    if (key === '12m') return 12;
    if (key === '6m') return 6;
    if (key === '3m') return 3;
    return 1;
  }
  // 解析口径上下文片段：kind 为 'deep'（深度解析）或 'pro'（专业解析）。
  // 行运/月返统一按月：深度按所选 N 个月逐月生成（每个月约 300 字，最多 6 个月）；
  // 专业按所选 N 个月一口气逐月解析（N×500 字：1/3/6/12 月对应 500/1500/3000/6000 字）；
  // 太阳弧固定「未来三年」；其余推运不注入。
  function aiPeriodPhrase(kind) {
    var key = currentTransitKey();
    if (key === 'solar-arc') return '，时间周期：未来三年';
    var cfg = AI_PERIODS[key];
    if (!cfg || Array.isArray(cfg)) return '';
    var stateKey = kind === 'deep' ? 'aiPeriodDeep' : 'aiPeriodPro';
    var cur = state[stateKey];
    if (!cur || !cur.label) return '';
    var label = cur.label;
    if (kind === 'pro') {
      return '，按月解析口径：请按所选' + label + '一口气逐月解析，' + label + '共约 ' + (monthsOf(cur.key) * 500) + ' 字（逐月展开）';
    }
    return '，按月解析口径：请按所选' + label + '逐月生成，每个月约 300 字（' + label + '逐月展开，最多 6 个月）';
  }

  // ---------- 各推运专属解析结构（深度与专业均按此生成；废除旧通用「推运整体综合解析 + 主要课题 / 五章节」模板） ----------
  // 结构总表：key → 专属结构（月返/行运按月选项：深度面板 1/3/6 个月，专业面板 1/3/6/12 个月）
  function transitStructure(key, kind) {
    var monthOpts = kind === 'pro' ? '一个月/三个月/六个月/十二个月' : '一个月/三个月/六个月';
    var S = {
      'solar-return': '综合解析 + 接下来一年的主要课题（事业、财富、感情等，选择最重要的进行讲解，如果有其他的就少讲）+ 接下来一年我的优势',
      'lunar-return': '综合解析 + ' + monthOpts + '的生活重点（并逐月解析）',
      'secondary': '综合解析 + 内在成长 + 人生阶段的转变',
      'transit': '综合解析 + ' + monthOpts + '的生活重点（并逐月解析感情、事业、财富和健康这四项）+ 注意事项',
      'tertiary': '综合解析 + 短期关注点 + 短期感受',
      'solar-arc': '综合解析 + 人生转折点 + 接下来需要面对的课题 + 整体建议/注意事项',
      'firdaria': '综合解析（包含人生重点、事业重点、感情重点、财富重点）',
      'profection': '综合解析 + 哪些行星在今年被激活 + 今年的侧重点在事业、财富、爱情、健康这四个中的哪一块'
    };
    return S[key] || S['transit'];
  }
  // 深度/专业解析专属章节模板（key → 固定章节骨架；月返/行运“所选月份”由 aiPeriodPhrase/monthlyNote 动态补充）
  function deepStructurePrompt(key) {
    var C = {
      'solar-return': '一、综合解析\n（内容）\n二、接下来一年的主要课题\n（事业、财富、感情等，选择最重要的进行讲解，如果有其他的就少讲）\n（内容）\n三、接下来一年我的优势\n（内容）',
      'lunar-return': '一、综合解析\n（内容）\n二、所选月份的生活重点（逐月解析）\n（内容）',
      'secondary': '一、综合解析\n（内容）\n二、内在成长\n（内容）\n三、人生阶段的转变\n（内容）',
      'transit': '一、综合解析\n（内容）\n二、所选月份的生活重点（逐月解析感情、事业、财富和健康这四项）\n（内容）\n三、注意事项\n（内容）',
      'tertiary': '一、综合解析\n（内容）\n二、短期关注点\n（内容）\n三、短期感受\n（内容）',
      'solar-arc': '一、综合解析\n（内容）\n二、人生转折点\n（内容）\n三、接下来需要面对的课题\n（内容）\n四、整体建议/注意事项\n（内容）',
      'firdaria': '一、综合解析\n（包含人生重点、事业重点、感情重点、财富重点）\n（内容）',
      'profection': '一、综合解析\n（内容）\n二、哪些行星在今年被激活\n（内容）\n三、今年的侧重点\n（事业、财富、爱情、健康四选一为主）\n（内容）'
    };
    return C[key] || C['transit'];
  }
  // 专业解析章节骨架与深度一致（仅篇幅与纵深不同）
  function proStructurePrompt(key) {
    return deepStructurePrompt(key);
  }
  // 深度解析 system 提示词：按当前推运方式动态注入专属结构
  function deepSystemPrompt() {
    var key = currentTransitKey();
    return '你是一位功底扎实的资深占星师，擅长本命与推运解读，请基于用户的本命盘与所选推运方式（太阳弧/日返/次限/三限/行运/月返/小限/法达，含行星落座/宫位/推运×本命跨盘相位或法达大运结构），生成一份「' + transitStructure(key, 'deep') + '」报告。' +
      '要求：1) 只做这段时间运势的整体综合解读，不做单星象逐项罗列；2) 先给出综合解析（整体画像与主线：运势基调、重点激活领域、发展节奏），并优先以本命四轴 ASC/IC/MC/DSC 搭建全局框架，运势必须依附本命格局解读；' +
      '3) 再按所选推运方式的专属结构展开后续章节（课题/优势/生活重点/注意事项等）；4) 必须紧扣盘面数据，不编造盘面上不存在的信息；' +
      '5) 不说"注定""一定"，运势是倾向不是判决；6) 不制造焦虑，不给改运承诺；7) 输出使用简体中文 Markdown，全篇控制在 900 字内，格式固定为：\n' +
      deepStructurePrompt(key);
  }
  // 专业解析 system 提示词：按当前推运方式动态注入专属结构（约 2500 字）
  function proSystemPrompt() {
    var key = currentTransitKey();
    return '你是一位功底扎实、从业 20 年+、擅长本命与推运解读的资深占星师，请基于用户的本命盘与所选推运方式（太阳弧/日返/次限/三限/行运/月返/小限/法达，含行星落座/宫位/推运×本命跨盘相位或法达大运结构），生成一份约 2500 字的「AI 专业解析」完整报告。' +
      '要求：1) 以本命四轴 ASC/IC/MC/DSC 与先天格局为全局骨架，先做综合解析（运势基调、重点激活领域、发展节奏、时间精准），运势必须依附本命格局解读；' +
      '2) 再按所选推运方式的专属结构展开后续章节（' + transitStructure(key, 'pro') + '）；3) 深入拆解并落到现实：事业/财务/感情/健康各领域的具体动向、优势利用与弊端解决、可执行行动建议；' +
      '4) 结构清晰分章节（按所选推运专属结构，见下方固定格式），总字数约 2500 字；' +
      '5) 必须紧扣盘面数据，不编造盘面上不存在的信息；6) 不说"注定""一定"，运势是倾向不是判决；7) 不制造焦虑，不给改运承诺；' +
      '8) 全程隐藏原始盘面数据（不罗列行星落座/相位/度数），只输出推导后的结论；9) 全篇禁止出现任何推运相位（推运×本命跨盘、推运盘内、相位名称/偏差度数），推运影响只以综合结论呈现；10) 输出使用简体中文 Markdown，格式固定为：\n' +
      proStructurePrompt(key);
  }

  // ---------- AI 深度解析（8 种推运各自专属结构） ----------
  var deepReportText = '';

  async function aiDeepReport() {
    if (!state.natal) return;
    if (!(await requireAI())) return;
    if (!(await Billing.spend('个人运势 · AI 深度解析'))) return;
    var box = $('#deepReport');
    box.innerHTML = '<span class="typing">正在为你生成' + esc(state.transit.meta.short) + '推运整体解析…</span>';
    var key = currentTransitKey();
    var isMonthly = key === 'transit' || key === 'lunar-return';
    var per = state.aiPeriodDeep;
    var monthlyNote = (isMonthly && per && per.label)
      ? '\n\n' + state.transit.meta.short + '按月解析补充：本报告须按所选' + per.label + '逐月展开（每个月约 300 字，共 ' + monthsOf(per.key) + ' 个月），总字数可突破上方 900 字上限；'
      : '';
    var sys = deepSystemPrompt() + monthlyNote + '\n\n用户推运数据：\n' + JSON.stringify(aiContext());
    callAIDeep([{ role: 'system', content: sys }, { role: 'user', content: '请为这份推运盘生成「' + transitStructure(key, 'deep') + '」报告（推运方式：' + state.transit.meta.label + aiPeriodPhrase('deep') + '）。' }]).then(function (text) {
      deepReportText = text;
      box.innerHTML = mdLite(text);
      toast('AI 深度解析已生成');
    }).catch(function (e) {
      Billing.refund('AI 深度解析失败退回');
      box.innerHTML = '<span class="deep-empty">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }
  $('#btnDeepReport').addEventListener('click', aiDeepReport);

  // ---------- AI 专业解析（2500 字长报告，仅站主/管理员；结构与深度解析一致，按 8 种推运专属结构展开） ----------
  var proReportText = '';

  function callAIPro(messages) {
    return API.ai.proReport(messages, 0.8, transitVariant()).then(function (d) { return d.content; });
  }

  async function aiProReport() {
    if (!state.natal) return;
    if (!(await requireAI())) return;
    if (!(await Billing.spend('AI 专业解析'))) return;
    var box = $('#proReport');
    var key = currentTransitKey();
    var isMonthly = key === 'transit' || key === 'lunar-return';
    var per = state.aiPeriodPro;
    var totalWords = (isMonthly && per && per.label) ? (monthsOf(per.key) * 500) : 2500;
    var monthlyNote = (isMonthly && per && per.label)
      ? '\n\n' + state.transit.meta.short + '按月解析补充：本报告须按所选' + per.label + '一口气逐月解析，全文约 ' + totalWords + ' 字（' + per.label + '逐月展开），可突破上方 2500 字上限；'
      : '';
    box.innerHTML = '<span class="typing">正在为你生成' + (isMonthly && per && per.label ? '约 ' + totalWords + ' 字的' + per.label : '约 2500 字的') + '专业级报告…</span>';
    var sys = proSystemPrompt() + monthlyNote + '\n\n用户推运数据：\n' + JSON.stringify(aiContext());
    callAIPro([{ role: 'system', content: sys }, { role: 'user', content: '请为这份推运盘生成' + (isMonthly ? '「AI 专业解析」完整报告' : '约 2500 字的「AI 专业解析」完整报告') + '（推运方式：' + state.transit.meta.label + aiPeriodPhrase('pro') + '）。' }]).then(function (text) {
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

  // 推运分级：普通用户仅可使用 太阳弧/日返/月返/行运；其余推运（次限/三限/小限/法达）仅站主/管理员
  var TRANSIT_FREE_KEYS = ['solar-arc', 'solar-return', 'transit', 'lunar-return'];
  function applyTransitAccess() {
    var admin = !!(window.Auth && typeof window.Auth.isAdmin === 'function' && (window.Auth.isAdmin() || window.Auth.isBeta()));
    var sel = $('#transitType');
    if (!sel) return;
    Array.prototype.slice.call(sel.options).forEach(function (o) {
      var restricted = TRANSIT_FREE_KEYS.indexOf(o.value) < 0;
      o.disabled = !admin && restricted;
      o.style.display = (!admin && restricted) ? 'none' : '';
    });
    if (!admin && TRANSIT_FREE_KEYS.indexOf(sel.value) < 0) {
      sel.value = 'transit';
      if (state.natal) buildTransit('transit');
    }
  }
  applyTransitAccess();
  if (window.API && window.API.bootstrap && !(window.Auth && window.Auth.currentProfile && window.Auth.currentProfile())) {
    window.API.bootstrap().then(function () { applyProVisible(); applyTransitAccess(); }, function () { applyProVisible(); applyTransitAccess(); });
  }

  // ---------- 导出报告（txt） ----------
  $('#btnExport').addEventListener('click', async function () {
    if (!state.natal) return;
    if (!(await Billing.spend('个人运势 · 导出报告'))) return;
    var btn = $('#btnExport');
    var oldText = btn.textContent;
    btn.textContent = '正在生成报告…';
    btn.disabled = true;
    function finish() { btn.textContent = oldText; btn.disabled = false; }

    function stripHtml(h) {
      return h
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h\d|li)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '· ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#8486;/g, '℞')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function doExport(deepText) {
      var natal = state.natal, transit = state.transit;
      var lines = [];
      lines.push('个人运势解读报告');
      lines.push('========================================');
      lines.push((state.name || '') + ' · ' + transit.meta.short + '推运（目标 ' + localDateStr(transit) + '） · 由' + (window.SITE_CONFIG ? window.SITE_CONFIG.name : 'Mora Aurora Astro') + '生成');
      lines.push('');
      lines.push(deepText.trim());
      lines.push('');
      lines.push('二、AI 回答记录');
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
      a.download = '个人运势报告_' + (state.name || '我的') + '_' + localDateStr(transit) + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast('报告已导出（txt，Word 可直接打开，已扣 1 星币）');
    }

    if (deepReportText) { doExport(deepReportText); finish(); return; }

    if (!(await requireAI())) { Billing.refund('导出失败退回'); finish(); return; }
    if (!(await Billing.spend('个人运势 · AI 深度解析'))) { finish(); return; }
    var key2 = currentTransitKey();
    var isMonthly2 = key2 === 'transit' || key2 === 'lunar-return';
    var per2 = state.aiPeriodDeep;
    var monthlyNote2 = (isMonthly2 && per2 && per2.label)
      ? '\n\n' + state.transit.meta.short + '按月解析补充：本报告须按所选' + per2.label + '逐月展开（每个月约 300 字，共 ' + monthsOf(per2.key) + ' 个月），总字数可突破上方 900 字上限；'
      : '';
    var sys = deepSystemPrompt() + monthlyNote2 + '\n\n用户推运数据：\n' + JSON.stringify(aiContext());
    callAIDeep([{ role: 'system', content: sys }, { role: 'user', content: '请为这份推运盘生成「' + transitStructure(key2, 'deep') + '」报告（推运方式：' + state.transit.meta.label + aiPeriodPhrase('deep') + '）。' }]).then(function (text) {
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
  function init() {
    if (typeof AstroCalc === 'undefined') {
      document.body.innerHTML = '<p style="padding:40px;text-align:center">星象计算库加载失败，请检查网络后刷新页面。</p>';
      return;
    }
    // 推运目标日期默认今天
    var now = new Date();
    var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (!$('#transitDate').value) $('#transitDate').value = today;

    bindTransitNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
