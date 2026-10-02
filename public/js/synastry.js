/* ============================================================
 * synastry.js — 占星合盘（双人比较盘）
 * 双盘计算 + 跨盘相位 + 大白话关系解读 + Bi-wheel 渲染（主题适配）
 * + AI 关系问答 / AI 深度解析（扣星币，按盘型与关系类型差异化）+ TXT 导出（扣星币）
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var SIGN_GLYPHS = ['\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653'];
  var ELE_CLASS = ['w-ele-fire', 'w-ele-earth', 'w-ele-air', 'w-ele-water'];

  var state = {
    pa: { name: '', place: null },
    pb: { name: '', place: null },
    chartA: null, chartB: null, cross: null, chartC: null,
    type: 'synastry',
    relType: '暧昧',
    aiReport: ''
  };

  /* ---------------- 合盘盘型（10 种） ---------------- */
  var SYN_TYPES = [
    { key: 'synastry', label: '比较盘（Synastry）', short: '比较盘', desc: 'A/B 双盘叠放为 Bi-Wheel，连线为跨盘相位' },
    { key: 'composite', label: '组合盘（Composite）', short: '组合盘', desc: '双方同名行星黄经中点合成单盘' },
    { key: 'composite-secondary', label: '组合次限盘', short: '组合次限', desc: '组合盘盘时按 1 天=1 年推进至当前' },
    { key: 'composite-tertiary', label: '组合三限盘', short: '组合三限', desc: '组合盘盘时按 1 天=29.5306 天推进至当前' },
    { key: 'marx', label: '马盘（马克思盘）', short: '马盘', desc: '按双方同名行星黄经中点口径合成的单盘' },
    { key: 'marx-secondary', label: '马次限盘', short: '马次限', desc: '马盘盘时按 1 天=1 年推进至当前' },
    { key: 'marx-tertiary', label: '马三限盘', short: '马三限', desc: '马盘盘时按 1 天=29.5306 天推进至当前' },
    { key: 'davison', label: '时空盘（Davison）', short: '时空盘', desc: '双方出生时刻中点为盘时、出生地中点为盘地起盘' },
    { key: 'davison-secondary', label: '时空次限盘', short: '时空次限', desc: '时空盘盘时按 1 天=1 年推进至当前' },
    { key: 'davison-tertiary', label: '时空三限盘', short: '时空三限', desc: '时空盘盘时按 1 天=29.5306 天推进至当前' }
  ];
  var SYN_MAP = {};
  SYN_TYPES.forEach(function (t) { SYN_MAP[t.key] = t; });

  /* ---------------- 知识库 ---------------- */
  var REL_ASPECTS = {
    conj: '两颗星的能量融合共振：你们在这个领域天然同频，容易一见如故、无缝配合。',
    trine: '和谐流动的支持：这段关系里最不费劲的部分，是你们的舒适区和天赋区。',
    sextile: '轻松的默契：差一层窗户纸的互补，谁先主动谁就能点亮它。',
    square: '吸引与摩擦并存：化学反应强烈，但两个需求总在打架——处理好了，这里就是你们绑定最深的地方。',
    opp: '磁铁般的互补拉扯：差异明显却互相吸引，学会在两端之间找平衡，是你们的长久课题。'
  };

  var ROLE = {
    sun: '核心自我', moon: '情绪需求', mercury: '沟通思维', venus: '爱与审美', mars: '行动欲望',
    jupiter: '成长与幸运', saturn: '承诺与考验', uranus: '新鲜与变化', neptune: '理想与浪漫',
    pluto: '深度与占有', node: '成长方向', asc: '外在形象', mc: '事业方向'
  };
  var PLANET_NAME = {
    sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星',
    saturn: '土星', uranus: '天王星', neptune: '海王星', pluto: '冥王星', node: '北交点', asc: '上升点', mc: '中天点'
  };

  var PAIR_NOTES = {
    'moon|sun': '太阳与月亮是合盘里的经典黄金组合：一个发光、一个回应，天然的心理契合。',
    'mars|venus': '金火相位是怦然心动的开关：吸引力直接而原始，化学反应拉满。',
    'moon|venus': '月亮遇金星自带温柔滤镜：彼此照顾、审美同频，相处像回到家。',
    'saturn|sun': '土星给关系带来认真与承诺，也可能带来压力：你们的连接是长期主义型的。',
    'moon|saturn': '月亮遇上土星：安全感与束缚感并存，学会表达柔软是共同功课。',
    'pluto|venus': '金冥的深度吸引：爱得浓烈投入，切忌演变成控制与试探。',
    'mars|saturn': '火星被土星踩了刹车：行动节奏不同步，凡事提前对齐预期。',
    'asc|sun': '太阳照在对方的上升：第一眼就觉得投缘，彼此人设互相加持。',
    'sun|venus': '金星环绕对方的太阳：欣赏与被欣赏同时发生，是轻松愉快的一对。',
    'moon|mars': '月亮与火星：情感点燃行动，也容易点火就着——注意情绪的引爆点。',
    'jupiter|sun': '木星照拂对方的太阳：互相鼓励、彼此成就，是能一起变大的组合。',
    'mercury|moon': '水星与月亮：说什么对方都懂，聊天是你们最重要的粘合剂。'
  };
  function pairNote(ka, kb) {
    var key = [ka, kb].sort().join('|');
    return PAIR_NOTES[key] || '';
  }

  /* ---------------- 计算 ---------------- */
  function chartPoints(chart) {
    var pts = chart.planets.map(function (p) { return { key: p.key, name: p.name, lon: p.lon, retro: p.retro, sign: p.sign }; });
    pts.push({ key: 'node', name: '北交点', lon: chart.node.lon, retro: true, sign: chart.node.sign });
    pts.push({ key: 'asc', name: '上升点', lon: chart.asc.lon, retro: false, sign: chart.asc.sign });
    pts.push({ key: 'mc', name: '中天点', lon: chart.mc.lon, retro: false, sign: chart.mc.sign });
    return pts;
  }

  function crossAspects(ptsA, ptsB) {
    var out = [];
    ptsA.forEach(function (pa) {
      ptsB.forEach(function (pb) {
        var d = Math.abs(((pa.lon - pb.lon) % 360 + 360) % 360);
        if (d > 180) d = 360 - d;
        AstroCalc.ASPECT_DEFS.forEach(function (asp) {
          var diff = Math.abs(d - asp.angle);
          if (diff <= asp.orb) {
            out.push({
              aKey: pa.key, bKey: pb.key, aName: pa.name, bName: pb.name,
              type: asp.key, name: asp.name, orb: Math.round(diff * 10) / 10,
              lonA: pa.lon, lonB: pb.lon
            });
          }
        });
      });
    });
    out.sort(function (x, y) { return x.orb - y.orb; });
    return out;
  }

  /* ---------------- 合成盘（组合/马盘/时空盘）与推进盘 ---------------- */
  function midLon(a, b) {
    var d = AstroCalc.norm360(b - a);
    if (d > 180) d -= 360;
    return AstroCalc.norm360(a + d / 2);
  }
  function meanPlace(p1, p2) {
    return { lat: (p1.lat + p2.lat) / 2, lon: (p1.lon + p2.lon) / 2, tz: 'UTC', name: '双方出生地中点' };
  }
  function midUtc(u1, u2) { return new Date((new Date(u1).getTime() + new Date(u2).getTime()) / 2); }
  function jdFromDate(d) { return d.getTime() / 86400000 + 2440587.5; }
  function dateFromJd(jd) { return new Date(Math.round((jd - 2440587.5) * 86400000)); }
  function utcParts(d) {
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtUTCDate(d) {
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ' UTC';
  }
  function houseOf(lon, cusps) {
    for (var h = 1; h <= 12; h++) {
      var a = cusps[h], b = cusps[h % 12 + 1];
      var span = AstroCalc.norm360(b - a), off = AstroCalc.norm360(lon - a);
      if (off < span) return h;
    }
    return 1;
  }
  function innerAspects(points) {
    var out = [];
    for (var i = 0; i < points.length; i++) {
      for (var j = i + 1; j < points.length; j++) {
        var a = points[i], b = points[j];
        var d = Math.abs(AstroCalc.norm360(a.lon - b.lon)); if (d > 180) d = 360 - d;
        for (var k = 0; k < AstroCalc.ASPECT_DEFS.length; k++) {
          var asp = AstroCalc.ASPECT_DEFS[k];
          var orb = asp.orb + ((a.key === 'sun' || a.key === 'moon' || b.key === 'sun' || b.key === 'moon') ? 1 : 0);
          var diff = Math.abs(d - asp.angle);
          if (diff <= orb) {
            out.push({ a: a.key, b: b.key, aName: a.name, bName: b.name, type: asp.key, name: asp.name, glyph: asp.glyph, angle: asp.angle, orb: Math.round(diff * 10) / 10 });
            break;
          }
        }
      }
    }
    out.sort(function (x, y) { return x.orb - y.orb; });
    return out;
  }
  function houseName(key) {
    for (var i = 0; i < AstroCalc.HOUSE_SYSTEMS.length; i++) {
      if (AstroCalc.HOUSE_SYSTEMS[i].key === key) return AstroCalc.HOUSE_SYSTEMS[i].name;
    }
    return key;
  }
  // 组合盘/马盘：双方同名行星黄经中点（shortest-arc midpoint）
  function compositeChart(baseUtc, kind) {
    var cA = state.chartA, cB = state.chartB;
    var houseSystem = ($('#synHouse') && $('#synHouse').value) || 'placidus';
    var place = meanPlace(cA.place, cB.place);
    var planets = AstroCalc.BODIES.map(function (b) {
      var pa = null, pb = null;
      for (var i = 0; i < cA.planets.length; i++) if (cA.planets[i].key === b.key) pa = cA.planets[i];
      for (var j = 0; j < cB.planets.length; j++) if (cB.planets[j].key === b.key) pb = cB.planets[j];
      if (!pa || !pb) return null;
      var lon = midLon(pa.lon, pb.lon);
      var speed = (pa.speed + pb.speed) / 2;
      return { key: b.key, name: b.name, glyph: b.glyph, color: b.color, lon: lon, lat: (pa.lat + pb.lat) / 2, speed: speed, retro: speed < 0, sign: AstroCalc.signOf(lon) };
    }).filter(function (x) { return !!x; });
    var nodeLon = midLon(cA.node.lon, cB.node.lon);
    var nodeSpeed = (cA.node.speed + cB.node.speed) / 2;
    var node = { key: 'node', name: '北交点', glyph: '\u260A', color: '#9db4c0', lon: nodeLon, lat: 0, speed: nodeSpeed, retro: nodeSpeed < 0, sign: AstroCalc.signOf(nodeLon) };
    var ascLon = midLon(cA.asc.lon, cB.asc.lon);
    var mcLon = midLon(cA.mc.lon, cB.mc.lon);
    var ascPoint = { key: 'asc', name: '上升点', glyph: 'ASC', color: '#e8c66a', lon: ascLon, retro: false, sign: AstroCalc.signOf(ascLon) };
    var mcPoint = { key: 'mc', name: '中天点', glyph: 'MC', color: '#e8c66a', lon: mcLon, retro: false, sign: AstroCalc.signOf(mcLon) };
    var hh = AstroCalc.housesFromAscMc(ascLon, mcLon, place.lat, baseUtc, houseSystem);
    var allPoints = planets.concat([node, ascPoint, mcPoint]);
    allPoints.forEach(function (p) { p.house = houseOf(p.lon, hh.cusps); });
    return finalizeSynChart({
      planets: planets, node: node, ascPoint: ascPoint, mcPoint: mcPoint,
      houses: hh.cusps, fallback: hh.fallback, houseSystem: houseSystem,
      baseUtc: baseUtc, place: place, aspects: innerAspects(allPoints),
      kind: kind || 'composite'
    });
  }
  // 时空盘（Davison）：双方出生时刻中点为盘时、出生地中点为盘地
  function davisonChart(baseUtc) {
    var p = utcParts(baseUtc);
    var place = meanPlace(state.chartA.place, state.chartB.place);
    var houseSystem = ($('#synHouse') && $('#synHouse').value) || 'placidus';
    var chart = AstroCalc.computeChart({
      year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute,
      timeUnknown: false,
      birthPlace: { lat: place.lat, lon: place.lon, tz: 'UTC', name: place.name },
      houseSystem: houseSystem
    });
    chart.synKind = 'davison';
    chart.localTimeStr = '时空盘盘时（双方出生时刻中点）：' + fmtUTCDate(baseUtc);
    return chart;
  }
  // 次限：1 天 = 1 年（365.2422 天）；三限：1 天 = 1 朔望月（29.5306 天）。以盘时为基准推进至当前。
  function progressedChart(kind, baseUtc) {
    var now = new Date();
    var baseJd = jdFromDate(baseUtc);
    var nowJd = jdFromDate(now);
    var factor = kind === 'secondary' ? 365.2422 : 29.5306;
    var targetJd = baseJd + (nowJd - baseJd) / factor;
    var target = dateFromJd(targetJd);
    var p = utcParts(target);
    var place = meanPlace(state.chartA.place, state.chartB.place);
    var houseSystem = ($('#synHouse') && $('#synHouse').value) || 'placidus';
    var chart = AstroCalc.computeChart({
      year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute,
      timeUnknown: false,
      birthPlace: { lat: place.lat, lon: place.lon, tz: 'UTC', name: place.name },
      houseSystem: houseSystem
    });
    chart.synKind = kind;
    chart.localTimeStr = (kind === 'secondary' ? '次限' : '三限') + '推进时点：' + fmtUTCDate(target) +
      '（基准盘时 ' + fmtUTCDate(baseUtc) + '，1天=' + (kind === 'secondary' ? '1年' : '29.5306天') + '）';
    return chart;
  }
  // 统一收尾：为手搓合成盘补齐 computeChart 同构字段
  function finalizeSynChart(o) {
    var MODE_MAP = ['cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable'];
    var elements = { fire: 0, earth: 0, air: 0, water: 0 };
    var modalities = { cardinal: 0, fixed: 0, mutable: 0 };
    o.planets.forEach(function (p) {
      if (AstroCalc.SIGNS[p.sign.index]) elements[AstroCalc.SIGNS[p.sign.index].element]++;
      modalities[MODE_MAP[p.sign.index]]++;
    });
    return {
      utc: o.baseUtc, utcISO: o.baseUtc.toISOString(),
      localTimeStr: '合成盘盘时（双方出生时刻中点）：' + fmtUTCDate(o.baseUtc),
      utOffset: 0,
      place: o.place, livePlace: null, timeUnknown: false,
      planets: o.planets, node: o.node, allPoints: o.planets.concat([o.node, o.ascPoint, o.mcPoint]),
      asc: o.ascPoint, mc: o.mcPoint,
      houses: o.houses, houseFallback: o.fallback, houseSystem: o.houseSystem,
      aspects: o.aspects, elements: elements, modalities: modalities,
      relocated: null, synKind: o.kind
    };
  }
  // 按盘型生成当前合盘数据
  function buildSynChart(type) {
    state.type = type || 'synastry';
    if (state.type === 'synastry') {
      state.chartC = null;
      state.cross = crossAspects(chartPoints(state.chartA), chartPoints(state.chartB));
      return;
    }
    state.cross = [];
    var baseUtc = midUtc(state.chartA.utc, state.chartB.utc);
    var c;
    if (state.type.indexOf('composite') === 0) c = compositeChart(baseUtc, 'composite');
    else if (state.type.indexOf('marx') === 0) c = compositeChart(baseUtc, 'marx');
    else c = davisonChart(baseUtc);
    if (state.type.indexOf('secondary') >= 0) c = progressedChart('secondary', baseUtc);
    else if (state.type.indexOf('tertiary') >= 0) c = progressedChart('tertiary', baseUtc);
    state.chartC = c;
  }
  function swapCross(cross) {
    return cross.map(function (a) {
      return { aKey: a.bKey, bKey: a.aKey, aName: a.bName, bName: a.aName, type: a.type, name: a.name, orb: a.orb, lonA: a.lonB, lonB: a.lonA };
    });
  }

  /* ---------------- Bi-wheel 渲染 ---------------- */
  var SIZE = 720, C = SIZE / 2;
  var R_ZO = 340, R_ZI = 292, R_B = 262, R_DIV = 232, R_A = 200, R_A_DEG = 179, R_ASP = 146;

  function pt(lon, r, asc) {
    var a = (180 + (lon - asc)) * Math.PI / 180;
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderBiWheel(cA, cB, cross, container) {
    var asc = cA.asc.lon;
    var s = '<svg class="wheel-svg" viewBox="0 0 ' + SIZE + ' ' + SIZE + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:640px;height:auto;display:block">';
    s += '<circle class="w-bg" cx="' + C + '" cy="' + C + '" r="' + (R_ZO + 12) + '"/>';
    s += '<circle class="w-band" cx="' + C + '" cy="' + C + '" r="' + R_ZO + '"/>';
    s += '<circle class="w-ring" cx="' + C + '" cy="' + C + '" r="' + R_ZI + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + R_DIV + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + R_ASP + '"/>';

    // 星座分隔与符号
    for (var i = 0; i < 12; i++) {
      var lineLon = i * 30 + asc;
      var p1 = pt(lineLon, R_ZI, asc), p2 = pt(lineLon, R_ZO, asc);
      s += '<line class="w-sep" x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '"/>';
      var gp = pt(i * 30 + 15 + asc, (R_ZO + R_ZI) / 2, asc);
      s += '<text class="' + ELE_CLASS[i % 4] + '" x="' + gp.x.toFixed(1) + '" y="' + (gp.y + 9).toFixed(1) + '" text-anchor="middle" font-size="22">' + SIGN_GLYPHS[i] + '</text>';
    }

    // A 的宫位线（从星座内圈到分隔圈）
    for (var h = 1; h <= 12; h++) {
      var lon = cA.houses[h];
      var q1 = pt(lon, R_DIV, asc), q2 = pt(lon, R_ZI, asc);
      var isAngle = (h === 1 || h === 4 || h === 7 || h === 10);
      s += '<line class="' + (isAngle ? 'w-house-angle' : 'w-house') + '" x1="' + q1.x.toFixed(1) + '" y1="' + q1.y.toFixed(1) + '" x2="' + q2.x.toFixed(1) + '" y2="' + q2.y.toFixed(1) + '"/>';
    }

    // 跨盘相位线（A 内圈 <-> B 外圈）
    cross.forEach(function (a) {
      var P1 = pt(a.lonA, R_ASP, asc), P2 = pt(a.lonB, R_ASP, asc);
      var tense = (a.type === 'square' || a.type === 'opp');
      var cls = tense ? 'w-asp-t' : (a.type === 'trine' || a.type === 'sextile' ? 'w-asp-h' : 'w-asp-x');
      var dash = tense ? ' stroke-dasharray="5,4"' : '';
      var w = a.orb < 3 ? 1.8 : 1;
      s += '<line class="' + cls + '" x1="' + P1.x.toFixed(1) + '" y1="' + P1.y.toFixed(1) + '" x2="' + P2.x.toFixed(1) + '" y2="' + P2.y.toFixed(1) + '" stroke-width="' + w + '"' + dash + ' opacity="0.5"/>';
    });

    // B 行星（外环）
    var placedB = [];
    cB.points.forEach(function (p) {
      var lon = p.lon, tries = 0;
      while (placedB.some(function (q) { var d = Math.abs(((q - lon) % 360 + 360) % 360); return d < 8; }) && tries < 6) { lon += 7; tries++; }
      placedB.push(lon);
      var pos = pt(lon, R_B, asc);
      var tick1 = pt(p.lon, R_ZI - 2, asc), tick2 = pt(p.lon, R_ZI - 12, asc);
      s += '<line class="w-tick" x1="' + tick1.x.toFixed(1) + '" y1="' + tick1.y.toFixed(1) + '" x2="' + tick2.x.toFixed(1) + '" y2="' + tick2.y.toFixed(1) + '"/>';
      s += '<text class="w-dim w-halo" x="' + pos.x.toFixed(1) + '" y="' + (pos.y + 6).toFixed(1) + '" text-anchor="middle" font-size="18">' + p.glyph + (p.retro ? '\u211E' : '') + '</text>';
    });

    // A 行星（内环）
    var placedA = [];
    cA.points.forEach(function (p) {
      var lon = p.lon, tries = 0;
      while (placedA.some(function (q) { var d = Math.abs(((q - lon) % 360 + 360) % 360); return d < 8; }) && tries < 6) { lon += 7; tries++; }
      placedA.push(lon);
      var pos = pt(lon, R_A, asc);
      var fs = (p.key === 'asc' || p.key === 'mc') ? 13 : 19;
      s += '<text class="w-planet w-halo" x="' + pos.x.toFixed(1) + '" y="' + (pos.y + 6).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '">' + p.glyph + (p.retro ? '\u211E' : '') + '</text>';
      if (p.key !== 'asc' && p.key !== 'mc') {
        var dp = pt(lon, R_A_DEG, asc);
        s += '<text class="w-dim" x="' + dp.x.toFixed(1) + '" y="' + (dp.y + 4).toFixed(1) + '" text-anchor="middle" font-size="10">' + p.sign.deg + '\u00B0</text>';
      }
    });

    var ascP = pt(cA.asc.lon, R_ZO + 22, asc);
    s += '<text class="w-planet w-halo" x="' + ascP.x.toFixed(1) + '" y="' + (ascP.y + 5).toFixed(1) + '" text-anchor="middle" font-size="13">ASC</text>';
    var mcP = pt(cA.mc.lon, R_ZO + 22, asc);
    s += '<text class="w-planet w-halo" x="' + mcP.x.toFixed(1) + '" y="' + (mcP.y + 5).toFixed(1) + '" text-anchor="middle" font-size="13">MC</text>';

    s += '</svg>';
    container.innerHTML = s;
  }

  function prep(chart) {
    var pts = chart.planets.map(function (p) { return { key: p.key, lon: p.lon, glyph: p.glyph, retro: p.retro, sign: p.sign }; });
    pts.push({ key: 'node', lon: chart.node.lon, glyph: '\u260A', retro: true, sign: chart.node.sign });
    return { points: pts, houses: chart.houses, asc: chart.asc, mc: chart.mc };
  }

  /* ---------------- 解读文本 ---------------- */
  function aspectText(a, nameA, nameB) {
    var note = pairNote(a.aKey, a.bKey);
    var who = a.aName === a.bName
      ? '你们俩的' + a.aName
      : esc(nameB) + '的' + a.bName + '（' + (ROLE[a.bKey] || '') + '）× ' + esc(nameA) + '的' + a.aName + '（' + (ROLE[a.aKey] || '') + '）';
    return '<b>' + a.aName + ' ' + a.name + ' ' + a.bName + '</b>（偏差 ' + a.orb + '\u00B0）<br>' + who + '：' + REL_ASPECTS[a.type] + (note ? '<br><span class="pair-note">' + note + '</span>' : '');
  }

  // 盘内相位文本（合成盘内行星之间，无 A/B 归属语义）
  function aspectTextInner(a) {
    var note = pairNote(a.a, a.b);
    return '<b>' + a.aName + ' ' + a.name + ' ' + a.bName + '</b>（偏差 ' + a.orb + '\u00B0）<br>' + a.aName + ' 与 ' + a.bName + '：' + REL_ASPECTS[a.type] + (note ? '<br><span class="pair-note">' + note + '</span>' : '');
  }

  function buildReport() {
    var nameA = state.pa.name || 'A', nameB = state.pb.name || 'B';
    var cA = state.chartA, cB = state.chartB, cross = state.cross;
    var sections = [];
    if (state.type === 'synastry') {
      var meta = '<p><b>' + esc(nameA) + '</b>：' + cA.localTimeStr + ' · ' + cA.place.name + ' — 太阳' + cA.planets[0].sign.name + ' / 月亮' + cA.planets[1].sign.name + ' / 上升' + cA.asc.sign.name +
        '<br><b>' + esc(nameB) + '</b>：' + cB.localTimeStr + ' · ' + cB.place.name + ' — 太阳' + cB.planets[0].sign.name + ' / 月亮' + cB.planets[1].sign.name + ' / 上升' + cB.asc.sign.name + '</p>';
      sections.push({ title: '一、双方星盘速览', html: meta });

      var harmony = cross.filter(function (a) { return a.type === 'trine' || a.type === 'sextile'; }).length;
      var tense = cross.filter(function (a) { return a.type === 'square' || a.type === 'opp'; }).length;
      var conj = cross.filter(function (a) { return a.type === 'conj'; }).length;
      var tone = conj + harmony > tense
        ? '你们的关系底色偏和谐：' + (conj + harmony) + ' 组顺能量 vs ' + tense + ' 组紧张能量，相处有天然的理解和配合，磨合点清晰可控。'
        : '你们的关系偏"火花型"：' + tense + ' 组紧张相位意味着强烈的吸引和碰撞并存，这是一段能互相激发、也需要用心经营的关系。';
      sections.push({
        title: '二、关系主色调',
        html: '<p>共检测到 <b>' + cross.length + '</b> 组跨盘相位：合相 ' + conj + ' · 和谐（三分/六分）' + harmony + ' · 紧张（四分/对分）' + tense + '。</p><p>' + tone + '</p>'
      });

      var goods = cross.filter(function (a) { return a.type === 'conj' || a.type === 'trine' || a.type === 'sextile'; }).slice(0, 4);
      var gHtml = goods.length ? goods.map(function (a) { return '<p>' + aspectText(a, nameA, nameB) + '</p>'; }).join('') : '<p>没有特别紧密的和谐相位——你们的关系更多靠主动经营，火花藏在紧张相位里。</p>';
      sections.push({ title: '三、吸引力与默契（和谐亮点）', html: gHtml });

      var bads = cross.filter(function (a) { return a.type === 'square' || a.type === 'opp'; }).slice(0, 3);
      var bHtml = bads.length ? bads.map(function (a) { return '<p>' + aspectText(a, nameA, nameB) + '</p>'; }).join('') : '<p>几乎找不到明显的紧张相位——你们相处难得地顺滑，注意别因为太舒适而缺乏推动力。</p>';
      sections.push({ title: '四、磨合与成长点', html: bHtml });

      var all = '<div class="aspect-list">';
      cross.forEach(function (a) {
        var tense = (a.type === 'square' || a.type === 'opp');
        all += '<div class="aspect-item"><span class="ai-line">' + a.aName + ' ' + a.name + ' ' + a.bName + ' <small>（' + a.orb + '\u00B0' + (tense ? ' · 紧张' : ' · 和谐') + '）</small></span><span class="ai-desc">' + REL_ASPECTS[a.type] + '</span></div>';
      });
      all += '</div>';
      sections.push({ title: '五、全部跨盘相位', html: all });
    } else {
      var t = SYN_MAP[state.type] || SYN_MAP.composite;
      var c = state.chartC;
      var meta = '<p>盘型：<b>' + t.label + '</b>（' + t.desc + '）</p>' +
        '<p>合成盘时点：' + esc(c.localTimeStr) + '<br>合成盘地点：' + esc(c.place.name) + '（双方出生地中点，' + c.place.lat.toFixed(2) + '\u00B0 / ' + c.place.lon.toFixed(2) + '\u00B0）<br>宫位制：' + houseName(c.houseSystem) + (c.houseFallback ? '（高纬回退 ' + c.houseFallback + '）' : '') + '</p>' +
        '<p><b>' + esc(nameA) + '</b>：' + cA.localTimeStr + ' · ' + cA.place.name + ' — 太阳' + cA.planets[0].sign.name + ' / 月亮' + cA.planets[1].sign.name + ' / 上升' + cA.asc.sign.name +
        '<br><b>' + esc(nameB) + '</b>：' + cB.localTimeStr + ' · ' + cB.place.name + ' — 太阳' + cB.planets[0].sign.name + ' / 月亮' + cB.planets[1].sign.name + ' / 上升' + cB.asc.sign.name + '</p>';
      sections.push({ title: '一、合成盘速览', html: meta });

      var pl = '<div class="aspect-list">';
      var order = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node'];
      order.forEach(function (key) {
        var p = null;
        for (var i = 0; i < c.planets.length; i++) if (c.planets[i].key === key) { p = c.planets[i]; break; }
        if (!p) return;
        if (key === 'node') {
          pl += '<div class="aspect-item"><span class="ai-line">' + p.name + '（' + p.sign.name + ' ' + p.sign.deg + '\u00B0' + '）</span><span class="ai-desc">第' + p.house + '宫</span></div>';
        } else {
          pl += '<div class="aspect-item"><span class="ai-line">' + p.glyph + ' ' + p.name + '（' + p.sign.name + ' ' + p.sign.deg + '\u00B0' + (p.retro ? ' \u211E' : '') + '）</span><span class="ai-desc">第' + p.house + '宫</span></div>';
        }
      });
      pl += '<div class="aspect-item"><span class="ai-line">ASC（' + c.asc.sign.name + ' ' + c.asc.sign.deg + '\u00B0' + '）</span><span class="ai-desc">上升点</span></div>';
      pl += '</div>';
      sections.push({ title: '二、合成盘行星落位', html: pl });

      var aspects = c.aspects;
      var harmony = aspects.filter(function (a) { return a.type === 'trine' || a.type === 'sextile'; }).length;
      var tense = aspects.filter(function (a) { return a.type === 'square' || a.type === 'opp'; }).length;
      var conj = aspects.filter(function (a) { return a.type === 'conj'; }).length;
      var tone = conj + harmony > tense
        ? '这张合成盘的底色偏和谐：' + (conj + harmony) + ' 组顺能量 vs ' + tense + ' 组紧张能量，双方合作的自然默契多于摩擦。'
        : '这张合成盘偏"火花型"：' + tense + ' 组紧张相位意味着强烈的吸引与碰撞并存，经营得当可转化为推进关系的动能。';
      sections.push({
        title: '三、盘内相位主色调',
        html: '<p>共检测到 <b>' + aspects.length + '</b> 组盘内相位：合相 ' + conj + ' · 和谐（三分/六分）' + harmony + ' · 紧张（四分/对分）' + tense + '。</p><p>' + tone + '</p>'
      });

      var goods = aspects.filter(function (a) { return a.type === 'conj' || a.type === 'trine' || a.type === 'sextile'; }).slice(0, 4);
      var gHtml = goods.length ? goods.map(function (a) { return '<p>' + aspectTextInner(a) + '</p>'; }).join('') : '<p>没有特别紧密的和谐相位——这段关系的火花更多藏在紧张相位里，需要主动经营。</p>';
      sections.push({ title: '四、和谐亮点', html: gHtml });

      var bads = aspects.filter(function (a) { return a.type === 'square' || a.type === 'opp'; }).slice(0, 3);
      var bHtml = bads.length ? bads.map(function (a) { return '<p>' + aspectTextInner(a) + '</p>'; }).join('') : '<p>几乎找不到明显的紧张相位——你们相处难得地顺滑，注意别因为太舒适而缺乏推动力。</p>';
      sections.push({ title: '五、磨合与成长点', html: bHtml });

      var all = '<div class="aspect-list">';
      aspects.forEach(function (a) {
        var tense2 = (a.type === 'square' || a.type === 'opp');
        all += '<div class="aspect-item"><span class="ai-line">' + a.aName + ' ' + a.name + ' ' + a.bName + ' <small>（' + a.orb + '\u00B0' + (tense2 ? ' · 紧张' : ' · 和谐') + '）</small></span><span class="ai-desc">' + REL_ASPECTS[a.type] + '</span></div>';
      });
      all += '</div>';
      sections.push({ title: '六、全部盘内相位', html: all });
    }

    sections.push({ title: (state.type === 'synastry' ? '六' : '七') + '、写在最后', html: '<p>合盘描述的是两人相处的"默认模式"，不是关系的判决书。和谐相位是天赋，紧张相位是功课——看见彼此的节奏差异，就是合盘最大的价值。</p><p>本报告由' + (window.SITE_CONFIG ? window.SITE_CONFIG.name : 'Mora Aurora Astro') + '生成，仅供参考与自我探索。</p>' });
    return sections;
  }

  /* ---------------- AI ---------------- */
  var AI_SYSTEM_PROMPT =
    '你是一位功底扎实、擅长关系占星的资深占星师，说话风格：像懂心理学的老朋友，大白话、接地气、有温度，会打比方，偶尔幽默。' +
    '规则：1) 所有解读必须紧扣提供的双人合盘数据（行星星座/跨盘或盘内相位），不允许编造数据中不存在的信息；' +
    '2) 不做绝对化断言，不说"注定""一定"，合盘是倾向不是判决；3) 不制造焦虑，不给改运承诺；' +
    '4) 建议要具体可操作；5) 输出使用简体中文，可用简单的 Markdown（小标题、加粗、列表）。';

  function chartBrief(c, name) {
    var ps = {};
    c.planets.forEach(function (p) { ps[p.name] = p.sign.name + ' ' + p.sign.deg + '\u00B0' + (p.retro ? ' ℞' : ''); });
    return { 昵称: name, 出生: c.localTimeStr + ' ' + c.place.name, 行星: ps, 上升: c.asc.sign.name + ' ' + c.asc.sign.deg + '\u00B0' };
  }

  function synContext() {
    if (state.type !== 'synastry') {
      var c = state.chartC, t = SYN_MAP[state.type] || SYN_MAP.composite;
      var top = c.aspects.slice(0, 24).map(function (a) { return a.aName + ' ' + a.name + ' ' + a.bName + '（偏差' + a.orb + '°）'; });
      return {
        盘型: t.label,
        A方: chartBrief(state.chartA, state.pa.name),
        B方: chartBrief(state.chartB, state.pb.name),
        合成盘: chartBrief(c, t.short),
        盘内相位: top,
        相位统计: {
          合相: c.aspects.filter(function (a) { return a.type === 'conj'; }).length,
          和谐: c.aspects.filter(function (a) { return a.type === 'trine' || a.type === 'sextile'; }).length,
          紧张: c.aspects.filter(function (a) { return a.type === 'square' || a.type === 'opp'; }).length
        }
      };
    }
    var top = state.cross.slice(0, 24).map(function (a) {
      return state.pa.name + '的' + a.aName + ' ' + a.name + ' ' + state.pb.name + '的' + a.bName + '（偏差' + a.orb + '°）';
    });
    return {
      A方: chartBrief(state.chartA, state.pa.name),
      B方: chartBrief(state.chartB, state.pb.name),
      跨盘相位: top,
      相位统计: {
        合相: state.cross.filter(function (a) { return a.type === 'conj'; }).length,
        和谐: state.cross.filter(function (a) { return a.type === 'trine' || a.type === 'sextile'; }).length,
        紧张: state.cross.filter(function (a) { return a.type === 'square' || a.type === 'opp'; }).length
      }
    };
  }

  // AI 由主平台统一配置：客户端不读取任何本地密钥，统一走服务端代理
  var aiReadyCache = null;
  function checkAI() {
    if (aiReadyCache !== null) return Promise.resolve(aiReadyCache);
    return API.ai.status().then(function (s) { aiReadyCache = !!s.configured; return aiReadyCache; })
      .catch(function () { return true; });
  }

  // 统一走服务端 AI 代理（密钥保存在服务端，客户端不接触）；variant 为当前盘型 key，供服务端做盘型权限校验
  function callAI(messages) {
    return API.ai.chat('合盘 · AI 问答', messages, 0.8, state.type).then(function (d) { return d.content; });
  }
  function callAIDeep(messages) {
    return API.ai.chat('合盘 · AI 深度解析', messages, 0.8, state.type).then(function (d) { return d.content; });
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

  async function requireAI() {
    var ready = await checkAI();
    if (!ready) toast('AI 功能尚未配置，请联系站长在主平台完成设置');
    return ready;
  }

  // AI 问答
  var chatHistory = [];
  async function sendChat() {
    if (!state.chartA) return;
    if (!(await requireAI())) return;
    var input = $('#synChatInput');
    var q = input.value.trim();
    if (!q) return;
    if (!(await Billing.spend('合盘 · AI 问答'))) return;
    input.value = '';
    addMsg('user', escapeHtml(q));

    var sys = AI_SYSTEM_PROMPT + '\n\n双人合盘数据：\n' + JSON.stringify(synContext()) +
      '\n\n回答要求：紧扣双方盘面与跨盘相位说话，说人话，给建议；回答控制在 300 字内直讲核心，主要课题只保留最重要的 1-2 项。';
    var msgs = [{ role: 'system', content: sys }].concat(chatHistory.slice(-10)).concat([{ role: 'user', content: q }]);
    var typing = addMsg('ai', '<span class="typing">正在结合两张星盘推算…</span>');

    callAI(msgs).then(function (text) {
      typing.querySelector('.bubble').innerHTML = mdLite(text);
      $('#synChatWindow').scrollTop = $('#synChatWindow').scrollHeight;
      chatHistory.push({ role: 'user', content: q });
      chatHistory.push({ role: 'assistant', content: text });
    }).catch(function (e) {
      Billing.refund('合盘 AI 问答失败退回');
      typing.querySelector('.bubble').innerHTML = '<span style="color:var(--danger)">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }

  function addMsg(role, html) {
    var div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
    div.innerHTML = '<div class="avatar">' + (role === 'user' ? '我' : 'AI') + '</div><div class="bubble">' + html + '</div>';
    $('#synChatWindow').appendChild(div);
    $('#synChatWindow').scrollTop = $('#synChatWindow').scrollHeight;
    return div;
  }

  // 10 种盘型的解读侧重点（用于深度解析 Prompt 差异化）
  var SYN_ANGLE = {
    synastry: '比较盘揭示两人相遇时的互动模式与张力：A 星与 B 星如何碰撞、吸引、磨合，情绪与行动在谁身上更主动，哪些领域天然同频、哪些领域容易误读。',
    composite: '组合盘是双方能量的"合体盘"，揭示这段关系作为一个共同体的本质：关系的整体气质、共同形象、相处基调与一起经营时的自然分工。',
    'composite-secondary': '组合次限盘把组合盘推到当前时间，侧重这段关系近一年来的演变方向：共同体气质正在怎样微调，当下的相处课题从哪里来。',
    'composite-tertiary': '组合三限盘把组合盘推到当下最近数日，侧重关系此刻的状态波动：近期气氛、临时课题与接下来几天的相处建议。',
    marx: '马克思盘（马盘）是一方对另一方内心感受的主观投影，解读时侧重感受层：双方在这段关系里真实的内心体验、安全感与需求满足程度。',
    'marx-secondary': '马次限盘把马盘推到当前时间，侧重双方内心感受近一年来的变化：谁的心境在靠近、谁在疏远，情感需求发生了什么转移。',
    'marx-tertiary': '马三限盘把马盘推到当下最近数日，侧重此刻双方情绪与心理状态的即时波动，适合解读近几天的情感体验。',
    davison: '时空盘（Davison）以两人出生时刻与地点的中点为盘，揭示这段关系的长期走向与命运感：关系最终会走向何方、共同经历的大主题是什么。',
    'davison-secondary': '时空次限盘把时空盘推到当前时间，侧重关系长期走向的近期推进：正处在哪个阶段，下一步的大方向在哪里。',
    'davison-tertiary': '时空三限盘把时空盘推到当下最近数日，侧重关系长期轴线上的当下节点：最近几日处于哪段推进节奏，短期的关键信号。'
  };

  // 4 种关系类型（深度解析场景化）
  var REL_SCENES = {
    '暧昧': '你们处于暧昧/试探阶段，解读请重点围绕：彼此的吸引力与好感信号、关系的不确定性、如何自然地推进关系、现阶段最该留意什么。',
    '感情': '你们处于恋爱感情阶段，解读请重点围绕：日常相处的舒适度与激情、沟通模式与争吵雷区、如何让感情升温、关系当前最需要经营的课题。',
    '婚姻': '你们处于婚姻/长期承诺视角，解读请重点围绕：责任与承诺的匹配度、共同生活的现实课题（家庭、财务、事业协调）、长期稳定性的根基、如何经营白头偕老。',
    '朋友': '你们处于朋友/伙伴关系，解读请重点围绕：彼此的陪伴与支持方式、共同的兴趣与话题、边界与独立性、这段友谊如何长期保鲜。'
  };

  function deepSystemPrompt() {
    var t = SYN_MAP[state.type] || SYN_MAP.synastry;
    var angle = SYN_ANGLE[state.type] || SYN_ANGLE.synastry;
    var scene = REL_SCENES[state.relType] || REL_SCENES['感情'];
    return '你是一位功底扎实、擅长关系占星的资深占星师，请基于双方合盘数据（双方行星落座/跨盘或盘内相位/元素/上升），生成一份「综合解析 + 两个人的优势/劣势 + 两个人的主要课题 + 合理相处建议」报告。' +
      '当前盘型是「' + t.label + '」（解读视角侧重：' + angle + '）' +
      '当前关系场景是「' + state.relType + '」（解读视角侧重：' + scene + '）' +
      '要求：1) 以双人关系的整体分析为主，不做单星象逐项罗列；2) 先给出这段关系在该场景下的整体画像与主线（契合基调、互补能量、发展节奏），以双方本命格局为基础；' +
      '3) 接着给出两个人的优势与劣势（各 2-3 项，紧扣盘面数据，落到现实相处）；4) 再提炼两个人的主要课题（只保留最重要的 1-2 项，关系卡点、沟通与转化建议），课题必须贴合所选关系场景与盘型侧重；5) 最后给出合理相处建议（可执行、落地）；6) 必须紧扣提供的合盘数据，不编造数据中不存在的信息；' +
      '7) 不说"注定""一定"，合盘是倾向不是判决；8) 不制造焦虑，不给改运承诺；9) 双方四轴仍需解析但不特别优先，仅在无更突出内容时作为解读骨架使用，且只输出结论、不报原始度数；10) 输出使用简体中文 Markdown，全篇控制在 900 字内，章节结构固定为：\n' +
      '一、综合解析\n（内容）\n二、两个人的优势/劣势\n（内容）\n三、两个人的主要课题\n（内容）\n四、合理相处建议\n（内容）';
  }

  async function aiDeepReport() {
    if (!state.chartA) return;
    if (!(await requireAI())) return;
    if (!(await Billing.spend('合盘 · AI 深度解析'))) return;
    var box = $('#synDeepReport');
    box.innerHTML = '<span class="typing">正在为你生成' + escapeHtml(state.relType) + '场景的' + escapeHtml((SYN_MAP[state.type] || SYN_MAP.synastry).short) + '深度解析…</span>';
    var sys = deepSystemPrompt() + '\n\n双人合盘数据：\n' + JSON.stringify(synContext());
    callAIDeep([
      { role: 'system', content: sys },
      { role: 'user', content: '请为这份合盘生成「综合解析 + 两个人的优势/劣势 + 两个人的主要课题 + 合理相处建议」报告（关系场景：' + state.relType + '，盘型：' + (SYN_MAP[state.type] || SYN_MAP.synastry).short + '，解读视角按上述侧重展开）。' }
    ]).then(function (text) {
      state.aiReport = mdLite(text);
      box.innerHTML = state.aiReport;
      renderReport();
      toast('AI 合盘深度解析已生成（已扣 1 星币）');
    }).catch(function (e) {
      Billing.refund('合盘 AI 解析失败退回');
      box.innerHTML = '<span class="deep-empty">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }

  // ---------- AI 专业解析（2500 字长报告，仅站主/管理员） ----------
  function proSystemPrompt() {
    var t = SYN_MAP[state.type] || SYN_MAP.synastry;
    var angle = SYN_ANGLE[state.type] || SYN_ANGLE.synastry;
    var scene = REL_SCENES[state.relType] || REL_SCENES['感情'];
    return '你是一位功底扎实、从业 20 年+、擅长关系占星的资深占星师，请基于双方合盘数据（双方行星落座/跨盘或盘内相位/元素/上升），生成一份约 2500 字的「AI 专业解析」完整关系报告。' +
      '当前盘型是「' + t.label + '」（解读视角侧重：' + angle + '）' +
      '当前关系场景是「' + state.relType + '」（解读视角侧重：' + scene + '）' +
      '要求：1) 以双人关系的整体分析为主线，先做综合解析（契合基调、互补能量、发展节奏、关系本质），以双方本命格局为基础；' +
      '2) 再展开两个人的主要课题（最重要的相处卡点、沟通模式与转化路径）；3) 深入拆解：两个人的优势与劣势（各 2-3 项）、吸引力根源、三观契合度、相处死结、隐性隐患、长期稳定性与关系最终走向、最优相处方式、是否值得长期维系，逐项落到现实并给出可执行建议；4) 最后给出合理相处建议（可执行的落地相处方案）；' +
      '5) 结构清晰分章节，固定为：一、综合解析；二、两个人的优势/劣势；三、两个人的主要课题；四、合理相处建议，总字数约 2500 字；' +
      '6) 必须紧扣提供的合盘数据，不编造数据中不存在的信息；7) 不说"注定""一定"，合盘是倾向不是判决；8) 不制造焦虑，不给改运承诺；' +
      '9) 双方四轴需解析但不特别优先，仅作解读骨架使用，只输出结论、不报原始度数；10) 全程隐藏原始盘面数据（不罗列行星落座/相位/度数），只输出推导后的结论；11) 输出使用简体中文 Markdown，格式固定为：\n' +
      '一、综合解析\n（内容）\n二、两个人的优势/劣势\n（内容）\n三、两个人的主要课题\n（内容）\n四、合理相处建议\n（内容）';
  }

  function callAIPro(messages) {
    return API.ai.proReport(messages, 0.8, state.type).then(function (d) { return d.content; });
  }

  async function aiProReport() {
    if (!state.chartA) return;
    if (!(await requireAI())) return;
    if (!(await Billing.spend('AI 专业解析'))) return;
    var box = $('#synProReport');
    box.innerHTML = '<span class="typing">正在为你生成约 2500 字的专业级关系报告…</span>';
    var sys = proSystemPrompt() + '\n\n双人合盘数据：\n' + JSON.stringify(synContext());
    callAIPro([
      { role: 'system', content: sys },
      { role: 'user', content: '请为这份合盘生成约 2500 字的「AI 专业解析」完整关系报告（关系场景：' + state.relType + '，盘型：' + (SYN_MAP[state.type] || SYN_MAP.synastry).short + '，解读视角按上述侧重展开）。' }
    ]).then(function (text) {
      box.innerHTML = mdLite(text);
      toast('AI 合盘专业解析已生成（已扣 1 星币）');
    }).catch(function (e) {
      Billing.refund('AI 专业解析失败退回');
      box.innerHTML = '<span class="deep-empty">出错了：' + escapeHtml(e.message) + '（1 星币已退回）</span>';
    });
  }
  if ($('#btnSynProReport')) $('#btnSynProReport').addEventListener('click', aiProReport);

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

  // 盘型分级：普通用户仅可使用 组合盘/比较盘/马克思盘/组合次限盘；其余盘型仅站主/管理员
  var SYN_FREE_KEYS = ['composite', 'synastry', 'marx', 'composite-secondary'];
  function applySynTypeAccess() {
    var admin = !!(window.Auth && typeof window.Auth.isAdmin === 'function' && (window.Auth.isAdmin() || window.Auth.isBeta()));
    var sel = $('#synType');
    if (!sel) return;
    Array.prototype.slice.call(sel.options).forEach(function (o) {
      var restricted = SYN_FREE_KEYS.indexOf(o.value) < 0;
      o.disabled = !admin && restricted;
      o.style.display = (!admin && restricted) ? 'none' : '';
    });
    if (!admin && SYN_FREE_KEYS.indexOf(sel.value) < 0) {
      sel.value = 'composite';
      if (state.chartA) { buildSynChart('composite'); renderResult(); }
    }
  }
  applySynTypeAccess();
  if (window.API && window.API.bootstrap && !(window.Auth && window.Auth.currentProfile && window.Auth.currentProfile())) {
    window.API.bootstrap().then(function () { applyProVisible(); applySynTypeAccess(); }, function () { applyProVisible(); applySynTypeAccess(); });
  }

  /* ---------------- 页面逻辑 ---------------- */
  var geoTimers = {};
  function attachGeoSearch(inputId, onPick) {
    var input = $('#' + inputId);
    var box = null;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (!q) { if (box) { box.remove(); box = null; } return; }
      clearTimeout(geoTimers[inputId]);
      geoTimers[inputId] = setTimeout(function () {
        fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=8&language=zh&format=json')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (box) box.remove();
            box = document.createElement('div');
            box.className = 'geo-drop';
            var results = mergeGeoResults(localGeoResults(q), data.results || []);
            if (!results.length) {
              box.innerHTML = '<div class="geo-empty">没有找到匹配的地点，试试输入城市名</div>';
            } else {
              results.forEach(function (r) {
                var item = document.createElement('div');
                item.className = 'geo-item';
                var sub = [r.admin1, r.country].filter(Boolean).join(' · ');
                item.innerHTML = r.name + '<span class="geo-sub">' + sub + '</span>';
                item.addEventListener('mousedown', function (e) {
                  e.preventDefault();
                  input.value = r.name + (sub ? '，' + sub : '');
                  onPick({ name: r.name, lat: r.latitude, lon: r.longitude, tz: r.timezone });
                  box.remove();
                });
                box.appendChild(item);
              });
            }
            input.parentNode.appendChild(box);
          }).catch(function () { });
      }, 350);
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (box) { box.remove(); box = null; } }, 220); });
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function renderReport() {
    var sections = buildReport();
    var html = '';
    sections.forEach(function (s, i) {
      html += '<details class="acc"' + (i === 0 ? ' open' : '') + '><summary>' + s.title + '</summary>' +
        '<div class="acc-body">' + s.html + '</div></details>';
    });
    if (state.aiReport) {
      html += '<details class="acc" open><summary>AI 关系深度解析（消耗 1 星币生成）</summary>' +
        '<div class="acc-body">' + state.aiReport + '</div></details>';
    }
    $('#synReport').innerHTML = html;
  }

  // 双方行星位置速览（对齐本命盘九大行星速览版式；合成盘附加合成盘行星行）
  function planetListHtml() {
    var order = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    function rowsFor(chart, name, extra) {
      var rows = '';
      order.forEach(function (key) {
        var p = null;
        for (var i = 0; i < chart.planets.length; i++) if (chart.planets[i].key === key) { p = chart.planets[i]; break; }
        if (!p) return;
        rows += '<div class="pl-row">' +
          '<span class="pl-glyph">' + p.glyph + '</span>' +
          '<span class="pl-name">' + p.name + '</span>' +
          '<span class="pl-sign">' + p.sign.name + '</span>' +
          '<span class="pl-deg">' + p.sign.deg + '\u00B0' + String(p.sign.min).padStart(2, '0') + '\u2032' + (p.retro ? ' \u211E' : '') + '</span>' +
          '<span class="pl-house">第' + p.house + '宫</span>' +
          '</div>';
      });
      return '<div class="pl-group">' + esc(name) + '</div>' + rows + (extra || '');
    }
    var extra = '';
    if (state.type !== 'synastry' && state.chartC) {
      var t = SYN_MAP[state.type] || SYN_MAP.composite;
      extra = rowsFor(state.chartC, t.short + '（合成）', '<div class="pl-node">北交 ' + state.chartC.node.sign.name + ' ' + state.chartC.node.sign.deg + '\u00B0' + String(state.chartC.node.sign.min).padStart(2, '0') + '\u2032</div>');
    }
    return rowsFor(state.chartA, state.pa.name) + rowsFor(state.chartB, state.pb.name) + extra;
  }

  function renderResult() {
    var nameA = state.pa.name, nameB = state.pb.name;
    renderSynView();

    $('#relTitle').textContent = nameA + ' × ' + nameB;
    $('#relSub').textContent = relSubText();

    // 视图切换按钮文案（以 A/B 为主）
    var vt = document.querySelectorAll('.syn-vtab');
    if (vt.length === 2) {
      vt[0].textContent = '以 ' + nameA + ' 为主';
      vt[1].textContent = '以 ' + nameB + ' 为主';
    }
    var vls = document.querySelectorAll('.syn-viewlabel');
    if (vls.length === 2) {
      vls[0].textContent = '以 ' + nameA + ' 为主（含宫位）· ' + currentTypeLabel();
      vls[1].textContent = '以 ' + nameB + ' 为主（含宫位）· ' + currentTypeLabel();
    }

    $('#planetList').innerHTML = planetListHtml();
    renderReport();
    if (window.Billing) Billing.refreshChips();
  }

  function currentType() {
    var el = $('#synType');
    return el ? el.value : 'synastry';
  }
  function currentTypeLabel() {
    var t = SYN_MAP[state.type] || SYN_MAP[currentType()] || SYN_MAP.synastry;
    return t.short;
  }
  function relSubText() {
    var nameA = state.pa.name, nameB = state.pb.name;
    var t = SYN_MAP[state.type] || SYN_MAP.synastry;
    if (state.type !== 'synastry' && state.chartC) {
      return t.label + ' · 合成盘宫位制 ' + houseName(state.chartC.houseSystem) + (state.chartC.houseFallback ? '（高纬回退 ' + state.chartC.houseFallback + '）' : '');
    }
    return t.label + ' · 共 ' + state.cross.length + ' 组跨盘相位 · 内圈为' + nameA + '（含宫位），外圈为' + nameB + '，连线为两人的行星相位';
  }

  // 双视图渲染：A 为主 / B 为主；比较盘画跨盘相位，合成盘画盘内相位（由 buildSynChart 置空 cross 并生成 chartC）
  function renderSynView() {
    var cA = prep(state.chartA), cB = prep(state.chartB);
    var isSyn = state.type === 'synastry';
    var cC = state.chartC ? prep(state.chartC) : null;
    if (isSyn) {
      renderBiWheel(cA, cB, state.cross, $('#wheel2'));
      renderBiWheel(cB, cA, swapCross(state.cross), $('#wheelB'));
    } else {
      renderBiWheel(cA, cC, [], $('#wheel2'));
      renderBiWheel(cB, cC, [], $('#wheelB'));
    }
    var tab = document.querySelector('.syn-vtab.active');
    var cur = (tab && tab.dataset.v) || 'a';
    $('#aWheelBox').style.display = cur === 'a' ? 'block' : 'none';
    $('#bWheelBox').style.display = cur === 'b' ? 'block' : 'none';
  }

  function init() {
    attachGeoSearch('placeA', function (p) { state.pa.place = p; });
    attachGeoSearch('placeB', function (p) { state.pb.place = p; });

    $('#unkA').addEventListener('change', function () { $('#timeA').disabled = this.checked; if (this.checked) $('#timeA').value = '12:00'; });
    $('#unkB').addEventListener('change', function () { $('#timeB').disabled = this.checked; if (this.checked) $('#timeB').value = '12:00'; });

    // Tab 切换（合盘解析 / AI 关系问答）
    document.querySelectorAll('#synResult .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('#synResult .tab').forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('#synResult .tab-panel').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        $('#' + t.dataset.tab).classList.add('active');
      });
    });

    // 盘型选择器切换（10 种合盘盘型）
    $('#synType').addEventListener('change', function () {
      if (!state.chartA) return;
      buildSynChart(this.value);
      renderResult();
    });

    // 视图切换：以 A 为主 / 以 B 为主
    document.querySelectorAll('.syn-vtab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.syn-vtab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var v = b.dataset.v;
        $('#aWheelBox').style.display = v === 'a' ? 'block' : 'none';
        $('#bWheelBox').style.display = v === 'b' ? 'block' : 'none';
      });
    });

    $('#btnSynastry').addEventListener('click', function () {
      var errs = [];
      var da = $('#dateA').value, ta = $('#timeA').value || '12:00';
      var db = $('#dateB').value, tb = $('#timeB').value || '12:00';
      if (!da) errs.push('请填写 A 的出生日期');
      if (!state.pa.place) errs.push('请从联想中选择 A 的出生地');
      if (!db) errs.push('请填写 B 的出生日期');
      if (!state.pb.place) errs.push('请从联想中选择 B 的出生地');
      if (errs.length) { toast(errs[0]); return; }

      state.pa.name = $('#nameA').value.trim() || 'TA';
      state.pb.name = $('#nameB').value.trim() || 'TA';
      var btn = this;
      btn.disabled = true; btn.textContent = '推 算 合 盘 中 …';
      setTimeout(function () {
        try {
          function mk(d, t, place, unk) {
            return AstroCalc.computeChart({
              year: +d.slice(0, 4), month: +d.slice(5, 7), day: +d.slice(8, 10),
              hour: +t.slice(0, 2), minute: +t.slice(3, 5),
              timeUnknown: unk, birthPlace: place, houseSystem: $('#synHouse').value
            });
          }
          state.chartA = mk(da, ta, state.pa.place, $('#unkA').checked);
          state.chartB = mk(db, tb, state.pb.place, $('#unkB').checked);
          buildSynChart(currentType());
          state.aiReport = '';
          chatHistory = [];
          renderResult();
          $('#synForm').style.display = 'none';
          $('#synResult').style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
          console.error(e);
          toast('生成失败：' + e.message);
        } finally {
          btn.disabled = false; btn.textContent = '生 成 合 盘';
        }
      }, 60);
    });

    $('#btnReset').addEventListener('click', function () {
      $('#synResult').style.display = 'none';
      $('#synForm').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 从客户库选择（A / B 方，依赖 customers-lib.js）
    function fillSide(c, side) {
      if (!c || !window.ClientLib) return;
      $('#name' + side).value = c.name || '';
      $('#date' + side).value = c.date || '';
      $('#unk' + side).checked = !!c.timeUnknown;
      $('#time' + side).disabled = !!c.timeUnknown;
      $('#time' + side).value = c.time || '12:00';
      $('#place' + side).value = ClientLib.placeText(c.place);
      state['p' + side.toLowerCase()].place = c.place || null;
      toast('已将客户「' + (c.name || '') + '」填入 ' + side + ' 方');
    }
    if (window.ClientLib) {
      if ($('#btnPickA')) $('#btnPickA').addEventListener('click', function () {
        ClientLib.openPicker({ title: '选择客户 · A 方', onPick: function (c) { fillSide(c, 'A'); } });
      });
      if ($('#btnPickB')) $('#btnPickB').addEventListener('click', function () {
        ClientLib.openPicker({ title: '选择客户 · B 方', onPick: function (c) { fillSide(c, 'B'); } });
      });
      // 支持客户库页「合盘·A/B方」直达：synastry.html?side=a|b&customer=xxx
      var mCust = /[?&]customer=([^&]+)/.exec(location.search);
      if (mCust) {
        var side = /side=b/i.test(location.search) ? 'B' : 'A';
        ClientLib.whenReady(function () { fillSide(ClientLib.byId(decodeURIComponent(mCust[1])), side); });
      }
    }

    // AI 模块页签切换（AI 回答 / AI 深度解析）
    document.querySelectorAll('.ai-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.ai-tab').forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('.ai-sub-panel').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.getElementById(t.dataset.aiTab).classList.add('active');
      });
    });

    // AI 问答
    $('#synBtnSend').addEventListener('click', sendChat);
    $('#synChatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    document.querySelectorAll('#syn-tab-ai .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        $('#synChatInput').value = c.textContent;
        sendChat();
      });
    });

    // AI 深度解析（AI 模块双页签内）
    $('#btnSynDeepReport').addEventListener('click', aiDeepReport);
    document.querySelectorAll('.reltype-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.reltype-chip').forEach(function (x) { x.classList.remove('active'); });
        c.classList.add('active');
        state.relType = c.dataset.rel;
      });
    });

    // 导出 TXT（扣 1 星币；纯文本，Word 可直接打开；结构同原导出）
    $('#btnExport').addEventListener('click', async function () {
      if (!state.chartA) return;
      if (!(await Billing.spend('合盘 · 导出报告'))) return;
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
      var lines = [];
      lines.push('占星合盘解读报告');
      lines.push('========================================');
      var t = SYN_MAP[state.type] || SYN_MAP.synastry;
      lines.push(state.pa.name + ' × ' + state.pb.name + ' · ' + t.label + ' · 关系场景：' + state.relType + ' · 由' + (window.SITE_CONFIG ? window.SITE_CONFIG.name : 'Mora Aurora Astro') + '生成');
      lines.push('');
      if (state.aiReport) {
        lines.push('AI 关系深度解析');
        lines.push('----------------------------------------');
        lines.push(stripHtml(state.aiReport));
        lines.push('');
        if (chatHistory.length) {
          lines.push('附：AI 问答记录');
          lines.push('----------------------------------------');
          for (var i = 0; i < chatHistory.length; i += 2) {
            lines.push('问：' + chatHistory[i].content);
            if (chatHistory[i + 1]) lines.push('答：' + chatHistory[i + 1].content);
            lines.push('');
          }
        }
      }
      lines.push('');
      lines.push('免责声明：本报告由 AI 生成，仅供娱乐与参考，不构成任何医疗、法律、投资、职业或其他重大决策依据。');
      var blob = new Blob(['\ufeff', lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '合盘报告_' + state.pa.name + '_' + state.pb.name + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast('TXT 报告已导出（Word 可直接打开，已扣 1 星币）');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
