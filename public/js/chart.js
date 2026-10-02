/* ============================================================
 * chart.js — 星盘盘面 SVG 渲染
 * 颜色通过 CSS class（w-*）映射到主题变量，亮暗模式自动适配
 * ============================================================ */
(function (root) {
  'use strict';

  var SIZE = 720, C = SIZE / 2;
  var R_ZODIAC_OUT = 330, R_ZODIAC_IN = 280, R_HOUSE_IN = 226, R_PLANET = 252, R_ASPECT = 150;

  var ELE_CLASS = ['w-ele-fire', 'w-ele-earth', 'w-ele-air', 'w-ele-water'];
  var SIGN_GLYPHS = ['\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653'];

  function pt(lon, r, asc) {
    // 上升点在左侧(180°屏幕角), 黄经逆时针增加
    var a = (180 + (lon - asc)) * Math.PI / 180;
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  }

  function renderChart(chart, container) {
    var asc = chart.asc.lon;
    var s = '';
    s += '<svg class="wheel-svg" viewBox="0 0 ' + SIZE + ' ' + SIZE + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;height:auto;display:block">';

    // 背景底圆 + 装饰星点
    s += '<circle class="w-bg" cx="' + C + '" cy="' + C + '" r="' + (R_ZODIAC_OUT + 20) + '"/>';
    var seed = 7;
    for (var st = 0; st < 90; st++) {
      seed = (seed * 9301 + 49297) % 233280;
      var rx = seed / 233280 * SIZE;
      seed = (seed * 9301 + 49297) % 233280;
      var ry = seed / 233280 * SIZE;
      seed = (seed * 9301 + 49297) % 233280;
      var ro = 0.4 + seed / 233280 * 1.1;
      s += '<circle class="w-star" cx="' + rx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="' + ro.toFixed(1) + '" opacity="0.08"/>';
    }

    // 外圈(星座带)
    s += '<circle class="w-band" cx="' + C + '" cy="' + C + '" r="' + R_ZODIAC_OUT + '"/>';
    s += '<circle class="w-ring" cx="' + C + '" cy="' + C + '" r="' + R_ZODIAC_IN + '"/>';
    s += '<circle class="w-inner" cx="' + C + '" cy="' + C + '" r="' + R_HOUSE_IN + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + R_ASPECT + '"/>';

    // 星座分隔线 + 符号：按真实黄经绘制（不叠加 asc），
    // 使星座环随每个人的 ASC 旋转：ASC 黄经恒定映射到屏幕 180°（左侧 9 点钟），
    // 行星（真实黄经）与星座环在同一标定下同步对齐 —— 市面主流占星软件模式
    for (var i = 0; i < 12; i++) {
      var lineLon = i * 30;
      var p1 = pt(lineLon, R_ZODIAC_IN, asc), p2 = pt(lineLon, R_ZODIAC_OUT, asc);
      s += '<line class="w-sep" x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '"/>';
      var mid = i * 30 + 15;
      var gp = pt(mid, (R_ZODIAC_OUT + R_ZODIAC_IN) / 2, asc);
      s += '<text class="' + ELE_CLASS[i % 4] + '" x="' + gp.x.toFixed(1) + '" y="' + gp.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="26">' + chart.signGlyphs[i] + '</text>';
    }

    // 宫位线：按每人真实宫头黄经分布（各盘不同）。
    // 四轴（ASC/DSC/MC/IC）自圆心辐射加粗；ASC 线恒为左侧水平半径，第 1 宫自左侧展开
    for (var h = 1; h <= 12; h++) {
      var lon = chart.houses[h];
      var isAngle = (h === 1 || h === 4 || h === 7 || h === 10);
      var q1 = pt(lon, isAngle ? 0 : R_HOUSE_IN, asc), q2 = pt(lon, R_ZODIAC_IN, asc);
      s += '<line class="' + (isAngle ? 'w-house-angle' : 'w-house') + '" x1="' + q1.x.toFixed(1) + '" y1="' + q1.y.toFixed(1) + '" x2="' + q2.x.toFixed(1) + '" y2="' + q2.y.toFixed(1) + '"/>';
      // 宫位号
      var nextLon = chart.houses[h % 12 + 1];
      var span = ((nextLon - lon) % 360 + 360) % 360;
      var hMid = lon + span / 2;
      var hp = pt(hMid, R_HOUSE_IN - 14, asc);
      s += '<text class="w-dim" x="' + hp.x.toFixed(1) + '" y="' + hp.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="13">' + h + '</text>';
    }

    // 相位线（和谐=实线，紧张=虚线）
    chart.aspects.forEach(function (a) {
      var pa = chart.pointLon[a.a], pb = chart.pointLon[a.b];
      if (pa === undefined || pb === undefined) return;
      var P1 = pt(pa, R_ASPECT, asc), P2 = pt(pb, R_ASPECT, asc);
      var isHarmony = (a.type === 'trine' || a.type === 'sextile');
      var isTense = (a.type === 'square' || a.type === 'opp');
      var cls = isHarmony ? 'w-asp-h' : (isTense ? 'w-asp-t' : 'w-asp-x');
      var dash = isTense ? ' stroke-dasharray="5,4"' : '';
      var op = isHarmony ? 0.75 : 0.6;
      s += '<line class="' + cls + '" x1="' + P1.x.toFixed(1) + '" y1="' + P1.y.toFixed(1) + '" x2="' + P2.x.toFixed(1) + '" y2="' + P2.y.toFixed(1) + '"' + dash + ' stroke-width="' + (a.orb < 3 ? 1.6 : 1) + '" opacity="' + op + '"/>';
    });

    // 行星
    var placed = [];
    chart.points.forEach(function (p) {
      var lon = p.lon, tries = 0;
      // 简单防重叠
      while (placed.some(function (q) { return Math.abs(((q - lon) % 360 + 360) % 360) < 7; }) && tries < 6) { lon += 6.5; tries++; }
      placed.push(lon);
      var pos = pt(lon, R_PLANET, asc);
      var tick1 = pt(p.lon, R_ZODIAC_IN, asc), tick2 = pt(p.lon, R_ZODIAC_IN - 12, asc);
      s += '<line class="w-tick" x1="' + tick1.x.toFixed(1) + '" y1="' + tick1.y.toFixed(1) + '" x2="' + tick2.x.toFixed(1) + '" y2="' + tick2.y.toFixed(1) + '"/>';
      var label = p.glyph + (p.retro ? '\u211E' : '');
      var fs = p.key === 'asc' || p.key === 'mc' ? 15 : 21;
      s += '<text class="w-planet w-halo" x="' + pos.x.toFixed(1) + '" y="' + pos.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="' + fs + '">' + label + '</text>';
      if (p.key !== 'asc' && p.key !== 'mc') {
        var dpos = pt(lon, R_PLANET - 22, asc);
        s += '<text class="w-dim" x="' + dpos.x.toFixed(1) + '" y="' + dpos.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="10.5">' + p.sign.deg + '\u00B0' + String(p.sign.min).padStart(2, '0') + '</text>';
      }
    });

    // ASC / MC 标注（ASC 恒定落在星盘左侧 9 点钟方向）
    var ascP = pt(chart.asc.lon, R_ZODIAC_OUT + 14, asc);
    s += '<text class="w-planet w-halo" x="' + ascP.x.toFixed(1) + '" y="' + ascP.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="14">ASC</text>';
    var mcP = pt(chart.mc.lon, R_ZODIAC_OUT + 14, asc);
    s += '<text class="w-planet w-halo" x="' + mcP.x.toFixed(1) + '" y="' + mcP.y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" font-size="14">MC</text>';

    s += '</svg>';
    container.innerHTML = s;
  }

  function prepareChart(chart) {
    // 组装绘制用的点集
    var pts = chart.planets.map(function (p) { return { key: p.key, lon: p.lon, glyph: p.glyph, retro: p.retro, sign: p.sign }; });
    pts.push({ key: 'node', lon: chart.node.lon, glyph: chart.node.glyph, retro: true, sign: chart.node.sign });
    var pointLon = {};
    pts.forEach(function (p) { pointLon[p.key] = p.lon; });
    pointLon['asc'] = chart.asc.lon; pointLon['mc'] = chart.mc.lon;
    return {
      points: pts, pointLon: pointLon, houses: chart.houses,
      asc: chart.asc, mc: chart.mc, aspects: chart.aspects, elements: chart.elements,
      signGlyphs: SIGN_GLYPHS
    };
  }

  // Bi-wheel 双盘渲染（个人运势：内圈本命 + 外圈推运 / 行运）
  // cross: [{ lonA, lonB, type, name, orb }] — lonA 为本命黄经（内圈）、lonB 为推运黄经（外圈）
  // 半径层级（自内向外）：内圈行星 200 → 内圈宫位线 200-232 → 外圈行星 250(轨道环线) → 外圈宫位线 264-286 → 星座带 292-340
  var BW_ZO = 340, BW_ZI = 292, BW_B = 250, BW_DIV = 232, BW_B_DIV = 286, BW_B_HOUSE = 264, BW_A = 200, BW_A_DEG = 179, BW_ASP = 146;

  function ascLabel(a) {
    var g = (a.sign && a.sign.index !== undefined) ? (SIGN_GLYPHS[a.sign.index] || '') : '';
    var d = (a.sign && a.sign.deg !== undefined) ? a.sign.deg : 0;
    return 'ASC' + g + (a.sign ? d + '\u00B0' : '');
  }

  function renderBiWheel(cA, cB, cross, container) {
    var asc = cA.asc.lon;
    var s = '<svg class="wheel-svg" viewBox="0 0 ' + SIZE + ' ' + SIZE + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:640px;height:auto;display:block">';
    s += '<circle class="w-bg" cx="' + C + '" cy="' + C + '" r="' + (BW_ZO + 12) + '"/>';
    s += '<circle class="w-band" cx="' + C + '" cy="' + C + '" r="' + BW_ZO + '"/>';
    s += '<circle class="w-ring" cx="' + C + '" cy="' + C + '" r="' + BW_ZI + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + BW_B_DIV + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + BW_DIV + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + BW_ASP + '"/>';
    s += '<circle class="w-ring-soft" cx="' + C + '" cy="' + C + '" r="' + BW_B + '"/>';

    // 星座分隔与符号：按真实黄经绘制（不叠加 asc），星座环随本命 ASC 旋转，ASC 恒在左侧 9 点钟
    for (var i = 0; i < 12; i++) {
      var lineLon = i * 30;
      var p1 = pt(lineLon, BW_ZI, asc), p2 = pt(lineLon, BW_ZO, asc);
      s += '<line class="w-sep" x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '"/>';
      var gp = pt(i * 30 + 15, (BW_ZO + BW_ZI) / 2, asc);
      s += '<text class="' + ELE_CLASS[i % 4] + '" x="' + gp.x.toFixed(1) + '" y="' + (gp.y + 10).toFixed(1) + '" text-anchor="middle" font-size="24">' + SIGN_GLYPHS[i] + '</text>';
    }

    // 内圈（A）宫位线：自内圈行星环到双盘分隔环
    for (var h = 1; h <= 12; h++) {
      var lon = cA.houses[h];
      var q1 = pt(lon, BW_A, asc), q2 = pt(lon, BW_DIV, asc);
      var isAngle = (h === 1 || h === 4 || h === 7 || h === 10);
      s += '<line class="' + (isAngle ? 'w-house-angle' : 'w-house') + '" x1="' + q1.x.toFixed(1) + '" y1="' + q1.y.toFixed(1) + '" x2="' + q2.x.toFixed(1) + '" y2="' + q2.y.toFixed(1) + '"/>';
      var nextLon = cA.houses[h % 12 + 1];
      var span = ((nextLon - lon) % 360 + 360) % 360;
      var hp = pt(lon + span / 2, (BW_A + BW_DIV) / 2, asc);
      s += '<text class="w-dim" x="' + hp.x.toFixed(1) + '" y="' + (hp.y + 4).toFixed(1) + '" text-anchor="middle" font-size="11">' + h + '</text>';
    }

    // 外圈（B）宫位线：自外圈行星环到星座带内缘（法达无宫位，houses 为空时跳过）
    for (var h = 1; h <= 12; h++) {
      var lon = cB.houses[h];
      if (lon === undefined || lon === null) continue;
      var q1 = pt(lon, BW_B_HOUSE, asc), q2 = pt(lon, BW_B_DIV, asc);
      var isAngle = (h === 1 || h === 4 || h === 7 || h === 10);
      s += '<line class="' + (isAngle ? 'w-house-angle' : 'w-house') + '" x1="' + q1.x.toFixed(1) + '" y1="' + q1.y.toFixed(1) + '" x2="' + q2.x.toFixed(1) + '" y2="' + q2.y.toFixed(1) + '"/>';
      var nextLon = cB.houses[h % 12 + 1];
      if (nextLon === undefined || nextLon === null) continue;
      var span = ((nextLon - lon) % 360 + 360) % 360;
      var hp = pt(lon + span / 2, (BW_B_HOUSE + BW_B_DIV) / 2, asc);
      s += '<text class="w-dim" x="' + hp.x.toFixed(1) + '" y="' + (hp.y + 4).toFixed(1) + '" text-anchor="middle" font-size="11">' + h + '</text>';
    }

    // 跨盘相位线（内圈本命行星 <-> 外圈推运行星，按各自黄经连线）
    cross.forEach(function (a) {
      var P1 = pt(a.lonA, BW_A, asc), P2 = pt(a.lonB, BW_B, asc);
      var tense = (a.type === 'square' || a.type === 'opp');
      var cls = tense ? 'w-asp-t' : (a.type === 'trine' || a.type === 'sextile' ? 'w-asp-h' : 'w-asp-x');
      var dash = tense ? ' stroke-dasharray="5,4"' : '';
      var w = a.orb < 3 ? 1.8 : 1;
      s += '<line class="' + cls + '" x1="' + P1.x.toFixed(1) + '" y1="' + P1.y.toFixed(1) + '" x2="' + P2.x.toFixed(1) + '" y2="' + P2.y.toFixed(1) + '" stroke-width="' + w + '"' + dash + ' opacity="0.5"/>';
    });

    // 外圈（B）行星（ASC/MC 单独绘制保证黄经精确）
    var placedB = [];
    if (cB.asc && cB.asc.lon !== undefined && cB.asc.lon !== null) placedB.push(cB.asc.lon);
    if (cB.mc && cB.mc.lon !== undefined && cB.mc.lon !== null) placedB.push(cB.mc.lon);
    (cB.points || []).forEach(function (p) {
      var lon = p.lon, tries = 0;
      while (placedB.some(function (q) { var d = Math.abs(((q - lon) % 360 + 360) % 360); return d < 8; }) && tries < 6) { lon += 7; tries++; }
      placedB.push(lon);
      var pos = pt(lon, BW_B, asc);
      var tick1 = pt(p.lon, BW_ZI - 2, asc), tick2 = pt(p.lon, BW_ZI - 12, asc);
      s += '<line class="w-tick" x1="' + tick1.x.toFixed(1) + '" y1="' + tick1.y.toFixed(1) + '" x2="' + tick2.x.toFixed(1) + '" y2="' + tick2.y.toFixed(1) + '"/>';
      s += '<text class="w-planet w-halo" x="' + pos.x.toFixed(1) + '" y="' + (pos.y + 6).toFixed(1) + '" text-anchor="middle" font-size="18">' + p.glyph + (p.retro ? '\u211E' : '') + '</text>';
      if (p.sign && p.sign.deg !== undefined) {
        var dp = pt(p.lon, BW_B - 10, asc);
        s += '<text class="w-dim" x="' + dp.x.toFixed(1) + '" y="' + (dp.y + 4).toFixed(1) + '" text-anchor="middle" font-size="10">' + p.sign.deg + '\u00B0</text>';
      }
    });
    if (cB.asc && cB.asc.lon !== undefined && cB.asc.lon !== null) {
      var posA = pt(cB.asc.lon, BW_B, asc);
      s += '<text class="w-planet w-halo" x="' + posA.x.toFixed(1) + '" y="' + (posA.y + 5).toFixed(1) + '" text-anchor="middle" font-size="13">' + ascLabel(cB.asc) + '</text>';
    }
    if (cB.mc && cB.mc.lon !== undefined && cB.mc.lon !== null) {
      var posM = pt(cB.mc.lon, BW_B, asc);
      s += '<text class="w-planet w-halo" x="' + posM.x.toFixed(1) + '" y="' + (posM.y + 5).toFixed(1) + '" text-anchor="middle" font-size="13">MC</text>';
    }

    // 内圈（A）行星（ASC/MC 于盘外标注）
    var placedA = [];
    cA.points.forEach(function (p) {
      var lon = p.lon, tries = 0;
      while (placedA.some(function (q) { var d = Math.abs(((q - lon) % 360 + 360) % 360); return d < 8; }) && tries < 6) { lon += 7; tries++; }
      placedA.push(lon);
      var pos = pt(lon, BW_A, asc);
      var fs = (p.key === 'asc' || p.key === 'mc') ? 13 : 19;
      s += '<text class="w-planet w-halo" x="' + pos.x.toFixed(1) + '" y="' + (pos.y + 6).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '">' + p.glyph + (p.retro ? '\u211E' : '') + '</text>';
      if (p.key !== 'asc' && p.key !== 'mc') {
        var dp = pt(lon, BW_A_DEG, asc);
        s += '<text class="w-dim" x="' + dp.x.toFixed(1) + '" y="' + (dp.y + 4).toFixed(1) + '" text-anchor="middle" font-size="10">' + p.sign.deg + '\u00B0</text>';
      }
    });

    var ascP = pt(cA.asc.lon, BW_ZO + 22, asc);
    s += '<text class="w-planet w-halo" x="' + ascP.x.toFixed(1) + '" y="' + (ascP.y + 5).toFixed(1) + '" text-anchor="middle" font-size="14">' + ascLabel(cA.asc) + '</text>';
    var mcP = pt(cA.mc.lon, BW_ZO + 22, asc);
    s += '<text class="w-planet w-halo" x="' + mcP.x.toFixed(1) + '" y="' + (mcP.y + 5).toFixed(1) + '" text-anchor="middle" font-size="14">MC</text>';

    s += '</svg>';
    container.innerHTML = s;
  }

  root.ChartRender = { renderChart: renderChart, prepareChart: prepareChart, renderBiWheel: renderBiWheel };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ChartRender;
})(typeof window !== 'undefined' ? window : globalThis);
